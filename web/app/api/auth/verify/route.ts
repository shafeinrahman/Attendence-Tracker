import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;

  return NextResponse.json({
    valid: true,
    message: "Authenticated successfully",
    user: auth.user,
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
