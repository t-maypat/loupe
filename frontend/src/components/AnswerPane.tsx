// Renders a single assistant turn: streamed markdown answer with citation chips
// and per-sentence verdict underlines, or the refusal card variant (§11).
//
// The action row and the collapsible source list follow the Beautiful UI
// "Streaming Text" primitive. They stay hidden until the stream finishes, so
// nothing is clickable while the text is still moving.

import { useMemo, useState } from "react";
import { normalizeClaim, renderMarkdown } from "../lib/markdown";
import { PixelLoader } from "./PixelLoader";
import type { ClaimAudit, EvidenceChunk, Outcome, Verdict } from "../lib/types";

type Props = {
  answerMd: string | null;
  outcome: Outcome | null;
  claims: ClaimAudit[];
  streaming: boolean;
  cached: boolean;
  sources: EvidenceChunk[];
  onCite: (sourceId: string) => void;
};

const REFUSAL_COPY: Record<string, { title: string; body: string }> = {
  refused: {
    title: "I can't answer this reliably",
    body: "The evidence I found doesn't hold up well enough to answer with confidence. The best sources and sub-questions are shown in the investigation panel.",
  },
  budget_exceeded: {
    title: "I ran out of budget before I could verify this",
    body: "The run hit its call/token/time budget. Any partial draft is unverified, so I'm holding back rather than presenting unchecked claims.",
  },
};

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function AnswerPane({
  answerMd,
  outcome,
  claims,
  streaming,
  cached,
  sources,
  onCite,
}: Props) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const verdicts = useMemo(() => {
    const map = new Map<string, Verdict>();
    for (const c of claims) map.set(normalizeClaim(c.text), c.verdict);
    return map;
  }, [claims]);

  const isRefusal = outcome === "refused" || outcome === "budget_exceeded";

  if (isRefusal && !answerMd) {
    const copy = REFUSAL_COPY[outcome] ?? REFUSAL_COPY.refused;
    return (
      <div className="refusal-card">
        <span className="refusal-badge">Refused</span>
        <h3>{copy.title}</h3>
        <p>{copy.body}</p>
      </div>
    );
  }

  const content = answerMd ?? "";
  const showActions = !streaming && content.length > 0;

  const copyAnswer = () => {
    navigator.clipboard?.writeText(content).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      },
      () => setCopied(false)
    );
  };

  return (
    <div className={`answer-card ${outcome === "redirected" ? "answer-card-redirect" : ""}`}>
      {isRefusal && <span className="refusal-badge">Refused, partial</span>}
      {cached && <span className="cached-badge">cached</span>}

      {streaming && content.length === 0 ? (
        <PixelLoader label="Researching" />
      ) : (
        <div className="md-prose">
          {renderMarkdown(content, { verdicts, onCite })}
          {streaming && <span className="stream-caret" aria-hidden />}
        </div>
      )}

      {showActions && (
        <div className="answer-actions">
          <button type="button" className="answer-action" onClick={copyAnswer}>
            {copied ? "Copied" : "Copy"}
          </button>
          {sources.length > 0 && (
            <button
              type="button"
              className="answer-action"
              aria-expanded={sourcesOpen}
              onClick={() => setSourcesOpen((open) => !open)}
            >
              {sources.length} {sources.length === 1 ? "source" : "sources"}
            </button>
          )}
        </div>
      )}

      {showActions && sources.length > 0 && (
        <div className="answer-sources" data-open={sourcesOpen}>
          <div className="answer-sources-inner">
            <div className="answer-sources-list">
              {sources.map((chunk) => {
                const host = hostOf(chunk.url);
                return (
                  <button
                    key={chunk.source_id ?? chunk.id}
                    type="button"
                    className="answer-source-row"
                    onClick={() => chunk.source_id && onCite(chunk.source_id)}
                  >
                    <span className="answer-source-id">{chunk.source_id}</span>
                    <span className="answer-source-title">{chunk.doc_title}</span>
                    {host && <span className="answer-source-host">{host}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
