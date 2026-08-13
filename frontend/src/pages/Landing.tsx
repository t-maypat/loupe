// Marketing landing page.
//
// The hero is a full viewport, centred on one idea, over an animated pixel
// dither field. Everything that explains the product sits below the fold. The
// signature element is the annotated proof sheet in the first section: an
// answer excerpt with its audit set in the right margin, like a marked proof.

import { useEffect, useRef, useState } from "react";
import { BrandGlyph } from "../components/BrandGlyph";
import { PixelDither } from "../components/PixelDither";
import { GITHUB_URL } from "../lib/config";

const PIPELINE = [
  { node: "intake", blurb: "Read the question and turn away what the corpus cannot answer." },
  { node: "plan", blurb: "Split the question into smaller questions worth searching separately." },
  { node: "retrieve", blurb: "Run dense search and BM25 together, then merge the two rankings." },
  { node: "grade", blurb: "Score every chunk for relevance. Weak evidence sends the run back." },
  { node: "rewrite", blurb: "Reword the weak questions and search again. Twice at most." },
  { node: "synthesize", blurb: "Write the answer with a source id on every claim." },
  { node: "verify", blurb: "Read each sentence again against the sources it cited. Grade it." },
  { node: "finalize", blurb: "Publish the audit, the evidence, and what the run cost." },
];

const CAPABILITIES = [
  {
    icon: <IconLayers />,
    title: "Hybrid search",
    body: "Dense search finds ideas worded differently. BM25 catches exact terms and rare names. Loupe runs both and merges the results.",
  },
  {
    icon: <IconFilter />,
    title: "Graded evidence",
    body: "Every chunk is scored before it can be cited. You see the dense score, the BM25 score, and the merged score on each one.",
  },
  {
    icon: <IconCheck />,
    title: "Claim audit",
    body: "After writing, Loupe checks each sentence against the sources it cited. Each one is marked supported, partial, or unsupported.",
  },
  {
    icon: <IconStop />,
    title: "It can say no",
    body: "When the evidence is thin, Loupe tells you it cannot answer well. It shows what it found instead of writing something that sounds right.",
  },
  {
    icon: <IconGauge />,
    title: "Fixed budget",
    body: "Each run has a hard limit on model calls, tokens, web fetches, and time. The run stops at the limit.",
  },
  {
    icon: <IconHand />,
    title: "You approve the web",
    body: "Deep runs pause before they leave the corpus. Nothing reaches the live web until you allow it.",
  },
];

