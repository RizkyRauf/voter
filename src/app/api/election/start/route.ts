import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, isErrorResponse } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { startElection } from "@/lib/store";

export async function POST(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const admin = await requireAdmin(req);
  if (isErrorResponse(admin)) return admin;

  const outcome = await startElection();

  if (!outcome.ok) {
    return outcome.reason === "too-few-candidates"
      ? NextResponse.json(
          { error: "Minimal 2 peserta untuk memulai voting" },
          { status: 400 },
        )
      : NextResponse.json({ error: "Voting sudah pernah dimulai" }, { status: 409 });
  }

  const e = outcome.election;
  return NextResponse.json({
    id: e.id,
    title: e.title,
    status: e.status,
    showResultsToVoters: e.showResultsToVoters,
    startedAt: e.startedAt,
    closedAt: e.closedAt,
    createdAt: e.createdAt,
  });
}
