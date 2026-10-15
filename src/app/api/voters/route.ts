import { NextRequest, NextResponse, connection } from "next/server";
import { isErrorResponse } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { listVotersWithChoice } from "@/lib/store";

export async function GET(req: NextRequest) {
  await connection();
  const admin = await requireAdmin(req);
  if (isErrorResponse(admin)) return admin;

  const voters = await listVotersWithChoice();
  return NextResponse.json({
    total: voters.length,
    votedCount: voters.filter((v) => v.hasVoted).length,
    voters: voters.map((v) => ({
      id: v.id,
      name: v.name,
      hasVoted: v.hasVoted,
      choice: v.choice,
      votedAt: v.votedAt,
      createdAt: v.createdAt,
    })),
  });
}
