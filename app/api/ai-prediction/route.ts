import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const GROQ_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_KEY) return NextResponse.json({ message: "GROQ_API_KEY not configured — get a free key at console.groq.com" }, { status: 500 });

    const { homeTeam, awayTeam, competition, date, score, events, status } = await req.json();
    if (!homeTeam || !awayTeam) return NextResponse.json({ message: "Missing match data" }, { status: 400 });

    const isFinished = status === "FT";
    const isUpcoming = status === "NS";

    const resultContext = isFinished
      ? `Final result: ${homeTeam} ${score?.home ?? 0} – ${score?.away ?? 0} ${awayTeam}`
      : `This match has not yet been played.`;

    const goalContext = isFinished && events?.length > 0
      ? `Goals: ${events.filter((e: any) => ["Goal","Penalty","OwnGoal"].includes(e.type))
          .map((e: any) => `${e.player} ${e.minute}' (${e.team === "home" ? homeTeam : awayTeam})`).join(", ")}`
      : "";

    const prompt = `You are a professional football betting analyst for PitchIntel. Provide a structured betting analysis for:

${homeTeam} vs ${awayTeam}
Competition: ${competition}
${resultContext}
${goalContext}

${isUpcoming
  ? `PRE-MATCH betting analysis. Use these exact labels:

PREDICTION: [predicted scoreline e.g. "1-2"]
CONFIDENCE: [Low / Medium / High]
BEST BET: [strongest single market pick e.g. "Both Teams to Score — Yes"]
REASONING: [2-3 sentences — form, head-to-head, home/away records]
ALSO CONSIDER: [Two secondary markets, one per line]`

  : `POST-MATCH analysis for future markets. Use these exact labels:

RESULT VERDICT: [e.g. "Expected win" / "Shock result" / "Fair draw"]
FORM SIGNAL: [What this result tells us about both teams going forward]
NEXT MATCH WATCH: [One forward-looking bet for each team's next fixture]`
}

Be specific. Reference teams by name. No generic statements.`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 450,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? `Groq error ${res.status}`);
    }

    const data = await res.json();
    const prediction = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!prediction) throw new Error("Empty response from AI");

    return NextResponse.json({ prediction, generatedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error("[ai-prediction]", err);
    return NextResponse.json({ message: err?.message ?? "Failed to generate prediction" }, { status: 500 });
  }
}
