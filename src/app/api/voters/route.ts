import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin, isErrorResponse, jsonError, readJsonBody } from "@/lib/api";
import { generateCode } from "@/lib/codes";
import { requireAdmin } from "@/lib/auth";
import { readDb, updateDb } from "@/lib/store";
import type { Voter } from "@/lib/types";

const MAX_GENERATE = 500;

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (isErrorResponse(admin)) return admin;

  const db = await readDb();
  return NextResponse.json({
    total: db.voters.length,
    votedCount: db.voters.filter((v) => v.hasVoted).length,
    voters: db.voters.map((v) => ({
      id: v.id,
      code: v.code,
      hasVoted: v.hasVoted,
      createdAt: v.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const admin = await requireAdmin(req);
  if (isErrorResponse(admin)) return admin;

  const body = await readJsonBody(req);
  if (isErrorResponse(body)) return body;

  const { count } = body as { count?: unknown };
  if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > MAX_GENERATE) {
    return jsonError(400, `Jumlah pemilih harus bilangan bulat antara 1 dan ${MAX_GENERATE}`);
  }

  const created = await updateDb((db): Voter[] => {
    const newVoters: Voter[] = [];
    const used = new Set(db.voters.map((v) => v.code));
    while (newVoters.length < count) {
      const code = generateCode();
      if (used.has(code)) continue;
      used.add(code);
      const voter: Voter = {
        id: randomUUID(),
        code,
        hasVoted: false,
        createdAt: new Date().toISOString(),
      };
      newVoters.push(voter);
    }
    db.voters.push(...newVoters);
    return newVoters.map((v) => ({ ...v }));
  });

  return NextResponse.json({ voters: created }, { status: 201 });
}
