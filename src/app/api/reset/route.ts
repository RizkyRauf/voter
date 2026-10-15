import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, isErrorResponse, jsonError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { resetElectionState } from "@/lib/store";

export async function POST(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const admin = await requireAdmin(req);
  if (isErrorResponse(admin)) return admin;

  const outcome = await resetElectionState();

  if (!outcome.ok) {
    return jsonError(409, "Reset hanya bisa dilakukan setelah voting ditutup");
  }
  return NextResponse.json({ ok: true });
}
