import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, isErrorResponse, jsonError, readJsonBody } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { updateDb } from "@/lib/store";
import type { Candidate } from "@/lib/types";
import { nameKey, validateName, validateOptionalText } from "@/lib/validation";

type EditOutcome =
  | { ok: true; candidate: Candidate }
  | { ok: false; reason: "not-found" | "not-draft" | "duplicate" };

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const admin = await requireAdmin(req);
  if (isErrorResponse(admin)) return admin;

  const { id } = await ctx.params;

  const body = await readJsonBody(req);
  if (isErrorResponse(body)) return body;

  const hasName = body.name !== undefined;
  const hasDescription = body.description !== undefined;
  const hasPhotoUrl = body.photoUrl !== undefined;
  if (!hasName && !hasDescription && !hasPhotoUrl) {
    return jsonError(400, "Tidak ada perubahan yang dikirim");
  }

  let name: string | null = null;
  let description: string | null | undefined;
  let photoUrl: string | null | undefined;

  if (hasName) {
    const validated = validateName(body.name);
    if (validated instanceof NextResponse) return validated;
    name = validated;
  }
  if (hasDescription) {
    const validated = validateOptionalText(body.description, "Deskripsi");
    if (validated instanceof NextResponse) return validated;
    description = validated;
  }
  if (hasPhotoUrl) {
    const validated = validateOptionalText(body.photoUrl, "Foto");
    if (validated instanceof NextResponse) return validated;
    photoUrl = validated;
  }

  const outcome = await updateDb((db): EditOutcome => {
    const candidate = db.candidates.find((c) => c.id === id);
    if (!candidate) return { ok: false, reason: "not-found" };
    if (db.election.status !== "DRAFT") return { ok: false, reason: "not-draft" };
    if (name !== null) {
      const key = nameKey(name);
      const clash = db.candidates.some(
        (c) => c.id !== id && nameKey(c.name) === key,
      );
      if (clash) return { ok: false, reason: "duplicate" };
      candidate.name = name;
    }
    if (hasDescription) candidate.description = description ?? null;
    if (hasPhotoUrl) candidate.photoUrl = photoUrl ?? null;
    return { ok: true, candidate: { ...candidate } };
  });

  if (!outcome?.ok) {
    switch (outcome?.reason) {
      case "duplicate":
        return jsonError(400, "Nama peserta duplikat");
      case "not-draft":
        return jsonError(409, "Peserta hanya dapat dikelola saat voting belum dimulai");
      default:
        return jsonError(404, "Peserta tidak ditemukan");
    }
  }
  return NextResponse.json(outcome.candidate);
}

type DeleteOutcome = { ok: true } | { ok: false; reason: "not-found" | "not-draft" };

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
    const index = db.candidates.findIndex((c) => c.id === id);
    if (index === -1) return { ok: false, reason: "not-found" };
    if (db.election.status !== "DRAFT") return { ok: false, reason: "not-draft" };
    db.candidates.splice(index, 1);
    return { ok: true };
  });

  if (!outcome?.ok) {
    return outcome?.reason === "not-draft"
      ? jsonError(409, "Peserta hanya dapat dikelola saat voting belum dimulai")
      : jsonError(404, "Peserta tidak ditemukan");
  }
  return NextResponse.json({ ok: true });
}
