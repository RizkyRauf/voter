import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, isErrorResponse, jsonError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { deleteVoter } from "@/lib/store";

/**
 * Remove a voter entry — and any vote it cast (FK cascade) — so admins can
 * clean up odd or duplicate names at any point during the event.
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

  const outcome = await deleteVoter(id);

  if (!outcome.ok) {
    return jsonError(404, "Pemilih tidak ditemukan");
  }
  return NextResponse.json({ ok: true, removedVotes: outcome.removedVotes });
}
