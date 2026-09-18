import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { parseMarkdownRoutine, ParsedSlot } from "@/lib/parser/markdown-parser";
import { parsePdfRoutine } from "@/lib/parser/pdf-parser";
import { parseImageRoutine } from "@/lib/parser/ocr-parser";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const contentType = req.headers.get("content-type") || "";

    let slots: ParsedSlot[] = [];

    if (contentType.includes("application/json")) {
      const body = await req.json();
      if (body.markdown) {
        slots = parseMarkdownRoutine(body.markdown);
      } else {
        return NextResponse.json({ error: "markdown field is required in JSON payload" }, { status: 400 });
      }
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const markdown = formData.get("markdown") as string | null;

      if (markdown) {
        slots = parseMarkdownRoutine(markdown);
      } else if (file) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const fileName = file.name.toLowerCase();

        if (fileName.endsWith(".md") || fileName.endsWith(".txt")) {
          const text = buffer.toString("utf-8");
          slots = parseMarkdownRoutine(text);
        } else if (fileName.endsWith(".pdf")) {
          slots = await parsePdfRoutine(buffer);
        } else if (
          fileName.endsWith(".png") ||
          fileName.endsWith(".jpg") ||
          fileName.endsWith(".jpeg") ||
          fileName.endsWith(".webp")
        ) {
          slots = await parseImageRoutine(buffer);
        } else {
          return NextResponse.json(
            { error: "Unsupported file format. Please upload a Markdown table (.md), PDF (.pdf), or Image (.png, .jpg)" },
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json({ error: "No file or markdown provided" }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: "Invalid Content-Type" }, { status: 400 });
    }

    return NextResponse.json({ slots, count: slots.length });
  } catch (error: any) {
    console.error("Error in routine/parse:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
