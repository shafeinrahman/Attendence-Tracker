import { NextRequest, NextResponse } from "next/server";

export function getExpectedApiToken(): string {
  return process.env.API_TOKEN || "attendance-secret-token-12345";
}

export function verifyApiToken(token: string | null | undefined): boolean {
  if (!token) return false;
  const expected = getExpectedApiToken();
  return token === expected;
}

export function extractTokenFromRequest(req: NextRequest): string | null {
  // Check Authorization header: "Bearer <token>"
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }

  // Check x-api-token header
  const customHeader = req.headers.get("x-api-token");
  if (customHeader) {
    return customHeader.trim();
  }

  // Check cookie
  const cookie = req.cookies.get("attendance_token");
  if (cookie?.value) {
    return cookie.value.trim();
  }

  return null;
}

export function authenticateRequest(req: NextRequest): { authenticated: boolean; errorResponse?: NextResponse } {
  const token = extractTokenFromRequest(req);
  if (!verifyApiToken(token)) {
    return {
      authenticated: false,
      errorResponse: NextResponse.json(
        { error: "Unauthorized: Invalid or missing API token" },
        { status: 401 }
      ),
    };
  }
  return { authenticated: true };
}
