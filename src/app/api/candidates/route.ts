import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, isErrorResponse, jsonError, readJsonBody } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { updateDb } from "@/lib/store";
import type { Candidate } from "@/lib/types";
import { nameKey, validateName, validateOptionalText } from "@/lib/validation";

type CreateOutcome =
  | { ok: true; candidate: Candidate }
  | { ok: false; reason: "not-draft" | "duplicate" };

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

  const outcome = await updateDb((db): CreateOutcome => {
    if (db.election.status !== "DRAFT") return { ok: false, reason: "not-draft" };
    const key = nameKey(name);
    if (db.candidates.some((c) => nameKey(c.name) === key)) {
      return { ok: false, reason: "duplicate" };
    }
    const candidate: Candidate = {
      id: randomUUID(),
      name,
      description,
      photoUrl,
      createdAt: new Date().toISOString(),
    };
    db.candidates.push(candidate);
    return { ok: true, candidate };
  });

  if (!outcome?.ok) {
    return outcome?.reason === "duplicate"
      ? jsonError(400, "Nama peserta duplikat")
      : jsonError(409, "Peserta hanya dapat dikelola saat voting belum dimulai");
  }
  return NextResponse.json(outcome.candidate, { status: 201 });
}
