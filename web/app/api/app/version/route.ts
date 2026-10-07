import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    version: "1.0.0",
    versionCode: 1,
    downloadUrl: "/AttendanceTracker.apk",
    apiDownloadUrl: "/api/app/download",
    releaseNotes: "Latest version with automatic network sync, course drop, Markdown routine ingestion, and room code display.",
    updatedAt: new Date().toISOString(),
  });
}
