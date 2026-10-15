import { beforeEach, describe, expect, it } from "vitest";
import { BASE_URL, TestClient, adminClient, resetState } from "./helpers";

const HOST = new URL(BASE_URL).host;

describe("origin check on state-changing requests", () => {
  beforeEach(async () => {
    await resetState();
  });

  it("rejects a cross-origin login attempt", async () => {
    const client = new TestClient();
    const res = await client.request(
      "POST",
      "/api/auth/login",
      { username: "admin", password: "admin123" },
      { origin: "https://evil.example" },
    );
    expect(res.status).toBe(403);
  });

  it("allows a same-origin request", async () => {
    const client = new TestClient();
    const res = await client.request(
      "POST",
      "/api/auth/login",
      { username: "admin", password: "admin123" },
      { origin: `http://${HOST}` },
    );
    expect(res.status).toBe(200);
  });

  it("rejects cross-origin mutations on admin endpoints", async () => {
    const admin = await adminClient();
    const res = await admin.request(
      "POST",
      "/api/election/stop",
      { confirm: true },
      { origin: "https://evil.example" },
    );
    expect(res.status).toBe(403);
  });
});
