import { NextRequest } from "next/server";
import { isErrorResponse } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { computeResults } from "@/lib/results";
import { readDb } from "@/lib/store";

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (isErrorResponse(admin)) return admin;

  const db = await readDb();
  const { results, totalVotes } = computeResults(db);

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
