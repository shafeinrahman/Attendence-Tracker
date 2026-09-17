import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.authenticated) return auth.errorResponse!;

  return NextResponse.json({ valid: true, message: "Authenticated successfully" });
}

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth.authenticated) return auth.errorResponse!;

  return NextResponse.json({ valid: true, message: "Authenticated successfully" });
}
