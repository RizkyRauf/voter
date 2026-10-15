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
import { getSessionSecret, registerVoter } from "@/lib/store";
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

  const voter = await registerVoter(name, nameKey);

  clearFailures(key);
  const res = NextResponse.json({ ok: true, hasVoted: voter.hasVoted });
  setVoterSession(res, voter.id, await getSessionSecret());
  return res;
}
