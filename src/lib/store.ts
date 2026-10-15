import bcrypt from "bcryptjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Admin, Candidate, Election, ElectionStatus, Vote, Voter } from "./types";

/**
 * Data layer backed by Supabase (Postgres). All access goes through the
 * service-role key from server-side route handlers only — the anon key is
 * never used and RLS blocks direct client access (migration 0001).
 *
 * Integrity-critical operations run as atomic SQL functions (RPC):
 * register_voter, cast_vote, reset_election, get_or_create_secret.
 */

interface AdminRow {
  id: string;
  username: string;
  password_hash: string;
  created_at: string;
}

interface ElectionRow {
  id: string;
  title: string;
  status: ElectionStatus;
  show_results_to_voters: boolean;
  started_at: string | null;
  closed_at: string | null;
  created_at: string;
}

interface CandidateRow {
  id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  created_at: string;
}

interface VoterRow {
  id: string;
  name: string;
  name_key: string;
  has_voted: boolean;
  voted_at: string | null;
  created_at: string;
}

interface VoteRow {
  id: string;
  voter_id: string;
  candidate_id: string;
  created_at: string;
}

let client: SupabaseClient | null = null;

function supabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY harus di-set (lihat .env.local / Netlify env)",
    );
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  if (res.data === null) throw new Error("Supabase: unexpected null response");
  return res.data;
}

/**
 * Postgres menolak filter/id non-UUID dengan error 22P02 — Supabase
 * mengembalikannya sebagai error 500. Guard di sini agar id tak-valid
 * diperlakukan sebagai "tidak ditemukan" (404), bukan crash server.
 */
function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function mapAdmin(row: AdminRow): Admin {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
}

function mapElection(row: ElectionRow): Election {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    showResultsToVoters: row.show_results_to_voters,
    startedAt: row.started_at,
    closedAt: row.closed_at,
    createdAt: row.created_at,
  };
}

function mapCandidate(row: CandidateRow): Candidate {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    photoUrl: row.photo_url,
    createdAt: row.created_at,
  };
}

function mapVoter(row: VoterRow): Voter {
  return {
    id: row.id,
    name: row.name,
    nameKey: row.name_key,
    hasVoted: row.has_voted,
    votedAt: row.voted_at,
    createdAt: row.created_at,
  };
}

function mapVote(row: VoteRow): Vote {
  return {
    id: row.id,
    voterId: row.voter_id,
    candidateId: row.candidate_id,
    createdAt: row.created_at,
  };
}

// ---------- session secret ----------

let secretCache: string | null = null;

export async function getSessionSecret(): Promise<string> {
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv) return fromEnv;
  if (secretCache) return secretCache;
  const secret = unwrap(await supabase().rpc("get_or_create_secret"));
  secretCache = typeof secret === "string" ? secret : String(secret);
  return secretCache;
}

/** Drop the cached secret (used by the test-only reset route). */
export function clearSessionSecretCache(): void {
  secretCache = null;
}

// ---------- admins ----------

export async function findAdminByUsername(username: string): Promise<Admin | null> {
  const res = await supabase()
    .from("admins")
    .select("*")
    .eq("username", username)
    .maybeSingle();
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  return res.data ? mapAdmin(res.data as AdminRow) : null;
}

export async function findAdminById(id: string): Promise<Admin | null> {
  if (!isUuid(id)) return null;
  const res = await supabase()
    .from("admins")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  return res.data ? mapAdmin(res.data as AdminRow) : null;
}

/** Seed the first admin account (username/password from env) if none exists. */
export async function ensureAdmin(): Promise<Admin> {
  const existing = await findAdminByUsername(process.env.ADMIN_USERNAME ?? "admin");
  if (existing) return existing;

  const username = process.env.ADMIN_USERNAME ?? "admin";
  const password = process.env.ADMIN_PASSWORD ?? "admin123";
  const passwordHash = await bcrypt.hash(password, 10);
  const res = await supabase()
    .from("admins")
    .upsert(
      { username, password_hash: passwordHash },
      { onConflict: "username", ignoreDuplicates: true },
    )
    .select()
    .maybeSingle();
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  if (res.data) return mapAdmin(res.data as AdminRow);
  // Another instance seeded the same username first — read theirs.
  const winner = await findAdminByUsername(username);
  if (!winner) throw new Error("Gagal membuat akun admin");
  return winner;
}

// ---------- election ----------

export async function getElection(): Promise<Election> {
  const res = await supabase()
    .from("election")
    .select("*")
    .eq("id", "main")
    .maybeSingle();
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  if (res.data) return mapElection(res.data as ElectionRow);

  // Row missing (DB seeded by older SQL) — insert it.
  const title = process.env.ELECTION_TITLE ?? "Pemilihan";
  const ins = await supabase()
    .from("election")
    .upsert({ id: "main", title }, { onConflict: "id", ignoreDuplicates: true })
    .select()
    .maybeSingle();
  if (ins.error) throw new Error(`Supabase: ${ins.error.message}`);
  if (ins.data) return mapElection(ins.data as ElectionRow);
  const again = await supabase().from("election").select("*").eq("id", "main").single();
  return mapElection(unwrap(again) as ElectionRow);
}

