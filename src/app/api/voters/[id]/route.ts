import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, isErrorResponse, jsonError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { updateDb } from "@/lib/store";

type DeleteOutcome =
  | { ok: true; removedVotes: number }
  | { ok: false; reason: "not-found" };

/**
 * Remove a voter entry — and any vote it cast — so admins can clean up
 * odd or duplicate names at any point during the event.
 */
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const admin = await requireAdmin(req);
  if (isErrorResponse(admin)) return admin;

  const { id } = await ctx.params;

  const outcome = await updateDb((db): DeleteOutcome => {
    const index = db.voters.findIndex((v) => v.id === id);
    if (index === -1) return { ok: false, reason: "not-found" };
    db.voters.splice(index, 1);
    const before = db.votes.length;
    db.votes = db.votes.filter((vote) => vote.voterId !== id);
    return { ok: true, removedVotes: before - db.votes.length };
  });

  if (!outcome?.ok) {
    return jsonError(404, "Pemilih tidak ditemukan");
  }
  return NextResponse.json({ ok: true, removedVotes: outcome.removedVotes });
}
