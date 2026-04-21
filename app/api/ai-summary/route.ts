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

    const prompt = `You're a football writer for a top sports outlet. A fan just watched this match and wants the lowdown—what happened, who was brilliant, who flopped, why it mattered. Give them a human take, not a robot summary.

${resultLine}
${htScore}

Goal Timeline:
${goalLines || "  No goals recorded."}

Match Statistics:
${statsText}

Write 3 tight paragraphs:

Paragraph 1 — How It Unfolded: Tell the story. Which team started hot? When did it flip? Were there turning points? Make it vivid.

Paragraph 2 — The Tactical Battle: Who won the midfield? Did the defense hold up? Were there standout performances or defensive disasters? Name players if you can.

Paragraph 3 — Verdict: Who deserved the result? What does this mean for both teams? Any wild cards or surprises?

Style: Like you're writing for ESPN or Sky Sports—punchy, opinionated, human. Use contractions. Sound like you cared about watching this. Under 250 words.`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8,
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
