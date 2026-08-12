# Loupe

**A deep-research agent that shows its work.** Ask a research question; Loupe plans
sub-questions, gathers evidence from a curated corpus and (optionally) the live web,
grades whether the evidence is sufficient, iterates when it isn't, writes a cited
answer — then **audits every claim in its own answer against the evidence it cited**,
and refuses to answer when the evidence doesn't hold up.

<!-- Record a short screen capture of a Deep query (answer streaming + claim audit +
     refusal on an unanswerable question) and drop it here: -->
![Loupe demo](docs/demo.gif)

> **Why refusal is a feature.** LLM answers are cheap; *auditable* answers are not.
> Most RAG demos will confidently answer anything. Loupe decomposes its own answer into
> atomic claims, checks each against the specific sources it cited, shows a per-claim
> verdict (`SUPPORTED` / `PARTIAL` / `UNSUPPORTED`), and declines — showing its best
> evidence and which sub-questions lacked support — rather than fabricate. Not answering
> is the point.

## What it does

- **Plans** — Deep-mode questions are decomposed into ≤3 sub-questions.
- **Retrieves** — hybrid dense (Pinecone + Gemini embeddings) + BM25 with normalized
  score fusion, over a curated corpus of AI/RAG literature; optional Tavily web search
  in Deep mode.
- **Grades & iterates** — an LLM grades evidence sufficiency per sub-question and
  rewrites queries to fill gaps (bounded loop).
- **Synthesizes** — a streamed, markdown answer with inline `[S1]`, `[S2]` citations.
- **Verifies** — a separate pass audits each claim against its cited evidence and
  refuses when support is weak (> 30% claims unsupported, or no sufficient evidence
  within budget).
- **Bounds everything** — a budget governor caps LLM calls, tokens, web fetches, and
  wall-clock per request, and every call is traced and attributed to a graph node.

## Architecture

```mermaid
flowchart TD
    Q[POST /api/research] --> IN[intake: classify + route]
    IN -->|smalltalk / out-of-domain| FIN
    IN -->|quick| RET
    IN -->|deep| PLAN[plan: sub-questions ≤3]
    PLAN --> HITL{approve web?}
    HITL -->|approved| RET[retrieve: hybrid corpus tool + web tool]
    RET --> GRADE[grade: evidence sufficiency]
    GRADE -->|insufficient & budget left| REW[rewrite: refine queries]
    REW --> RET
    GRADE -->|sufficient or budget exhausted| SYN[synthesize: streamed cited answer]
    SYN --> VER[verify: claim audit vs cited evidence]
    VER --> FIN[finalize: answer | refusal + ledger]
```

A LangGraph `StateGraph` drives the loop; nodes are plain Python functions. The graph
is checkpointed to SQLite so Deep-mode human-in-the-loop interrupts can resume and
follow-ups share state. Provider SDKs (Gemini, Pinecone, Tavily) live behind adapter
Protocols.

- **Backend**: FastAPI + LangGraph + `google-genai`, streamed over SSE. `backend/app/`.
- **Frontend**: React 18 + Vite + Tailwind — a conversation pane and an investigation
  panel (agent timeline, evidence drawer, claim-audit table, usage meter). `frontend/src/`.

### Design decisions worth defending

- **Verification is a distinct node**, not a synthesis instruction — a separate temp-0
  structured pass over already-generated text is auditable and testable in isolation.
- **Refusal on weak support** (> 30% claims `UNSUPPORTED`) rather than an ignorable
  confidence caveat. The refusal card shows the best evidence found.
- **No cross-encoder reranker** — hybrid fusion + the LLM evidence-grading node *is* the
  reranking story, and grading also drives the refusal decision. A 512 MB free instance
  can't hold a reranker; documented tradeoff, not an oversight.
- **Model routing** — a cheap `flash-lite` for control flow (intake/grade/rewrite/verify),
  `flash` for synthesis and the judge. Overridable via `MODEL_CONTROL` / `MODEL_SYNTH`.
- **Budget enforced as `ledger.check()` before each node**, not as a node — exceeding it
  routes to `finalize`, which still surfaces a partial draft plus the ledger.
