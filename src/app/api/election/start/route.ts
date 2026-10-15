import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, isErrorResponse } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { updateDb } from "@/lib/store";
import type { Election } from "@/lib/types";

type StartOutcome =
  | { ok: true; election: Election }
  | { ok: false; reason: "not-draft" | "too-few-candidates" };

export async function POST(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const admin = await requireAdmin(req);
  if (isErrorResponse(admin)) return admin;

  const outcome = await updateDb((db): StartOutcome => {
    if (db.election.status !== "DRAFT") return { ok: false, reason: "not-draft" };
    if (db.candidates.length < 2) return { ok: false, reason: "too-few-candidates" };
    db.election.status = "OPEN";
    db.election.startedAt = new Date().toISOString();
    return { ok: true, election: { ...db.election } };
  });

  if (!outcome?.ok) {
    return outcome?.reason === "too-few-candidates"
      ? NextResponse.json(
          { error: "Minimal 2 peserta untuk memulai voting" },
          { status: 400 },
        )
      : NextResponse.json({ error: "Voting sudah pernah dimulai" }, { status: 409 });
  }
  return NextResponse.json(outcome.election);
}
