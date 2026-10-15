import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { getAdminFromRequest } from "@/lib/auth";
import { computeResults } from "@/lib/results";
import { readDb } from "@/lib/store";

export async function GET(req: NextRequest) {
  const db = await readDb();
  const admin = await getAdminFromRequest(req);

  // Public access: only after CLOSED and only when the admin allows it.
  if (!admin) {
    if (db.election.status === "DRAFT") {
      return jsonError(403, "Voting belum dimulai");
    }
    if (db.election.status === "OPEN") {
      return jsonError(403, "Hasil akan diumumkan setelah voting ditutup");
    }
    if (!db.election.showResultsToVoters) {
      return jsonError(403, "Hasil tidak tersedia untuk umum");
    }
  }

  return NextResponse.json(computeResults(db));
}
