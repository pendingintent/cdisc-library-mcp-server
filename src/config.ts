import "dotenv/config";

export const DEFAULT_BASE_URL = "https://library.cdisc.org/api";

export interface Settings {
  apiKey: string;
  baseUrl: string;
}

export function loadSettings(): Settings {
  const apiKey = process.env.CDISC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "CDISC_API_KEY is not set. Obtain a key from " +
        "https://library.cdisc.org and set it in the environment or a .env file."
    );
  }
  // `||` (not `??`) deliberately also falls back on an empty string: the MCPB manifest
  // maps this from an optional user_config field, and if a user leaves it blank, the
  // host may substitute "" into the env var rather than omitting it entirely.
  const baseUrl = process.env.CDISC_LIBRARY_BASE_URL || DEFAULT_BASE_URL;
  return { apiKey, baseUrl };
}
