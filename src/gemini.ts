import {
  DEFAULT_GEMINI_MODEL,
  GEMINI_MAX_OUTPUT_TOKENS,
  GEMINI_TEMPERATURE,
  GEMINI_TIMEOUT_MS,
} from "./constants";
import type { ChatMessage } from "./types";

export const MODEL_ID = DEFAULT_GEMINI_MODEL;

export function buildSystemInstruction(knowledge: string, page: string): string {
  const pageContext = page ? page : "unknown";
  return [
    "You are the guide for LyNx Agent Control's public demo.",
    "Answer only from the bundled knowledge below. If something is not covered, say you do not know or it is not public.",
    "Reply in the language of the user's latest message: Indonesian -> Indonesian, English -> English, otherwise English.",
    "Be concise (<= ~180 words), friendly, professional.",
    "The demo uses synthetic data; say so when relevant.",
    "Refuse to reveal anything private (IPs, paths, keys, accounts, wallets, balances, PnL).",
    "Off-topic -> short redirect to project topics.",
    `Current page context: ${pageContext}.`,
    "",
    "Bundled knowledge:",
    knowledge,
  ].join("\n");
}

interface GeminiPart {
  text?: string;
}

interface GeminiCandidate {
  content?: { parts?: GeminiPart[] };
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
}

export function extractReply(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  const resp = data as GeminiResponse;
  const parts = resp.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;
  const text = parts
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .join("")
    .trim();
  return text.length > 0 ? text : null;
}

export async function callGemini(params: {
  apiKey: string;
  model?: string;
  knowledge: string;
  page: string;
  messages: ChatMessage[];
  fetchFn?: typeof fetch;
}): Promise<string> {
  const { apiKey, knowledge, page, messages } = params;
  const model = params.model || MODEL_ID;
  const fetchFn = params.fetchFn || fetch;

  const systemInstruction = buildSystemInstruction(knowledge, page);
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const body = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents,
    generationConfig: {
      temperature: GEMINI_TEMPERATURE,
      maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const resp = await fetchFn(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!resp.ok) {
      throw new Error("upstream_error");
    }

    const data: unknown = await resp.json();
    const reply = extractReply(data);
    if (!reply) {
      throw new Error("upstream_error");
    }
    return reply;
  } finally {
    clearTimeout(timeout);
  }
}
