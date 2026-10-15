import { NextRequest, connection } from "next/server";
import { assertSameOrigin, isErrorResponse, jsonError, readJsonBody } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { getElection, listCandidates, patchElection } from "@/lib/store";
import type { ElectionStatus } from "@/lib/types";

export interface PublicElection {
  title: string;
  status: ElectionStatus;
  showResultsToVoters: boolean;
  startedAt: string | null;
  closedAt: string | null;
  candidates: {
    id: string;
    name: string;
    description: string | null;
    photoUrl: string | null;
  }[];
}

export async function GET() {
  await connection();
  const election = await getElection();
  const candidates = election.status === "DRAFT" ? [] : await listCandidates();
  const body: PublicElection = {
    title: election.title,
    status: election.status,
    showResultsToVoters: election.showResultsToVoters,
    startedAt: election.startedAt,
    closedAt: election.closedAt,
    candidates: candidates.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      photoUrl: c.photoUrl,
    })),
  };
  return Response.json(body);
}

export async function PATCH(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const admin = await requireAdmin(req);
  if (isErrorResponse(admin)) return admin;

  const body = await readJsonBody(req);
  if (isErrorResponse(body)) return body;

  const { title, showResultsToVoters } = body as {
    title?: unknown;
    showResultsToVoters?: unknown;
  };

  if (title === undefined && showResultsToVoters === undefined) {
    return jsonError(400, "Tidak ada perubahan yang dikirim");
  }
  if (title !== undefined && (typeof title !== "string" || title.trim() === "" || title.length > 200)) {
    return jsonError(400, "Judul tidak valid");
  }
  if (
    showResultsToVoters !== undefined &&
    typeof showResultsToVoters !== "boolean"
  ) {
    return jsonError(400, "Pengaturan hasil tidak valid");
  }

  const updated = await patchElection({
    title: title !== undefined ? (title as string).trim() : undefined,
    showResultsToVoters:
      showResultsToVoters !== undefined ? (showResultsToVoters as boolean) : undefined,
  });
  return Response.json({
    title: updated.title,
    status: updated.status,
    showResultsToVoters: updated.showResultsToVoters,
    startedAt: updated.startedAt,
    closedAt: updated.closedAt,
  });
}
