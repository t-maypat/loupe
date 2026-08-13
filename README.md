<div align="center">

# Loupe

### A deep-research agent that shows its work.

Ask a research question. Loupe plans sub-questions, gathers evidence from a curated corpus
and optionally the live web, grades whether that evidence is sufficient, iterates when it is
not, and writes a cited answer. Then it audits every claim in its own answer against the
evidence it cited, and refuses to answer when the evidence does not hold up.

<br>

<img src="https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python 3.11">
<img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI 0.115">
<img src="https://img.shields.io/badge/LangGraph-0.4-1C3C3C?style=flat-square&logo=langchain&logoColor=white" alt="LangGraph 0.4">
<img src="https://img.shields.io/badge/Gemini-flash-8E75B2?style=flat-square&logo=googlegemini&logoColor=white" alt="Google Gemini">
<img src="https://img.shields.io/badge/Pinecone-vector%20db-000000?style=flat-square" alt="Pinecone">

<img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React 18">
<img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript 5.6">
<img src="https://img.shields.io/badge/Vite-8.2-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite 8.2">
<img src="https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind 3.4">
<img src="https://img.shields.io/badge/Node.js-20+-5FA04E?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js 20+">

<img src="https://img.shields.io/badge/Docker-compose-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker Compose">
<img src="https://img.shields.io/badge/Heroku-backend-430098?style=flat-square&logo=heroku&logoColor=white" alt="Heroku">
<img src="https://img.shields.io/badge/Vercel-frontend-000000?style=flat-square&logo=vercel&logoColor=white" alt="Vercel">
<img src="https://img.shields.io/badge/pytest-104%20offline-0A9EDC?style=flat-square&logo=pytest&logoColor=white" alt="104 offline unit tests">
<img src="https://img.shields.io/badge/MCP-Claude%20Desktop-D97757?style=flat-square&logo=anthropic&logoColor=white" alt="MCP server">

<br>

