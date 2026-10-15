import { beforeAll, describe, expect, it } from "vitest";
import { ADMIN_PASSWORD, ADMIN_USERNAME, TestClient, resetState } from "./helpers";

describe("POST /api/auth/login", () => {
  beforeAll(async () => {
    await resetState();
  });

  it("rejects unknown username with 401", async () => {
    const client = new TestClient();
    const res = await client.post("/api/auth/login", {
      username: "bukan-admin",
      password: "rahasia",
    });
    expect(res.status).toBe(401);
  });

  it("rejects wrong password with 401", async () => {
    const client = new TestClient();
    const res = await client.post("/api/auth/login", {
      username: ADMIN_USERNAME,
      password: "salah",
    });
    expect(res.status).toBe(401);
    expect((res.data as { error: string }).error).toMatch(/salah/i);
  });

  it("rejects missing credentials with 400", async () => {
    const client = new TestClient();
    const res = await client.post("/api/auth/login", { username: ADMIN_USERNAME });
    expect(res.status).toBe(400);
  });

  it("accepts valid credentials and sets an httpOnly session cookie", async () => {
    const client = new TestClient();
    const res = await client.post("/api/auth/login", {
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
    });
    expect(res.status).toBe(200);
    expect((res.data as { ok: boolean }).ok).toBe(true);

    const setCookie = res.headers.getSetCookie().join(";");
    expect(setCookie).toContain("admin_session=");
    expect(setCookie.toLowerCase()).toContain("httponly");

    const session = await client.get("/api/auth/session");
    expect(session.status).toBe(200);
    expect(session.data).toEqual({ authenticated: true, username: ADMIN_USERNAME });
  });

  it("reports unauthenticated session without cookie", async () => {
    const client = new TestClient();
    const session = await client.get("/api/auth/session");
    expect(session.status).toBe(200);
    expect(session.data).toEqual({ authenticated: false });
  });

  it("logout clears the session", async () => {
    const client = new TestClient();
    await client.post("/api/auth/login", {
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
    });
    const logout = await client.post("/api/auth/logout");
    expect(logout.status).toBe(200);
    const session = await client.get("/api/auth/session");
    expect(session.data).toEqual({ authenticated: false });
  });

  it("blocks further attempts after repeated failures (rate limit)", async () => {
    const client = new TestClient();
    // 5 failed attempts are allowed, the 6th is blocked regardless of password.
    for (let i = 0; i < 5; i++) {
      const res = await client.post("/api/auth/login", {
        username: ADMIN_USERNAME,
        password: `salah-${i}`,
      });
      expect(res.status).toBe(401);
    }
    const blocked = await client.post("/api/auth/login", {
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
    });
    expect(blocked.status).toBe(429);
  });
});
