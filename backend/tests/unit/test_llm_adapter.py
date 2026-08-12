"""GeminiLLM budget gating and retry classification — stubbed client, no network."""

import pytest
from pydantic import BaseModel

from app.adapters.llm import GeminiLLM
from app.agent import budget
from app.agent.errors import BudgetExceeded, NodeOutputError


class _Schema(BaseModel):
    value: str


class _Response:
    def __init__(self, text: str) -> None:
        self.text = text
        self.parsed = None
        self.usage_metadata = None


class _Models:
    """Stub of ``client.models`` yielding queued responses (or raising queued errors)."""

    def __init__(self, outcomes: list) -> None:
        self._outcomes = list(outcomes)
        self.calls = 0

    def generate_content(self, **kwargs):
        self.calls += 1
        outcome = self._outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


class _Client:
    def __init__(self, outcomes: list) -> None:
        self.models = _Models(outcomes)


def _adapter(outcomes: list) -> GeminiLLM:
    llm = GeminiLLM.__new__(GeminiLLM)  # skip __init__: no key, no real client
    llm._client = _Client(outcomes)
    return llm


def test_budget_precheck_blocks_before_the_provider_is_called():
    llm = _adapter([_Response('{"value": "ok"}')])
    ledger = budget.new_ledger("quick")
    ledger.llm_calls = budget.MAX_LLM_CALLS
    with pytest.raises(BudgetExceeded):
        llm.generate_json("p", _Schema, ledger=ledger)
    assert llm._client.models.calls == 0  # no billable request was issued


def test_budget_precheck_gates_generate_and_stream_too():
    ledger = budget.new_ledger("quick")
    ledger.input_tokens = budget.MAX_TOTAL_TOKENS
    llm = _adapter([_Response("x")])
    with pytest.raises(BudgetExceeded):
        llm.generate("p", ledger=ledger)
    with pytest.raises(BudgetExceeded):
        list(llm.generate_stream("p", ledger=ledger))
    assert llm._client.models.calls == 0


def test_provider_error_is_not_retried():
    llm = _adapter([RuntimeError("quota exhausted"), _Response('{"value": "ok"}')])
    with pytest.raises(RuntimeError):
        llm.generate_json("p", _Schema, ledger=budget.new_ledger())
    assert llm._client.models.calls == 1  # no second billable attempt


def test_malformed_json_is_retried_once_then_surfaces_typed_error():
    llm = _adapter([_Response("not json"), _Response("still not json")])
    with pytest.raises(NodeOutputError):
        llm.generate_json("p", _Schema, ledger=budget.new_ledger())
    assert llm._client.models.calls == 2


def test_malformed_json_then_valid_output_recovers():
    llm = _adapter([_Response("not json"), _Response('{"value": "ok"}')])
    result = llm.generate_json("p", _Schema, ledger=budget.new_ledger())
    assert result.value == "ok"
    assert llm._client.models.calls == 2
