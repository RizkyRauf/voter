import { NextRequest } from "next/server";
import { getVoterFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const voter = await getVoterFromRequest(req);
  if (!voter) return Response.json({ authenticated: false });
  return Response.json({ authenticated: true, hasVoted: voter.hasVoted });
}
