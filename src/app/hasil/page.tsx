"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import type { PublicElectionDto, ResultsDto } from "@/lib/dto";

export default function HasilPage() {
  const [title, setTitle] = useState("Hasil Voting");
  const [results, setResults] = useState<ResultsDto | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api<PublicElectionDto>("/api/election"), api<ResultsDto>("/api/results")]).then(
      ([electionRes, resultsRes]) => {
        if (electionRes.ok) setTitle(electionRes.data.title);
        if (resultsRes.ok) {
          setResults(resultsRes.data);
        } else {
          setMessage(resultsRes.error);
        }
        setLoading(false);
      },
    );
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8">
      <Link href="/" className="text-sm font-medium text-indigo-700 hover:underline">
        ← Beranda
      </Link>

      <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-slate-600">Hasil resmi setelah voting ditutup.</p>

        {loading ? <p className="mt-5 text-slate-600">Memuat…</p> : null}

        {!loading && message ? (
          <p
            role="status"
            className="mt-5 rounded-lg bg-amber-50 px-4 py-3 font-medium text-amber-900"
          >
            {message}
          </p>
        ) : null}

        {!loading && results ? (
          results.totalVotes === 0 ? (
            <p className="mt-5 text-slate-600">Belum ada suara masuk.</p>
          ) : (
            <>
              {results.winner ? (
                <p className="mt-5 rounded-xl bg-indigo-50 px-4 py-4 text-lg font-semibold text-indigo-900">
                  Pemenang: {results.winner.name}
                </p>
              ) : (
                <p className="mt-5 rounded-xl bg-slate-100 px-4 py-4 font-medium text-slate-700">
                  Hasil seri — tidak ada pemenang tunggal.
                </p>
              )}

              <ul className="mt-6 space-y-4">
                {results.results.map((row, index) => (
                  <li key={row.candidateId}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-slate-800">
                        {index + 1}. {row.name}
                      </span>
                      <span className="shrink-0 text-slate-600">
                        {row.votes} suara · {row.percentage}%
                      </span>
                    </div>
                    <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{ width: `${row.percentage}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>

              <p className="mt-6 text-sm text-slate-500">
                Total {results.totalVotes} suara sah.
              </p>
            </>
          )
        ) : null}
      </div>
    </main>
  );
}
