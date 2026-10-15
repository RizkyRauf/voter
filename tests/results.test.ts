import { beforeEach, describe, expect, it } from "vitest";
import { BASE_URL, TestClient, adminClient, resetState, uniqueName } from "./helpers";

interface ResultsResponse {
  status: "DRAFT" | "OPEN" | "CLOSED";
  totalVotes: number;
  results: { candidateId: string; name: string; votes: number; percentage: number }[];
  winner: { candidateId: string; name: string } | null;
  truncated: boolean;
}

async function openElection(admin: TestClient): Promise<void> {
  expect((await admin.post("/api/election/start")).status).toBe(200);
}

async function voteAs(voterName: string, candidateName: string): Promise<void> {
  const voter = new TestClient();
  expect((await voter.post("/api/voter/session", { name: voterName })).status).toBe(200);
  expect((await voter.post("/api/votes", { candidateName })).status).toBe(201);
}

describe("results API", () => {
  let admin: TestClient;

  beforeEach(async () => {
    await resetState();
    admin = await adminClient();
  });

  it("hides results from the public while voting is OPEN", async () => {
    await openElection(admin);
    const res = await fetch(`${BASE_URL}/api/results`);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/ditutup|umumkan/i);
  });

  it("gives the admin live counts while OPEN (A-06)", async () => {
    await openElection(admin);
    await voteAs(uniqueName("Pemilih"), "Kandidat A");

    const res = await admin.get("/api/results");
    expect(res.status).toBe(200);
    const body = res.data as ResultsResponse;
    expect(body.status).toBe("OPEN");
    expect(body.totalVotes).toBe(1);
    expect(body.results).toHaveLength(1);
    expect(body.results[0]?.name).toBe("Kandidat A");
    expect(body.results[0]?.votes).toBe(1);
    expect(body.winner?.name).toBe("Kandidat A");
  });

  it("reveals final results to the public after CLOSED (A-08, V-09)", async () => {
    await openElection(admin);
    await voteAs(uniqueName("Pemilih 1"), "Alpha");
    await voteAs(uniqueName("Pemilih 2"), "Alpha");
    await voteAs(uniqueName("Pemilih 3"), "Beta");

    expect((await admin.post("/api/election/stop", { confirm: true })).status).toBe(200);

    const res = await fetch(`${BASE_URL}/api/results`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as ResultsResponse;
    expect(body.status).toBe("CLOSED");
    expect(body.totalVotes).toBe(3);
    expect(body.truncated).toBe(false);
    const first = body.results[0];
    const second = body.results[1];
    expect(first?.name).toBe("Alpha");
    expect(first?.votes).toBe(2);
    expect(first?.percentage).toBeCloseTo(66.7, 1);
    expect(second?.name).toBe("Beta");
    expect(second?.votes).toBe(1);
    expect(second?.percentage).toBeCloseTo(33.3, 1);
    expect(body.winner?.name).toBe("Alpha");
  });

  it("returns no winner when the vote is tied", async () => {
    await openElection(admin);
    await voteAs(uniqueName("Pemilih 1"), "Alpha");
    await voteAs(uniqueName("Pemilih 2"), "Beta");
    await admin.post("/api/election/stop", { confirm: true });

    const res = await fetch(`${BASE_URL}/api/results`);
    const body = (await res.json()) as ResultsResponse;
    expect(body.winner).toBeNull();
  });

  it("limits the public view to the top 5 after CLOSED; admin sees everything", async () => {
    await openElection(admin);
    await voteAs(uniqueName("Pemilih 1"), "Juara");
    await voteAs(uniqueName("Pemilih 2"), "Juara");
    for (const label of ["Budi", "Citra", "Dewi", "Eko", "Fajar", "Gita"]) {
      await voteAs(uniqueName("Pemilih"), label);
    }
    expect((await admin.post("/api/election/stop", { confirm: true })).status).toBe(200);

    const publicRes = await fetch(`${BASE_URL}/api/results`);
    expect(publicRes.status).toBe(200);
    const publicBody = (await publicRes.json()) as ResultsResponse;
    expect(publicBody.truncated).toBe(true);
    expect(publicBody.results).toHaveLength(5);
    expect(publicBody.results[0]?.name).toBe("Juara"); // peringkat 1 = pemenang
    expect(publicBody.winner?.name).toBe("Juara");

    const adminBody = (await admin.get("/api/results")).data as ResultsResponse;
    expect(adminBody.truncated).toBe(false);
    expect(adminBody.results).toHaveLength(7);
  });

  it("hides public results when the admin disables the toggle", async () => {
    await openElection(admin);
    await voteAs(uniqueName("Pemilih"), "Kandidat A");
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
