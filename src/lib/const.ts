export const IS_DEV = process.env.NODE_ENV !== "production";
export const IS_BROWSER = typeof window !== "undefined";

declare const EdgeRuntime: any;
export const IS_EDGE_RUNTIME = typeof EdgeRuntime !== "undefined";

export const PROMPT_PASTE_MAX_LENGTH = 1000;

export const IS_VERCEL = process.env.VERCEL === "1";

export const IS_MCP_SERVER_SSE_ONLY = IS_VERCEL;
