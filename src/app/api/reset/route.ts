import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, isErrorResponse, jsonError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { updateDb } from "@/lib/store";

type ResetOutcome = { ok: true } | { ok: false; reason: "not-closed" };

export async function POST(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const admin = await requireAdmin(req);
  if (isErrorResponse(admin)) return admin;

  const outcome = await updateDb((db): ResetOutcome => {
    if (db.election.status !== "CLOSED") return { ok: false, reason: "not-closed" };
    db.votes = [];
    for (const voter of db.voters) {
      voter.hasVoted = false;
      voter.votedAt = null;
    }
    db.election.status = "DRAFT";
    db.election.startedAt = null;
    db.election.closedAt = null;
    return { ok: true };
  });

  if (!outcome?.ok) {
    return jsonError(409, "Reset hanya bisa dilakukan setelah voting ditutup");
  }
  return NextResponse.json({ ok: true });
}
