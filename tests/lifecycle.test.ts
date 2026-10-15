import { beforeEach, describe, expect, it } from "vitest";
import { BASE_URL, TestClient, adminClient, resetState, uniqueName } from "./helpers";

interface CandidateResponse {
  id: string;
  name: string;
}

interface ElectionResponse {
  status: "DRAFT" | "OPEN" | "CLOSED";
  startedAt: string | null;
  closedAt: string | null;
  candidates: { id: string; name: string }[];
}

async function addCandidates(admin: TestClient, count: number): Promise<CandidateResponse[]> {
  const out: CandidateResponse[] = [];
  for (let i = 0; i < count; i++) {
    const res = await admin.post("/api/candidates", { name: uniqueName(`Kandidat ${i}`) });
    expect(res.status).toBe(201);
    out.push(res.data as CandidateResponse);
  }
  return out;
}

describe("election lifecycle", () => {
  let admin: TestClient;

  beforeEach(async () => {
    await resetState();
    admin = await adminClient();
  });

  it("requires admin authentication to start voting", async () => {
    const anon = new TestClient();
    const res = await anon.post("/api/election/start");
    expect(res.status).toBe(401);
  });

  it("refuses to start with fewer than 2 candidates", async () => {
    let res = await admin.post("/api/election/start");
    expect(res.status).toBe(400);
    expect((res.data as { error: string }).error).toMatch(/minimal 2 peserta/i);

    await addCandidates(admin, 1);
    res = await admin.post("/api/election/start");
    expect(res.status).toBe(400);
  });

  it("starts voting with 2 or more candidates and exposes them publicly", async () => {
    await addCandidates(admin, 2);
    const res = await admin.post("/api/election/start");
    expect(res.status).toBe(200);
    const body = res.data as ElectionResponse;
    expect(body.status).toBe("OPEN");
    expect(body.startedAt).toBeTruthy();

    const publicView = await fetch(`${BASE_URL}/api/election`);
    const election = (await publicView.json()) as ElectionResponse;
    expect(election.status).toBe("OPEN");
    expect(election.candidates.length).toBe(2);
  });

  it("rejects starting twice while OPEN", async () => {
    await addCandidates(admin, 2);
    const first = await admin.post("/api/election/start");
    expect(first.status).toBe(200);
    const again = await admin.post("/api/election/start");
    expect(again.status).toBe(409);
  });

  it("locks candidate management once voting is OPEN", async () => {
    const [cand] = await addCandidates(admin, 2);
    await admin.post("/api/election/start");

    const create = await admin.post("/api/candidates", { name: uniqueName() });
    expect(create.status).toBe(409);
    const edit = await admin.patch(`/api/candidates/${cand.id}`, { name: uniqueName("X") });
    expect(edit.status).toBe(409);
    const remove = await admin.delete(`/api/candidates/${cand.id}`);
    expect(remove.status).toBe(409);
  });

  it("requires explicit confirmation to stop voting", async () => {
    await addCandidates(admin, 2);
    await admin.post("/api/election/start");
    const res = await admin.post("/api/election/stop", {});
    expect(res.status).toBe(400);
    expect((res.data as { error: string }).error).toMatch(/konfirmasi/i);
  });

  it("stops voting with confirmation; status becomes CLOSED (one-way)", async () => {
    await addCandidates(admin, 2);
    await admin.post("/api/election/start");
    const res = await admin.post("/api/election/stop", { confirm: true });
    expect(res.status).toBe(200);
    const body = res.data as ElectionResponse;
    expect(body.status).toBe("CLOSED");
    expect(body.closedAt).toBeTruthy();

    const stopAgain = await admin.post("/api/election/stop", { confirm: true });
    expect(stopAgain.status).toBe(409);
    const startAgain = await admin.post("/api/election/start");
    expect(startAgain.status).toBe(409);
  });
});
