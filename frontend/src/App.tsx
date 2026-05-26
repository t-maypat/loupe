import { useState } from "react";
import { queryAgent } from "./lib/api";
import type { Message, SourceChunk, TraceStep } from "./lib/types";

const starterQuestions = [
  "Summarize the product vision",
  "What does the retrieval pipeline optimize for?",
  "Which components make this agentic?"
];

export default function App() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sources, setSources] = useState<SourceChunk[]>([]);
  const [trace, setTrace] = useState<TraceStep[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSend = async (value?: string) => {
    const text = (value ?? question).trim();
    if (!text || loading) return;

    setLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setQuestion("");

    try {
      const response = await queryAgent(text, 5);
      setMessages((prev) => [...prev, { role: "assistant", content: response.answer }]);
      setSources(response.sources);
      setTrace(response.trace);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong." }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Agentic RAG Portfolio Demo</p>
          <h1>Atlas RAG Studio</h1>
          <p className="subtitle">
            A modern retrieval system that blends Pinecone, Anthropic, and fast local embeddings.
          </p>
        </div>
        <div className="hero-card">
          <p className="card-title">Suggested prompts</p>
          <div className="prompt-grid">
            {starterQuestions.map((prompt) => (
              <button key={prompt} onClick={() => handleSend(prompt)}>
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="layout">
        <section className="chat">
          <div className="chat-header">
            <span className="badge">Live Agent</span>
            <p>Ask a question about the demo knowledge base.</p>
          </div>
          <div className="chat-body">
            {messages.length === 0 ? (
              <div className="empty">
                <h3>Start with a question</h3>
                <p>Responses include citations and trace steps.</p>
              </div>
            ) : (
              messages.map((message, index) => (
                <div key={index} className={`message ${message.role}`}>
                  <div className="role">{message.role === "user" ? "You" : "Atlas"}</div>
                  <div className="content">{message.content}</div>
                </div>
              ))
            )}
          </div>
          <div className="chat-input">
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask about the roadmap, architecture, or retrieval flow"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleSend();
                }
              }}
            />
            <button onClick={() => handleSend()} disabled={loading}>
              {loading ? "Thinking..." : "Send"}
            </button>
          </div>
        </section>

        <aside className="side">
          <div className="panel">
            <h3>Sources</h3>
            {sources.length === 0 ? (
              <p className="muted">No sources yet.</p>
            ) : (
              sources.map((source) => (
                <div key={source.chunk_id} className="source">
                  <div className="source-meta">
                    <span>{source.title || "Untitled"}</span>
                    <span className="score">{source.score.toFixed(3)}</span>
                  </div>
                  <p>{source.text}</p>
                </div>
              ))
            )}
          </div>
          <div className="panel">
            <h3>Trace</h3>
            {trace.length === 0 ? (
              <p className="muted">No trace yet.</p>
            ) : (
              trace.map((step, index) => (
                <div key={`${step.name}-${index}`} className="trace">
                  <strong>{step.name}</strong>
                  <span>{step.detail}</span>
                </div>
              ))
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
