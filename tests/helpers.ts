/**
 * Shared helpers for API tests.
 *
 * Tests run against a real `next dev` server (started by tests/global-setup.ts)
 * with an isolated JSON data store in a temp directory.
 */

const TEST_PORT = process.env.TEST_PORT ?? "4310";
export const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

export const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "admin";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin123";

export interface TestResponse<T = unknown> {
  status: number;
  data: T;
  text: string;
  headers: Headers;
}

export class TestClient {
  private cookies = new Map<string, string>();

  cookieHeader(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  setCookie(name: string, value: string) {
    this.cookies.set(name, value);
  }

  private storeCookies(res: Response) {
    for (const header of res.headers.getSetCookie?.() ?? []) {
      const [pair] = header.split(";");
      const idx = pair.indexOf("=");
      if (idx <= 0) continue;
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      if (value === "" || /deleted/i.test(value)) {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, value);
      }
    }
  }

  async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<TestResponse<T>> {
    const headers: Record<string, string> = { ...extraHeaders };
    const cookie = this.cookieHeader();
    if (cookie) headers["cookie"] = cookie;
    if (body !== undefined) headers["content-type"] = "application/json";

    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });
    this.storeCookies(res);

    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    return { status: res.status, data: data as T, text, headers: res.headers };
  }

  get<T = unknown>(path: string) {
    return this.request<T>("GET", path);
  }
  post<T = unknown>(path: string, body?: unknown, extraHeaders?: Record<string, string>) {
    return this.request<T>("POST", path, body ?? {}, extraHeaders);
  }
  patch<T = unknown>(path: string, body?: unknown) {
    return this.request<T>("PATCH", path, body ?? {});
  }
  delete<T = unknown>(path: string) {
    return this.request<T>("DELETE", path);
  }
}

export async function resetState(): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/test-reset`, { method: "POST" });
  if (!res.ok) {
    const text = (await res.text()).slice(0, 200);
    throw new Error(`Failed to reset test state: ${res.status} ${text}`);
  }
}

export async function adminClient(): Promise<TestClient> {
  const client = new TestClient();
  const res = await client.post("/api/auth/login", {
    username: ADMIN_USERNAME,
    password: ADMIN_PASSWORD,
  });
  if (res.status !== 200) {
    throw new Error(`Admin login failed: ${res.status} ${res.text}`);
  }
  return client;
}

export function uniqueName(prefix = "Peserta"): string {
  return `${prefix} ${Math.random().toString(36).slice(2, 8)}`;
}
