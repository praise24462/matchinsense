import type { SummaryRequest, SummaryResponse } from "@/types";

export async function generateMatchSummary(req: SummaryRequest): Promise<SummaryResponse> {
  const res = await fetch("/api/ai-summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Failed to generate summary");
  }
  return res.json();
}
