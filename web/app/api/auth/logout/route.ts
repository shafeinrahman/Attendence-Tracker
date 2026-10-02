import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const response = NextResponse.json(
    { success: true, message: "Logged out successfully" },
    { status: 200 }
  );

  const cookiesToClear = [
    "attendance_jwt",
    "authjs.session-token",
    "__Secure-authjs.session-token",
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
    "authjs.csrf-token",
    "__Host-authjs.csrf-token",
    "next-auth.csrf-token",
    "__Host-next-auth.csrf-token",
    "authjs.callback-url",
    "__Secure-authjs.callback-url",
    "next-auth.callback-url",
    "__Secure-next-auth.callback-url",
  ];

  for (const cookieName of cookiesToClear) {
    response.cookies.set(cookieName, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      expires: new Date(0),
      path: "/",
    });
    response.cookies.delete(cookieName);
  }

  return response;
}

export async function GET(req: NextRequest) {
  return POST(req);
}