**[Quickstart](#quickstart)** · **[Architecture](#architecture)** · **[Evaluation](#evaluation)** · **[Security](#security)** · **[Deployment](#deployment)** · **[Limitations](#limitations-honest)**

</div>

<!-- Demo capture goes here. Record a short screen capture of a Deep query showing the
     answer streaming, the claim audit, and a refusal on an unanswerable question, save it
     to docs/demo.gif, then uncomment the line below.
![Loupe demo](docs/demo.gif)
-->

---

> ### Why refusal is a feature
>
> LLM answers are cheap. Auditable answers are not. Most RAG demos will confidently answer
> anything you ask them. Loupe decomposes its own answer into atomic claims, checks each one
> against the specific sources it cited, shows a per-claim verdict (`SUPPORTED`, `PARTIAL`,
> or `UNSUPPORTED`), and declines rather than fabricate, showing its best evidence and which
> sub-questions lacked support. Not answering is the point.

## At a glance

| | |
|---|---|
| **Corpus** | 46 curated AI and RAG documents, 92 chunks |
| **Retrieval** | Dense (Pinecone + Gemini embeddings) and BM25, merged by normalized score fusion |
| **Planning** | Up to 3 sub-questions per deep-mode question |
| **Budget per run** | 10 LLM calls, 80k tokens, 3 web fetches, wall-clock cap |
| **Latency** | About 15s in quick mode, about 90s in deep mode |
| **Refusal rule** | More than 30% of claims `UNSUPPORTED`, or no sufficient evidence within budget |
| **Retrieval eval** | 40 golden questions, 35 answerable, ratcheted CI gate on recall@5 |
| **Generation eval** | 25 judged items, capped at 150 LLM calls per run |
| **Tests** | 104 unit tests, none of which touch the network |

## What it does

- **Plans.** Deep-mode questions are decomposed into at most 3 sub-questions.
- **Retrieves.** Hybrid dense (Pinecone + Gemini embeddings) and BM25 with normalized score
  fusion, over a curated corpus of AI and RAG literature. Tavily web search is available in
  deep mode.
- **Grades and iterates.** An LLM grades evidence sufficiency per sub-question and rewrites
  queries to fill the gaps, in a bounded loop.
- **Synthesizes.** A streamed markdown answer with inline `[S1]`, `[S2]` citations.
- **Verifies.** A separate pass audits each claim against its cited evidence and refuses
  when support is weak.
- **Bounds everything.** A budget governor caps LLM calls, tokens, web fetches, and
  wall-clock per request. Every call is traced and attributed to a graph node.

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

A LangGraph `StateGraph` drives the loop, and the nodes are plain Python functions. The graph
is checkpointed to SQLite so deep-mode human-in-the-loop interrupts can resume and follow-ups
share state. Provider SDKs (Gemini, Pinecone, Tavily) live behind adapter Protocols.

| Layer | Stack | Path |
|---|---|---|
| **Backend** | FastAPI, LangGraph, `google-genai`, streamed over SSE | `backend/app/` |
| **Frontend** | React 18, Vite, TypeScript, Tailwind | `frontend/src/` |
| **Retrieval** | Pinecone dense vectors, `rank-bm25`, custom fusion | `backend/app/retrieval/` |
| **Interface** | Conversation pane plus an investigation panel: agent timeline, evidence drawer, claim-audit table, usage meter | `frontend/src/components/` |

### Design decisions worth defending

- **Verification is a distinct node**, not a synthesis instruction. A separate temp-0
  structured pass over already-generated text is auditable and testable in isolation.
- **Refusal on weak support** (more than 30% of claims `UNSUPPORTED`) rather than an
  ignorable confidence caveat. The refusal card shows the best evidence found.
- **No cross-encoder reranker.** Hybrid fusion plus the LLM evidence-grading node is the
  reranking story, and grading also drives the refusal decision. A 512 MB free instance
  cannot hold a reranker. This is a documented tradeoff, not an oversight.
- **Model routing.** A cheap `flash-lite` handles control flow (intake, grade, rewrite,
  verify), and `flash` handles synthesis and the judge. Override with `MODEL_CONTROL` and
  `MODEL_SYNTH`.
- **Budget enforced as `ledger.check()` before each node**, not as a node of its own.
  Exceeding it routes to `finalize`, which still surfaces a partial draft plus the ledger.
- **Ports and adapters.** `LLMClient`, `VectorStore`, `WebSearch`, and `Embedder` are
  Protocols. SDK types never leak past an adapter, and no unit test touches the network
  (enforced by `pytest-socket`).
- **Prompts as versioned markdown** with `id` and `version` frontmatter. The
  `prompt_id@version` is logged into every trace.

## Quickstart

### Run with Docker

The whole app runs locally with Docker Compose. nginx serves the built frontend and proxies
`/api` to the backend, so everything is same-origin and there is no CORS config to set.

```bash
cp backend/.env.example backend/.env   # then fill in GEMINI_API_KEY
docker compose up --build              # open http://localhost:8080
```

`GEMINI_API_KEY` is required. `PINECONE_API_KEY` enables dense retrieval; without it, retrieval
runs BM25-only. Tavily and Langfuse keys are optional.

The committed corpus index (`data/index/chunks.jsonl`) ships in the image, so there is no
ingest step. The LangGraph checkpointer DB is ephemeral and is lost on container restart, by
design.

### Run manually

<table>
<tr><th align="left">Backend (Python 3.11, <a href="https://docs.astral.sh/uv/">uv</a>)</th><th align="left">Frontend (Node 20+)</th></tr>
<tr valign="top">
<td>

```bash
cd backend
uv sync
cp .env.example .env
uv run uvicorn app.main:app --reload
```

Serves on `http://localhost:8000`.

</td>
<td>

```bash
cd frontend
npm ci --ignore-scripts
npm run dev
```

Serves on `http://localhost:5173`.

</td>
</tr>
</table>

The frontend defaults to `http://localhost:8000` for the API. Override it by creating
`frontend/.env` with `VITE_API_BASE_URL`.

## Use Loupe from Claude Desktop (MCP)

Loupe is also an MCP server (`backend/mcp_server.py`, FastMCP over stdio) exposing two tools:

| Tool | What it does |
|---|---|
| `search_corpus(query, top_k=5)` | Hybrid corpus retrieval. Returns evidence chunks. |
| `research(question)` | Runs the full agent in quick mode. Returns `{answer_md, outcome, claims, sources}`. |

<details>
<summary><b>Claude Desktop config</b></summary>

Add this to `claude_desktop_config.json`, pointing `cwd` at the `backend/` directory:

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

Restart Claude Desktop and the two tools appear. Because `research` runs the graph without
streaming, allow up to about 60 seconds per call.

</details>

## Observability

Set `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and `LANGFUSE_HOST` to enable
[Langfuse](https://langfuse.com) tracing: one trace per request, a span per graph node, and a
generation per LLM call recording model, tokens, latency, and `prompt_id@version`.

With those keys unset a no-op tracer is used and `/api/health` reports `"tracing": false`.
No network calls, no overhead. A server-side cost ledger is exposed to the UI on every request
through the `usage` SSE event.

## Evaluation

Evaluation is a first-class deliverable, in two layers, both driven by hand-curated golden
sets under `data/eval/`.

**Deterministic retrieval eval** (`scripts/run_retrieval_eval.py`) covers 40 golden questions
across five categories (definitional, comparative, specific-fact, multi-hop, unanswerable),
scored over the 35 answerable items. It runs fully offline using a local numpy vector store,
real BM25, and the production fusion code, with zero network and zero LLM calls.

It **gates CI**: the run fails when `recall@5` drops more than 0.02 below the ratchet in
`data/eval/baselines.json`, which you create once with `--update-baselines` and then commit.
Metrics are recall@5, recall@10, MRR@10, and nDCG@10, reported
overall and per category. It requires a one-time fixture build, and the committed embedding
fixtures carry corpus and question hashes so drift fails loudly instead of silently.

**Judged generation eval** (`scripts/run_generation_eval.py`) runs 25 items (20 answerable and
5 not) through the full agent against live APIs. A separate temp-0 judge pass scores
faithfulness on a 1 to 5 scale, key-fact coverage, and correct refusal, capped at 150 LLM calls
per run. It is human-reviewed and deliberately never a merge gate, because it is
nondeterministic and the judge shares a vendor with the generator.

```bash
cd backend
uv run python scripts/build_eval_fixtures.py                   # one-time, needs GEMINI_API_KEY
uv run python scripts/run_retrieval_eval.py                    # evaluate and gate
uv run python scripts/run_retrieval_eval.py --update-baselines # bump the ratchet
```

Metric definitions live in `app/eval/metrics.py` and are unit-tested offline in
`tests/unit/test_eval_metrics.py`.

> [!NOTE]
> Both GitHub workflows (`ci.yml`, `nightly-eval.yml`) are currently `workflow_dispatch`-only.
> Automatic PR and nightly runs are deliberately disabled to avoid Actions and API cost on this
> deployment. Trigger them manually, or restore the `push`, `pull_request`, and `schedule`
> triggers noted in the workflow files to re-enable the gates.

## Deployment

Deploys as two pieces on free or low-cost tiers.

| Piece | Target | Built from |
|---|---|---|
| Backend | Heroku, container stack | `backend/Dockerfile` via `heroku.yml` |
| Frontend | Vercel, static build | `frontend/` |

Production config, with the annotated full list in `backend/.env.example`: set `GEMINI_API_KEY`
and `PINECONE_API_KEY`, `APP_ENV=production`, `CORS_ORIGINS` to the deployed frontend origin
(never `*`), `TRUSTED_PROXY=1` for the Heroku router hop, and both `REQUIRE_DEEP_APPROVAL` and
`REQUIRE_HCAPTCHA` set to `true`. The frontend needs `VITE_API_BASE_URL` pointing at the
backend. Smoke-test any deploy against `/api/health`.

Full walkthrough in [docs/DEPLOY.md](docs/DEPLOY.md).

## Security

- **No public ingest endpoint.** The old LFI vector is gone. Ingestion is a local CLI.
- **Web content is treated as untrusted.** It is sanitized, length-capped, wrapped in tags the
  prompts are instructed never to obey, and injection-flagged. Flagged content is marked
  `trust: "low"` and excluded from synthesis.
- **hCaptcha and rate limiting** on `/api/research`, both per-IP and global, with
  trusted-proxy-aware client-IP resolution and generic error messages.
- **A global daily request cap** acts as a spend kill-switch under distributed abuse.
- **CORS locked to an explicit origin list**, never `*`. No secrets reach the client.

The sanitizer and access-control layers live in `backend/app/security/` and are covered by canary
unit tests (`tests/unit/test_sanitize.py`, `test_access.py`), so the injection defenses fail
deterministically rather than silently. More in [docs/SECURITY.md](docs/SECURITY.md).

## Limitations (honest)

- **Single instance.** The rate limiter and thread store are in-process and reset on restart.
  Redis is the first thing to add when scaling past one instance.
- **Ephemeral threads.** The SQLite checkpointer sits on ephemeral disk, so follow-up context
  is lost across redeploys. This is by design.
- **No reranker.** Fusion plus LLM evidence grading is the reranking story. Deliberate: a
  512 MB free instance cannot hold a cross-encoder.
- **Shared-vendor judge.** The generation-eval judge shares a vendor with the generator,
  mitigated by the adapter seam and the deterministic retrieval gate.
- **Fixed corpus.** 46 curated AI and RAG documents, 92 chunks, with no live corpus expansion.
- **Free-tier limits.** Gemini allows roughly 15 requests per minute, which means sequential
  calls with backoff on 429 plus an exact-match response cache. Sleeping dynos cold-start.

## Where the code lives

| Path | What |
|---|---|
| `backend/app/agent/` | Graph definition, state, budget governor, and the 9 nodes |
| `backend/app/adapters/` | The SDK boundary. Gemini, Pinecone, and Tavily behind Protocols |
| `backend/app/retrieval/` | Pure BM25, fusion, and chunking logic. Unit-tested, no I/O |
| `backend/app/prompts/` | Versioned markdown prompts plus the registry |
| `backend/app/security/` | Sanitizer, injection flagging, rate limiting, access control |
| `backend/app/eval/` | Metrics, fixtures, and the eval harness |
| `backend/tests/unit/` | 104 network-free unit tests (`pytest-socket`) |
| `frontend/src/pages/` | Landing page and the workspace |
| `frontend/src/components/` | Conversation pane and investigation panel |

## Further reading

| Doc | What |
|---|---|
| [docs/DESIGN.md](docs/DESIGN.md) | System design and the reasoning behind the graph |
| [docs/EVALS.md](docs/EVALS.md) | Eval methodology, golden sets, and metric definitions |
| [docs/SECURITY.md](docs/SECURITY.md) | Threat model and the defenses in place |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Step-by-step deployment |
| [docs/DEVELOPMENT_RETROSPECTIVE.md](docs/DEVELOPMENT_RETROSPECTIVE.md) | What went wrong, and what that taught |
