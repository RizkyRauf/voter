"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { api } from "@/lib/client-api";
import type { PublicElectionDto, VoterMeDto } from "@/lib/dto";

type Phase = "code" | "ballot" | "done" | "blocked" | "checking";

interface BlockedInfo {
  title: string;
  message: string;
  showResultsLink: boolean;
}

export default function VotePage() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [name, setName] = useState("");
  const [election, setElection] = useState<PublicElectionDto | null>(null);
  const [blocked, setBlocked] = useState<BlockedInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [doneReason, setDoneReason] = useState<"voted" | "already" | null>(null);

  const loadElection = useCallback(async (hasVoted: boolean) => {
    const result = await api<PublicElectionDto>("/api/election");
    if (!result.ok) {
      setError(result.error);
      setPhase("code");
      return;
    }
    const data = result.data;
    setElection(data);
    if (data.status === "DRAFT") {
      setBlocked({
        title: "Voting belum dimulai",
        message: "Silakan tunggu hingga admin memulai voting, lalu periksa lagi halaman ini.",
        showResultsLink: false,
      });
      setPhase("blocked");
    } else if (data.status === "CLOSED") {
      setBlocked({
        title: "Voting telah ditutup",
        message: "Periode pemungutan suara sudah berakhir. Terima kasih sudah berpartisipasi.",
        showResultsLink: data.showResultsToVoters,
      });
      setPhase("blocked");
    } else if (hasVoted) {
      setDoneReason("already");
      setPhase("done");
    } else {
      setChoice("");
      setShowSuggest(false);
      setPhase("ballot");
    }
  }, []);

  useEffect(() => {
    api<VoterMeDto>("/api/voter/me").then((me) => {
      if (me.ok && me.data.authenticated) {
        loadElection(me.data.hasVoted === true);
      } else {
        setPhase("code");
      }
    });
  }, [loadElection]);

  async function enterName(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const session = await api<{ hasVoted: boolean }>("/api/voter/session", {
      json: { name },
    });
    setSubmitting(false);
    if (!session.ok) {
      setError(session.error);
      return;
    }
    loadElection(session.data.hasVoted);
  }

  async function submitVote() {
    const candidateName = choice.trim();
    if (!candidateName) return;
    setConfirmOpen(false);
    setSubmitting(true);
    setError(null);
    const result = await api("/api/votes", { json: { candidateName } });
    setSubmitting(false);
    if (!result.ok) {
      if (result.status === 401) {
        setPhase("code");
        setError("Sesi Anda berakhir. Masukkan nama Anda kembali.");
        return;
      }
      if (result.status === 409) {
        setDoneReason("already");
        setPhase("done");
        return;
      }
      setError(result.error);
      return;
    }
    setDoneReason("voted");
    setPhase("done");
  }

  const trimmedChoice = choice.trim();
  const suggestions = (() => {
    const q = trimmedChoice.toLowerCase();
    if (!q) return [];
    const names = new Set<string>();
    for (const c of election?.candidates ?? []) {
      const n = c.name.toLowerCase();
      if (n.includes(q) && n !== q) names.add(c.name);
      if (names.size >= 6) break;
    }
    return [...names];
  })();

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-96 w-[36rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-teal-200/50 via-emerald-100/40 to-transparent blur-3xl" />
      </div>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8">
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{election?.title ?? "Pemilihan"}</h1>
              <p className="text-sm text-slate-500">Satu pemilih, satu suara.</p>
            </div>
          </div>

          {phase === "checking" ? (
            <p className="mt-6 text-slate-600">Memuat…</p>
          ) : null}

          {phase === "code" ? (
            <>
              <p className="mt-6 text-slate-600">
                Masukkan nama Anda untuk melanjutkan. Setiap nama hanya boleh
                memilih satu kali.
              </p>
              <form onSubmit={enterName} className="mt-5 flex flex-col gap-4">
                <div>
                  <label htmlFor="voter-name" className="block text-sm font-medium text-slate-700">
                    Nama Anda
                  </label>
                  <input
                    id="voter-name"
                    required
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Nama lengkap"
                    className="mt-1 min-h-12 w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                  />
                </div>
                {error ? (
                  <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-12 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 px-5 py-3 font-semibold text-white shadow-md shadow-teal-200 transition hover:opacity-90 disabled:opacity-60"
                >
                  {submitting ? "Memeriksa…" : "Lanjutkan"}
                </button>
              </form>
            </>
          ) : null}

          {phase === "blocked" && blocked ? (
            <div className="mt-6">
              <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
                <div>
                  <p className="font-bold text-amber-900" role="status">
                    {blocked.title}
                  </p>
                  <p className="mt-1 text-sm text-amber-800">{blocked.message}</p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    setPhase("checking");
                    api<VoterMeDto>("/api/voter/me").then((me) =>
                      loadElection(me.ok && me.data.authenticated && me.data.hasVoted === true),
                    );
                  }}
                  className="min-h-12 rounded-xl border border-slate-300 bg-white px-5 py-3 font-medium text-slate-700 hover:bg-slate-50"
                >
                  Periksa lagi
                </button>
                {blocked.showResultsLink ? (
                  <Link
                    href="/hasil"
                    className="flex min-h-12 items-center rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 px-5 py-3 font-semibold text-white shadow-md shadow-teal-200 hover:opacity-90"
                  >
                    Lihat hasil
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}

          {phase === "ballot" && election ? (
            <>
              <p className="mt-6 text-slate-600">
                Ketik nama peserta yang Anda pilih. Jika nama sudah pernah
                diketik pemilih lain, saran akan muncul — pilih untuk
                memastikan ejaannya sama.
              </p>
              <div className="relative mt-5">
                <label htmlFor="choice" className="block text-sm font-medium text-slate-700">
                  Nama peserta
                </label>
                <input
                  id="choice"
                  required
                  autoComplete="off"
                  value={choice}
                  onChange={(event) => {
                    setChoice(event.target.value);
                    setShowSuggest(true);
                  }}
                  onFocus={() => setShowSuggest(true)}
                  onBlur={() => {
                    // tunda agar klik saran sempat terpicu sebelum tertutup
                    setTimeout(() => setShowSuggest(false), 120);
                  }}
                  placeholder="Contoh: Anis Malik"
                  className="mt-1 min-h-12 w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                />
                {showSuggest && suggestions.length > 0 ? (
                  <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                    {suggestions.map((name) => (
                      <li key={name}>
                        <button
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            setChoice(name);
                            setShowSuggest(false);
                          }}
                          className="flex min-h-11 w-full items-center px-4 py-2.5 text-left text-slate-700 hover:bg-teal-50"
                        >
                          {name}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {trimmedChoice && suggestions.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">
                    Nama baru — akan tercatat sebagai peserta begitu suara
                    dikirim.
                  </p>
                ) : null}
              </div>
              {error ? (
                <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              ) : null}
              <button
                onClick={() => setConfirmOpen(true)}
                disabled={!trimmedChoice || submitting}
                className="mt-6 min-h-12 w-full rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 px-5 py-3 font-semibold text-white shadow-md shadow-teal-200 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none sm:w-auto sm:px-10"
              >
                Kirim Suara
              </button>
            </>
          ) : null}

          {phase === "done" ? (
            <div className="mt-8 flex flex-col items-center text-center" role="status">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 text-white shadow-lg shadow-teal-200">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-8 w-8" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <p className="mt-4 text-2xl font-bold text-slate-900">
                Terima kasih, suara Anda tercatat.
              </p>
              {doneReason === "already" ? (
                <p className="mt-2 max-w-md text-sm text-slate-600">
                  Setiap nama hanya boleh memberikan satu suara, sehingga pilihan
                  tidak dapat diubah.
                </p>
              ) : null}
              {election?.status === "CLOSED" && election.showResultsToVoters ? (
                <Link
                  href="/hasil"
                  className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 px-6 py-3 font-semibold text-white shadow-md shadow-teal-200 hover:opacity-90"
                >
                  Lihat hasil
                </Link>
              ) : (
                <Link
                  href="/"
                  className="mt-6 inline-flex min-h-12 items-center rounded-xl border border-slate-300 bg-white px-6 py-3 font-medium text-slate-700 hover:bg-slate-50"
                >
                  Kembali ke beranda
                </Link>
              )}
            </div>
          ) : null}
        </div>
      </main>

      <Modal
        open={confirmOpen}
        title="Konfirmasi pilihan"
        onClose={() => setConfirmOpen(false)}
      >
        <p>
          Anda memilih <strong>{trimmedChoice}</strong>. Setelah dikirim, suara tidak
          dapat diubah lagi.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={submitVote}
            disabled={submitting}
            className="min-h-12 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 px-5 py-3 font-semibold text-white shadow-md shadow-teal-200 hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Mengirim…" : "Ya, kirim suara"}
          </button>
          <button
            onClick={() => setConfirmOpen(false)}
            className="min-h-12 rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700"
          >
            Periksa lagi
          </button>
        </div>
      </Modal>
    </div>
  );
}

