import { NextRequest } from "next/server";
import { assertSameOrigin, isErrorResponse, jsonError, readJsonBody } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { readDb, updateDb } from "@/lib/store";
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
  const db = await readDb();
  const body: PublicElection = {
    title: db.election.title,
    status: db.election.status,
    showResultsToVoters: db.election.showResultsToVoters,
    startedAt: db.election.startedAt,
    closedAt: db.election.closedAt,
    candidates:
      db.election.status === "DRAFT"
        ? []
        : db.candidates.map((c) => ({
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

  const updated = await updateDb((db) => {
    if (title !== undefined) db.election.title = (title as string).trim();
    if (showResultsToVoters !== undefined) {
      db.election.showResultsToVoters = showResultsToVoters as boolean;
    }
    return {
      title: db.election.title,
      status: db.election.status,
      showResultsToVoters: db.election.showResultsToVoters,
      startedAt: db.election.startedAt,
      closedAt: db.election.closedAt,
    };
  });
  return Response.json(updated);
}