export function Landing() {
  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-nav-inner">
          <a className="brand" href="#/">
            <span className="brand-mark" aria-hidden>
              <BrandGlyph />
            </span>
            <span className="brand-name">Loupe</span>
          </a>
          <nav className="lp-nav-links" aria-label="Sections">
            <a href="#answer">The answer</a>
            <a href="#how">How it runs</a>
            <a href="#checks">What it checks</a>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              Source
            </a>
          </nav>
          <a className="lp-btn lp-btn-primary lp-btn-sm" href="#/app">
            Try it now
          </a>
        </div>
      </header>

      <main>
        {/* ---------- Hero: one idea, full screen ---------- */}
        <section className="lp-hero">
          <div className="lp-hero-wash" aria-hidden />
          <PixelDither />
          <div className="lp-hero-inner">
            <p className="lp-eyebrow lp-eyebrow-dot">Research agent</p>
            <h1 className="lp-display">Answers you can check.</h1>
            <p className="lp-hero-line">
              Loupe answers your research question, then checks every sentence against the sources
              it used.
            </p>
            <a className="lp-btn lp-btn-primary lp-btn-lg" href="#/app">
              Try it now
            </a>
          </div>
          <a className="lp-scroll-cue" href="#answer" aria-label="Skip to the explanation">
            <span>See what it returns</span>
            <span className="lp-scroll-arrow" aria-hidden>
              ↓
            </span>
          </a>
        </section>

        {/* ---------- The answer ---------- */}
        <section className="lp-section" id="answer">
          <div className="lp-container">
            <div className="lp-section-head">
              <p className="lp-eyebrow lp-eyebrow-dot">What comes back</p>
              <h2 className="lp-h2">Every sentence carries its source.</h2>
              <p className="lp-body">
                Loupe writes the answer with a source id on each claim. Then it reads the answer
                again and grades every sentence against those sources. The grade sits in the
                margin, next to the line it belongs to.
              </p>
            </div>
            <ProofSheet />
          </div>
        </section>

        {/* ---------- Facts strip ---------- */}
        <section className="lp-facts">
          <div className="lp-container lp-facts-inner">
            <Fact value="Dense + BM25" label="two searches, merged" />
            <Fact value="Every claim" label="graded after writing" />
            <Fact value="10 calls, 80k tokens" label="hard limit per run" />
            <Fact value="Says no" label="when evidence is thin" />
          </div>
        </section>

        {/* ---------- How it runs ---------- */}
        <section className="lp-section" id="how">
          <div className="lp-container lp-split">
            <div className="lp-split-text">
              <p className="lp-eyebrow lp-eyebrow-dot">How it runs</p>
              <h2 className="lp-h2">Eight steps, and you watch all of them.</h2>
              <p className="lp-body">
                There is no black box with a spinner in front of it. Each step reports when it
                starts, what it did, and how long it took. You see this live, while the answer is
                still being written.
              </p>
              <p className="lp-body">
                Grading is the step that matters most. If the evidence is too weak, the run does
                not push ahead. It rewords the questions and searches again, up to two more times.
                If it still finds nothing solid, it refuses.
              </p>
              <a className="lp-btn lp-btn-secondary" href="#/app">
                Run one yourself
              </a>
            </div>

            <Pipeline />
          </div>
        </section>

        {/* ---------- Capabilities ---------- */}
        <section className="lp-section" id="checks">
          <div className="lp-container">
            <div className="lp-section-head">
              <p className="lp-eyebrow lp-eyebrow-dot">What it checks</p>
              <h2 className="lp-h2">Six things happen on every question.</h2>
            </div>
            <div className="lp-grid">
              {CAPABILITIES.map((c) => (
                <article className="lp-card" key={c.title}>
                  <span className="lp-card-icon" aria-hidden>
                    {c.icon}
                  </span>
                  <h3 className="lp-card-title">{c.title}</h3>
                  <p className="lp-card-body">{c.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Refusal ---------- */}
        <section className="lp-section" id="refusal">
          <div className="lp-container lp-split lp-split-reverse">
            <div className="lp-refusal-mock">
              <span className="refusal-badge">Refused</span>
              <h3>I can't answer this reliably</h3>
              <p>
                The evidence I found is not strong enough to answer with confidence. The best
                sources and questions are shown in the investigation panel.
              </p>
              <div className="lp-refusal-meta">
                <span>4 chunks found</span>
                <span>0 graded relevant</span>
                <span>2 rewrites tried</span>
              </div>
            </div>

            <div className="lp-split-text">
              <p className="lp-eyebrow lp-eyebrow-dot">When it refuses</p>
              <h2 className="lp-h2">A wrong answer costs more than no answer.</h2>
              <p className="lp-body">
                Most demos answer anything you ask, because an empty reply looks broken. Loupe
                treats that as the bug. If grading finds no evidence for an answer, the run ends in
                a refusal. The chunks it found stay on screen with their scores, so you can see
                why.
              </p>
              <p className="lp-body">
                Budget works the same way. If a run hits its limit before checking is done, the
                draft is held back rather than shown unchecked.
              </p>
            </div>
          </div>
        </section>

        {/* ---------- Closing ---------- */}
        <section className="lp-close">
          <div className="lp-container lp-close-inner">
            <h2 className="lp-h2">Ask it something you can check.</h2>
            <p className="lp-body">
              The corpus covers retrieval, RAG, embeddings, and agentic search. Bring a question
              you already know the answer to, then see if the audit agrees with you.
            </p>
            <div className="lp-cta-row">
              <a className="lp-btn lp-btn-primary lp-btn-lg" href="#/app">
                Try it now
              </a>
              <a
                className="lp-btn lp-btn-ghost lp-btn-lg"
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
              >
                Read the source
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-container lp-footer-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden>
              <BrandGlyph />
            </span>
            <span className="brand-name">Loupe</span>
          </div>
          <p className="lp-footer-note">
            A research agent that shows its work. The corpus holds papers and docs on retrieval,
            RAG, and agentic search.
          </p>
          <a className="lp-footer-link" href={GITHUB_URL} target="_blank" rel="noreferrer">
            GitHub ↗
          </a>
        </div>
      </footer>
    </div>
  );
}

/* ---------- Pipeline ----------
 * A run walks the list on a loop while the section is on screen, so the reader
 * sees the order rather than having to infer it. It only animates while
 * visible, and holds still under reduced motion. */

const STEP_MS = 1000;

function Pipeline() {
  const [active, setActive] = useState(-1);
  const listRef = useRef<HTMLOListElement | null>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let timer = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        window.clearInterval(timer);
        if (entry.isIntersecting) {
          timer = window.setInterval(
            () => setActive((current) => (current + 1) % PIPELINE.length),
            STEP_MS
          );
        } else {
          setActive(-1);
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(list);
    return () => {
      window.clearInterval(timer);
      observer.disconnect();
    };
  }, []);

  // The loop band belongs to the grade and rewrite steps, so it lights with them.
  const loopLive = active === 3 || active === 4;

  return (
    <ol className="lp-pipeline" ref={listRef}>
      {PIPELINE.map((step, i) => (
        <li className={`lp-pipeline-step ${i === active ? "is-active" : ""}`} key={step.node}>
          <span className="lp-pipeline-index">{String(i + 1).padStart(2, "0")}</span>
          <div className="lp-pipeline-body">
            <span className="lp-pipeline-node">{step.node}</span>
            <p className="lp-pipeline-blurb">{step.blurb}</p>
          </div>
        </li>
      ))}
      <li className={`lp-pipeline-loop ${loopLive ? "is-live" : ""}`}>
        <span>grade sends weak runs back to rewrite, twice at most</span>
      </li>
    </ol>
  );
}

/* ---------- Signature: the annotated proof sheet ---------- */

const PROOF_LINES: {
  text: string;
  cites: string[];
  verdict: string;
  tone: "ok" | "partial";
}[] = [
  {
    text: "Hybrid search pairs a dense model with BM25, so rare terms stay findable.",
    cites: ["S1", "S4"],
    verdict: "Supported",
    tone: "ok",
  },
  {
    text: "Rank fusion merges the two result lists without tuning their scores.",
    cites: ["S2"],
    verdict: "Supported",
    tone: "ok",
  },
  {
    text: "Rewriting the query recovers most of the results lost to wording.",
    cites: ["S3"],
    verdict: "Partial",
    tone: "partial",
  },
];

function ProofSheet() {
  return (
    <figure className="lp-proof">
      <figcaption className="lp-proof-chrome">
        <span className="lp-proof-label">Answer</span>
        <span className="lp-proof-status">checked, 3 claims</span>
      </figcaption>

      <div className="lp-proof-body">
        {PROOF_LINES.map((line) => (
          <div className="lp-proof-row" key={line.text}>
            <p className="lp-proof-text">
              <span
                className={`claim-underline claim-${line.tone === "ok" ? "supported" : "partial"}`}
              >
                {line.text}
              </span>{" "}
              {line.cites.map((c) => (
                <span className="lp-cite" key={c}>
                  {c}
                </span>
              ))}
            </p>
            <span className={`lp-verdict lp-verdict-${line.tone}`}>{line.verdict}</span>
          </div>
        ))}
      </div>

      <div className="lp-proof-foot">
        <span>2 supported, 1 partial, 0 unsupported</span>
        <span className="lp-proof-cost">8.4s / $0.0031</span>
      </div>
    </figure>
  );
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div className="lp-fact">
      <span className="lp-fact-value">{value}</span>
      <span className="lp-fact-label">{label}</span>
    </div>
  );
}

/* ---------- Icons: 1.5px line style, one colour ---------- */

function IconLayers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 3 3 7.5l9 4.5 9-4.5z" strokeLinejoin="round" />
      <path d="m3 12.5 9 4.5 9-4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconFilter() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3.5 5h17l-6.6 7.6V19l-3.8-2.2v-4.2z" strokeLinejoin="round" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 6h9M4 11h9M4 16h5" strokeLinecap="round" />
      <path d="m14.5 15.5 2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconStop() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="8.5" />
      <path d="m6.5 6.5 11 11" strokeLinecap="round" />
    </svg>
  );
}

function IconGauge() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 17a8 8 0 1 1 16 0" strokeLinecap="round" />
      <path d="m12 17 4.2-5.4" strokeLinecap="round" />
    </svg>
  );
}

function IconHand() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path
        d="M9 11V5.6a1.6 1.6 0 0 1 3.2 0V11m0-1.4a1.6 1.6 0 0 1 3.2 0V12m0-1a1.6 1.6 0 0 1 3.2 0v4.4A5.6 5.6 0 0 1 12.8 21h-1a5.6 5.6 0 0 1-5.6-5.6v-3.6a1.6 1.6 0 0 1 2.8-1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
