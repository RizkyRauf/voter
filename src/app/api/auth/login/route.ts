import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
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
import { setAdminSession } from "@/lib/auth";
import { ensureAdmin, findAdminByUsername, getSessionSecret } from "@/lib/store";

const LOGIN_LIMIT = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const body = await readJsonBody(req);
  if (isErrorResponse(body)) return body;

  const { username, password } = body as { username?: unknown; password?: unknown };
  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    username.trim() === "" ||
    password === ""
  ) {
    return jsonError(400, "Username dan password wajib diisi");
  }

  const key = `login:${clientIp(req)}:${username.trim().toLowerCase()}`;
  if (tooManyFailures(key, LOGIN_LIMIT, LOGIN_WINDOW_MS)) {
    return jsonError(429, "Terlalu banyak percobaan login. Coba lagi nanti.");
  }

  await ensureAdmin();
  const admin = await findAdminByUsername(username.trim());
  const valid = admin ? await bcrypt.compare(password, admin.passwordHash) : false;

  if (!admin || !valid) {
    recordFailure(key, LOGIN_LIMIT, LOGIN_WINDOW_MS);
    return jsonError(401, "Username atau password salah");
  }

  clearFailures(key);
  const res = NextResponse.json({ ok: true, username: admin.username });
  setAdminSession(res, admin.id, await getSessionSecret());
  return res;
}
