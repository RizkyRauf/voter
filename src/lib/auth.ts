import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "./api";
import { readDb } from "./store";
import type { Admin, Voter } from "./types";

export const ADMIN_SESSION_COOKIE = "admin_session";
export const VOTER_SESSION_COOKIE = "voter_session";

const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours
const VOTER_SESSION_MAX_AGE = 60 * 60 * 24; // 24 hours

interface SessionPayload {
  sub: string;
  typ: "admin" | "voter";
  /** expiry in epoch milliseconds */
  exp: number;
}

function sign(payload: SessionPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyToken(token: string | undefined, secret: string): SessionPayload | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (
      typeof payload.sub !== "string" ||
      (payload.typ !== "admin" && payload.typ !== "voter") ||
      typeof payload.exp !== "number" ||
      payload.exp < Date.now()
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export function setAdminSession(res: NextResponse, adminId: string, secret: string): void {
  const token = sign(
    { sub: adminId, typ: "admin", exp: Date.now() + ADMIN_SESSION_MAX_AGE * 1000 },
    secret,
  );
  res.cookies.set(ADMIN_SESSION_COOKIE, token, sessionCookieOptions(ADMIN_SESSION_MAX_AGE));
}

export function setVoterSession(res: NextResponse, voterId: string, secret: string): void {
  const token = sign(
    { sub: voterId, typ: "voter", exp: Date.now() + VOTER_SESSION_MAX_AGE * 1000 },
    secret,
  );
  res.cookies.set(VOTER_SESSION_COOKIE, token, sessionCookieOptions(VOTER_SESSION_MAX_AGE));
}

export function clearSession(res: NextResponse, name: string): void {
  res.cookies.set(name, "", { ...sessionCookieOptions(0), maxAge: 0 });
}

export async function getAdminFromRequest(req: NextRequest): Promise<Admin | null> {
  const db = await readDb();
  const payload = verifyToken(req.cookies.get(ADMIN_SESSION_COOKIE)?.value, db.secret);
  if (!payload || payload.typ !== "admin") return null;
  return db.admins.find((a) => a.id === payload.sub) ?? null;
}

export async function getVoterFromRequest(req: NextRequest): Promise<Voter | null> {
  const db = await readDb();
  const payload = verifyToken(req.cookies.get(VOTER_SESSION_COOKIE)?.value, db.secret);
  if (!payload || payload.typ !== "voter") return null;
  return db.voters.find((v) => v.id === payload.sub) ?? null;
}

export async function requireAdmin(req: NextRequest): Promise<Admin | NextResponse> {
  const admin = await getAdminFromRequest(req);
  if (!admin) return jsonError(401, "Silakan login sebagai admin terlebih dahulu");
  return admin;
}
