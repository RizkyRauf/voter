import { NextRequest, NextResponse } from "next/server";
import {
  assertSameOrigin,
  clearFailures,
  clientIp,
  isErrorResponse,
  jsonError,
  readJsonBody,
  recordFailure,
  tooManyFailures,
} from "@/lib/api";
import { normalizeCode } from "@/lib/codes";
import { setVoterSession } from "@/lib/auth";
import { readDb } from "@/lib/store";

const SESSION_LIMIT = 10;
const SESSION_WINDOW_MS = 5 * 60 * 1000;

export async function POST(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const body = await readJsonBody(req);
  if (isErrorResponse(body)) return body;

  const code = normalizeCode((body as { code?: unknown }).code);
  if (!code) return jsonError(400, "Kode pemilih wajib diisi");

  const key = `voter-session:${clientIp(req)}`;
  if (tooManyFailures(key, SESSION_LIMIT, SESSION_WINDOW_MS)) {
    return jsonError(429, "Terlalu banyak percobaan. Coba lagi nanti.");
  }

  const db = await readDb();
  const voter = db.voters.find((v) => v.code === code);
  if (!voter) {
    recordFailure(key, SESSION_LIMIT, SESSION_WINDOW_MS);
    return jsonError(404, "Kode tidak valid");
  }

  clearFailures(key);
  const res = NextResponse.json({ ok: true, hasVoted: voter.hasVoted });
  setVoterSession(res, voter.id, db.secret);
  return res;
}
