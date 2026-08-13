// Evidence panel: cited sources (S1..Sn) plus per-sub-question retrieved chunks,
// each with dense/bm25/fused scores and origin/trust badges (§11).
//
// Card layout follows the Beautiful UI "Context Cards" primitive: a title bar
// with the chunk size on the right, the chunk body, then a source chip carrying
// a type badge. Cards stagger in as retrieval fills the panel.

import { useEffect, useRef } from "react";
import type { EvidenceChunk, SubQuestion } from "../lib/types";

type Props = {
  subQuestions: SubQuestion[];
  evidence: Record<string, EvidenceChunk[]>;
  sources: EvidenceChunk[];
  focusedSourceId: string | null;
};

function fmt(n: number | null | undefined): string {
  return typeof n === "number" ? n.toFixed(3) : "n/a";
}

function sourceName(chunk: EvidenceChunk): string {
  if (chunk.url) {
    try {
      return new URL(chunk.url).hostname.replace(/^www\./, "");
    } catch {
      return chunk.doc_title;
    }
  }
  return chunk.doc_title;
}

function LinesIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 17L17 7M7 7h10v10" />
    </svg>
  );
}

function ChunkCard({
  chunk,
  label,
  highlight,
  cardRef,
  index,
}: {
  chunk: EvidenceChunk;
  label?: string;
  highlight?: boolean;
  cardRef?: React.Ref<HTMLDivElement>;
  index: number;
}) {
  const name = sourceName(chunk);
  const badge = chunk.origin === "web" ? "WEB" : "DOC";

  return (
    <div
      ref={cardRef}
      className={`chunk-card ${highlight ? "chunk-focus" : ""}`}
      style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}
    >
      <div className="chunk-bar">
        {label && <span className="source-tag">{label}</span>}
        <span className="chunk-bar-title">
          <LinesIcon />
          <span className="chunk-title">{chunk.doc_title}</span>
        </span>
        <span className="chunk-chars">{chunk.text.length.toLocaleString()} characters</span>
      </div>

      {chunk.section && <p className="chunk-section">{chunk.section}</p>}
      <p className="chunk-text">{chunk.text}</p>

      <div className="chunk-foot">
        {chunk.url ? (
          <a className="chunk-source" href={chunk.url} target="_blank" rel="noreferrer">
            <span className={`chunk-badge chunk-badge-${chunk.origin}`}>{badge}</span>
            <span className="chunk-source-name">{name}</span>
            <ExternalIcon />
          </a>
        ) : (
          <span className="chunk-source">
            <span className={`chunk-badge chunk-badge-${chunk.origin}`}>{badge}</span>
            <span className="chunk-source-name">{name}</span>
          </span>
        )}
        {chunk.trust === "low" && <span className="badge badge-low">low trust</span>}
      </div>

      <div className="chunk-scores">
        <span>dense {fmt(chunk.scores.dense)}</span>
        <span>bm25 {fmt(chunk.scores.bm25)}</span>
        <span className="score-fused">fused {fmt(chunk.scores.fused)}</span>
      </div>
    </div>
  );
}

export function EvidenceDrawer({ subQuestions, evidence, sources, focusedSourceId }: Props) {
  const focusRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (focusedSourceId && focusRef.current) {
      focusRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [focusedSourceId]);

  const hasEvidence = Object.keys(evidence).length > 0;
  const subById = new Map(subQuestions.map((s) => [s.id, s]));
  const groupIds = Object.keys(evidence);

  if (sources.length === 0 && !hasEvidence) {
    return <p className="panel-empty">Evidence appears here as the agent retrieves it.</p>;
  }

  return (
    <div className="evidence-drawer">
      {sources.length > 0 && (
        <section className="evidence-section">
          <h4 className="evidence-subhead">
            Cited sources
            <span className="evidence-count">{sources.length}</span>
          </h4>
          {sources.map((chunk, i) => (
            <ChunkCard
              key={chunk.source_id ?? chunk.id}
              chunk={chunk}
              index={i}
              label={chunk.source_id}
              highlight={chunk.source_id === focusedSourceId}
              cardRef={chunk.source_id === focusedSourceId ? focusRef : undefined}
            />
          ))}
        </section>
      )}

      {groupIds.map((sqId) => (
        <section key={sqId} className="evidence-section">
          <h4 className="evidence-subhead">
            {subById.get(sqId)?.text ?? sqId}
            <span className="evidence-count">{evidence[sqId].length}</span>
          </h4>
          {evidence[sqId].map((chunk, i) => (
            <ChunkCard key={chunk.id} chunk={chunk} index={i} />
          ))}
        </section>
      ))}
    </div>
  );
}
