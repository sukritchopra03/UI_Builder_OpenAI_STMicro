import cors from "cors";
import dotenv from "dotenv";
import express from "express";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 8787);
const apiKey =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.X_GOOG_API_KEY;
const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const geminiBaseUrl =
  process.env.GEMINI_API_BASE_URL ||
  "https://generativelanguage.googleapis.com/v1beta";
const allowInsecureTLS =
  String(
    process.env.GEMINI_ALLOW_INSECURE_TLS ||
      process.env.OPENAI_ALLOW_INSECURE_TLS ||
      ""
  ).toLowerCase() === "true";

if (allowInsecureTLS) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const assistantPrompt = `You are ALFRED, an expert AI assistant for STMicroelectronics.
You help with electronics, embedded systems, STM32 microcontrollers, semiconductor products,
UI/UX design, and general technical questions.
Keep responses concise, practical, and implementation-focused.
When showing code, use markdown code blocks with language identifiers.
Use **bold** for emphasis and structure your responses with clear formatting.`;

const uiBuilderPrompt = `UI BUILDER MODE IS ENABLED.
Return strict JSON only, no markdown fences.
Schema:
{
  "reply": "short assistant response",
  "artifact": {
    "title": "short title",
    "html": "body-only HTML markup",
    "css": "CSS for the html",
    "js": "optional JS for interactions"
  }
}
Rules:
- Always include reply.
- Include artifact for any request that asks for UI/code/prototype.
- html must not include <html>, <head>, or <body>.
- Keep css scoped so the preview looks clean.
- Use modern CSS with great aesthetics. Use Inter font.
- If JS is not needed, return an empty string.
`;

const imageAnalysisPrompt = `The user has attached image(s) to their message. 
Analyze the image(s) carefully and respond to the user's query about them.
If the image appears to be a UI screenshot, webpage, or design mockup, describe
the layout, components, colors, typography, and suggest improvements or provide
code to replicate/enhance it.
If no text query is provided, describe what you see in detail.`;

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m) => m && typeof m.content === "string")
    .filter((m) => ["user", "assistant"].includes(m.role))
    .map((m) => ({ role: m.role, content: m.content.trim() }))
    .filter((m) => m.content.length > 0);
}

function toGeminiContents(messages, images) {
  const contents = messages.map((m, idx) => {
    const parts = [{ text: m.content }];

    // Add images only to the last user message
    if (
      m.role === "user" &&
      idx === messages.length - 1 &&
      Array.isArray(images) &&
      images.length > 0
    ) {
      for (const img of images) {
        if (img.data && img.mimeType) {
          parts.push({
            inlineData: {
              mimeType: img.mimeType,
              data: img.data,
            },
          });
        }
      }
    }

    return {
      role: m.role === "assistant" ? "model" : "user",
      parts,
    };
  });
  return contents;
}

function extractGeminiText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .filter((p) => typeof p?.text === "string")
    .map((p) => p.text)
    .join("\n")
    .trim();
}

function tryParseJSON(text) {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch?.[1]) {
      try {
        return JSON.parse(fencedMatch[1].trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

function normalizeArtifact(artifact) {
  if (!artifact || typeof artifact !== "object") return null;
  const html = typeof artifact.html === "string" ? artifact.html : "";
  const css = typeof artifact.css === "string" ? artifact.css : "";
  const js = typeof artifact.js === "string" ? artifact.js : "";
  const title =
    typeof artifact.title === "string" ? artifact.title : "Live UI";
  if (!html.trim() && !css.trim() && !js.trim()) return null;
  return { title, html, css, js };
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    provider: "gemini",
    model,
    hasApiKey: Boolean(apiKey),
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    if (!apiKey) {
      return res
        .status(500)
        .json({ error: "GEMINI_API_KEY is missing in .env" });
    }

    const { messages, uiBuilder, images } = req.body || {};
    const normalizedMessages = normalizeMessages(messages);

    if (normalizedMessages.length === 0) {
      return res.status(400).json({ error: "messages is required" });
    }

    // Build system prompt
    let systemText = assistantPrompt;
    if (uiBuilder) systemText += "\n\n" + uiBuilderPrompt;
    if (Array.isArray(images) && images.length > 0) {
      systemText += "\n\n" + imageAnalysisPrompt;
    }

    const response = await fetch(
      `${geminiBaseUrl}/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemText }],
          },
          contents: toGeminiContents(normalizedMessages, images),
          generationConfig: {
            temperature: 0.7,
          },
        }),
      }
    );

    const payload = await response.json();
    if (!response.ok) {
      const detail =
        payload?.error?.message || payload?.error || "Gemini request failed";
      return res.status(response.status || 500).json({ error: detail });
    }

    const output = extractGeminiText(payload);
    if (!output) {
      const blockReason = payload?.promptFeedback?.blockReason;
      const detail = blockReason
        ? `No text returned from Gemini (${blockReason}).`
        : "No text returned from Gemini.";
      return res.status(502).json({ error: detail });
    }

    if (!uiBuilder) {
      return res.json({ reply: output, artifact: null });
    }

    const parsed = tryParseJSON(output);
    const artifact = normalizeArtifact(parsed?.artifact);
    const reply =
      typeof parsed?.reply === "string" && parsed.reply.trim()
        ? parsed.reply.trim()
        : output;

    return res.json({ reply, artifact });
  } catch (error) {
    const detail = error?.message || "Unexpected error";
    return res.status(500).json({ error: detail });
  }
});

if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`ALFRED server running on http://localhost:${port}`);
  });
}

export default app;
