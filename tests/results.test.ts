import { beforeEach, describe, expect, it } from "vitest";
import { BASE_URL, TestClient, adminClient, resetState, uniqueName } from "./helpers";

interface ResultsResponse {
  status: "DRAFT" | "OPEN" | "CLOSED";
  totalVotes: number;
  results: { candidateId: string; name: string; votes: number; percentage: number }[];
  winner: { candidateId: string; name: string } | null;
}

interface GeneratedVoter {
  id: string;
  code: string;
}

async function setupOpen(admin: TestClient): Promise<string[]> {
  const ids: string[] = [];
  for (const label of ["A", "B"]) {
    const res = await admin.post("/api/candidates", { name: uniqueName(`Kandidat ${label}`) });
    ids.push((res.data as { id: string }).id);
  }
  expect((await admin.post("/api/election/start")).status).toBe(200);
  return ids;
}

async function voteAs(code: string, candidateId: string): Promise<void> {
  const voter = new TestClient();
  expect((await voter.post("/api/voter/session", { code })).status).toBe(200);
  expect((await voter.post("/api/votes", { candidateId })).status).toBe(201);
}

async function generateVoters(admin: TestClient, count: number): Promise<GeneratedVoter[]> {
  const res = await admin.post("/api/voters", { count });
  return (res.data as { voters: GeneratedVoter[] }).voters;
}

describe("results API", () => {
  let admin: TestClient;

  beforeEach(async () => {
    await resetState();
    admin = await adminClient();
  });

  it("hides results from the public while voting is OPEN", async () => {
    await setupOpen(admin);
    const res = await fetch(`${BASE_URL}/api/results`);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/ditutup|umumkan/i);
  });

  it("gives the admin live counts while OPEN (A-06)", async () => {
    const ids = await setupOpen(admin);
    const [voter] = await generateVoters(admin, 1);
    await voteAs(voter.code, ids[0]);

    const res = await admin.get("/api/results");
    expect(res.status).toBe(200);
    const body = res.data as ResultsResponse;
    expect(body.status).toBe("OPEN");
    expect(body.totalVotes).toBe(1);
    expect(body.results.find((r) => r.candidateId === ids[0])?.votes).toBe(1);
    expect(body.results.find((r) => r.candidateId === ids[1])?.votes).toBe(0);
    expect(body.winner?.candidateId).toBe(ids[0]);
  });

  it("reveals final results to the public after CLOSED (A-08, V-09)", async () => {
    const ids = await setupOpen(admin);
    const voters = await generateVoters(admin, 3);
    await voteAs(voters[0].code, ids[0]);
    await voteAs(voters[1].code, ids[0]);
    await voteAs(voters[2].code, ids[1]);

    expect((await admin.post("/api/election/stop", { confirm: true })).status).toBe(200);

    const res = await fetch(`${BASE_URL}/api/results`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as ResultsResponse;
    expect(body.status).toBe("CLOSED");
    expect(body.totalVotes).toBe(3);
    const first = body.results[0];
    const second = body.results[1];
    expect(first?.votes).toBe(2);
    expect(first?.percentage).toBeCloseTo(66.7, 1);
    expect(second?.votes).toBe(1);
    expect(second?.percentage).toBeCloseTo(33.3, 1);
    expect(body.winner?.candidateId).toBe(ids[0]);
  });

  it("returns no winner when the vote is tied", async () => {
    const ids = await setupOpen(admin);
    const voters = await generateVoters(admin, 2);
    await voteAs(voters[0].code, ids[0]);
    await voteAs(voters[1].code, ids[1]);
    await admin.post("/api/election/stop", { confirm: true });

    const res = await fetch(`${BASE_URL}/api/results`);
    const body = (await res.json()) as ResultsResponse;
    expect(body.winner).toBeNull();
  });

  it("hides public results when the admin disables the toggle", async () => {
    const ids = await setupOpen(admin);
    const [voter] = await generateVoters(admin, 1);
    await voteAs(voter.code, ids[0]);
    await admin.post("/api/election/stop", { confirm: true });

    const patched = await admin.patch("/api/election", { showResultsToVoters: false });
    expect(patched.status).toBe(200);
    expect((patched.data as { showResultsToVoters: boolean }).showResultsToVoters).toBe(false);

    const publicRes = await fetch(`${BASE_URL}/api/results`);
    expect(publicRes.status).toBe(403);

    const adminRes = await admin.get("/api/results");
    expect(adminRes.status).toBe(200);
    expect((adminRes.data as ResultsResponse).totalVotes).toBe(1);
  });

  it("updates the election title via PATCH (admin only)", async () => {
    const anon = new TestClient();
    expect((await anon.patch("/api/election", { title: "X" })).status).toBe(401);

    const bad = await admin.patch("/api/election", { title: "   " });
    expect(bad.status).toBe(400);

    const none = await admin.patch("/api/election", {});
    expect(none.status).toBe(400);

    const ok = await admin.patch("/api/election", { title: "Pemilihan Baru" });
    expect(ok.status).toBe(200);
    expect((ok.data as { title: string }).title).toBe("Pemilihan Baru");

    const publicView = await fetch(`${BASE_URL}/api/election`);
    expect(((await publicView.json()) as { title: string }).title).toBe("Pemilihan Baru");
  });
});
