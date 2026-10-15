import { NextRequest } from "next/server";
import { connection } from "next/server";
import { getAdminFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  await connection();
  const admin = await getAdminFromRequest(req);
  if (!admin) return Response.json({ authenticated: false });
  return Response.json({ authenticated: true, username: admin.username });
}
