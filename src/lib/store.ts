import { randomBytes, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import type { Db } from "./types";

const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "db.json");

let cache: Db | null = null;
let queue: Promise<unknown> = Promise.resolve();

function now(): string {
  return new Date().toISOString();
}

async function createSeed(): Promise<Db> {
  const username = process.env.ADMIN_USERNAME ?? "admin";
  const password = process.env.ADMIN_PASSWORD ?? "admin123";
  const secret = process.env.SESSION_SECRET ?? randomBytes(32).toString("hex");
  return {
    secret,
    admins: [
      {
        id: randomUUID(),
        username,
        passwordHash: await bcrypt.hash(password, 10),
        createdAt: now(),
      },
    ],
    election: {
      id: randomUUID(),
      title: process.env.ELECTION_TITLE ?? "Pemilihan",
      status: "DRAFT",
      showResultsToVoters: true,
      startedAt: null,
      closedAt: null,
      createdAt: now(),
    },
    candidates: [],
    voters: [],
    votes: [],
  };
}

async function atomicWrite(db: Db): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  const tmp = path.join(dataDir, `.db.${process.pid}.${randomUUID()}.tmp`);
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
  await fs.rename(tmp, dbPath);
}

async function loadFromDisk(): Promise<Db | null> {
  try {
    const raw = await fs.readFile(dbPath, "utf8");
    return JSON.parse(raw) as Db;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

async function ensureLoaded(): Promise<Db> {
  if (cache) return cache;
  const db = (await loadFromDisk()) ?? (await seed());
  cache = db;
  return db;
}

async function seed(): Promise<Db> {
  const db = await createSeed();
  await atomicWrite(db);
  return db;
}

function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** Read the current database state (serialized against writes). */
export function readDb(): Promise<Db> {
  return runExclusive(ensureLoaded);
}

/**
 * Read-modify-write inside a critical section. Disk is the source of truth,
 * so every update re-reads before mutating and writes atomically (tmp+rename).
 *
 * The mutator may return `null` to abort without persisting — in that case it
 * must not have mutated `db` yet (validate first, mutate last).
 */
export function updateDb<T>(
  mutator: (db: Db) => T | null | Promise<T | null>,
): Promise<T | null> {
  return runExclusive(async () => {
    cache = (await loadFromDisk()) ?? (await seed());
    const db = cache;
    const result = await mutator(db);
    if (result === null) return null;
    await atomicWrite(db);
    return result;
  });
}

/** Wipe the store and seed a fresh one. Used by the test-only reset route. */
export async function resetDb(): Promise<void> {
  await runExclusive(async () => {
    cache = null;
    cache = await seed();
  });
}
