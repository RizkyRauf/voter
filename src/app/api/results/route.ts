import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { getAdminFromRequest } from "@/lib/auth";
import { computeResults } from "@/lib/results";
import { getElection, listCandidates, listVotes } from "@/lib/store";

export async function GET(req: NextRequest) {
  const [election, admin] = await Promise.all([getElection(), getAdminFromRequest(req)]);

  // Public access: only after CLOSED and only when the admin allows it.
  if (!admin) {
    if (election.status === "DRAFT") {
      return jsonError(403, "Voting belum dimulai");
    }
    if (election.status === "OPEN") {
      return jsonError(403, "Hasil akan diumumkan setelah voting ditutup");
    }
    if (!election.showResultsToVoters) {
      return jsonError(403, "Hasil tidak tersedia untuk umum");
    }
  }

  const [candidates, votes] = await Promise.all([listCandidates(), listVotes()]);
  return NextResponse.json(computeResults({ election, candidates, votes }));
}
