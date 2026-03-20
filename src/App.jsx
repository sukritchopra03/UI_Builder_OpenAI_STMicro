import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ─── Constants & Helpers ────────────────────────────── */
const starterMessage = {
  role: "assistant",
  content:
    "Hello! I'm **ALFRED**, your STMicroelectronics AI assistant. Ask me anything, upload images for analysis, or describe a UI you'd like me to build.",
  artifact: null,
  images: [],
  files: [],
  time: new Date(),
  streaming: false,
};

function formatTime(date) {
  return new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

function renderMarkdown(text) {
  if (!text) return "";
  let html = text
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre><code class="language-${lang}">${code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</code><button class="copy-btn" onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent)"><svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><rect x='9' y='9' width='13' height='13' rx='2'/><path d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'/></svg></button></pre>`;
    })
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br/>");
  return html;
}

function buildArtifactDocument(artifact) {
  if (!artifact) return "";
  const escapedJs = (artifact.js || "").replace(/<\/script>/gi, "<\\/script>");
  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: 'Inter', sans-serif; background: #f8f9fb; }
      ${artifact.css || ""}
    </style>
  </head>
  <body>
    ${artifact.html || ""}
    <script>${escapedJs}</script>
  </body>
</html>`;
}

/* ─── SVG Icons ──────────────────────────────────────── */
const STLogo = () => (
  <svg viewBox="0 0 76 80" fill="none">
    <path d="M38 0L0 20v40l38 20 38-20V20L38 0z" fill="#03234B" />
    <text x="38" y="48" textAnchor="middle" fill="#FFD200" fontWeight="800" fontSize="30" fontFamily="Inter, sans-serif">ST</text>
  </svg>
);

const IconPlus = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconHome = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const IconCode = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
  </svg>
);

const IconImage = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
  </svg>
);

const IconLink = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const IconSend = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const IconPaperclip = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.49" />
  </svg>
);

const IconUpload = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" /><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
  </svg>
);

const IconFile = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
  </svg>
);

const IconCopy = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const IconGlobe = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);

const IconLayout = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" />
  </svg>
);

const IconWand = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8L19 13"/><path d="M15 9h0"/><path d="M17.8 6.2L19 5"/><path d="M11 6.2L9.7 5"/><path d="M11 11.8L9.7 13"/><line x1="12" y1="22" x2="3" y2="13"/><path d="M16 13l-4-4"/>
  </svg>
);

const IconSparkle = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z"/>
  </svg>
);

const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/* ─── Streaming Text Hook ────────────────────────────── */
function useStreamingText(fullText, isStreaming, speed = 12) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const indexRef = useRef(0);

  useEffect(() => {
    if (!isStreaming) {
      setDisplayed(fullText || "");
      setDone(true);
      return;
    }
    setDisplayed("");
    setDone(false);
    indexRef.current = 0;

    const interval = setInterval(() => {
      indexRef.current += Math.floor(Math.random() * 3) + 1; // 1-3 chars at a time for natural feel
      if (indexRef.current >= fullText.length) {
        indexRef.current = fullText.length;
        setDisplayed(fullText);
        setDone(true);
        clearInterval(interval);
      } else {
        setDisplayed(fullText.slice(0, indexRef.current));
      }
    }, speed);

    return () => clearInterval(interval);
  }, [fullText, isStreaming, speed]);

  return { displayed, done };
}

/* ─── Streaming Code Component (Builder Panel) ───────── */
function StreamingCodeViewer({ code, isStreaming }) {
  const { displayed, done } = useStreamingText(code, isStreaming, 4);

  return (
    <div className="code-stream-container">
      <div className="code-stream-header">
        <div className="code-stream-dots">
          <span /><span /><span />
        </div>
        <span className="code-stream-label">
          {!done && isStreaming ? "Generating..." : "Generated HTML"}
        </span>
        <button
          type="button"
          className="code-stream-copy"
          onClick={() => navigator.clipboard.writeText(code)}
          title="Copy code"
        >
          <IconCopy />
        </button>
      </div>
      <pre className="code-stream-body">
        <code>{displayed}</code>
        {!done && <span className="code-cursor">│</span>}
      </pre>
    </div>
  );
}

/* ─── Streaming Message Bubble ───────────────────────── */
function StreamingBubble({ content, isStreaming, onStreamDone }) {
  const { displayed, done } = useStreamingText(content, isStreaming, 14);

  useEffect(() => {
    if (done && isStreaming && onStreamDone) onStreamDone();
  }, [done, isStreaming, onStreamDone]);

  return (
    <div
      className="msg-bubble"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(displayed) }}
    />
  );
}

/* ─── UI Build Prompt (Claude-style follow-up) ───────── */
function UIBuildPrompt({ onYes, onDismiss, visible }) {
  if (!visible) return null;
  return (
    <div className="ui-prompt" style={{ animation: "fadeInUp 0.4s ease" }}>
      <div className="ui-prompt-inner">
        <div className="ui-prompt-icon">
          <IconSparkle />
        </div>
        <div className="ui-prompt-text">
          <strong>Want me to build a UI for this?</strong>
          <span>I can generate a live, interactive prototype</span>
        </div>
        <div className="ui-prompt-actions">
          <button type="button" className="ui-prompt-yes" onClick={onYes}>
            <IconWand />
            Yes, build it
          </button>
          <button type="button" className="ui-prompt-no" onClick={onDismiss}>
            No thanks
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main App ───────────────────────────────────────── */
export default function App() {
  const [messages, setMessages] = useState([starterMessage]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uiBuilderEnabled, setUiBuilderEnabled] = useState(false);
  const [artifactView, setArtifactView] = useState("ui");
  const [activeArtifact, setActiveArtifact] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [dragging, setDragging] = useState(false);

  // Claude-style features
  const [streamingMsgIdx, setStreamingMsgIdx] = useState(-1);
  const [showBuildPrompt, setShowBuildPrompt] = useState(false);
  const [buildPromptContext, setBuildPromptContext] = useState("");
  const [streamingArtifactCode, setStreamingArtifactCode] = useState(null);
  const [isArtifactStreaming, setIsArtifactStreaming] = useState(false);
  const [generatingLabel, setGeneratingLabel] = useState("");

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const dragCounter = useRef(0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, showBuildPrompt]);

  const artifactDocument = useMemo(
    () => buildArtifactDocument(activeArtifact),
    [activeArtifact]
  );

  /* ── Auto-resize textarea ─────────────────────────── */
  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "24px";
      ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
    }
  }, []);

  useEffect(() => autoResize(), [input, autoResize]);

  /* ── File handling ─────────────────────────────────── */
  const processFiles = useCallback((fileList) => {
    const allowed = 5;
    const newFiles = Array.from(fileList).slice(0, allowed);
    const processed = newFiles.map((file) => {
      const isImage = file.type.startsWith("image/");
      return {
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        isImage,
        preview: isImage ? URL.createObjectURL(file) : null,
      };
    });
    setAttachments((prev) => [...prev, ...processed].slice(0, allowed));
  }, []);

  const removeAttachment = useCallback((index) => {
    setAttachments((prev) => {
      const next = [...prev];
      if (next[index]?.preview) URL.revokeObjectURL(next[index].preview);
      next.splice(index, 1);
      return next;
    });
  }, []);

  /* ── Drag & Drop ───────────────────────────────────── */
  const onDragEnter = useCallback((e) => { e.preventDefault(); dragCounter.current++; setDragging(true); }, []);
  const onDragLeave = useCallback((e) => { e.preventDefault(); dragCounter.current--; if (dragCounter.current === 0) setDragging(false); }, []);
  const onDragOver = useCallback((e) => e.preventDefault(), []);
  const onDrop = useCallback((e) => {
    e.preventDefault(); dragCounter.current = 0; setDragging(false);
    if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files);
  }, [processFiles]);

  /* ── Paste handler ─────────────────────────────────── */
  const onPaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files = [];
    for (const item of items) { if (item.kind === "file") { const f = item.getAsFile(); if (f) files.push(f); } }
    if (files.length) processFiles(files);
  }, [processFiles]);

  /* ── Convert image to base64 ───────────────────────── */
  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  /* ── Send message (core) ───────────────────────────── */
  const sendMessageCore = async (text, forceUIBuilder = false) => {
    if ((!text.trim() && attachments.length === 0) || loading) return;

    const imageAttachments = attachments.filter((a) => a.isImage);
    const fileAttachments = attachments.filter((a) => !a.isImage);

    const userMessage = {
      role: "user",
      content: text.trim(),
      artifact: null,
      images: imageAttachments.map((a) => a.preview),
      files: fileAttachments.map((a) => ({ name: a.name, size: a.size, type: a.type })),
      time: new Date(),
      streaming: false,
    };

    const outboundMessages = [...messages, userMessage].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setAttachments([]);
    setLoading(true);
    setShowBuildPrompt(false);

    // If building UI, auto-open the builder panel with "generating" state
    const shouldBuildUI = forceUIBuilder || uiBuilderEnabled;
    if (shouldBuildUI) {
      setUiBuilderEnabled(true);
      setArtifactView("html"); // Start on code tab to show streaming
      setStreamingArtifactCode(null);
      setIsArtifactStreaming(false);
      setGeneratingLabel("Thinking...");
    }

    try {
      const body = {
        messages: outboundMessages,
        uiBuilder: shouldBuildUI,
      };

      if (imageAttachments.length > 0) {
        const imageData = [];
        for (const att of imageAttachments) {
          try {
            const base64 = await fileToBase64(att.file);
            imageData.push({ mimeType: att.type, data: base64 });
          } catch { /* skip */ }
        }
        if (imageData.length > 0) body.images = imageData;
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Request failed");

      const assistantMessage = {
        role: "assistant",
        content: payload.reply || "I could not generate a response.",
        artifact: payload.artifact || null,
        images: [],
        files: [],
        time: new Date(),
        streaming: true, // Enable streaming animation
      };

      setMessages((prev) => {
        const newMessages = [...prev, assistantMessage];
        setStreamingMsgIdx(newMessages.length - 1);
        return newMessages;
      });

      // If artifact was generated, start streaming code in the builder panel
      if (payload.artifact) {
        const fullDoc = buildArtifactDocument(payload.artifact);
        setGeneratingLabel("Generating UI...");
        setStreamingArtifactCode(fullDoc);
        setIsArtifactStreaming(true);

        // After code streaming completes, switch to preview
        const estimatedTime = fullDoc.length * 4 + 500;
        setTimeout(() => {
          setActiveArtifact(payload.artifact);
          setIsArtifactStreaming(false);
          setArtifactView("ui"); // Auto-switch to live preview
          setGeneratingLabel("");
        }, Math.min(estimatedTime, 8000)); // Cap at 8 seconds
      }

      // Show "Build UI?" prompt after non-UI-builder responses (after streaming finishes)
      if (!shouldBuildUI && !payload.artifact) {
        const replyLen = (payload.reply || "").length;
        const streamTime = replyLen * 14 + 800;
        setTimeout(() => {
          setBuildPromptContext(payload.reply || "");
          setShowBuildPrompt(true);
        }, Math.min(streamTime, 5000));
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ Error: ${error.message}`,
          artifact: null,
          images: [],
          files: [],
          time: new Date(),
          streaming: false,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  /* ── Send from input ───────────────────────────────── */
  const sendMessage = () => sendMessageCore(input);

  /* ── Handle "Yes, build it" ────────────────────────── */
  const handleBuildUI = () => {
    setShowBuildPrompt(false);
    // Take the last user message context and send a follow-up
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    const context = lastUserMsg?.content || "";
    const buildPrompt = `Based on our conversation, please build a UI for: ${context}. Make it modern, interactive, and visually stunning with great CSS.`;
    setInput("");
    sendMessageCore(buildPrompt, true);
  };

  const handleNewChat = () => {
    setMessages([starterMessage]);
    setActiveArtifact(null);
    setInput("");
    setAttachments([]);
    setShowBuildPrompt(false);
    setStreamingMsgIdx(-1);
    setStreamingArtifactCode(null);
    setIsArtifactStreaming(false);
    setGeneratingLabel("");
  };

  /* ── Mark message as done streaming ────────────────── */
  const handleStreamDone = useCallback((idx) => {
    setMessages((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, streaming: false } : m))
    );
    setStreamingMsgIdx(-1);
  }, []);

  /* ── Render ────────────────────────────────────────── */
  return (
    <div className="app-shell" onDragEnter={onDragEnter} onDragLeave={onDragLeave} onDragOver={onDragOver} onDrop={onDrop}>
      {/* ═══ Sidebar ═══ */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand">
            <div className="brand-logo"><STLogo /></div>
            <div className="brand-info">
              <span className="brand-name">ALFRED</span>
              <span className="brand-tagline">life.augmented</span>
            </div>
          </div>
          <button type="button" className="new-chat-btn" onClick={handleNewChat}>
            <IconPlus /><span>New Chat</span>
          </button>
        </div>
        <nav className="sidebar-nav">
          <p className="nav-section-title">Menu</p>
          <button type="button" className="nav-item active"><IconHome /><span>Home</span></button>
          <button type="button" className="nav-item"><IconCode /><span>Prompt Library</span></button>
          <button type="button" className="nav-item"><IconImage /><span>Image Library</span></button>
          <button type="button" className="nav-item"><IconLink /><span>Links</span></button>
        </nav>
        <div className="sidebar-footer">
          <button type="button" className="sidebar-footer-link">Help & FAQ</button>
          <button type="button" className="sidebar-footer-link">Settings</button>
          <button type="button" className="sidebar-footer-link">v2.0 · STMicroelectronics</button>
        </div>
      </aside>

      {/* ═══ Main Content ═══ */}
      <div className="main-content">
        {/* ── Header Bar ── */}
        <header className="header-bar">
          <div className="header-title">
            <h1>ALFRED · Digital Assistant</h1>
            <span className="status-dot" />
          </div>
          <div className="header-actions">
            <div
              className={`toggle-group ${uiBuilderEnabled ? "active" : ""}`}
              onClick={() => setUiBuilderEnabled((v) => !v)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setUiBuilderEnabled((v) => !v); }}
            >
              <span className="toggle-label">UI Builder</span>
              <div className={`toggle-switch ${uiBuilderEnabled ? "on" : ""}`} />
            </div>
          </div>
        </header>

        {/* ── Workspace ── */}
        <div className={`workspace ${uiBuilderEnabled ? "builder-open" : ""}`}>
          {/* Chat Panel */}
          <section className="chat-panel" style={{ position: "relative" }}>
            <div className={`drop-overlay ${dragging ? "visible" : ""}`}>
              <div className="drop-overlay-text"><IconUpload /> Drop files here to attach</div>
            </div>

            <div className="chat-messages">
              {/* Welcome */}
              {messages.length <= 1 && (
                <div className="welcome-banner">
                  <div className="welcome-logo"><STLogo /></div>
                  <h2>How can I help you today?</h2>
                  <p>I can answer questions, analyze images, generate UI components, and help with STMicroelectronics products & documentation.</p>
                  <div className="welcome-chips">
                    {[
                      "Generate a dashboard UI",
                      "Explain STM32 GPIO setup",
                      "Analyze a circuit schematic",
                      "Create a landing page",
                    ].map((text) => (
                      <button key={text} type="button" className="welcome-chip" onClick={() => { setInput(text); textareaRef.current?.focus(); }}>
                        {text}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages */}
              {messages.map((msg, idx) => (
                <article key={`${msg.role}-${idx}`} className={`message ${msg.role}`}>
                  <div className="message-inner">
                    <div className="msg-avatar">
                      {msg.role === "assistant" ? <STLogo /> : "You"}
                    </div>
                    <div className="msg-body">
                      {msg.images?.length > 0 && (
                        <div className="msg-image-grid">
                          {msg.images.map((src, i) => (
                            <img key={i} src={src} alt={`Attachment ${i + 1}`} className="msg-image-thumb" />
                          ))}
                        </div>
                      )}
                      {msg.files?.length > 0 && msg.files.map((f, i) => (
                        <div key={i} className="msg-file-badge">
                          <IconFile />
                          <span className="msg-file-name">{f.name}</span>
                          <span className="msg-file-size">{formatFileSize(f.size)}</span>
                        </div>
                      ))}

                      {/* Streaming or static bubble */}
                      {msg.streaming && idx === streamingMsgIdx ? (
                        <StreamingBubble
                          content={msg.content}
                          isStreaming={true}
                          onStreamDone={() => handleStreamDone(idx)}
                        />
                      ) : (
                        <div className="msg-bubble" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                      )}

                      {/* Artifact badge (Claude-style) */}
                      {msg.artifact && !msg.streaming && (
                        <button
                          type="button"
                          className="artifact-badge"
                          onClick={() => {
                            setActiveArtifact(msg.artifact);
                            setUiBuilderEnabled(true);
                            setArtifactView("ui");
                          }}
                        >
                          <div className="artifact-badge-icon"><IconLayout /></div>
                          <div className="artifact-badge-text">
                            <strong>{msg.artifact.title || "Generated UI"}</strong>
                            <span>Click to view live preview</span>
                          </div>
                          <div className="artifact-badge-arrow">→</div>
                        </button>
                      )}

                      {/* Meta */}
                      {!msg.streaming && (
                        <div className="msg-meta">
                          <span className="msg-time">{formatTime(msg.time)}</span>
                          {msg.role === "assistant" && (
                            <button type="button" className="msg-action-btn" title="Copy" onClick={() => navigator.clipboard.writeText(msg.content)}>
                              <IconCopy />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              ))}

              {/* Typing indicator */}
              {loading && streamingMsgIdx === -1 && (
                <article className="message assistant">
                  <div className="message-inner">
                    <div className="msg-avatar"><STLogo /></div>
                    <div className="msg-body">
                      <div className="msg-bubble">
                        <div className="typing-indicator">
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              )}

              {/* ── "Build a UI?" prompt (Claude-style) ── */}
              <UIBuildPrompt
                visible={showBuildPrompt}
                onYes={handleBuildUI}
                onDismiss={() => setShowBuildPrompt(false)}
              />

              <div ref={messagesEndRef} />
            </div>

            {/* ── Composer ── */}
            <footer className="composer">
              <div className="composer-inner">
                {attachments.length > 0 && (
                  <div className="attachment-preview">
                    {attachments.map((att, idx) =>
                      att.isImage ? (
                        <div key={idx} className="attach-thumb">
                          <img src={att.preview} alt={att.name} />
                          <button type="button" className="attach-remove" onClick={() => removeAttachment(idx)}>✕</button>
                        </div>
                      ) : (
                        <div key={idx} className="attach-thumb attach-thumb-file">
                          <IconFile /><span>{att.name}</span>
                          <button type="button" className="attach-remove" onClick={() => removeAttachment(idx)}>✕</button>
                        </div>
                      )
                    )}
                  </div>
                )}

                <div className="input-row">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    placeholder="Message ALFRED..."
                    rows={1}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    onPaste={onPaste}
                  />
                  <button type="button" className="composer-btn" title="Attach files or images" onClick={() => fileInputRef.current?.click()}>
                    <IconPaperclip />
                  </button>
                  <input ref={fileInputRef} type="file" className="hidden-input" multiple
                    accept="image/*,.pdf,.txt,.csv,.json,.md,.html,.css,.js,.py,.c,.h,.xml"
                    onChange={(e) => { if (e.target.files?.length) processFiles(e.target.files); e.target.value = ""; }}
                  />
                  <button type="button" className="send-btn" onClick={sendMessage}
                    disabled={loading || (!input.trim() && attachments.length === 0)} title="Send message">
                    <IconSend />
                  </button>
                </div>

                <div className="composer-hint">
                  <span>ALFRED can make mistakes. Verify important info.</span>
                  <span>{input.length > 0 ? `${input.length} chars` : "Shift+Enter for new line"}</span>
                </div>
              </div>
            </footer>
          </section>

          {/* ═══ Builder Panel ═══ */}
          {uiBuilderEnabled && (
            <aside className="builder-panel">
              <header className="builder-header">
                <div>
                  <h2>
                    {generatingLabel || activeArtifact?.title || "UI Builder"}
                    {isArtifactStreaming && <span className="generating-pulse" />}
                  </h2>
                  <p>Preview or inspect generated markup</p>
                </div>
                <div className="view-tabs">
                  <button type="button" className={`view-tab ${artifactView === "ui" ? "active" : ""}`}
                    onClick={() => setArtifactView("ui")}>
                    Preview
                  </button>
                  <button type="button" className={`view-tab ${artifactView === "html" ? "active" : ""}`}
                    onClick={() => setArtifactView("html")}>
                    Code
                  </button>
                </div>
              </header>

              <section className="builder-body">
                {/* No artifact yet & not streaming */}
                {!activeArtifact && !streamingArtifactCode && (
                  <div className="builder-placeholder">
                    <IconLayout />
                    <h3>UI Builder Active</h3>
                    <p>Ask for a component, page, or prototype and it will render live right here.</p>
                  </div>
                )}

                {/* Streaming code animation */}
                {streamingArtifactCode && artifactView === "html" && (
                  <StreamingCodeViewer
                    code={streamingArtifactCode}
                    isStreaming={isArtifactStreaming}
                  />
                )}

                {/* Non-streaming code view */}
                {activeArtifact && artifactView === "html" && !isArtifactStreaming && !streamingArtifactCode && (
                  <textarea readOnly value={artifactDocument} className="code-box" />
                )}

                {/* Live preview */}
                {activeArtifact && artifactView === "ui" && (
                  <div className="preview-container">
                    {isArtifactStreaming && (
                      <div className="preview-loading">
                        <div className="preview-spinner" />
                        <span>Building preview...</span>
                      </div>
                    )}
                    <iframe
                      title="Generated UI"
                      srcDoc={artifactDocument}
                      sandbox="allow-scripts allow-modals"
                      style={{ opacity: isArtifactStreaming ? 0.3 : 1, transition: "opacity 0.5s ease" }}
                    />
                  </div>
                )}
              </section>
            </aside>
          )}
        </div>

        {/* ═══ Footer ═══ */}
        <footer className="app-footer">
          <div className="footer-main">
            <div className="footer-col">
              <h4>STMicroelectronics</h4>
              <p className="footer-brand-desc">A world leader in semiconductor solutions, serving customers across the spectrum of electronics applications.</p>
              <div className="footer-social">
                <button type="button" className="footer-social-btn" title="Website"><IconGlobe /></button>
                <button type="button" className="footer-social-btn" title="GitHub"><IconCode /></button>
                <button type="button" className="footer-social-btn" title="Links"><IconLink /></button>
              </div>
            </div>
            <div className="footer-col">
              <h4>Products</h4>
              <button type="button" className="footer-link">Microcontrollers</button>
              <button type="button" className="footer-link">Sensors</button>
              <button type="button" className="footer-link">Power Management</button>
              <button type="button" className="footer-link">Automotive ICs</button>
            </div>
            <div className="footer-col">
              <h4>Resources</h4>
              <button type="button" className="footer-link">Documentation</button>
              <button type="button" className="footer-link">Developer Tools</button>
              <button type="button" className="footer-link">Community</button>
              <button type="button" className="footer-link">Support</button>
            </div>
            <div className="footer-col">
              <h4>Company</h4>
              <button type="button" className="footer-link">About ST</button>
              <button type="button" className="footer-link">Careers</button>
              <button type="button" className="footer-link">Sustainability</button>
              <button type="button" className="footer-link">Contact</button>
            </div>
          </div>
          <div className="footer-bottom">
            © {new Date().getFullYear()} STMicroelectronics · ALFRED AI Assistant · life.augmented
          </div>
        </footer>
      </div>
    </div>
  );
}
