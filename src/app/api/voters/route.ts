import { NextRequest, NextResponse } from "next/server";
import { isErrorResponse } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { listVoters } from "@/lib/store";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (isErrorResponse(admin)) return admin;

  const voters = await listVoters();
  return NextResponse.json({
    total: voters.length,
    votedCount: voters.filter((v) => v.hasVoted).length,
    voters: voters.map((v) => ({
      id: v.id,
      name: v.name,
      hasVoted: v.hasVoted,
      votedAt: v.votedAt,
      createdAt: v.createdAt,
    })),
  });
}
