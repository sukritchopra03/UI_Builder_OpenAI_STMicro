import { useEffect, useMemo, useRef, useState } from "react";

const starterMessage = {
  role: "assistant",
  content:
    "Hello, I am Alfred. Ask me anything, or switch on UI Builder to generate live interfaces.",
  artifact: null,
};

function buildArtifactDocument(artifact) {
  if (!artifact) {
    return "";
  }

  const escapedJs = (artifact.js || "").replace(/<\/script>/gi, "<\\/script>");

  return `<!doctype html>
<html>
  <head>
    <meta charset=\"UTF-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />
    <style>
      :root {
        color-scheme: light;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        font-family: "Sora", "Segoe UI", sans-serif;
        background: #f4f7fb;
      }
      ${artifact.css || ""}
    </style>
  </head>
  <body>
    ${artifact.html || ""}
    <script>
      ${escapedJs}
    </script>
  </body>
</html>`;
}

export default function App() {
  const [messages, setMessages] = useState([starterMessage]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uiBuilderEnabled, setUiBuilderEnabled] = useState(false);
  const [artifactView, setArtifactView] = useState("ui");
  const [activeArtifact, setActiveArtifact] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const artifactDocument = useMemo(
    () => buildArtifactDocument(activeArtifact),
    [activeArtifact]
  );

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) {
      return;
    }

    const userMessage = { role: "user", content: text, artifact: null };
    const outboundMessages = [...messages, userMessage].map((message) => ({
      role: message.role,
      content: message.content,
    }));

    setMessages((previous) => [...previous, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: outboundMessages,
          uiBuilder: uiBuilderEnabled,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Request failed");
      }

      const assistantMessage = {
        role: "assistant",
        content: payload.reply || "I could not generate a response.",
        artifact: payload.artifact || null,
      };

      setMessages((previous) => [...previous, assistantMessage]);

      if (payload.artifact) {
        setActiveArtifact(payload.artifact);
        setArtifactView("ui");
      }
    } catch (error) {
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: `Error: ${error.message}`,
          artifact: null,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <aside className="side-rail">
        <div className="brand-card">
          <div className="brand-mark">ST</div>
          <div>
            <p className="brand-title">My Chat</p>
            <p className="brand-sub">ALFRED</p>
          </div>
        </div>
        <nav className="rail-nav">
          <button type="button" className="rail-item active">
            Home
          </button>
          <button type="button" className="rail-item">
            Prompt Library
          </button>
          <button type="button" className="rail-item">
            Image Library
          </button>
          <button type="button" className="rail-item">
            Links
          </button>
        </nav>
      </aside>

      <main className={`workspace ${uiBuilderEnabled ? "builder-open" : ""}`}>
        <section className="chat-panel">
          <header className="chat-header">
            <h1>ALFRED · Digital Assistant</h1>
            <p>Ask me anything</p>
          </header>

          <section className="chat-log">
            {messages.map((message, index) => (
              <article
                key={`${message.role}-${index}`}
                className={`message ${message.role}`}
              >
                <div className="avatar">{message.role === "assistant" ? "A" : "You"}</div>
                <div className="bubble">{message.content}</div>
              </article>
            ))}

            {loading && (
              <article className="message assistant">
                <div className="avatar">A</div>
                <div className="bubble typing">Thinking...</div>
              </article>
            )}
            <div ref={messagesEndRef} />
          </section>

          <footer className="composer">
            <textarea
              value={input}
              placeholder="Send a message"
              rows={3}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
            />

            <div className="composer-actions">
              <button
                type="button"
                className="send-btn"
                onClick={sendMessage}
                disabled={loading}
              >
                {loading ? "Sending..." : "Send"}
              </button>

              <button
                type="button"
                className={`builder-btn ${uiBuilderEnabled ? "on" : ""}`}
                onClick={() => setUiBuilderEnabled((value) => !value)}
              >
                UI Builder: {uiBuilderEnabled ? "On" : "Off"}
              </button>
            </div>
          </footer>
        </section>

        {uiBuilderEnabled && (
          <aside className="builder-panel">
            <header className="builder-header">
              <div>
                <h2>{activeArtifact?.title || "UI Builder"}</h2>
                <p>Preview or inspect generated markup</p>
              </div>
              <div className="view-toggle">
                <button
                  type="button"
                  className={artifactView === "ui" ? "active" : ""}
                  onClick={() => setArtifactView("ui")}
                >
                  UI
                </button>
                <button
                  type="button"
                  className={artifactView === "html" ? "active" : ""}
                  onClick={() => setArtifactView("html")}
                >
                  HTML
                </button>
              </div>
            </header>

            <section className="builder-body">
              {!activeArtifact && (
                <div className="builder-placeholder">
                  UI Builder is active. Ask for a component, page, or prototype to render it here.
                </div>
              )}

              {activeArtifact && artifactView === "ui" && (
                <iframe
                  title="Generated UI"
                  srcDoc={artifactDocument}
                  sandbox="allow-scripts allow-modals"
                />
              )}

              {activeArtifact && artifactView === "html" && (
                <textarea readOnly value={artifactDocument} className="code-box" />
              )}
            </section>
          </aside>
        )}
      </main>
    </div>
  );
}
