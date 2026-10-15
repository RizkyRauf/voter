import { resetRateLimits } from "@/lib/api";
import { resetDb } from "@/lib/store";

export function GET() {
  return new Response(null, { status: 404 });
}

export async function POST() {
  if (process.env.ENABLE_TEST_ROUTES !== "1") {
    return new Response(null, { status: 404 });
  }
  await resetDb();
  resetRateLimits();
  return Response.json({ ok: true });
}
