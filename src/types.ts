export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  page?: string;
  uiLang?: "id" | "en";
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
}

export interface Env {
  GEMINI_API_KEY: string;
  RATE_LIMITER: DurableObjectNamespace;
  GEMINI_MODEL?: string;
}
