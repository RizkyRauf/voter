import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, isErrorResponse, readJsonBody } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { stopElection } from "@/lib/store";

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

  const outcome = await stopElection();

  if (!outcome.ok) {
    return NextResponse.json({ error: "Voting sedang tidak berjalan" }, { status: 409 });
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
