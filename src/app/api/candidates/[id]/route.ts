import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, isErrorResponse, jsonError, readJsonBody } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { deleteCandidate, updateCandidate } from "@/lib/store";
import { nameKey, validateName, validateOptionalText } from "@/lib/validation";

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

  const patch: {
    name?: string;
    nameKey?: string;
    description?: string | null;
    photoUrl?: string | null;
  } = {};

  if (hasName) {
    const validated = validateName(body.name);
    if (validated instanceof NextResponse) return validated;
    patch.name = validated;
    patch.nameKey = nameKey(validated);
  }
  if (hasDescription) {
    const validated = validateOptionalText(body.description, "Deskripsi");
    if (validated instanceof NextResponse) return validated;
    patch.description = validated;
  }
  if (hasPhotoUrl) {
    const validated = validateOptionalText(body.photoUrl, "Foto");
    if (validated instanceof NextResponse) return validated;
    patch.photoUrl = validated;
  }

  const outcome = await updateCandidate(id, patch);

  if (!outcome.ok) {
    switch (outcome.reason) {
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

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const admin = await requireAdmin(req);
  if (isErrorResponse(admin)) return admin;

  const { id } = await ctx.params;

  const outcome = await deleteCandidate(id);

  if (!outcome.ok) {
    return outcome.reason === "not-draft"
      ? jsonError(409, "Peserta hanya dapat dikelola saat voting belum dimulai")
      : jsonError(404, "Peserta tidak ditemukan");
  }
  return NextResponse.json({ ok: true });
}
