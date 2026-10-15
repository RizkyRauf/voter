"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { api } from "@/lib/client-api";
import type { CandidateDto, PublicElectionDto, VoterMeDto } from "@/lib/dto";

type Phase = "code" | "ballot" | "done" | "blocked" | "checking";

interface BlockedInfo {
  title: string;
  message: string;
  showResultsLink: boolean;
}

export default function VotePage() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [code, setCode] = useState("");
  const [election, setElection] = useState<PublicElectionDto | null>(null);
  const [blocked, setBlocked] = useState<BlockedInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
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
        message: "Silakan tunggu hingga admin memulai voting, lalu muat ulang halaman.",
        showResultsLink: false,
      });
      setPhase("blocked");
    } else if (data.status === "CLOSED") {
      setBlocked({
        title: "Voting telah ditutup",
        message: "Periode pemungutan suara sudah berakhir.",
        showResultsLink: data.showResultsToVoters,
      });
      setPhase("blocked");
    } else if (hasVoted) {
      setDoneReason("already");
      setPhase("done");
    } else {
      setSelected(null);
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

  async function enterCode(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const session = await api<{ hasVoted: boolean }>("/api/voter/session", {
      json: { code },
    });
    setSubmitting(false);
    if (!session.ok) {
      setError(session.error);
      return;
    }
    loadElection(session.data.hasVoted);
  }

  async function submitVote() {
    if (!selected) return;
    setConfirmOpen(false);
    setSubmitting(true);
    setError(null);
    const result = await api("/api/votes", { json: { candidateId: selected } });
    setSubmitting(false);
    if (!result.ok) {
      if (result.status === 401) {
        setPhase("code");
        setError("Sesi pemilih tidak berlaku. Masukkan kode ulang.");
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

  const chosen = election?.candidates.find((c) => c.id === selected);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8">
      <Link href="/" className="text-sm font-medium text-indigo-700 hover:underline">
        ← Beranda
      </Link>

      <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
        <h1 className="text-2xl font-bold">{election?.title ?? "Pemilihan"}</h1>

        {phase === "checking" ? (
          <p className="mt-4 text-slate-600">Memuat…</p>
        ) : null}

        {phase === "code" ? (
          <>
            <p className="mt-2 text-slate-600">
              Masukkan kode pemilih yang Anda terima untuk melanjutkan.
            </p>
            <form onSubmit={enterCode} className="mt-5 flex flex-col gap-4">
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-slate-700">
                  Kode pemilih
                </label>
                <input
                  id="code"
                  required
                  autoCapitalize="characters"
                  autoComplete="off"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  placeholder="contoh: A2B3C4D5"
                  className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono tracking-widest focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
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
                className="min-h-11 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
              >
                {submitting ? "Memeriksa…" : "Lanjutkan"}
              </button>
            </form>
          </>
        ) : null}

        {phase === "blocked" && blocked ? (
          <div className="mt-5">
            <p
              className="rounded-lg bg-amber-50 px-4 py-3 font-medium text-amber-900"
              role="status"
            >
              {blocked.title}
            </p>
            <p className="mt-3 text-sm text-slate-600">{blocked.message}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={() => {
                  setPhase("checking");
                  api<VoterMeDto>("/api/voter/me").then((me) =>
                    loadElection(me.ok && me.data.authenticated && me.data.hasVoted === true),
                  );
                }}
                className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
              >
                Periksa lagi
              </button>
              {blocked.showResultsLink ? (
                <Link
                  href="/hasil"
                  className="flex min-h-11 items-center rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-500"
                >
                  Lihat hasil
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}

        {phase === "ballot" && election ? (
          <>
            <p className="mt-2 text-slate-600">Pilih satu peserta, lalu kirim suara Anda.</p>
            <fieldset className="mt-5">
              <legend className="sr-only">Daftar peserta</legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {election.candidates.map((candidate) => (
                  <CandidateCard
                    key={candidate.id}
                    candidate={candidate}
                    checked={selected === candidate.id}
                    onChange={() => setSelected(candidate.id)}
                  />
                ))}
              </div>
            </fieldset>
            {error ? (
              <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={!selected || submitting}
              className="mt-5 min-h-11 w-full rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Kirim Suara
            </button>
          </>
        ) : null}

        {phase === "done" ? (
          <div className="mt-5" role="status">
            <p className="rounded-lg bg-emerald-50 px-4 py-4 text-lg font-semibold text-emerald-900">
              Terima kasih, suara Anda tercatat.
            </p>
            <p className="mt-3 text-sm text-slate-600">
              {doneReason === "already"
                ? "Satu pemilih hanya boleh memberikan satu suara, sehingga pilihan tidak dapat diubah."
                : null}
            </p>
            {election?.status === "CLOSED" && election.showResultsToVoters ? (
              <Link
                href="/hasil"
                className="mt-5 inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
              >
                Lihat hasil nanti
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      <Modal
        open={confirmOpen}
        title="Konfirmasi pilihan"
        onClose={() => setConfirmOpen(false)}
      >
        <p>
          Anda memilih <strong>{chosen?.name}</strong>. Setelah dikirim, suara tidak
          dapat diubah lagi.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={submitVote}
            disabled={submitting}
            className="min-h-11 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {submitting ? "Mengirim…" : "Ya, kirim suara"}
          </button>
          <button
            onClick={() => setConfirmOpen(false)}
            className="min-h-11 rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700"
          >
            Periksa lagi
          </button>
        </div>
      </Modal>
    </main>
  );
}

function CandidateCard({
  candidate,
  checked,
  onChange,
}: {
  candidate: CandidateDto;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${
        checked
          ? "border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600"
          : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
    >
      <input
        type="radio"
        name="candidate"
        className="sr-only"
        checked={checked}
        onChange={onChange}
      />
      {candidate.photoUrl ? (
        <img
          src={candidate.photoUrl}
          alt=""
          className="h-12 w-12 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg font-semibold text-slate-500">
          {candidate.name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="min-w-0">
        <span className="block font-semibold text-slate-900">{candidate.name}</span>
        {candidate.description ? (
          <span className="block truncate text-sm text-slate-600">
            {candidate.description}
          </span>
        ) : null}
      </span>
      <span
        aria-hidden="true"
        className={`ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
          checked ? "border-indigo-600 bg-indigo-600" : "border-slate-300"
        }`}
      >
        {checked ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
      </span>
    </label>
  );
}
