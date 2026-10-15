import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, isErrorResponse, jsonError, readJsonBody } from "@/lib/api";
import { getVoterFromRequest } from "@/lib/auth";
import {
  castVote,
  castVoteByName,
  type CastVoteOutcome,
} from "@/lib/store";
import { validateCandidateName } from "@/lib/validation";

function errorResponse(outcome: CastVoteOutcome): NextResponse | null {
  if (outcome.ok) return null;
  switch (outcome.reason) {
    case "not-started":
      return jsonError(403, "Voting belum dimulai");
    case "closed":
      return jsonError(403, "Voting telah ditutup");
    case "already-voted":
      return jsonError(409, "Anda sudah memberikan suara dan tidak dapat mengubahnya");
    case "voter-gone":
      return jsonError(401, "Anda tidak lagi terdaftar sebagai pemilih");
    case "candidate-not-found":
      return jsonError(404, "Peserta tidak ditemukan");
    case "invalid-name":
      return jsonError(400, "Nama peserta tidak valid");
    default:
      return jsonError(400, "Permintaan tidak valid");
  }
}

export async function POST(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const voter = await getVoterFromRequest(req);
  if (!voter) {
    return jsonError(401, "Masukkan nama Anda terlebih dahulu");
  }

  const body = await readJsonBody(req);
  if (isErrorResponse(body)) return body;

  const { candidateId, candidateName } = body as {
    candidateId?: unknown;
    candidateName?: unknown;
  };

  let outcome: CastVoteOutcome;
  if (candidateName !== undefined || candidateId === undefined) {
    // Jalur utama (Amd.4): nama peserta diketik bebas + typeahead.
    const validated = validateCandidateName(candidateName);
    if (validated instanceof NextResponse) return validated;
    outcome = await castVoteByName(voter.id, validated.name, validated.nameKey);
  } else {
    // Jalur lama (klien selama jendela deploy) — overload SQL lama.
    if (typeof candidateId !== "string" || candidateId.trim() === "") {
      return jsonError(400, "Pilihan peserta wajib diisi");
    }
    outcome = await castVote(voter.id, candidateId);
  }

  const error = errorResponse(outcome);
  if (error) return error;
  return NextResponse.json({ ok: true }, { status: 201 });
}
