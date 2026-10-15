import { beforeEach, describe, expect, it } from "vitest";
import { BASE_URL, TestClient, adminClient, resetState, uniqueName } from "./helpers";

async function setupClosedWithVotes(
  admin: TestClient,
): Promise<{ voterNames: string[]; candidateNames: string[] }> {
  expect((await admin.post("/api/election/start")).status).toBe(200);
  const voterNames = [uniqueName("Pemilih 1"), uniqueName("Pemilih 2")];
  const candidateNames = [uniqueName("Kandidat A"), uniqueName("Kandidat B")];
  for (const [i, voterName] of voterNames.entries()) {
    const client = new TestClient();
    await client.post("/api/voter/session", { name: voterName });
    expect(
      (await client.post("/api/votes", { candidateName: candidateNames[i] })).status,
    ).toBe(201);
  }
  expect((await admin.post("/api/election/stop", { confirm: true })).status).toBe(200);
  return { voterNames, candidateNames };
}

describe("CSV export (A-10)", () => {
  let admin: TestClient;

  beforeEach(async () => {
    await resetState();
    admin = await adminClient();
  });

  it("requires admin authentication", async () => {
    const anon = new TestClient();
    const res = await anon.get("/api/export");
    expect(res.status).toBe(401);
  });

  it("exports aggregate results as CSV attachment", async () => {
    await setupClosedWithVotes(admin);
    const res = await fetch(`${BASE_URL}/api/export`, {
      headers: { cookie: admin.cookieHeader() },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("attachment");

    const text = await res.text();
    const lines = text.trim().split("\n");
    expect(lines[0]).toBe("Nama Peserta,Suara,Persentase");
    expect(lines.length).toBe(4); // header + 2 candidates + total
    expect(text).toContain("Total Suara,2");
    // aggregate only: no voter names in the export
    expect(text).not.toMatch(/Kode/i);
  });

  it("escapes commas and quotes in candidate names", async () => {
    expect((await admin.post("/api/election/start")).status).toBe(200);
    const client = new TestClient();
    await client.post("/api/voter/session", { name: uniqueName("Pemilih") });
    const vote = await client.post("/api/votes", { candidateName: 'Kandidat, "Hebat"' });
    expect(vote.status).toBe(201);
    await admin.post("/api/election/stop", { confirm: true });

    const res = await fetch(`${BASE_URL}/api/export`, {
      headers: { cookie: admin.cookieHeader() },
    });
    const text = await res.text();
    expect(text).toContain('"Kandidat, ""Hebat"""');
  });
});

describe("reset voting (A-11)", () => {
  let admin: TestClient;

  beforeEach(async () => {
    await resetState();
    admin = await adminClient();
  });

  it("requires admin authentication", async () => {
    const anon = new TestClient();
    const res = await anon.post("/api/reset");
    expect(res.status).toBe(401);
  });

  it("only allows reset after the election is CLOSED", async () => {
    expect((await admin.post("/api/reset")).status).toBe(409);
    await admin.post("/api/election/start");
    expect((await admin.post("/api/reset")).status).toBe(409);
  });

  it("clears votes, voter names, and typed candidates, reopens a fresh DRAFT session", async () => {
    const { voterNames } = await setupClosedWithVotes(admin);

    const res = await admin.post("/api/reset");
    expect(res.status).toBe(200);

    const election = await fetch(`${BASE_URL}/api/election`);
    const body = (await election.json()) as {
      status: string;
      startedAt: string | null;
      closedAt: string | null;
      candidates: unknown[];
    };
    expect(body.status).toBe("DRAFT");
    expect(body.startedAt).toBeNull();
    expect(body.closedAt).toBeNull();
    expect(body.candidates).toEqual([]); // hidden while DRAFT

    // sesi baru dimulai bersih — kandidat lama ikut terhapus (Amd.4)
    const start = await admin.post("/api/election/start");
    expect(start.status).toBe(200);

    const view = await fetch(`${BASE_URL}/api/election`);
    const after = (await view.json()) as { candidates: unknown[] };
    expect(after.candidates).toEqual([]);

    // voter names are wiped together with their votes
    const voters = (await admin.get("/api/voters")).data as {
      total: number;
      voters: { name: string }[];
    };
    expect(voters.total).toBe(0);
    expect(voters.voters).toEqual([]);

    // the same name can register fresh in the new session and vote again
    const client = new TestClient();
    expect(
      (await client.post("/api/voter/session", { name: voterNames[0] })).status,
    ).toBe(200);
    const vote = await client.post("/api/votes", { candidateName: "Anis Malik" });
    expect(vote.status).toBe(201);
  });
});
