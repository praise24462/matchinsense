import { NextRequest, NextResponse } from "next/server";

// Simple in-memory storage (resets on server restart - for testing only)
const savedMatches = new Map<string, Set<number>>();

// For testing: use a fixed user ID
const TEST_USER = "test-user-123";

export async function GET(_req: NextRequest) {
  try {
    const saved = Array.from(savedMatches.get(TEST_USER) || new Set());
    return NextResponse.json(saved.map(matchId => ({ matchId })));
  } catch (err: any) {
    console.error("[GET /api/saved-matches-test]", err.message);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { matchId, action } = await req.json();

    if (!matchId || !["save", "unsave"].includes(action)) {
      return NextResponse.json({ message: "Invalid request" }, { status: 400 });
    }

    if (!savedMatches.has(TEST_USER)) {
      savedMatches.set(TEST_USER, new Set());
    }

    const userSaves = savedMatches.get(TEST_USER)!;

    if (action === "save") {
      userSaves.add(matchId);
      return NextResponse.json({ saved: true });
    } else {
      userSaves.delete(matchId);
      return NextResponse.json({ saved: false });
    }
  } catch (err: any) {
    console.error("[POST /api/saved-matches-test]", err.message);
    return NextResponse.json({ message: "Error" }, { status: 500 });
  }
}
