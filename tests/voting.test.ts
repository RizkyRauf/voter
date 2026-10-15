import { beforeEach, describe, expect, it } from "vitest";
import { BASE_URL, TestClient, adminClient, resetState, uniqueName } from "./helpers";

interface VoterInfo {
  id: string;
  name: string;
  hasVoted: boolean;
  votedAt: string | null;
}

async function openElectionWithCandidates(admin: TestClient): Promise<string[]> {
  const ids: string[] = [];
  for (const label of ["A", "B"]) {
    const res = await admin.post("/api/candidates", { name: uniqueName(`Kandidat ${label}`) });
    expect(res.status).toBe(201);
    ids.push((res.data as { id: string }).id);
  }
  const start = await admin.post("/api/election/start");
  expect(start.status).toBe(200);
  return ids;
}

async function register(name: string): Promise<TestClient> {
  const client = new TestClient();
  const res = await client.post("/api/voter/session", { name });
  expect(res.status).toBe(200);
  return client;
}

describe("voter registration by name", () => {
  let admin: TestClient;

  beforeEach(async () => {
    await resetState();
    admin = await adminClient();
  });

  it("registers a new voter and sets an httpOnly session cookie", async () => {
    const client = await register("Budi Santoso");
    expect(client.cookieHeader()).toContain("voter_session=");

    const me = await client.get("/api/voter/me");
    expect(me.status).toBe(200);
    expect(me.data).toEqual({ authenticated: true, hasVoted: false });
  });

  it("maps case/whitespace variants of a name to the same voter", async () => {
    const first = await register("Budi Santoso");
    const second = await register("  budi   SANTOSO ");

    const a = await first.get("/api/voter/me");
    const b = await second.get("/api/voter/me");
    expect(a.data).toEqual({ authenticated: true, hasVoted: false });
    expect(b.data).toEqual({ authenticated: true, hasVoted: false });

    const list = (await admin.get("/api/voters")).data as {
      total: number;
      voters: VoterInfo[];
    };
    expect(list.total).toBe(1);
    expect(list.voters[0]?.name).toBe("Budi Santoso");
  });

  it("rejects an empty name", async () => {
    for (const name of ["", "   "]) {
      const res = await new TestClient().post("/api/voter/session", { name });
      expect(res.status).toBe(400);
    }
  });

  it("lists voters with names for admin only, without exposing choices", async () => {
    const ids = await openElectionWithCandidates(admin);
    const client = await register("Siti");
    await client.post("/api/votes", { candidateId: ids[0] });

    const list = await admin.get("/api/voters");
    expect(list.status).toBe(200);
    const body = list.data as { total: number; votedCount: number; voters: VoterInfo[] };
    expect(body.total).toBe(1);
    expect(body.votedCount).toBe(1);
    expect(body.voters[0]?.name).toBe("Siti");
    expect(body.voters[0]?.hasVoted).toBe(true);
    expect(typeof body.voters[0]?.votedAt).toBe("string");

    const denied = await new TestClient().get("/api/voters");
    expect(denied.status).toBe(401);
  });
});

