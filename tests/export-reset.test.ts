import { beforeEach, describe, expect, it } from "vitest";
import { BASE_URL, TestClient, adminClient, resetState, uniqueName } from "./helpers";

async function setupClosedWithVotes(admin: TestClient): Promise<string[]> {
  const ids: string[] = [];
  for (const label of ["A", "B"]) {
    const res = await admin.post("/api/candidates", { name: uniqueName(`Kandidat ${label}`) });
    ids.push((res.data as { id: string }).id);
  }
  await admin.post("/api/election/start");
  const names = [uniqueName("Pemilih 1"), uniqueName("Pemilih 2")];
  for (const [i, name] of names.entries()) {
    const client = new TestClient();
    await client.post("/api/voter/session", { name });
    await client.post("/api/votes", { candidateId: ids[i] });
  }
  await admin.post("/api/election/stop", { confirm: true });
  return names;
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
    // aggregate only: no voter codes in the export
    expect(text).not.toMatch(/Kode/i);
  });

  it("escapes commas and quotes in candidate names", async () => {
    const weird = await admin.post("/api/candidates", { name: 'Kandidat, "Hebat"' });
    expect(weird.status).toBe(201);
    await admin.post("/api/candidates", { name: uniqueName("Biasa") });
    await admin.post("/api/election/start");
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
    for (const label of ["A", "B"]) {
      await admin.post("/api/candidates", { name: uniqueName(label) });
    }
    await admin.post("/api/election/start");
    expect((await admin.post("/api/reset")).status).toBe(409);
  });

  it("clears votes and voter names, reopens a fresh DRAFT session keeping candidates", async () => {
    const names = await setupClosedWithVotes(admin);

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

    // candidates are kept: we can start again right away
    const start = await admin.post("/api/election/start");
    expect(start.status).toBe(200);

    const view = await fetch(`${BASE_URL}/api/election`);
    const after = (await view.json()) as { candidates: unknown[] };
    expect(after.candidates.length).toBe(2);

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
      (await client.post("/api/voter/session", { name: names[0] })).status,
    ).toBe(200);
    const candidates = after.candidates as { id: string }[];
    const vote = await client.post("/api/votes", { candidateId: candidates[0].id });
    expect(vote.status).toBe(201);
  });
});
