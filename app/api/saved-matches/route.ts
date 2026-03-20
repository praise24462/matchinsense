import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/services/prisma";

// GET — list all saved matches for current user
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    
    try {
      const user = await prisma.user.findUnique({ where: { email: session.user.email } });
      if (!user) return NextResponse.json([], { status: 200 });

      const saved = await prisma.savedMatch.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(saved);
    } catch (dbErr: any) {
      console.error("[GET /api/saved-matches] DB error:", dbErr.message);
      return NextResponse.json([], { status: 200 }); // Fallback: return empty list on DB error
    }
  } catch (err: any) {
    console.error("[GET /api/saved-matches] Auth error:", err.message);
    return NextResponse.json({ message: "Error" }, { status: 401 });
  }
}

// POST — save or unsave a match
export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch (parseErr: any) {
      console.error("[POST /api/saved-matches] JSON parse error:", parseErr.message);
      return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
    }

    const { matchId, action } = body;

    if (!matchId || !["save", "unsave"].includes(action)) {
      return NextResponse.json({ message: "Invalid request" }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
      const user = await prisma.user.findUnique({ where: { email: session.user.email } });
      if (!user) {
        return NextResponse.json({ message: "User not found" }, { status: 404 });
      }

      if (action === "save") {
        // Upsert to handle duplicates gracefully
        await prisma.savedMatch.upsert({
          where: { userId_matchId: { userId: user.id, matchId } },
          update: {},
          create: { userId: user.id, matchId },
        });
        return NextResponse.json({ saved: true });
      } else {
        // Unsave
        await prisma.savedMatch.deleteMany({
          where: { userId: user.id, matchId },
        });
        return NextResponse.json({ saved: false });
      }
    } catch (dbErr: any) {
      console.error("[POST /api/saved-matches] DB error:", dbErr.message);
      return NextResponse.json({ message: "Database error" }, { status: 500 });
    }
  } catch (err: any) {
    console.error("[POST /api/saved-matches] Unexpected error:", err.message);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
