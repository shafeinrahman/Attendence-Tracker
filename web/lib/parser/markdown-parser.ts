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
  sa: { dayOfWeek: 6, dayName: "Saturday" },
  s: { dayOfWeek: 6, dayName: "Saturday" },
  sun: { dayOfWeek: 7, dayName: "Sunday" },
  sunday: { dayOfWeek: 7, dayName: "Sunday" },
  su: { dayOfWeek: 7, dayName: "Sunday" },
  u: { dayOfWeek: 7, dayName: "Sunday" },
};

export function parseDay(text: string): { dayOfWeek: number; dayName: string } | null {
  const clean = text.trim().toLowerCase();
  return DAY_MAP[clean] ?? null;
}

export function parseDays(text: string): Array<{ dayOfWeek: number; dayName: string }> {
  const clean = text.trim().toLowerCase();
  if (DAY_MAP[clean]) return [DAY_MAP[clean]];

  // Standard multi-day university abbreviations
  if (clean === "st") return [DAY_MAP.sun, DAY_MAP.tue];
  if (clean === "mw") return [DAY_MAP.mon, DAY_MAP.wed];
  if (clean === "sr" || clean === "ra") return [DAY_MAP.sun, DAY_MAP.thu];
  if (clean === "tr") return [DAY_MAP.tue, DAY_MAP.thu];

  // Delimited days: "Sun, Tue" or "Monday / Wednesday"
  const tokens = clean.split(/[\/,\s&]+/).filter(Boolean);
  const result: Array<{ dayOfWeek: number; dayName: string }> = [];
  for (const t of tokens) {
    const d = DAY_MAP[t];
    if (d && !result.some((r) => r.dayOfWeek === d.dayOfWeek)) {
      result.push(d);
    }
  }
  return result;
}

