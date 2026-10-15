import { beforeEach, describe, expect, it } from "vitest";
import { BASE_URL, TestClient, adminClient, resetState } from "./helpers";

interface ElectionResponse {
  status: "DRAFT" | "OPEN" | "CLOSED";
  startedAt: string | null;
  closedAt: string | null;
  candidates: { id: string; name: string }[];
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

  it("starts voting right away without pre-registered candidates (Amd.4)", async () => {
    const res = await admin.post("/api/election/start");
    expect(res.status).toBe(200);
    const body = res.data as ElectionResponse;
    expect(body.status).toBe("OPEN");
    expect(body.startedAt).toBeTruthy();

    const publicView = await fetch(`${BASE_URL}/api/election`);
    const election = (await publicView.json()) as ElectionResponse;
    expect(election.status).toBe("OPEN");
    expect(election.candidates).toEqual([]); // tercipta saat pemilih mengetik
  });

  it("rejects starting twice while OPEN", async () => {
    const first = await admin.post("/api/election/start");
    expect(first.status).toBe(200);
    const again = await admin.post("/api/election/start");
    expect(again.status).toBe(409);
  });

  it("no longer exposes the candidates management API", async () => {
    expect((await admin.post("/api/candidates", { name: "X" })).status).toBe(404);
    expect((await admin.get("/api/candidates")).status).toBe(404);
    expect((await admin.delete("/api/candidates/x")).status).toBe(404);
  });

  it("requires explicit confirmation to stop voting", async () => {
    await admin.post("/api/election/start");
    const res = await admin.post("/api/election/stop", {});
    expect(res.status).toBe(400);
    expect((res.data as { error: string }).error).toMatch(/konfirmasi/i);
  });

  it("stops voting with confirmation; status becomes CLOSED (one-way)", async () => {
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
