import { NextRequest, NextResponse } from "next/server";

export function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

const buckets = new Map<string, { count: number; resetAt: number }>();

function bucketFor(key: string, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    const fresh = { count: 0, resetAt: now + windowMs };
    buckets.set(key, fresh);
    return fresh;
  }
  return bucket;
}

/** True when this key has exhausted its failure budget inside the window. */
export function tooManyFailures(key: string, limit: number, windowMs: number): boolean {
  return bucketFor(key, windowMs).count >= limit;
}

/** Count one failed attempt (e.g. wrong password). */
export function recordFailure(key: string, limit: number, windowMs: number): void {
  const bucket = bucketFor(key, windowMs);
  bucket.count += 1;
  if (bucket.count > limit) bucket.count = limit;
}

/** Successful action — forget past failures for this key. */
export function clearFailures(key: string): void {
  buckets.delete(key);
}

export function resetRateLimits(): void {
  buckets.clear();
}

export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "local";
}

/**
 * Basic CSRF protection for state-changing requests: browsers always send an
 * Origin header on cross-origin (and same-origin POST) requests, so a mismatch
 * is rejected. Non-browser clients (no Origin header) are allowed through.
 */
export function assertSameOrigin(req: NextRequest): NextResponse | null {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return null;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return jsonError(403, "Origin tidak valid");
  }
  if (originHost !== host) {
    return jsonError(403, "Permintaan ditolak: origin tidak sama");
  }
  return null;
}

export async function readJsonBody(
  req: NextRequest,
): Promise<Record<string, unknown> | NextResponse> {
  try {
    const body: unknown = await req.json();
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return jsonError(400, "Body request harus berupa JSON object");
    }
    return body as Record<string, unknown>;
  } catch {
    return jsonError(400, "Body JSON tidak valid");
  }
}

export function isErrorResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}