- **Ports and adapters** — `LLMClient`, `VectorStore`, `WebSearch`, `Embedder` are
  Protocols; SDK types never leak past an adapter, and no unit test touches the network
  (`pytest-socket`).
- **Prompts as versioned markdown** with `id`/`version` frontmatter; `prompt_id@version`
  is logged into every trace.

## Quickstart

### Run with Docker (one command)

The whole app runs locally with Docker Compose. nginx serves the built frontend and
proxies `/api` to the backend, so everything is same-origin (no CORS config).

1. Create `backend/.env` from `backend/.env.example` and fill in `GEMINI_API_KEY`
   (plus `PINECONE_API_KEY` for dense retrieval; Tavily and Langfuse keys are optional).
2. `docker compose up --build`
3. Open http://localhost:8080

The committed corpus index (`data/index/chunks.jsonl`) ships in the image, so no ingest
step is needed. The LangGraph checkpointer DB is ephemeral (lost on container restart)
by design.

### Run manually

**Backend** (Python 3.11, [uv](https://docs.astral.sh/uv/)):

```bash
cd backend
uv sync                              # installs from uv.lock
cp .env.example .env                 # then fill in GEMINI_API_KEY (+ PINECONE_API_KEY)
uv run uvicorn app.main:app --reload # → http://localhost:8000
```

**Frontend** (Node 20):

```bash
cd frontend
npm install
# Optional: create frontend/.env with VITE_API_BASE_URL=http://localhost:8000
# (defaults to http://localhost:8000 when unset).
npm run dev                          # → http://localhost:5173
```

## Use Loupe from Claude Desktop (MCP)

Loupe is also an MCP server (`backend/mcp_server.py`, FastMCP over stdio) exposing two
tools:

- `search_corpus(query, top_k=5)` — hybrid corpus retrieval, returns evidence.
- `research(question)` — runs the full agent (quick mode) and returns
  `{answer_md, outcome, claims, sources}`.

Add this to your Claude Desktop config (`claude_desktop_config.json`), pointing `cwd`
at the `backend/` directory and setting the API keys in `env`:

```json
{
  "mcpServers": {
    "loupe": {
      "command": "uv",
      "args": ["run", "python", "mcp_server.py"],
      "cwd": "/absolute/path/to/agentic-rag/backend",
      "env": {
        "GEMINI_API_KEY": "your-gemini-api-key",
        "PINECONE_API_KEY": "your-pinecone-api-key"
      }
    }
  }
}
```

Restart Claude Desktop; the `search_corpus` and `research` tools then appear. Because
`research` runs the graph without streaming, allow up to ~60 s per call.

## Observability

Set `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and `LANGFUSE_HOST` to enable
[Langfuse](https://langfuse.com) tracing: one trace per request, a span per graph node,
and a generation per LLM call (model, tokens, latency, `prompt_id@version`). With the
keys unset, a no-op tracer is used and `/api/health` reports `"tracing": false` — no
network calls, no overhead. A server-side cost ledger is exposed to the UI on every
request via the `usage` SSE event.

## Evaluation

Evaluation is a first-class deliverable, in two layers, both driven by hand-curated
golden sets under `data/eval/`:

- **Deterministic retrieval eval** (`scripts/run_retrieval_eval.py`) — 40 golden
  questions across five categories (definitional, comparative, specific-fact, multi-hop,
  unanswerable), scored over the 35 answerable items. Runs offline (local numpy vector
  store + real BM25 + production fusion, zero network/LLM) and **gates CI**: fails when
  `recall@5` drops more than 0.02 below the committed ratchet in
  `data/eval/baselines.json`. Metrics: recall@5/@10, MRR@10, nDCG@10, overall and per
  category. Requires a one-time fixture build (`scripts/build_eval_fixtures.py`, needs a
  Gemini key); committed embedding fixtures carry corpus + question hashes so drift fails
  loudly.
- **Judged generation eval** (`scripts/run_generation_eval.py`) — 25 items (20 answerable
  + 5 not) run through the full agent against live APIs; a separate temp-0 judge pass
  scores faithfulness (1–5), key-fact coverage, and correct-refusal. Capped at 150 LLM
  calls per run. Human-reviewed, never a merge gate (nondeterministic + shared-vendor
  judge, mitigated by the adapter seam).

```bash
cd backend
uv run python scripts/build_eval_fixtures.py       # one-time, needs GEMINI_API_KEY
uv run python scripts/run_retrieval_eval.py        # evaluate + gate
uv run python scripts/run_retrieval_eval.py --update-baselines   # bump the ratchet
```

Metric definitions live in `app/eval/metrics.py` and are unit-tested offline in
`tests/unit/test_eval_metrics.py`.

> **Note:** both GitHub workflows (`ci.yml`, `nightly-eval.yml`) are currently
> `workflow_dispatch`-only — automatic PR/nightly runs are deliberately disabled to avoid
> Actions/API cost on this deployment. Trigger them manually, or restore the `push`/
> `pull_request`/`schedule` triggers noted in the workflow files to re-enable the gates.

## Deployment

Deploys as two pieces on free/low-cost tiers:

- **Backend → Heroku** (container stack, built from `backend/Dockerfile` via `heroku.yml`).
- **Frontend → Vercel** (static Vite build from `frontend/`).

Production config (see `backend/.env.example` for the annotated full list): set
`GEMINI_API_KEY`, `PINECONE_API_KEY`, `APP_ENV=production`, `CORS_ORIGINS` to the deployed
frontend origin (never `*`), `TRUSTED_PROXY=1` for the Heroku router hop, and
`REQUIRE_DEEP_APPROVAL` / `REQUIRE_HCAPTCHA` to `true`. The frontend needs
`VITE_API_BASE_URL` pointing at the backend. Smoke-test a deploy against `/api/health`.

## Security

- No public ingest endpoint (the old LFI vector is gone); ingestion is a local CLI.
- Web content is treated as untrusted: sanitized, length-capped, wrapped in tags the
  prompts are instructed never to obey, and injection-flagged (`trust: "low"`, excluded
  from synthesis).
- hCaptcha + per-IP and global rate limiting on `/api/research`; trusted-proxy-aware
  client-IP resolution; generic error messages.
- A global daily request cap acts as a spend kill-switch under distributed abuse.
- CORS locked to an explicit origin list (never `*`); no secrets reach the client.

The sanitizer and access-control layers live in `backend/app/security/` and are covered by
canary unit tests (`tests/unit/test_sanitize.py`, `test_access.py`) so the injection
defenses fail deterministically rather than silently.

## Limitations (honest)

- **Single instance**: the rate limiter and thread store are in-process and reset on
  restart. Redis is the first thing to add when scaling past one instance.
- **Ephemeral threads**: SQLite checkpointer on ephemeral disk — follow-up context is
  lost across redeploys, by design.
- **No reranker**: fusion + LLM evidence grading is the reranking story (deliberate; a
  512 MB free instance can't hold a cross-encoder).
- **Shared-vendor judge**: the generation-eval judge shares a vendor with the generator;
  mitigated by the adapter seam and the deterministic retrieval gate.
- **Fixed corpus**: 46 curated AI/RAG documents (92 chunks); no live corpus expansion.
- **Free-tier limits**: Gemini RPM (~15) means sequential calls with backoff on 429 plus
  an exact-match response cache; cold starts on sleeping dynos.

## Where the code lives

| Path | What |
|---|---|
| `backend/app/agent/` | Graph definition, state, budget governor, and the 9 nodes |
| `backend/app/adapters/` | The SDK boundary — Gemini, Pinecone, Tavily behind Protocols |
| `backend/app/retrieval/` | Pure BM25 / fusion / chunking logic (unit-tested, no I/O) |
| `backend/app/prompts/` | Versioned markdown prompts + registry |
| `backend/app/security/` | Sanitizer, injection flagging, rate limiting, access control |
| `backend/app/eval/` | Metrics, fixtures, and the eval harness |
| `backend/tests/unit/` | 104 network-free unit tests (`pytest-socket`) |
| `frontend/src/` | React conversation pane + investigation panel |
