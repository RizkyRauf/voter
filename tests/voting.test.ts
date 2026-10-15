import { beforeEach, describe, expect, it } from "vitest";
import { BASE_URL, TestClient, adminClient, resetState, uniqueName } from "./helpers";

interface GeneratedVoter {
  id: string;
  code: string;
  hasVoted: boolean;
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

async function generateVoters(admin: TestClient, count: number): Promise<GeneratedVoter[]> {
  const res = await admin.post("/api/voters", { count });
  expect(res.status).toBe(201);
  return (res.data as { voters: GeneratedVoter[] }).voters;
}

async function voterSession(code: string): Promise<TestClient> {
  const client = new TestClient();
  const res = await client.post("/api/voter/session", { code });
  expect(res.status).toBe(200);
  return client;
}

describe("voter management", () => {
  let admin: TestClient;

  beforeEach(async () => {
    await resetState();
    admin = await adminClient();
  });

  it("generates unique voter codes", async () => {
    const voters = await generateVoters(admin, 3);
    expect(voters.length).toBe(3);
    const codes = voters.map((v) => v.code);
    expect(new Set(codes).size).toBe(3);
    for (const voter of voters) {
      expect(voter.hasVoted).toBe(false);
      expect(voter.code).toMatch(/^[A-Z2-9]{6,12}$/);
    }
  });

  it("lists voters for admin only", async () => {
    await generateVoters(admin, 2);
    const list = await admin.get("/api/voters");
    expect(list.status).toBe(200);
    const body = list.data as { total: number; votedCount: number; voters: GeneratedVoter[] };
    expect(body.total).toBe(2);
    expect(body.votedCount).toBe(0);
    expect(body.voters.length).toBe(2);

    const anon = new TestClient();
    const denied = await anon.get("/api/voters");
    expect(denied.status).toBe(401);
  });

  it("validates the count parameter", async () => {
    for (const count of [0, -1, 1.5, "abc", 501]) {
      const res = await admin.post("/api/voters", { count });
      expect(res.status).toBe(400);
    }
  });

  it("deletes a voter that has not voted", async () => {
    const voters = await generateVoters(admin, 1);
    const res = await admin.delete(`/api/voters/${voters[0].id}`);
    expect(res.status).toBe(200);
    const session = await new TestClient().post("/api/voter/session", { code: voters[0].code });
    expect(session.status).toBe(404);
  });
});

describe("voter session", () => {
  let admin: TestClient;

  beforeEach(async () => {
    await resetState();
    admin = await adminClient();
  });

  it("rejects an unknown code", async () => {
    const res = await new TestClient().post("/api/voter/session", { code: "SALAHBGT" });
    expect(res.status).toBe(404);
  });

  it("accepts a valid code and sets an httpOnly session cookie", async () => {
    const [voter] = await generateVoters(admin, 1);
    const client = await voterSession(voter.code);
    const setCookie = client.cookieHeader();
    expect(setCookie).toContain("voter_session=");

    const me = await client.get("/api/voter/me");
    expect(me.status).toBe(200);
    expect(me.data).toEqual({ authenticated: true, hasVoted: false });
  });

  it("reports unauthenticated voter without a session", async () => {
    const me = await new TestClient().get("/api/voter/me");
    expect(me.data).toEqual({ authenticated: false });
  });
});

describe("casting a vote (1 voter = 1 suara)", () => {
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
    const [voter] = await generateVoters(admin, 1);
    const client = await voterSession(voter.code);

    const res = await client.post("/api/votes", { candidateId: "any" });
    expect(res.status).toBe(403);
    expect((res.data as { error: string }).error).toMatch(/belum dimulai/i);
  });

  it("accepts a vote while OPEN and marks the voter as having voted", async () => {
    const [voter] = await generateVoters(admin, 1);
    const client = await voterSession(voter.code);

    const res = await client.post("/api/votes", { candidateId: candidateIds[0] });
    expect(res.status).toBe(201);

    const me = await client.get("/api/voter/me");
    expect(me.data).toEqual({ authenticated: true, hasVoted: true });
  });

  it("rejects a second vote from the same voter", async () => {
    const [voter] = await generateVoters(admin, 1);
    const client = await voterSession(voter.code);
    const first = await client.post("/api/votes", { candidateId: candidateIds[0] });
    expect(first.status).toBe(201);
    const second = await client.post("/api/votes", { candidateId: candidateIds[1] });
    expect(second.status).toBe(409);
    expect((second.data as { error: string }).error).toMatch(/sudah/i);
  });

  it("accepts concurrent double-submit only once (server-side)", async () => {
    const [voter] = await generateVoters(admin, 1);
    const client = await voterSession(voter.code);

    const [a, b] = await Promise.all([
      client.post("/api/votes", { candidateId: candidateIds[0] }),
      client.post("/api/votes", { candidateId: candidateIds[1] }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);
  });

  it("rejects a vote for an unknown candidate", async () => {
    const [voter] = await generateVoters(admin, 1);
    const client = await voterSession(voter.code);
    const res = await client.post("/api/votes", { candidateId: "tidak-ada" });
    expect(res.status).toBe(404);
  });

  it("lets a second voter vote for a different candidate", async () => {
    const voters = await generateVoters(admin, 2);
    const first = await voterSession(voters[0].code);
    const second = await voterSession(voters[1].code);
    expect((await first.post("/api/votes", { candidateId: candidateIds[0] })).status).toBe(201);
    expect((await second.post("/api/votes", { candidateId: candidateIds[1] })).status).toBe(201);
  });

  it("rejects votes once the election is CLOSED", async () => {
    const [voter] = await generateVoters(admin, 1);
    const client = await voterSession(voter.code);
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
