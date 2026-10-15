import { NextRequest, connection } from "next/server";
import { isErrorResponse } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { computeResults } from "@/lib/results";
import { getElection, listCandidates, listVotes } from "@/lib/store";

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest) {
  await connection();
  const admin = await requireAdmin(req);
  if (isErrorResponse(admin)) return admin;

  const [election, candidates, votes] = await Promise.all([
    getElection(),
    listCandidates(),
    listVotes(),
  ]);
  const { results, totalVotes } = computeResults({ election, candidates, votes });

  const lines = ["Nama Peserta,Suara,Persentase"];
  for (const row of results) {
    lines.push(`${csvCell(row.name)},${row.votes},${row.percentage}%`);
  }
  lines.push(`Total Suara,${totalVotes},`);
  const csv = `${lines.join("\n")}\n`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="hasil-voting.csv"',
      "Cache-Control": "no-store",
    },
  });
}
