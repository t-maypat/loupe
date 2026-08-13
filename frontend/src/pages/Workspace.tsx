// The product surface: conversation + composer on the left, live investigation
// panel on the right. The marketing hero lives on the landing page, so the empty
// state here stays compact - it only has to get the first question typed.

import { useEffect, useMemo, useState } from "react";
import { AgentTimeline } from "../components/AgentTimeline";
import { AnswerPane } from "../components/AnswerPane";
import { ApproveModal } from "../components/ApproveModal";
import { BrandGlyph } from "../components/BrandGlyph";
import { ClaimAuditTable } from "../components/ClaimAuditTable";
import { EvidenceDrawer } from "../components/EvidenceDrawer";
import { QueryBar } from "../components/QueryBar";
import { UsageMeter } from "../components/UsageMeter";
import { useDockResize } from "../hooks/useDockResize";
import { useHcaptcha } from "../hooks/useHcaptcha";
import { useResearch } from "../hooks/useResearch";
import { getHealth } from "../lib/api";
import { GITHUB_URL } from "../lib/config";
import type { Health, Mode } from "../lib/types";

const EXAMPLE_QUESTIONS = [
  "How does hybrid dense + BM25 retrieval improve factual grounding in RAG?",
  "Compare BM25 and dense retrievers for research-heavy questions.",
  "When does query rewriting help a retrieval pipeline, and when doesn't it?",
];

export function Workspace() {
  const { state, submit, approve } = useResearch();
  const hcaptcha = useHcaptcha("light");
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("quick");
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [focusedSourceId, setFocusedSourceId] = useState<string | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const { dockRef, dockStyle, handleProps } = useDockResize();

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  const streaming = state.phase === "streaming";
  const latestSources = useMemo(() => {
    for (let i = state.turns.length - 1; i >= 0; i--) {
      if (state.turns[i].sources.length > 0) return state.turns[i].sources;
    }
    return [];
  }, [state.turns]);

  const handleSubmit = (question?: string) => {
    const q = (question ?? input).trim();
    if (!q || streaming) return;
    if (hcaptcha.enabled && !hcaptcha.token) {
      setCaptchaError("Complete the verification challenge to send a query.");
      return;
    }
    setCaptchaError(null);
    submit(q, mode, hcaptcha.token);
    setInput("");
    hcaptcha.reset();
  };

  const onCite = (sourceId: string) => setFocusedSourceId(sourceId);

  const showEmpty = state.turns.length === 0 && state.phase === "idle";

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <a className="app-back" href="#/">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Overview
          </a>
          <span className="header-divider" aria-hidden />
          <span className="brand">
            <span className="brand-mark" aria-hidden>
              <BrandGlyph />
            </span>
            <h1 className="brand-name">Loupe</h1>
          </span>
        </div>
        <div className="header-meta">
          {health && (
            <div className="health-badges">
              <span className="hbadge">{health.chunks} chunks</span>
              <span className={`hbadge ${health.web_tool ? "hbadge-on" : "hbadge-off"}`}>
                web {health.web_tool ? "on" : "off"}
              </span>
              <span className={`hbadge ${health.tracing ? "hbadge-on" : "hbadge-off"}`}>
                tracing {health.tracing ? "on" : "off"}
              </span>
            </div>
          )}
          <a className="github-link" href={GITHUB_URL} target="_blank" rel="noreferrer">
            GitHub ↗
          </a>
        </div>
      </header>

      <main className="workspace">
        <section className="conversation">
          <div className="conversation-scroll">
            {showEmpty ? (
              <div className="app-empty">
                <h2 className="app-empty-title">Ask a research question</h2>
                <p className="app-empty-body">
                  Retrieval, RAG, embeddings, or agentic search. Quick stays in the corpus; Deep
                  asks before it reaches the live web.
                </p>
                <p className="app-empty-label">Start with one of these</p>
                <div className="example-chips">
                  {EXAMPLE_QUESTIONS.map((q) => (
                    <button key={q} className="example-chip" onClick={() => handleSubmit(q)}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="turns">
                {state.turns.map((turn) => (
                  <div key={turn.id} className="turn">
                    <div className="bubble bubble-user">{turn.question}</div>
                    <AnswerPane
                      answerMd={turn.answerMd}
                      outcome={turn.outcome}
                      claims={turn.claims}
                      streaming={false}
                      cached={turn.cached}
                      sources={turn.sources}
                      onCite={onCite}
                    />
                  </div>
                ))}

                {state.currentQuestion &&
                  (streaming || state.phase === "interrupted" || state.phase === "error") && (
                    <div className="turn">
                      <div className="bubble bubble-user">{state.currentQuestion}</div>
                      {state.phase === "interrupted" ? (
                        <div className="answer-card answer-card-waiting">
                          Waiting for approval to search the web…
                        </div>
                      ) : state.phase === "error" ? (
                        <div className="error-banner">
                          <strong>Something went wrong.</strong>{" "}
                          {state.error?.message ?? "The research run failed."}
                        </div>
                      ) : (
                        <AnswerPane
                          answerMd={state.streamingAnswer}
                          outcome={null}
                          claims={state.claims}
                          streaming={true}
                          cached={false}
                          sources={[]}
                          onCite={onCite}
                        />
                      )}
                    </div>
                  )}
              </div>
            )}
          </div>

          <div className="composer-dock" ref={dockRef} style={dockStyle}>
            <div className="dock-handle" {...handleProps}>
              <span className="dock-grip" aria-hidden />
            </div>
            <QueryBar
              value={input}
              onChange={setInput}
              onSubmit={() => handleSubmit()}
              mode={mode}
              onModeChange={setMode}
              disabled={streaming}
              captchaEnabled={hcaptcha.enabled}
              captchaRef={hcaptcha.ref}
              captchaSatisfied={Boolean(hcaptcha.token)}
              hint={state.threadId ? "Follow-up questions stay in this thread" : null}
            />
            {captchaError && <p className="composer-error">{captchaError}</p>}
          </div>
        </section>

        <aside className="investigation">
          <Panel title="Agent timeline" subtitle="live execution">
            <AgentTimeline stages={state.stages} active={streaming} />
          </Panel>
          <Panel title="Evidence" subtitle="sources & retrieval">
            <EvidenceDrawer
              subQuestions={state.subQuestions}
              evidence={state.evidence}
              sources={latestSources}
              focusedSourceId={focusedSourceId}
            />
          </Panel>
          <Panel title="Claim audit" subtitle="verify layer">
            <ClaimAuditTable claims={state.claims} onCite={onCite} />
          </Panel>
          <Panel title="Budget" subtitle="cost governor">
            <UsageMeter usage={state.usage} mode={state.mode} />
          </Panel>
        </aside>
      </main>

      {state.phase === "interrupted" && state.interrupt && (
        <ApproveModal
          interrupt={state.interrupt}
          onApprove={() => approve(true)}
          onDecline={() => approve(false)}
        />
      )}
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h3>{title}</h3>
        <span className="panel-sub">{subtitle}</span>
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}
