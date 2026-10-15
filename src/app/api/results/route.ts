import { NextRequest, NextResponse, connection } from "next/server";
import { jsonError } from "@/lib/api";
import { getAdminFromRequest } from "@/lib/auth";
import { computeResults } from "@/lib/results";
import { getElection, listCandidates, listVotes } from "@/lib/store";

/** Jumlah peringkat yang boleh dilihat publik setelah CLOSED. */
const PUBLIC_TOP_N = 5;

export async function GET(req: NextRequest) {
  await connection();
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
  const full = computeResults({ election, candidates, votes });

  // Admin melihat lengkap; publik hanya 5 peringkat teratas (Amd. 3).
  if (admin) {
    return NextResponse.json({ ...full, truncated: false });
  }
  const publicRows = full.results.slice(0, PUBLIC_TOP_N);
  return NextResponse.json({
    ...full,
    results: publicRows,
    truncated: full.results.length > publicRows.length,
  });
}
