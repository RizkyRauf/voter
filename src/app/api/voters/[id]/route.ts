import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, isErrorResponse, jsonError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { updateDb } from "@/lib/store";

type DeleteOutcome =
  | { ok: true }
  | { ok: false; reason: "not-found" | "has-voted" | "not-draft" };

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
    if (db.election.status !== "DRAFT") return { ok: false, reason: "not-draft" };
    if (db.voters[index].hasVoted) return { ok: false, reason: "has-voted" };
    db.voters.splice(index, 1);
    return { ok: true };
  });

  if (!outcome?.ok) {
    switch (outcome?.reason) {
      case "has-voted":
        return jsonError(409, "Pemilih sudah memberikan suara");
      case "not-draft":
        return jsonError(409, "Pemilih hanya dapat dikelola saat voting belum dimulai");
      default:
        return jsonError(404, "Pemilih tidak ditemukan");
    }
  }
  return NextResponse.json({ ok: true });
}
