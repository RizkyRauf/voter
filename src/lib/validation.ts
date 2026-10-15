import { jsonError } from "./api";
import type { NextResponse } from "next/server";

export const MAX_NAME_LENGTH = 120;
export const MAX_TEXT_LENGTH = 500;

export function validateName(value: unknown): string | NextResponse {
  if (typeof value !== "string" || value.trim() === "") {
    return jsonError(400, "Nama peserta wajib diisi");
  }
  const name = value.trim();
  if (name.length > MAX_NAME_LENGTH) {
    return jsonError(400, `Nama peserta terlalu panjang (maks. ${MAX_NAME_LENGTH} karakter)`);
  }
  return name;
}

export function validateOptionalText(
  value: unknown,
  field: string,
): string | null | NextResponse {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return jsonError(400, `${field} tidak valid`);
  const trimmed = value.trim();
  if (trimmed.length > MAX_TEXT_LENGTH) {
    return jsonError(400, `${field} terlalu panjang (maks. ${MAX_TEXT_LENGTH} karakter)`);
  }
  return trimmed === "" ? null : trimmed;
}

/** Case-insensitive key for duplicate-name checks. */
export function nameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Validate a voter name. Returns the display form (trimmed, collapsed
 * whitespace) together with the normalized key, or an error response.
 */
export function validateVoterName(
  value: unknown,
): { name: string; nameKey: string } | NextResponse {
  if (typeof value !== "string" || value.trim() === "") {
    return jsonError(400, "Nama wajib diisi");
  }
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length > MAX_NAME_LENGTH) {
    return jsonError(400, `Nama terlalu panjang (maks. ${MAX_NAME_LENGTH} karakter)`);
  }
  return { name, nameKey: nameKey(name) };
}