export async function patchElection(patch: {
  title?: string;
  showResultsToVoters?: boolean;
}): Promise<Election> {
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.showResultsToVoters !== undefined) {
    row.show_results_to_voters = patch.showResultsToVoters;
  }
  const res = await supabase()
    .from("election")
    .update(row)
    .eq("id", "main")
    .select()
    .single();
  return mapElection(unwrap(res) as ElectionRow);
}

export type StartOutcome =
  | { ok: true; election: Election }
  | { ok: false; reason: "not-draft" | "too-few-candidates" };

/**
 * DRAFT → OPEN via compare-and-swap on status so concurrent starts
 * cannot both win.
 */
export async function startElection(): Promise<StartOutcome> {
  const [election, candRes] = await Promise.all([
    getElection(),
    supabase().from("candidates").select("id", { count: "exact", head: true }),
  ]);
  if (candRes.error) throw new Error(`Supabase: ${candRes.error.message}`);

  if (election.status !== "DRAFT") return { ok: false, reason: "not-draft" };
  if ((candRes.count ?? 0) < 2) return { ok: false, reason: "too-few-candidates" };

  const res = await supabase()
    .from("election")
    .update({ status: "OPEN", started_at: new Date().toISOString() })
    .eq("id", "main")
    .eq("status", "DRAFT")
    .select()
    .maybeSingle();
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  if (res.data) return { ok: true, election: mapElection(res.data as ElectionRow) };
  return { ok: false, reason: "not-draft" };
}

export type StopOutcome =
  | { ok: true; election: Election }
  | { ok: false; reason: "not-open" };

export async function stopElection(): Promise<StopOutcome> {
  const res = await supabase()
    .from("election")
    .update({ status: "CLOSED", closed_at: new Date().toISOString() })
    .eq("id", "main")
    .eq("status", "OPEN")
    .select()
    .maybeSingle();
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  if (res.data) return { ok: true, election: mapElection(res.data as ElectionRow) };
  return { ok: false, reason: "not-open" };
}

// ---------- candidates ----------

export async function listCandidates(): Promise<Candidate[]> {
  const res = await supabase()
    .from("candidates")
    .select("*")
    .order("created_at", { ascending: true });
  return (unwrap(res) as CandidateRow[]).map(mapCandidate);
}

export type CreateCandidateOutcome =
  | { ok: true; candidate: Candidate }
  | { ok: false; reason: "not-draft" | "duplicate" };

export async function createCandidate(input: {
  name: string;
  nameKey: string;
  description: string | null;
  photoUrl: string | null;
}): Promise<CreateCandidateOutcome> {
  const election = await getElection();
  if (election.status !== "DRAFT") return { ok: false, reason: "not-draft" };

  const existing = await listCandidates();
  if (existing.some((c) => candidateKey(c.name) === input.nameKey)) {
    return { ok: false, reason: "duplicate" };
  }

  const res = await supabase()
    .from("candidates")
    .insert({
      name: input.name,
      description: input.description,
      photo_url: input.photoUrl,
    })
    .select()
    .single();
  return { ok: true, candidate: mapCandidate(unwrap(res) as CandidateRow) };
}

export type UpdateCandidateOutcome =
  | { ok: true; candidate: Candidate }
  | { ok: false; reason: "not-found" | "not-draft" | "duplicate" };

export async function updateCandidate(
  id: string,
  patch: {
    name?: string;
    nameKey?: string;
    description?: string | null;
    photoUrl?: string | null;
  },
  ): Promise<UpdateCandidateOutcome> {
  if (!isUuid(id)) return { ok: false, reason: "not-found" };
  const [election, candidates] = await Promise.all([getElection(), listCandidates()]);
  const target = candidates.find((c) => c.id === id);
  if (!target) return { ok: false, reason: "not-found" };
  if (election.status !== "DRAFT") return { ok: false, reason: "not-draft" };
  if (patch.name !== undefined && patch.nameKey !== undefined) {
    const clash = candidates.some(
      (c) => c.id !== id && candidateKey(c.name) === patch.nameKey,
    );
    if (clash) return { ok: false, reason: "duplicate" };
  }

  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.photoUrl !== undefined) row.photo_url = patch.photoUrl;

  const res = await supabase()
    .from("candidates")
    .update(row)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  if (!res.data) return { ok: false, reason: "not-found" };
  return { ok: true, candidate: mapCandidate(res.data as CandidateRow) };
}

export type DeleteCandidateOutcome =
  | { ok: true }
  | { ok: false; reason: "not-found" | "not-draft" };

export async function deleteCandidate(id: string): Promise<DeleteCandidateOutcome> {
  if (!isUuid(id)) return { ok: false, reason: "not-found" };
  const election = await getElection();
  if (election.status !== "DRAFT") return { ok: false, reason: "not-draft" };

  const res = await supabase()
    .from("candidates")
    .delete()
    .eq("id", id)
    .select()
    .maybeSingle();
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  if (!res.data) return { ok: false, reason: "not-found" };
  return { ok: true };
}

function candidateKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

// ---------- voters ----------

