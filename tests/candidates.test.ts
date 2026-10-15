import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { TestClient, adminClient, resetState, uniqueName } from "./helpers";

interface CandidateResponse {
  id: string;
  name: string;
  description: string | null;
  photoUrl: string | null;
}

describe("candidates API", () => {
  let admin: TestClient;

  beforeAll(async () => {
    await resetState();
  });

  beforeEach(async () => {
    admin = await adminClient();
  });

  it("requires admin authentication to create a candidate", async () => {
    const anon = new TestClient();
    const res = await anon.post("/api/candidates", { name: "Sia-Sia" });
    expect(res.status).toBe(401);
  });

  it("creates a candidate with a required name", async () => {
    const name = uniqueName();
    const res = await admin.post("/api/candidates", { name });
    expect(res.status).toBe(201);
    const body = res.data as CandidateResponse;
    expect(body.name).toBe(name);
    expect(body.description).toBeNull();
    expect(body.photoUrl).toBeNull();
    expect(typeof body.id).toBe("string");
  });

  it("creates a candidate with optional description and photo", async () => {
    const name = uniqueName();
    const res = await admin.post("/api/candidates", {
      name,
      description: "Deskripsi singkat",
      photoUrl: "https://example.com/foto.jpg",
    });
    expect(res.status).toBe(201);
    const body = res.data as CandidateResponse;
    expect(body.description).toBe("Deskripsi singkat");
    expect(body.photoUrl).toBe("https://example.com/foto.jpg");
  });

  it("rejects an empty or whitespace-only name", async () => {
    for (const name of ["", "   "]) {
      const res = await admin.post("/api/candidates", { name });
      expect(res.status).toBe(400);
    }
  });

  it("rejects a duplicate name (case-insensitive)", async () => {
    const name = uniqueName();
    const first = await admin.post("/api/candidates", { name });
    expect(first.status).toBe(201);
    const dup = await admin.post("/api/candidates", { name: name.toUpperCase() });
    expect(dup.status).toBe(400);
    expect((dup.data as { error: string }).error).toMatch(/duplikat|sudah ada/i);
  });

  it("edits a candidate while the election is still DRAFT", async () => {
    const created = await admin.post("/api/candidates", { name: uniqueName() });
    const id = (created.data as CandidateResponse).id;
    const res = await admin.patch(`/api/candidates/${id}`, {
      name: uniqueName("Nama Baru"),
      description: "Diubah",
    });
    expect(res.status).toBe(200);
    const body = res.data as CandidateResponse;
    expect(body.description).toBe("Diubah");
  });

  it("rejects renaming onto another candidate's name", async () => {
    const a = await admin.post("/api/candidates", { name: uniqueName() });
    const b = await admin.post("/api/candidates", { name: uniqueName() });
    const idA = (a.data as CandidateResponse).id;
    const nameB = (b.data as CandidateResponse).name;
    const res = await admin.patch(`/api/candidates/${idA}`, { name: nameB });
    expect(res.status).toBe(400);
  });

  it("returns 404 when editing an unknown candidate", async () => {
    const res = await admin.patch("/api/candidates/does-not-exist", { name: "X" });
    expect(res.status).toBe(404);
  });

  it("deletes a candidate while DRAFT", async () => {
    const created = await admin.post("/api/candidates", { name: uniqueName() });
    const id = (created.data as CandidateResponse).id;
    const res = await admin.delete(`/api/candidates/${id}`);
    expect(res.status).toBe(200);

    const again = await admin.delete(`/api/candidates/${id}`);
    expect(again.status).toBe(404);
  });

  it("returns 404 when deleting an unknown candidate", async () => {
    const res = await admin.delete("/api/candidates/nope");
    expect(res.status).toBe(404);
  });
});
