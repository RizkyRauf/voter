import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/api";
import { ADMIN_SESSION_COOKIE, clearSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;
  const res = NextResponse.json({ ok: true });
  clearSession(res, ADMIN_SESSION_COOKIE);
  return res;
}
