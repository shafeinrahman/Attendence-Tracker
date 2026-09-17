import { ParsedSlot } from "./markdown-parser";
import { classifyByRoomCode } from "./classifier";

const DAY_MAP: Record<string, { dayOfWeek: number; dayName: string }> = {
  sunday: { dayOfWeek: 7, dayName: "Sunday" },
  sun: { dayOfWeek: 7, dayName: "Sunday" },
  monday: { dayOfWeek: 1, dayName: "Monday" },
  mon: { dayOfWeek: 1, dayName: "Monday" },
  tuesday: { dayOfWeek: 2, dayName: "Tuesday" },
  tue: { dayOfWeek: 2, dayName: "Tuesday" },
  wednesday: { dayOfWeek: 3, dayName: "Wednesday" },
  wed: { dayOfWeek: 3, dayName: "Wednesday" },
  thursday: { dayOfWeek: 4, dayName: "Thursday" },
  thu: { dayOfWeek: 4, dayName: "Thursday" },
  friday: { dayOfWeek: 5, dayName: "Friday" },
  fri: { dayOfWeek: 5, dayName: "Friday" },
  saturday: { dayOfWeek: 6, dayName: "Saturday" },
  sat: { dayOfWeek: 6, dayName: "Saturday" },
};

/**
 * Extracts class slots from raw text extracted from a PDF or OCR.
 * Handles tabular layouts, lines with Day + Time + Course + Room, or grouped blocks.
 */
export function parseTextRoutine(rawText: string): ParsedSlot[] {
  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
  const slots: ParsedSlot[] = [];

  let currentDay: { dayOfWeek: number; dayName: string } | null = null;
  let currentTime: { startTime: string; endTime: string } | null = null;

  const timeRegex = /(\d{1,2}:\d{2})\s*(?:am|pm)?\s*(?:-|to)\s*(\d{1,2}:\d{2})\s*(?:am|pm)?/i;
  const courseRoomRegex = /([A-Za-z]{2,5}\s*[-_]?\s*\d{3,4}[A-Za-z]?)\s+([A-Za-z0-9-]+[CL]?)/i;

  for (const line of lines) {
    // Check if line specifies a Day header
    const lower = line.toLowerCase();
    for (const [key, val] of Object.entries(DAY_MAP)) {
      if (lower === key || lower.startsWith(key + " ") || lower.endsWith(" " + key) || lower.startsWith(key + ":")) {
        currentDay = val;
        break;
      }
    }

    // Check if line specifies a Time
    const timeMatch = line.match(timeRegex);
    if (timeMatch) {
      let start = timeMatch[1];
      let end = timeMatch[2];
      if (start.length === 4) start = "0" + start;
      if (end.length === 4) end = "0" + end;
      currentTime = { startTime: start, endTime: end };
    }

    // Check if line contains a full entry: Day, Time, Course, Room all in one line
    // e.g. "Monday 09:30-11:00 CSE331 402C"
    let lineDay = currentDay;
    for (const [key, val] of Object.entries(DAY_MAP)) {
      if (new RegExp(`\\b${key}\\b`, "i").test(line)) {
        lineDay = val;
        break;
      }
    }

    let lineTime = currentTime;
    if (timeMatch) {
      let start = timeMatch[1];
      let end = timeMatch[2];
      if (start.length === 4) start = "0" + start;
      if (end.length === 4) end = "0" + end;
      lineTime = { startTime: start, endTime: end };
    }

    const courseMatch = line.match(courseRoomRegex);
    if (courseMatch && lineDay && lineTime) {
      const courseCode = courseMatch[1].replace(/\s+/g, "").toUpperCase();
      const roomCode = courseMatch[2].toUpperCase();
      const classification = classifyByRoomCode(roomCode);

      // Avoid duplicates
      const exists = slots.some(
        (s) =>
          s.courseCode === courseCode &&
          s.dayOfWeek === lineDay!.dayOfWeek &&
          s.startTime === lineTime!.startTime
      );

      if (!exists) {
        slots.push({
          courseCode,
          courseName: courseCode,
          roomCode,
          dayOfWeek: lineDay.dayOfWeek,
          dayName: lineDay.dayName,
          startTime: lineTime.startTime,
          endTime: lineTime.endTime,
          category: classification.category,
          thresholdPct: classification.thresholdPct,
        });
      }
    }
  }

  return slots;
}

/**
 * Parses a PDF buffer into structured class slots.
 */
export async function parsePdfRoutine(buffer: Buffer): Promise<ParsedSlot[]> {
  try {
    // Dynamically import pdf-parse to avoid top-level issues in Next.js build
    // @ts-ignore
    const pdf = (await import("pdf-parse")).default || (await import("pdf-parse"));
    const data = await pdf(buffer);
    return parseTextRoutine(data.text);
  } catch (error) {
    console.error("PDF parsing failed, returning empty slots:", error);
    return [];
  }
}
