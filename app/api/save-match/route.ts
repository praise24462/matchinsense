import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/services/prisma";

// POST — save a match
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  try {
    const { matchId } = await req.json();
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) throw new Error("User not found");

    const saved = await prisma.savedMatch.upsert({
      where: { userId_matchId: { userId: user.id, matchId } },
      update: {},
      create: { userId: user.id, matchId },
    });
    return NextResponse.json({ success: true, saved });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Failed to save match" }, { status: 500 });
  }
}

// DELETE — unsave a match
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  try {
    const { matchId } = await req.json();
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) throw new Error("User not found");

    await prisma.savedMatch.deleteMany({
      where: { userId: user.id, matchId },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Failed to unsave match" }, { status: 500 });
  }
}
