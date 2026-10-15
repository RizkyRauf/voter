import { NextRequest, NextResponse, connection } from "next/server";
import { assertSameOrigin, isErrorResponse, jsonError, readJsonBody } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { createCandidate, listCandidates } from "@/lib/store";
import { nameKey, validateName, validateOptionalText } from "@/lib/validation";

export async function GET(req: NextRequest) {
  await connection();
  const admin = await requireAdmin(req);
  if (isErrorResponse(admin)) return admin;

  const candidates = await listCandidates();
  return NextResponse.json(
    candidates.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      photoUrl: c.photoUrl,
      createdAt: c.createdAt,
    })),
  );
}

export async function POST(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const admin = await requireAdmin(req);
  if (isErrorResponse(admin)) return admin;

  const body = await readJsonBody(req);
  if (isErrorResponse(body)) return body;

  const name = validateName(body.name);
  if (name instanceof NextResponse) return name;
  const description = validateOptionalText(body.description, "Deskripsi");
  if (description instanceof NextResponse) return description;
  const photoUrl = validateOptionalText(body.photoUrl, "Foto");
  if (photoUrl instanceof NextResponse) return photoUrl;

  const outcome = await createCandidate({
    name,
    nameKey: nameKey(name),
    description,
    photoUrl,
  });

  if (!outcome.ok) {
    return outcome.reason === "duplicate"
      ? jsonError(400, "Nama peserta duplikat")
      : jsonError(409, "Peserta hanya dapat dikelola saat voting belum dimulai");
  }
  return NextResponse.json(outcome.candidate, { status: 201 });
}
