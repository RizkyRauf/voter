import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, isErrorResponse, readJsonBody } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { updateDb } from "@/lib/store";
import type { Election } from "@/lib/types";

type StopOutcome =
  | { ok: true; election: Election }
  | { ok: false; reason: "not-open" };

export async function POST(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const admin = await requireAdmin(req);
  if (isErrorResponse(admin)) return admin;

  const body = await readJsonBody(req);
  if (isErrorResponse(body)) return body;

  if (body.confirm !== true) {
    return NextResponse.json(
      { error: "Konfirmasi diperlukan untuk menghentikan voting" },
      { status: 400 },
    );
  }

  const outcome = await updateDb((db): StopOutcome => {
    if (db.election.status !== "OPEN") return { ok: false, reason: "not-open" };
    db.election.status = "CLOSED";
    db.election.closedAt = new Date().toISOString();
    return { ok: true, election: { ...db.election } };
  });

  if (!outcome?.ok) {
    return NextResponse.json({ error: "Voting sedang tidak berjalan" }, { status: 409 });
  }
  return NextResponse.json(outcome.election);
}
