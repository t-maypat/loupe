// Deep-mode HITL approval interrupt (§1.1, §6). The stream pauses; the user
// approves or declines live web research before the run resumes.
//
// Follows the Beautiful UI "Approval Card" primitive: the agent asks one
// question, the choices are radio rows, and the send arrow stays inert until a
// choice is made. Nothing auto-advances here, because the answer spends budget
// and reaches the public web.

import { useState } from "react";
import type { InterruptEvent } from "../lib/types";

type Props = {
  interrupt: InterruptEvent;
  onApprove: () => void;
  onDecline: () => void;
};

const CHOICES = [
  { id: "web", label: "Search the live web" },
  { id: "corpus", label: "Stay in the corpus" },
];

export function ApproveModal({ interrupt, onApprove, onDecline }: Props) {
  const [choice, setChoice] = useState<string | null>(null);

  const send = () => {
    if (!choice) return;
    if (choice === "web") onApprove();
    else onDecline();
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Approve web research">
      <div className="approval-card">
        <div className="approval-body">
          <div className="approval-head">
            <span className="approval-q">Search the live web?</span>
            <button
              type="button"
              aria-label="Dismiss and stay in the corpus"
              className="approval-dismiss"
              onClick={onDecline}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="approval-note">
            {interrupt.message || "This will search the live web and use more budget."}
          </p>

          <div className="approval-options">
            {CHOICES.map((option) => {
              const on = choice === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setChoice(option.id)}
                  className="approval-option"
                >
                  <span className={`approval-radio ${on ? "approval-radio-on" : ""}`}>
                    <span className="approval-radio-dot" />
                  </span>
                  <span className={`approval-option-label ${on ? "approval-option-on" : ""}`}>
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="approval-foot">
          <span className="approval-hint">Deep research, approval needed</span>
          <button
            type="button"
            aria-label="Send answer"
            className={`approval-send ${choice ? "approval-send-ready" : ""}`}
            disabled={!choice}
            onClick={send}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
