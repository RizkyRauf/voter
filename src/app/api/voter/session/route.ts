import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  assertSameOrigin,
  clearFailures,
  clientIp,
  isErrorResponse,
  jsonError,
  readJsonBody,
  tooManyFailures,
} from "@/lib/api";
import { setVoterSession } from "@/lib/auth";
import { readDb, updateDb } from "@/lib/store";
import { validateVoterName } from "@/lib/validation";

// Anti-spam only: a name is not a secret, so this just slows down someone
// mass-registering junk entries from one address.
const SESSION_LIMIT = 30;
const SESSION_WINDOW_MS = 5 * 60 * 1000;

export async function POST(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const body = await readJsonBody(req);
  if (isErrorResponse(body)) return body;

  const validated = validateVoterName((body as { name?: unknown }).name);
  if (isErrorResponse(validated)) return validated;
  const { name, nameKey } = validated;

  const key = `voter-session:${clientIp(req)}`;
  if (tooManyFailures(key, SESSION_LIMIT, SESSION_WINDOW_MS)) {
    return jsonError(429, "Terlalu banyak percobaan. Coba lagi nanti.");
  }

  const voter = await updateDb((db) => {
    const existing = db.voters.find((v) => v.nameKey === nameKey);
    if (existing) return existing;
    const created = {
      id: randomUUID(),
      name,
      nameKey,
      hasVoted: false,
      createdAt: new Date().toISOString(),
      votedAt: null,
    };
    db.voters.push(created);
    return created;
  });

  if (!voter) return jsonError(500, "Gagal membuat sesi pemilih");

  clearFailures(key);
  const db = await readDb();
  const res = NextResponse.json({ ok: true, hasVoted: voter.hasVoted });
  setVoterSession(res, voter.id, db.secret);
  return res;
}
