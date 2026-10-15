import { NextRequest, NextResponse } from "next/server";
import { isErrorResponse } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { readDb } from "@/lib/store";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (isErrorResponse(admin)) return admin;

  const db = await readDb();
  return NextResponse.json({
    total: db.voters.length,
    votedCount: db.voters.filter((v) => v.hasVoted).length,
    voters: db.voters.map((v) => ({
      id: v.id,
      name: v.name,
      hasVoted: v.hasVoted,
      votedAt: v.votedAt,
      createdAt: v.createdAt,
    })),
  });
}
