"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/client-api";
import type {
  CandidateDto,
  ElectionAdminDto,
  ResultsDto,
  VotersDto,
} from "@/lib/dto";

const POLL_MS = 3000;

interface ConfirmState {
  kind: "stop" | "reset" | "delete-candidate" | "delete-voter";
  id?: string;
  name?: string;
}

export function AdminDashboard() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [username, setUsername] = useState("");
  const [election, setElection] = useState<ElectionAdminDto | null>(null);
  const [candidates, setCandidates] = useState<CandidateDto[]>([]);
  const [results, setResults] = useState<ResultsDto | null>(null);
  const [voters, setVoters] = useState<VotersDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [busy, setBusy] = useState(false);

  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPhotoUrl, setEditPhotoUrl] = useState("");

  const refresh = useCallback(async () => {
    const [electionRes, candidatesRes, resultsRes, votersRes] = await Promise.all([
      api<ElectionAdminDto>("/api/election"),
      api<CandidateDto[]>("/api/candidates"),
      api<ResultsDto>("/api/results"),
      api<VotersDto>("/api/voters"),
    ]);
    if (electionRes.ok) setElection(electionRes.data);
    if (candidatesRes.ok) setCandidates(candidatesRes.data);
    if (resultsRes.ok) setResults(resultsRes.data);
    if (votersRes.ok) setVoters(votersRes.data);
    if (!electionRes.ok && electionRes.status === 401) {
      router.replace("/admin/login");
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    api<{ authenticated: boolean; username?: string }>("/api/auth/session").then(
      (session) => {
        if (cancelled) return;
        if (!session.ok || !session.data.authenticated) {
          router.replace("/admin/login");
          return;
        }
        setUsername(session.data.username ?? "admin");
        setReady(true);
        refresh();
      },
    );
    return () => {
      cancelled = true;
    };
  }, [refresh, router]);

  const status = election?.status ?? "DRAFT";
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!ready || status !== "OPEN") return;
    pollRef.current = setInterval(() => {
      refresh();
    }, POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [ready, status, refresh]);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/admin/login");
  }

  async function addCandidate(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await api("/api/candidates", {
      json: {
        name: newName,
        description: newDescription || undefined,
        photoUrl: newPhotoUrl || undefined,
      },
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNewName("");
    setNewDescription("");
    setNewPhotoUrl("");
    refresh();
  }

  async function saveEdit(id: string) {
    setBusy(true);
    setError(null);
    const result = await api(`/api/candidates/${id}`, {
      method: "PATCH",
      json: {
        name: editName,
        description: editDescription,
        photoUrl: editPhotoUrl,
      },
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditingId(null);
    refresh();
  }

  async function runConfirm(state: ConfirmState) {
    setBusy(true);
    setError(null);
    setInfo(null);
    let result;
    if (state.kind === "stop") {
      result = await api("/api/election/stop", { json: { confirm: true } });
      if (result.ok) setInfo("Voting telah dihentikan. Hasil akhir ditampilkan.");
    } else if (state.kind === "reset") {
      result = await api("/api/reset", { method: "POST" });
      if (result.ok) setInfo("Sesi baru dimulai. Daftar nama pemilih dan peserta tetap tersedia.");
    } else if (state.kind === "delete-candidate") {
      result = await api(`/api/candidates/${state.id}`, { method: "DELETE" });
    } else {
      result = await api(`/api/voters/${state.id}`, { method: "DELETE" });
    }
    setBusy(false);
    setConfirm(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    refresh();
  }

  async function startVoting() {
    setBusy(true);
    setError(null);
    const result = await api("/api/election/start", { method: "POST" });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setInfo("Voting dimulai. Pemilih sekarang dapat memberikan suara.");
    refresh();
  }

  async function togglePublicResults() {
    if (!election) return;
    setBusy(true);
    const result = await api("/api/election", {
      method: "PATCH",
      json: { showResultsToVoters: !election.showResultsToVoters },
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    refresh();
  }

  if (!ready || !election) {
    return (
      <main className="flex flex-1 items-center justify-center p-8 text-slate-600">
        Memuat…
      </main>
    );
  }

  const totalVotes = results?.totalVotes ?? 0;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{election.title}</h1>
          <div className="mt-2 flex items-center gap-3">
            <StatusBadge status={election.status} />
            <span className="text-sm text-slate-600" aria-live="polite">
              Suara masuk: <strong>{totalVotes}</strong>
              {voters ? ` / ${voters.total} pemilih` : ""}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="hidden text-slate-600 sm:inline">{username}</span>
          <button
            onClick={logout}
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-100"
          >
            Keluar
          </button>
        </div>
      </header>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {info}
        </p>
      ) : null}

      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Aksi Voting</h2>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          {election.status === "DRAFT" ? (
            <>
              <button
                onClick={startVoting}
                disabled={busy || candidates.length < 2}
                className="min-h-11 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Mulai Vote
              </button>
              {candidates.length < 2 ? (
                <span className="self-center text-sm text-slate-500">
                  Minimal 2 peserta untuk memulai.
                </span>
              ) : null}
            </>
          ) : null}
          {election.status === "OPEN" ? (
            <button
              onClick={() => setConfirm({ kind: "stop" })}
              disabled={busy}
              className="min-h-11 rounded-xl bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-500 disabled:opacity-50"
            >
              Stop Vote
            </button>
          ) : null}
          {election.status === "CLOSED" ? (
            <>
              <a
                href="/api/export"
                className="flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 hover:bg-slate-100"
              >
                Unduh CSV
              </a>
              <button
                onClick={() => setConfirm({ kind: "reset" })}
                disabled={busy}
                className="min-h-11 rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                Reset Sesi Baru
              </button>
            </>
          ) : null}
        </div>
      </section>

      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-semibold">Hasil</h2>
        {results && results.results.length > 0 ? (
          <>
            <ul className="mt-4 space-y-4 md:hidden">
              {results.results.map((row) => (
                <li key={row.candidateId}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-slate-800">{row.name}</span>
                    <span className="text-slate-600">
                      {row.votes} suara · {row.percentage}%
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${row.percentage}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>

            <table className="mt-4 hidden w-full text-left text-sm md:table">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2 font-medium">Peserta</th>
                  <th className="py-2 font-medium">Suara</th>
                  <th className="py-2 font-medium">Persentase</th>
                </tr>
              </thead>
              <tbody>
                {results.results.map((row) => (
                  <tr key={row.candidateId} className="border-b border-slate-100">
                    <td className="py-2 font-medium text-slate-800">{row.name}</td>
                    <td className="py-2 text-slate-700">{row.votes}</td>
                    <td className="py-2 text-slate-700">{row.percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="mt-4 text-sm text-slate-700">
              {results.winner ? (
                <>
                  Pemenang: <strong>{results.winner.name}</strong>
                </>
              ) : (
                "Belum ada pemenang (belum ada suara atau terjadi seri)."
              )}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-slate-500">Belum ada suara masuk.</p>
        )}

        <label className="mt-4 flex items-center gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={election.showResultsToVoters}
            onChange={togglePublicResults}
            disabled={busy}
            className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          Tampilkan hasil kepada pemilih setelah voting ditutup
        </label>
      </section>

      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-semibold">Peserta</h2>

        {election.status === "DRAFT" ? (
          <form onSubmit={addCandidate} className="mt-4 flex flex-col gap-3">
            <div>
              <label htmlFor="cand-name" className="block text-sm font-medium text-slate-700">
                Nama peserta
              </label>
              <input
                id="cand-name"
                required
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
            <div>
              <label htmlFor="cand-desc" className="block text-sm font-medium text-slate-700">
                Deskripsi (opsional)
              </label>
              <textarea
                id="cand-desc"
                value={newDescription}
                onChange={(event) => setNewDescription(event.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
            <div>
              <label htmlFor="cand-photo" className="block text-sm font-medium text-slate-700">
                URL foto (opsional)
              </label>
              <input
                id="cand-photo"
                value={newPhotoUrl}
                onChange={(event) => setNewPhotoUrl(event.target.value)}
                placeholder="https://…"
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="min-h-11 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              Tambah Peserta
            </button>
          </form>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            Peserta tidak dapat diubah selama voting berlangsung.
          </p>
        )}

        <ul className="mt-5 divide-y divide-slate-100">
          {candidates.length === 0 ? (
            <li className="py-3 text-sm text-slate-500">Belum ada peserta.</li>
          ) : null}
          {candidates.map((candidate) => (
            <li key={candidate.id} className="py-3">
              {editingId === candidate.id ? (
                <div className="flex flex-col gap-2">
                  <input
                    aria-label="Nama peserta"
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    className="min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                  <input
                    aria-label="Deskripsi peserta"
                    value={editDescription}
                    onChange={(event) => setEditDescription(event.target.value)}
                    className="min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                  <input
                    aria-label="URL foto peserta"
                    value={editPhotoUrl}
                    onChange={(event) => setEditPhotoUrl(event.target.value)}
                    className="min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(candidate.id)}
                      disabled={busy}
                      className="min-h-11 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Simpan
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {candidate.photoUrl ? (
                      <img
                        src={candidate.photoUrl}
                        alt=""
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-lg font-semibold text-slate-500">
                        {candidate.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div>
                      <p className="font-medium text-slate-900">{candidate.name}</p>
                      {candidate.description ? (
                        <p className="text-sm text-slate-600">{candidate.description}</p>
                      ) : null}
                    </div>
                  </div>
                  {election.status === "DRAFT" ? (
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => {
                          setEditingId(candidate.id);
                          setEditName(candidate.name);
                          setEditDescription(candidate.description ?? "");
                          setEditPhotoUrl(candidate.photoUrl ?? "");
                        }}
                        className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() =>
                          setConfirm({
                            kind: "delete-candidate",
                            id: candidate.id,
                            name: candidate.name,
                          })
                        }
                        className="min-h-11 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                      >
                        Hapus
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-semibold">Pemilih</h2>
        <p className="mt-1 text-sm text-slate-500">
          Pemilih mendaftarkan diri dengan nama saat membuka halaman voting.
          Suara tetap bersifat anonim — di sini hanya terlihat siapa yang sudah
          memilih. Hapus nama yang tidak wajar; suaranya ikut dihapus dari total.
        </p>

        <ul className="mt-5 divide-y divide-slate-100 md:hidden">
          {voters?.voters.map((voter) => (
            <li key={voter.id} className="py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{voter.name}</p>
                  <p className="text-xs text-slate-500">
                    {voter.hasVoted
                      ? `Sudah memilih${voter.votedAt ? ` · ${new Date(voter.votedAt).toLocaleString("id-ID")}` : ""}`
                      : "Belum memilih"}
                  </p>
                </div>
                <button
                  onClick={() => setConfirm({ kind: "delete-voter", id: voter.id, name: voter.name })}
                  className="min-h-11 shrink-0 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  Hapus
                </button>
              </div>
            </li>
          ))}
          {!voters?.voters.length ? (
            <li className="py-3 text-sm text-slate-500">Belum ada pemilih terdaftar.</li>
          ) : null}
        </ul>

        <table className="mt-5 hidden w-full text-left text-sm md:table">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="py-2 font-medium">Nama</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2 font-medium">Waktu memilih</th>
              <th className="py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {voters?.voters.map((voter) => (
              <tr key={voter.id} className="border-b border-slate-100">
                <td className="py-2 font-medium text-slate-800">{voter.name}</td>
                <td className="py-2">
                  {voter.hasVoted ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800">
                      Sudah memilih
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                      Belum memilih
                    </span>
                  )}
                </td>
                <td className="py-2 text-slate-600">
                  {voter.votedAt
                    ? new Date(voter.votedAt).toLocaleString("id-ID")
                    : "—"}
                </td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => setConfirm({ kind: "delete-voter", id: voter.id, name: voter.name })}
                    className="min-h-11 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                  >
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
            {!voters?.voters.length ? (
              <tr>
                <td colSpan={4} className="py-3 text-slate-500">
                  Belum ada pemilih terdaftar.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <p className="mt-8 text-center text-sm text-slate-500">
        <Link href="/hasil" className="font-medium text-indigo-700 hover:underline">
          Lihat halaman hasil
        </Link>
      </p>

      <Modal
        open={confirm?.kind === "stop"}
        title="Hentikan voting?"
        onClose={() => setConfirm(null)}
      >
        <p>
          Setelah dihentikan, voting tidak dapat dibuka kembali dan hasil akan
          dinyatakan final.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={() => runConfirm({ kind: "stop" })}
            disabled={busy}
            className="min-h-11 rounded-xl bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-500 disabled:opacity-50"
          >
            Ya, hentikan voting
          </button>
          <button
            onClick={() => setConfirm(null)}
            className="min-h-11 rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700"
          >
            Batal
          </button>
        </div>
      </Modal>

      <Modal
        open={confirm?.kind === "reset"}
        title="Reset untuk sesi baru?"
        onClose={() => setConfirm(null)}
      >
        <p>
          Semua suara dan daftar nama pemilih akan dihapus, dan voting kembali
          ke status draft. Daftar peserta tetap tersedia; sesi baru dimulai
          dengan mendaftarkan nama pemilih (nama lama boleh dipakai ulang).
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={() => runConfirm({ kind: "reset" })}
            disabled={busy}
            className="min-h-11 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            Ya, reset
          </button>
          <button
            onClick={() => setConfirm(null)}
            className="min-h-11 rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700"
          >
            Batal
          </button>
        </div>
      </Modal>

      <Modal
        open={confirm?.kind === "delete-candidate"}
        title="Hapus peserta?"
        onClose={() => setConfirm(null)}
      >
        <p>
          Peserta <strong>{confirm?.name}</strong> akan dihapus permanen.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={() => confirm && runConfirm(confirm)}
            disabled={busy}
            className="min-h-11 rounded-xl bg-red-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            Ya, hapus
          </button>
          <button
            onClick={() => setConfirm(null)}
            className="min-h-11 rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700"
          >
            Batal
          </button>
        </div>
      </Modal>

      <Modal
        open={confirm?.kind === "delete-voter"}
        title="Hapus pemilih?"
        onClose={() => setConfirm(null)}
      >
        <p>
          Nama <strong>{confirm?.name}</strong> akan dihapus dari daftar pemilih.
          Jika sudah memilih, suaranya juga ikut dihapus dari total hasil.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={() => confirm && runConfirm(confirm)}
            disabled={busy}
            className="min-h-11 rounded-xl bg-red-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            Ya, hapus
          </button>
          <button
            onClick={() => setConfirm(null)}
            className="min-h-11 rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700"
          >
            Batal
          </button>
        </div>
      </Modal>
    </main>
  );
}
