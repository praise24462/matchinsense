import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const GROQ_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_KEY) return NextResponse.json({ message: "GROQ_API_KEY not configured — get a free key at console.groq.com" }, { status: 500 });

    const { homeTeam, awayTeam, competition, date } = await req.json();
    if (!homeTeam || !awayTeam) return NextResponse.json({ message: "Missing match data" }, { status: 400 });

    const kickoff = new Date(date).toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
    });

    const prompt = `You are a senior football analyst for PitchIntel. Write a compelling pre-match preview for the following fixture.

Match: ${homeTeam} vs ${awayTeam}
Competition: ${competition}
Kickoff: ${kickoff}

Write exactly 3 paragraphs:

Paragraph 1 — The Storyline: What makes this fixture special? Historical rivalry, title implications, relegation battle, cup stakes. Set the scene.

Paragraph 2 — Form & Key Battles: Current form of both teams, which players are in form, key tactical matchups to watch.

Paragraph 3 — The Prediction: How do you see this game unfolding? End with a confident prediction of the likely outcome and why.

Style: Think Sky Sports or BBC Sport — punchy, authoritative, engaging. No bullet points. No headers. Under 280 words total.`;

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
        max_tokens: 550,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? `Groq error ${res.status}`);
    }

    const data = await res.json();
    const preview = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!preview) throw new Error("Empty response from AI");

    return NextResponse.json({ preview, generatedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error("[ai-preview]", err);
    return NextResponse.json({ message: err?.message ?? "Failed to generate preview" }, { status: 500 });
  }
}
