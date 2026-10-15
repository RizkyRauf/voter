import { beforeAll, describe, expect, it } from "vitest";
import { BASE_URL, resetState } from "./helpers";

interface PublicElection {
  title: string;
  status: "DRAFT" | "OPEN" | "CLOSED";
  showResultsToVoters: boolean;
  startedAt: string | null;
  closedAt: string | null;
  candidates: { id: string; name: string; description: string | null; photoUrl: string | null }[];
}

describe("GET /api/election (public)", () => {
  beforeAll(async () => {
    await resetState();
  });

  it("returns seeded election in DRAFT status with no candidates", async () => {
    const res = await fetch(`${BASE_URL}/api/election`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as PublicElection;
    expect(body.title).toBe("Pemilihan Uji");
    expect(body.status).toBe("DRAFT");
    expect(body.startedAt).toBeNull();
    expect(body.closedAt).toBeNull();
    expect(body.candidates).toEqual([]);
    expect(typeof body.showResultsToVoters).toBe("boolean");
  });
});
