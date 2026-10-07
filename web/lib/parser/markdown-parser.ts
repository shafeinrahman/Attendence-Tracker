import { classifyByRoomCode } from "./classifier";

export interface ParsedSlot {
  courseCode: string;
  courseName: string;
  roomCode: string;
  dayOfWeek: number; // 1 (Mon) - 7 (Sun)
  dayName: string;
  startTime: string; // "09:30"
  endTime: string;   // "11:00"
  category: "theory" | "lab" | "unclassified";
  thresholdPct: number;
}

const DAY_MAP: Record<string, { dayOfWeek: number; dayName: string }> = {
  mon: { dayOfWeek: 1, dayName: "Monday" },
  monday: { dayOfWeek: 1, dayName: "Monday" },
  tue: { dayOfWeek: 2, dayName: "Tuesday" },
  tues: { dayOfWeek: 2, dayName: "Tuesday" },
  tuesday: { dayOfWeek: 2, dayName: "Tuesday" },
  wed: { dayOfWeek: 3, dayName: "Wednesday" },
  wednesday: { dayOfWeek: 3, dayName: "Wednesday" },
  thu: { dayOfWeek: 4, dayName: "Thursday" },
  thur: { dayOfWeek: 4, dayName: "Thursday" },
  thurs: { dayOfWeek: 4, dayName: "Thursday" },
  thursday: { dayOfWeek: 4, dayName: "Thursday" },
  fri: { dayOfWeek: 5, dayName: "Friday" },
  friday: { dayOfWeek: 5, dayName: "Friday" },
  sat: { dayOfWeek: 6, dayName: "Saturday" },
  saturday: { dayOfWeek: 6, dayName: "Saturday" },
  sun: { dayOfWeek: 7, dayName: "Sunday" },
  sunday: { dayOfWeek: 7, dayName: "Sunday" },
};

function parseDay(text: string): { dayOfWeek: number; dayName: string } | null {
  const clean = text.trim().toLowerCase();
  return DAY_MAP[clean] ?? null;
}

function parseTimeRange(text: string): { startTime: string; endTime: string } | null {
  // Matches e.g. "08:00 - 09:20", "8:00am - 9:20am", "09:30-11:00"
  const regex = /(\d{1,2}:\d{2})\s*(?:am|pm)?\s*(?:-|to)\s*(\d{1,2}:\d{2})\s*(?:am|pm)?/i;
  const match = text.match(regex);
  if (!match) return null;

  let start = match[1];
  let end = match[2];

  // Normalize to HH:mm
  if (start.length === 4) start = "0" + start;
  if (end.length === 4) end = "0" + end;

  return { startTime: start, endTime: end };
}

// 6-character alphanumeric room code pattern (e.g. 09A-01C, AS1-15L)
export const ROOM_CODE_REGEX = /\b([A-Za-z0-9]{3}-[A-Za-z0-9]{3})\b/i;

function extractCourseAndRoom(cell: string): { courseCode: string; roomCode: string } | null {
  const clean = cell.replace(/<br\s*\/?>/gi, " ").trim();
  if (!clean || clean === "-" || clean === "N/A" || clean.toLowerCase() === "free") {
    return null;
  }

  // Regex to match patterns like "CSE331 402C", "CSE-331 / 402C", "MATH101 [301C]"
  const courseRegex = /([A-Za-z]{2,5}\s*[-_]?\s*\d{3,4}[A-Za-z]?)/i;
  const courseMatch = clean.match(courseRegex);
  if (!courseMatch) return null;

  const courseCode = courseMatch[1].replace(/\s+/g, "").toUpperCase();

  // Strip out course code to search for the room code
  const remaining = clean.replace(courseMatch[0], "").trim();

  // 1. Check for 6-character alphanumeric room code (e.g. 09A-01C, AS1-15L)
  const room6Match = remaining.match(ROOM_CODE_REGEX) || clean.match(ROOM_CODE_REGEX);
  let roomCode: string;

  if (room6Match) {
    roomCode = room6Match[1].toUpperCase();
  } else {
    // 2. Fallback to general room token extraction (e.g. 402C, L-201L)
    const sanitizedRemaining = remaining.replace(/[()\[\]/\\,:]/g, " ").trim();
    const roomTokens = sanitizedRemaining.split(/\s+/).filter(Boolean);
    roomCode = roomTokens.length > 0 ? roomTokens[0].toUpperCase() : "TBD";
  }

  return { courseCode, roomCode };
}

/**
 * Parses a grid-format markdown table into class slots.
 * Auto-detects whether columns represent Days or Time Slots.
 */
export function parseMarkdownRoutine(markdown: string): ParsedSlot[] {
  const lines = markdown
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|") && l.endsWith("|"));

  if (lines.length < 3) return [];

  // Parse table rows and cells
  const rows = lines.map((line) =>
    line
      .slice(1, -1)
      .split("|")
      .map((c) => c.trim())
  );

  // Skip delimiter row (e.g. |---|---|---|)
  const header = rows[0];
  const bodyRows = rows.slice(1).filter((r) => !r.every((c) => /^[-:\s]+$/.test(c)));

  const slots: ParsedSlot[] = [];

  // Detect orientation:
  // Check if header contains Days or Times
  const headerDays = header.map((col) => parseDay(col));
  const headerTimes = header.map((col) => parseTimeRange(col));

  const daysInHeaderCount = headerDays.filter(Boolean).length;
  const timesInHeaderCount = headerTimes.filter(Boolean).length;

  if (daysInHeaderCount >= timesInHeaderCount && daysInHeaderCount > 0) {
    // Orientation: Rows = Time Slots, Columns = Days
    for (const row of bodyRows) {
      const time = parseTimeRange(row[0]);
      if (!time) continue;

      for (let colIdx = 1; colIdx < row.length && colIdx < header.length; colIdx++) {
        const dayInfo = headerDays[colIdx];
        if (!dayInfo) continue;

        const cell = row[colIdx];
        const parsed = extractCourseAndRoom(cell);
        if (parsed) {
          const classification = classifyByRoomCode(parsed.roomCode);
          slots.push({
            courseCode: parsed.courseCode,
            courseName: parsed.courseCode,
            roomCode: parsed.roomCode,
            dayOfWeek: dayInfo.dayOfWeek,
            dayName: dayInfo.dayName,
            startTime: time.startTime,
            endTime: time.endTime,
            category: classification.category,
            thresholdPct: classification.thresholdPct,
          });
        }
      }
    }
  } else {
    // Orientation: Rows = Days, Columns = Time Slots
    for (const row of bodyRows) {
      const dayInfo = parseDay(row[0]);
      if (!dayInfo) continue;

      for (let colIdx = 1; colIdx < row.length && colIdx < header.length; colIdx++) {
        const time = headerTimes[colIdx] ?? parseTimeRange(header[colIdx]);
        if (!time) continue;

        const cell = row[colIdx];
        const parsed = extractCourseAndRoom(cell);
        if (parsed) {
          const classification = classifyByRoomCode(parsed.roomCode);
          slots.push({
            courseCode: parsed.courseCode,
            courseName: parsed.courseCode,
            roomCode: parsed.roomCode,
            dayOfWeek: dayInfo.dayOfWeek,
            dayName: dayInfo.dayName,
            startTime: time.startTime,
            endTime: time.endTime,
            category: classification.category,
            thresholdPct: classification.thresholdPct,
          });
        }
      }
    }
  }

  return slots;
}