describe("casting a vote (1 nama = 1 suara)", () => {
  let admin: TestClient;
  let candidateIds: string[];

  beforeEach(async () => {
    await resetState();
    admin = await adminClient();
    candidateIds = await openElectionWithCandidates(admin);
  });

  it("requires a voter session", async () => {
    const anon = new TestClient();
    const res = await anon.post("/api/votes", { candidateId: candidateIds[0] });
    expect(res.status).toBe(401);
  });

  it("rejects votes while the election is still DRAFT", async () => {
    await resetState();
    admin = await adminClient();
    await admin.post("/api/candidates", { name: uniqueName("A") });
    await admin.post("/api/candidates", { name: uniqueName("B") });
    const client = await register("Andi");

    const res = await client.post("/api/votes", { candidateId: "any" });
    expect(res.status).toBe(403);
    expect((res.data as { error: string }).error).toMatch(/belum dimulai/i);
  });

  it("accepts a vote while OPEN and marks the voter as having voted", async () => {
    const client = await register("Andi");

    const res = await client.post("/api/votes", { candidateId: candidateIds[0] });
    expect(res.status).toBe(201);

    const me = await client.get("/api/voter/me");
    expect(me.data).toEqual({ authenticated: true, hasVoted: true });
  });

  it("rejects a second vote from the same name (any casing/spacing)", async () => {
    const client = await register("Andi");
    const first = await client.post("/api/votes", { candidateId: candidateIds[0] });
    expect(first.status).toBe(201);

    // A fresh request with a variant of the same name reuses the same voter.
    const again = await register("  andi ");
    const second = await again.post("/api/votes", { candidateId: candidateIds[1] });
    expect(second.status).toBe(409);
    expect((second.data as { error: string }).error).toMatch(/sudah/i);
  });

  it("accepts concurrent double-submit only once (server-side)", async () => {
    const client = await register("Andi");

    const [a, b] = await Promise.all([
      client.post("/api/votes", { candidateId: candidateIds[0] }),
      client.post("/api/votes", { candidateId: candidateIds[1] }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);
  });

  it("rejects a vote for an unknown candidate", async () => {
    const client = await register("Andi");
    const res = await client.post("/api/votes", { candidateId: "tidak-ada" });
    expect(res.status).toBe(404);
  });

  it("lets a second voter vote for a different candidate", async () => {
    const first = await register("Andi");
    const second = await register("Siti");
    expect((await first.post("/api/votes", { candidateId: candidateIds[0] })).status).toBe(201);
    expect((await second.post("/api/votes", { candidateId: candidateIds[1] })).status).toBe(201);
  });

  it("rejects votes once the election is CLOSED", async () => {
    const client = await register("Andi");
    await admin.post("/api/election/stop", { confirm: true });

    const res = await client.post("/api/votes", { candidateId: candidateIds[0] });
    expect(res.status).toBe(403);
    expect((res.data as { error: string }).error).toMatch(/ditutup/i);
  });

  it("keeps the candidate list publicly visible while OPEN", async () => {
    const res = await fetch(`${BASE_URL}/api/election`);
    const body = (await res.json()) as { candidates: { id: string }[] };
    expect(body.candidates.length).toBe(2);
  });
});

describe("admin cleanup of voter entries", () => {
  let admin: TestClient;
  let candidateIds: string[];

  beforeEach(async () => {
    await resetState();
    admin = await adminClient();
    candidateIds = await openElectionWithCandidates(admin);
  });

  it("requires admin authentication", async () => {
    const client = await register("Andi");
    const list = (await admin.get("/api/voters")).data as { voters: VoterInfo[] };
    const id = list.voters[0]!.id;

    const anon = new TestClient();
    expect((await anon.delete(`/api/voters/${id}`)).status).toBe(401);
    expect((await client.get("/api/voters")).status).toBe(401);
  });

  it("deletes a voter who has not voted, allowing re-registration", async () => {
    const client = await register("Andi");
    const list = (await admin.get("/api/voters")).data as { voters: VoterInfo[] };
    const id = list.voters[0]!.id;

    expect((await admin.delete(`/api/voters/${id}`)).status).toBe(200);

    const me = await client.get("/api/voter/me");
    expect(me.data).toEqual({ authenticated: false });
    // Re-registering the same name works and can vote again.
    const again = await register("Andi");
    expect((await again.post("/api/votes", { candidateId: candidateIds[0] })).status).toBe(201);
  });

  it("deletes a voter who already voted and removes their vote from the total", async () => {
    const client = await register("Andi");
    expect((await client.post("/api/votes", { candidateId: candidateIds[0] })).status).toBe(201);
    const list = (await admin.get("/api/voters")).data as { voters: VoterInfo[] };
    const id = list.voters[0]!.id;

    const resultsBefore = (await admin.get("/api/results")).data as { totalVotes: number };
    expect(resultsBefore.totalVotes).toBe(1);

    const del = await admin.delete(`/api/voters/${id}`);
    expect(del.status).toBe(200);
    expect((del.data as { removedVotes: number }).removedVotes).toBe(1);

    const resultsAfter = (await admin.get("/api/results")).data as { totalVotes: number };
    expect(resultsAfter.totalVotes).toBe(0);

    // The freed name can vote again in the still-OPEN election.
    const again = await register("Andi");
    expect((await again.post("/api/votes", { candidateId: candidateIds[1] })).status).toBe(201);
  });

  it("returns 404 for an unknown voter id", async () => {
    expect((await admin.delete("/api/voters/tidak-ada")).status).toBe(404);
  });
});
