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

    const prompt = `You are a legendary football analyst at Sky Sports. Write a pre-match preview that reads like you're chatting with a friend who loves football—excited, opinionated, conversational.

Match: ${homeTeam} vs ${awayTeam}
Competition: ${competition}
Kickoff: ${kickoff}

Write exactly 3 paragraphs:

Paragraph 1 — The Scene: What's the vibe for this match? Is there bad blood? Are they fighting for something big? Are underdogs on a mission? Paint the picture like you're setting up the match on air.

Paragraph 2 — Form, Battles & Key Moments: Who's hot right now? Who's got injuries or suspensions? What's the tactical chess match going to look like? Name some players who'll decide this.

Paragraph 3 — Your Take: How's it going to play out? Who do you fancy? What's your gut telling you? Don't be generic—be bold, be specific, sound like you actually watched these teams play.

Style: Sky Sports meets your mate at the pub — punchy, opinionated, engaging. Use casual language. Sound human. "This is going to be brilliant" not "anticipated result." Under 280 words.`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.85,
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
