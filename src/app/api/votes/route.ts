import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, isErrorResponse, jsonError, readJsonBody } from "@/lib/api";
import { getVoterFromRequest } from "@/lib/auth";
import { castVote, type CastVoteOutcome } from "@/lib/store";

export async function POST(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const voter = await getVoterFromRequest(req);
  if (!voter) {
    return jsonError(401, "Masukkan nama Anda terlebih dahulu");
  }

  const body = await readJsonBody(req);
  if (isErrorResponse(body)) return body;

  const { candidateId } = body as { candidateId?: unknown };
  if (typeof candidateId !== "string" || candidateId.trim() === "") {
    return jsonError(400, "Pilihan peserta wajib diisi");
  }

  const outcome: CastVoteOutcome = await castVote(voter.id, candidateId);

  if (!outcome.ok) {
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
      default:
        return jsonError(400, "Permintaan tidak valid");
    }
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
