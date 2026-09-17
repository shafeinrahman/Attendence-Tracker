import { ParsedSlot } from "./markdown-parser";
import { parseTextRoutine } from "./pdf-parser";

/**
 * Performs OCR on an image buffer using tesseract.js and extracts class slots.
 */
export async function parseImageRoutine(imageBuffer: Buffer): Promise<ParsedSlot[]> {
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    const ret = await worker.recognize(imageBuffer);
    await worker.terminate();

    return parseTextRoutine(ret.data.text);
  } catch (error) {
    console.error("OCR parsing failed:", error);
    return [];
  }
}
