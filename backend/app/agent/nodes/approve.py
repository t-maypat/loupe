"""Approve (deep mode HITL gate, REVAMP_PLAN §1.1 / §3).

Sits between plan and retrieve. When ``REQUIRE_DEEP_APPROVAL`` is set, the node
calls LangGraph's :func:`interrupt`, pausing the run: the stream ends and the
client must confirm via ``POST /api/research/{thread_id}/approve``. The route
resumes with ``Command(resume={"approved": bool})``, whose value is returned here.

When approval is disabled (dev default) the node is a pass-through, so it needs no
checkpointer and unit tests exercising the deep path stay simple.
"""

from typing import Any, Literal

from langgraph.types import Command, interrupt

from app.agent import events
from app.agent.deps import NodeConfig
from app.agent.state import ResearchState
from app.core.config import settings

APPROVE_REASON = "approve_web_research"
APPROVE_MESSAGE = "This will search the live web and use more budget — proceed?"
DECLINE_MESSAGE = "Web research was declined, so I did not search the live web."


def _approved(decision: Any) -> bool:
    if isinstance(decision, dict):
        return bool(decision.get("approved"))
    return bool(decision)


def approve(state: ResearchState, config: NodeConfig) -> Command[Literal["retrieve", "finalize"]]:
    if not settings.require_deep_approval:
        events.stage_start("approve")
        events.stage_end("approve", "auto-approved → retrieve", 0)
        return Command(goto="retrieve")

    # interrupt() raises on the first execution (pausing the run before the stage
    # events fire) and returns the resume value when the node re-executes, so the
    # start/end pair below is emitted exactly once — on the resumed run. Elapsed
    # is 0 by design: the wait is human decision time, not compute.
    decision = interrupt({"reason": APPROVE_REASON, "message": APPROVE_MESSAGE})
    events.stage_start("approve")
    if _approved(decision):
        events.stage_end("approve", "approved → retrieve", 0)
        return Command(goto="retrieve")
    # User declined live web research → graceful refusal carrying an explanation
    # (finalize surfaces ``redirect_message`` for a preset refusal, §6).
    events.stage_end("approve", "declined → refusal", 0)
    update: dict[str, Any] = {"outcome": "refused", "redirect_message": DECLINE_MESSAGE}
    return Command(goto="finalize", update=update)
