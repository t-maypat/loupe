import { QueryResponse } from "./types";

const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export async function queryAgent(
  query: string,
  topK: number,
  hcaptchaToken?: string
): Promise<QueryResponse> {
  const response = await fetch(`${baseUrl}/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(hcaptchaToken ? { "X-hCaptcha-Token": hcaptchaToken } : {})
    },
    credentials: "include",
    body: JSON.stringify({ query, top_k: topK, hcaptcha_token: hcaptchaToken ?? null })
  });

  if (!response.ok) {
    let detail = "Query failed";
    try {
      const payload = await response.json();
      detail = payload.detail || detail;
    } catch {
      // Ignore non-JSON errors and surface the generic fallback.
    }
    throw new Error(detail);
  }

  return response.json();
}
