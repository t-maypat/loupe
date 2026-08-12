"""Per-thread / global run-slot guard on the research routes."""

import pytest
from fastapi import HTTPException

from app.api.routes import research
from app.core.config import settings

_T1 = "a" * 32
_T2 = "b" * 32


@pytest.fixture(autouse=True)
def _clean_slots():
    research._active_threads.clear()
    research._active_runs = 0
    yield
    research._active_threads.clear()
    research._active_runs = 0


def test_second_run_on_same_thread_is_rejected_409():
    research._acquire_run(_T1)
    with pytest.raises(HTTPException) as exc:
        research._acquire_run(_T1)
    assert exc.value.status_code == 409


def test_global_capacity_is_rejected_503(monkeypatch):
    monkeypatch.setattr(settings, "max_concurrent_runs", 1)
    research._acquire_run(_T1)
    with pytest.raises(HTTPException) as exc:
        research._acquire_run(_T2)
    assert exc.value.status_code == 503


def test_release_frees_both_slots():
    research._acquire_run(_T1)
    research._release_run(_T1)
    research._acquire_run(_T1)  # no raise
    research._release_run(_T1)


async def test_guarded_releases_on_generator_close():
    async def infinite():
        while True:
            yield {"event": "token", "data": {}}

    research._acquire_run(_T1)
    guarded = research._guarded(_T1, infinite())
    assert (await guarded.__anext__())["event"] == "token"
    await guarded.aclose()  # client disconnect
    assert _T1 not in research._active_threads
    assert research._active_runs == 0
