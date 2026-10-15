"use client";

import Image from "next/image";
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
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-96 w-[36rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-teal-200/50 via-emerald-100/40 to-transparent blur-3xl" />
      </div>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-sm font-medium text-teal-700 hover:underline"
          >
            ← Beranda
          </Link>
          <Image src="/logo_nestecth.png" alt="NesTech" width={72} height={56} className="h-9 w-auto" />
        </div>

        <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-7">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 text-white shadow-md shadow-teal-200">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              <p className="text-sm text-slate-500">Hasil resmi setelah voting ditutup.</p>
            </div>
          </div>

          {loading ? <p className="mt-6 text-slate-600">Memuat…</p> : null}

          {!loading && message ? (
            <p
              role="status"
              className="mt-6 flex items-start gap-3 rounded-xl bg-amber-50 p-4 font-medium text-amber-900 ring-1 ring-amber-200"
            >
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              {message}
            </p>
          ) : null}

          {!loading && results ? (
            results.totalVotes === 0 ? (
              <div className="mt-6 flex flex-col items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-10 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V7a2 2 0 00-2-2H6a2 2 0 00-2 2v6m16 0v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4m16 0h-3.5l-1.5 2h-5l-1.5-2H4" />
                  </svg>
                </span>
                <p className="mt-3 font-medium text-slate-600">Belum ada suara masuk.</p>
              </div>
            ) : (
              <>
                {results.winner ? (
                  <div className="mt-6 overflow-hidden rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-500 p-[1px] shadow-lg shadow-teal-100">
                    <div className="flex items-center gap-4 rounded-2xl bg-white/95 p-5">
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 text-white shadow-md shadow-teal-200">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-7 w-7" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 3h14a1 1 0 011 1v3a6 6 0 01-6 6h-4a6 6 0 01-6-6V4a1 1 0 011-1zM5 7H3a1 1 0 00-1 1c0 3.5 2 5.5 4 6M19 7h2a1 1 0 011 1c0 3.5-2 5.5-4 6M9 21h6M12 17v4" />
                        </svg>
                      </span>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">
                          Pemenang
                        </p>
                        <p className="text-2xl font-extrabold text-slate-900">
                          {results.winner.name}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-6 rounded-xl bg-slate-100 px-4 py-4 font-medium text-slate-700">
                    Hasil seri — tidak ada pemenang tunggal.
                  </p>
                )}

                <ul className="mt-6 space-y-4">
                  {results.results.map((row, index) => (
                    <li
                      key={row.candidateId}
                      className={
                        index === 0
                          ? "rounded-xl bg-teal-50/60 p-3 ring-1 ring-teal-100"
                          : "p-1"
                      }
                    >
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2 font-semibold text-slate-800">
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                              index === 0
                                ? "bg-gradient-to-br from-teal-500 to-emerald-500 text-white"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {index + 1}
                          </span>
                          {row.name}
                        </span>
                        <span className="shrink-0 text-slate-600">
                          {row.votes} suara · {row.percentage}%
                        </span>
                      </div>
                      <div
                        className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
                        role="progressbar"
                        aria-valuenow={row.percentage}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Persentase ${row.name}`}
                      >
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-[width] duration-500"
                          style={{ width: `${row.percentage}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>

                <p className="mt-6 text-sm text-slate-500">
                  Total {results.totalVotes} suara sah.
                </p>
                {results.truncated ? (
                  <p className="mt-2 text-sm text-slate-500">
                    Menampilkan 5 peringkat teratas. Hubungi admin untuk
                    informasi hasil lengkap.
                  </p>
                ) : null}
              </>
            )
          ) : null}
        </div>
      </main>
    </div>
  );
}
