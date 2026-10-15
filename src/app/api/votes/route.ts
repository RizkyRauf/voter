import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, isErrorResponse, jsonError, readJsonBody } from "@/lib/api";
import { getVoterFromRequest } from "@/lib/auth";
import { updateDb } from "@/lib/store";

type VoteOutcome =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "not-started"
        | "closed"
        | "voter-gone"
        | "already-voted"
        | "candidate-not-found";
    };

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

  const outcome = await updateDb((db): VoteOutcome => {
    if (db.election.status === "DRAFT") return { ok: false, reason: "not-started" };
    if (db.election.status === "CLOSED") return { ok: false, reason: "closed" };

    const current = db.voters.find((v) => v.id === voter.id);
    if (!current) return { ok: false, reason: "voter-gone" };
    // Unique constraint: one vote record per voter, enforced server-side.
    if (current.hasVoted || db.votes.some((vote) => vote.voterId === voter.id)) {
      return { ok: false, reason: "already-voted" };
    }
    const candidate = db.candidates.find((c) => c.id === candidateId);
    if (!candidate) return { ok: false, reason: "candidate-not-found" };

    current.hasVoted = true;
    current.votedAt = new Date().toISOString();
    db.votes.push({
      id: randomUUID(),
      voterId: voter.id,
      candidateId: candidate.id,
      createdAt: current.votedAt,
    });
    return { ok: true };
  });

  if (!outcome?.ok) {
    switch (outcome?.reason) {
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
