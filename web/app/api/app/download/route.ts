import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  try {
    const apkPath = path.join(process.cwd(), "public", "AttendanceTracker.apk");

    if (!fs.existsSync(apkPath)) {
      // Check project root fallback
      const rootApkPath = path.join(process.cwd(), "..", "AttendanceTracker.apk");
      if (fs.existsSync(rootApkPath)) {
        const fileBuffer = fs.readFileSync(rootApkPath);
        return new NextResponse(fileBuffer, {
          headers: {
            "Content-Type": "application/vnd.android.package-archive",
            "Content-Disposition": 'attachment; filename="AttendanceTracker.apk"',
            "Content-Length": fileBuffer.length.toString(),
          },
        });
      }
      return NextResponse.json({ error: "APK not found" }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(apkPath);
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/vnd.android.package-archive",
        "Content-Disposition": 'attachment; filename="AttendanceTracker.apk"',
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("Error serving APK:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