export function parseTimeRange(text: string): { startTime: string; endTime: string } | null {
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

/**
 * Main Academic Building:
 * - Floor: 07 to 12
 * - Block: A to G
 * - Room: 01 to 50
 * - Type: L (lab) or C (classroom)
 * e.g., 07B-12C, 10F-33L, 09A-01C, 12G-50C
 */
export const UNIVERSITY_MAIN_ROOM_REGEX = /\b((?:0[7-9]|1[0-2])[A-Ga-g]\s*-\s*(?:0[1-9]|[1-4]\d|50)[LClc])\b/i;

/**
 * Annex Building:
 * - Prefix: AS
 * - Floor: G (ground) or 1 to 3
 * - Room: 01 to 50
 * - Type: L (lab) or C (classroom)
 * e.g., ASG-12C, AS1-23L, AS2-05C, AS3-40L
 */
export const UNIVERSITY_ANNEX_ROOM_REGEX = /\b(AS[G1-3g1-3]\s*-\s*(?:0[1-9]|[1-4]\d|50)[LClc])\b/i;

/**
 * Unified 6-character alphanumeric university room code:
 * Exactly 6 characters divided into 2 sections of 3 characters by a hyphen: XXX-XXX
 */
export const UNIVERSITY_ROOM_CODE_REGEX = /\b((?:(?:0[7-9]|1[0-2])[A-Ga-g]|AS[G1-3g1-3])\s*-\s*(?:0[1-9]|[1-4]\d|50)[LClc])\b/i;

/**
 * General 3-3 room code: 3 chars, hyphen, 2 digits + L/C
 */
export const ROOM_CODE_REGEX = /\b([A-Za-z0-9]{3}\s*-\s*(?:0[1-9]|[1-4]\d|50)[LClc])\b/i;

// Legacy room format (e.g. 402C, L-201L)
const LEGACY_ROOM_REGEX = /\b([0-9]{3}[LClc]|L-[0-9]{3}[LClc]?)\b/i;

export function extractRoomCode(text: string): string {
  if (!text) return "TBD";

  // 1. Strict university room code (Main or Annex)
  const uniMatch = text.match(UNIVERSITY_ROOM_CODE_REGEX);
  if (uniMatch) {
    return uniMatch[1].replace(/\s+/g, "").toUpperCase();
  }

  // 2. General 6-char (3-3) room code ending in L or C
  const genMatch = text.match(ROOM_CODE_REGEX);
  if (genMatch) {
    return genMatch[1].replace(/\s+/g, "").toUpperCase();
  }

  // 3. Legacy room patterns (e.g. 402C, L-201L)
  const legMatch = text.match(LEGACY_ROOM_REGEX);
  if (legMatch) {
    return legMatch[1].replace(/\s+/g, "").toUpperCase();
  }

  // Never return section numbers like "-01", "01", "-", etc.
  return "TBD";
}

export function extractCourseAndRoom(cell: string): { courseCode: string; roomCode: string } | null {
  const clean = cell.replace(/<br\s*\/?>/gi, " ").trim();
  if (!clean || clean === "-" || clean === "N/A" || clean.toLowerCase() === "free") {
    return null;
  }

  // Regex to match patterns like "CSE331 402C", "CSE-331 / 402C", "MATH101 [301C]", "CSE391L-01"
  const courseRegex = /([A-Za-z]{2,5}\s*[-_]?\s*\d{3,4}[A-Za-z]?)/i;
  const courseMatch = clean.match(courseRegex);
  if (!courseMatch) return null;

  const courseCode = courseMatch[1].replace(/\s+/g, "").toUpperCase();

  // Extract room code using strict university specifications
  const roomCode = extractRoomCode(clean);

  return { courseCode, roomCode };
}

/**
 * Parses markdown routine table into class slots.
 * Supports:
 * 1. Matrix Grid tables (Columns = Days, Rows = Times OR Columns = Times, Rows = Days)
 * 2. Column-based Tabular tables (| Course | Section | Day | Time | Room |)
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

  const header = rows[0];
  const bodyRows = rows.slice(1).filter((r) => !r.every((c) => /^[-:\s]+$/.test(c)));
  const slots: ParsedSlot[] = [];

  // Check if header is a Column-Based List Table:
  const colIndexMap = {
    course: header.findIndex((h) => /course|code/i.test(h)),
    day: header.findIndex((h) => /^day/i.test(h)),
    time: header.findIndex((h) => /^time|slot/i.test(h)),
    room: header.findIndex((h) => /^room/i.test(h)),
  };

  if (colIndexMap.course !== -1 && (colIndexMap.day !== -1 || colIndexMap.time !== -1)) {
    // Process Tabular / List Table
    for (const row of bodyRows) {
      const courseCell = row[colIndexMap.course] || "";
      const courseExtract = extractCourseAndRoom(courseCell);
      if (!courseExtract) continue;

      const timeCell = colIndexMap.time !== -1 ? row[colIndexMap.time] : "";
      const time = parseTimeRange(timeCell) || parseTimeRange(row.join(" "));
      if (!time) continue;

      const dayCell = colIndexMap.day !== -1 ? row[colIndexMap.day] : "";
      const days = parseDays(dayCell);
      if (days.length === 0) continue;

      // Check room from room column first, then course cell, then entire row
      let roomCode = "TBD";
      if (colIndexMap.room !== -1 && row[colIndexMap.room]) {
        roomCode = extractRoomCode(row[colIndexMap.room]);
      }
      if (roomCode === "TBD") {
        roomCode = courseExtract.roomCode !== "TBD" ? courseExtract.roomCode : extractRoomCode(row.join(" "));
      }

      const classification = classifyByRoomCode(roomCode, courseExtract.courseCode);

      for (const day of days) {
        slots.push({
          courseCode: courseExtract.courseCode,
          courseName: courseExtract.courseCode,
          roomCode,
          dayOfWeek: day.dayOfWeek,
          dayName: day.dayName,
          startTime: time.startTime,
          endTime: time.endTime,
          category: classification.category,
          thresholdPct: classification.thresholdPct,
        });
      }
    }

    if (slots.length > 0) return slots;
  }

  // Otherwise, handle Matrix Grid table
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
          const classification = classifyByRoomCode(parsed.roomCode, parsed.courseCode);
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
          const classification = classifyByRoomCode(parsed.roomCode, parsed.courseCode);
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
