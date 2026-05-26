import { QueryResponse } from "./types";

const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export async function queryAgent(query: string, topK: number): Promise<QueryResponse> {
  const response = await fetch(`${baseUrl}/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query, top_k: topK })
  });

  if (!response.ok) {
    throw new Error("Query failed");
  }

  return response.json();
}
