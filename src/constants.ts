export const ALLOWED_ORIGINS = ["https://makhdanramadhan-ui.github.io"] as const;
export const LOCALHOST_ORIGIN_PATTERN = /^http:\/\/localhost(?::\d+)?$/;

export const MAX_MESSAGES = 10;
export const MAX_CONTENT_CHARS = 500;
export const MAX_PAGE_CHARS = 80;
export const RATE_LIMIT_MAX = 100;
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
export const GEMINI_TIMEOUT_MS = 20_000;
export const GEMINI_MAX_OUTPUT_TOKENS = 1024;
export const GEMINI_TEMPERATURE = 0.4;

export const DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview";
