import { spawn, type ChildProcess } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { BASE_URL } from "./helpers";

let child: ChildProcess | null = null;

export async function setup() {
  const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
  const port = new URL(BASE_URL).port;

  // Storage: Supabase (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY dari
  // .env.local, dimuat otomatis oleh next dev). Test-reset mengosongkan
  // tabel sebelum tiap file test — karenanya test wajib berurutan
  // (fileParallelism: false di vitest.config.ts).
  child = spawn(process.execPath, [nextBin, "dev", "-p", port], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      // Vitest menurunkan NODE_ENV=test ke child; Next.js sengaja tidak
      // memuat .env.local pada mode test — paksa development agar variabel
      // Supabase di .env.local tetap terbaca oleh server uji.
      NODE_ENV: "development",
      NEXT_DIST_DIR: `.next-test-${port}`,
      ENABLE_TEST_ROUTES: "1",
      SESSION_SECRET: "test-session-secret-do-not-use-in-prod",
      ADMIN_USERNAME: "admin",
      ADMIN_PASSWORD: "admin123",
      ELECTION_TITLE: "Pemilihan Uji",
      NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: process.env.DEBUG_TEST_SERVER
      ? ["ignore", "pipe", "pipe"]
      : ["ignore", "ignore", "ignore"],
    detached: true,
  });

  if (process.env.DEBUG_TEST_SERVER) {
    child.stdout?.pipe(process.stdout);
    child.stderr?.pipe(process.stderr);
  }

  const deadline = Date.now() + 150_000;
  for (;;) {
    if (child.exitCode !== null) {
      throw new Error(`next dev exited early with code ${child.exitCode}`);
    }
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.status === 200) break;
    } catch {
      // server not ready yet
    }
    if (Date.now() > deadline) {
      throw new Error(`Dev server not ready at ${BASE_URL} within timeout`);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
}

export async function teardown() {
  if (child?.pid) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
    await new Promise((r) => setTimeout(r, 800));
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      // already gone
    }
  }
  rmSync(path.join(process.cwd(), `.next-test-${new URL(BASE_URL).port}`), {
    recursive: true,
    force: true,
  });
}
