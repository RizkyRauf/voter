export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

export async function api<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<ApiResult<T>> {
  const headers = new Headers(init?.headers);
  let body = init?.body;
  if (init?.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(init.json);
  }
  try {
    const res = await fetch(path, {
      method: init?.method ?? (init?.json !== undefined ? "POST" : "GET"),
      headers,
      body,
      credentials: "same-origin",
      cache: "no-store",
    });
    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }
    if (!res.ok) {
      const message =
        data && typeof data === "object" && "error" in data
          ? String((data as { error: unknown }).error)
          : "Terjadi kesalahan. Silakan coba lagi.";
      return { ok: false, status: res.status, error: message };
    }
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, status: 0, error: "Tidak dapat terhubung ke server" };
  }
}
