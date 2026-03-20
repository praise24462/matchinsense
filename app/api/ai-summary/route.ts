import { NextRequest, NextResponse } from "next/server";
import type { SummaryRequest, SummaryResponse } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const GROQ_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_KEY) return NextResponse.json({ message: "GROQ_API_KEY not configured — get a free key at console.groq.com" }, { status: 500 });

    const body: SummaryRequest = await req.json();
    const { homeTeam, awayTeam, score, statistics, events, halfTimeScore } = body;

    if (!homeTeam || !awayTeam) return NextResponse.json({ message: "Missing match data" }, { status: 400 });

    const isFinished = score.home !== null && score.away !== null;
    const htScore = halfTimeScore?.home !== null && halfTimeScore?.away !== null
      ? `Half-time: ${homeTeam} ${halfTimeScore?.home} – ${halfTimeScore?.away} ${awayTeam}` : "";

    const goals = (events ?? []).filter(e => ["Goal","OwnGoal","Penalty"].includes(e.type));
    const goalLines = goals.map(g => {
      const team = g.team === "home" ? homeTeam : awayTeam;
      const type = g.type === "OwnGoal" ? " (OG)" : g.type === "Penalty" ? " (pen)" : "";
      return `  ${g.minute}' – ${g.player}${type} (${team})${g.detail ? `, ${g.detail}` : ""}`;
    }).join("\n");

    const statsText = statistics.length > 0
      ? statistics.slice(0, 8).map(s => `  ${s.label}: ${s.home} (${homeTeam}) vs ${s.away} (${awayTeam})`).join("\n")
      : "  Statistics not available for this match.";

    const resultLine = isFinished
      ? `Result: ${homeTeam} ${score.home} – ${score.away} ${awayTeam}`
      : `Status: Match upcoming / in progress`;

    const prompt = `You are a professional football analyst for PitchIntel. Write a compelling 3-paragraph match report.

${resultLine}
${htScore}

Goal Timeline:
${goalLines || "  No goals recorded."}

Match Statistics:
${statsText}

Instructions:
- Paragraph 1: Match narrative — how the game unfolded, key moments, goals
- Paragraph 2: Tactical analysis — which team dominated, key stats, momentum shifts
- Paragraph 3: Verdict — which team deserved the result, standout performances, what it means for both clubs

Style: Professional sports journalism. Under 250 words. No bullet points. No headers.`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.75,
        max_tokens: 500,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? `Groq error ${res.status}`);
    }

    const data = await res.json();
    const summary = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!summary) throw new Error("Empty response from AI");

    return NextResponse.json({ summary, generatedAt: new Date().toISOString() } satisfies SummaryResponse);
  } catch (err: any) {
    console.error("[ai-summary]", err);
    return NextResponse.json({ message: err?.message ?? "Server error" }, { status: 500 });
  }
}