/** Register (or fetch) a voter by normalized name. Atomic via RPC. */
export async function registerVoter(name: string, nameKey: string): Promise<Voter> {
  const rows = unwrap(
    await supabase().rpc("register_voter", { p_name: name, p_name_key: nameKey }),
  ) as VoterRow[];
  const row = rows?.[0];
  if (!row) throw new Error("Supabase: register_voter returned no row");
  return mapVoter(row);
}

export async function getVoterById(id: string): Promise<Voter | null> {
  if (!isUuid(id)) return null;
  const res = await supabase().from("voters").select("*").eq("id", id).maybeSingle();
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  return res.data ? mapVoter(res.data as VoterRow) : null;
}

export async function listVoters(): Promise<Voter[]> {
  const res = await supabase()
    .from("voters")
    .select("*")
    .order("created_at", { ascending: true });
  return (unwrap(res) as VoterRow[]).map(mapVoter);
}

export type DeleteVoterOutcome =
  | { ok: true; removedVotes: number }
  | { ok: false; reason: "not-found" };

/**
 * Remove a voter entry; their vote (if any) disappears via FK cascade.
 * Allowed in any election status so admins can clean odd/duplicate names.
 */
export async function deleteVoter(id: string): Promise<DeleteVoterOutcome> {
  if (!isUuid(id)) return { ok: false, reason: "not-found" };
  const votesBefore = await supabase()
    .from("votes")
    .select("id", { count: "exact", head: true })
    .eq("voter_id", id);
  if (votesBefore.error) throw new Error(`Supabase: ${votesBefore.error.message}`);

  const res = await supabase()
    .from("voters")
    .delete()
    .eq("id", id)
    .select()
    .maybeSingle();
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  if (!res.data) return { ok: false, reason: "not-found" };
  return { ok: true, removedVotes: votesBefore.count ?? 0 };
}

// ---------- votes ----------

export type CastVoteFailureReason =
  | "not-started"
  | "closed"
  | "voter-gone"
  | "already-voted"
  | "candidate-not-found";

export type CastVoteOutcome =
  | { ok: true }
  | { ok: false; reason: CastVoteFailureReason };

/** Cast a vote. Single atomic SQL function — race-proof (unique voter_id). */
export async function castVote(
  voterId: string,
  candidateId: string,
): Promise<CastVoteOutcome> {
  if (!isUuid(voterId)) return { ok: false, reason: "voter-gone" };
  if (!isUuid(candidateId)) {
    // PostgREST menolak parameter non-uuid sebelum fungsi berjalan —
    // tiru urutan cek status yang sama seperti di dalam cast_vote.
    const election = await getElection();
    if (election.status === "DRAFT") return { ok: false, reason: "not-started" };
    if (election.status === "CLOSED") return { ok: false, reason: "closed" };
    return { ok: false, reason: "candidate-not-found" };
  }
  const out = unwrap(
    await supabase().rpc("cast_vote", {
      p_voter_id: voterId,
      p_candidate_id: candidateId,
    }),
  ) as { ok: boolean; reason?: CastVoteFailureReason };
  if (out.ok) return { ok: true };
  return { ok: false, reason: out.reason ?? "candidate-not-found" };
}

export async function listVotes(): Promise<Vote[]> {
  const res = await supabase().from("votes").select("*");
  return (unwrap(res) as VoteRow[]).map(mapVote);
}

// ---------- election reset (admin action) ----------

export type ResetElectionOutcome =
  | { ok: true }
  | { ok: false; reason: "not-closed" };

export async function resetElectionState(): Promise<ResetElectionOutcome> {
  const out = unwrap(await supabase().rpc("reset_election")) as {
    ok: boolean;
    reason?: string;
  };
  if (out.ok) return { ok: true };
  return { ok: false, reason: out.reason as "not-closed" };
}

/**
 * Full wipe + reseed (test-only route): all tables back to a fresh session
 * with a new admin account seeded from env.
 */
export async function resetDb(): Promise<void> {
  const sb = supabase();
  const delVotes = await sb.from("votes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (delVotes.error) throw new Error(`Supabase: ${delVotes.error.message}`);
  const delVoters = await sb.from("voters").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (delVoters.error) throw new Error(`Supabase: ${delVoters.error.message}`);
  const delCands = await sb.from("candidates").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (delCands.error) throw new Error(`Supabase: ${delCands.error.message}`);
  const delAdmins = await sb.from("admins").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (delAdmins.error) throw new Error(`Supabase: ${delAdmins.error.message}`);
  const delSettings = await sb.from("settings").delete().neq("key", "");
  if (delSettings.error) throw new Error(`Supabase: ${delSettings.error.message}`);

  const title = process.env.ELECTION_TITLE ?? "Pemilihan";
  const upsert = await sb
    .from("election")
    .upsert(
      {
        id: "main",
        title,
        status: "DRAFT",
        show_results_to_voters: true,
        started_at: null,
        closed_at: null,
      },
      { onConflict: "id" },
    )
    .select()
    .maybeSingle();
  if (upsert.error) throw new Error(`Supabase: ${upsert.error.message}`);

  clearSessionSecretCache();
  await ensureAdmin();
}
