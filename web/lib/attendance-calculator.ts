export type AttendanceStatusType =
  | "present"
  | "running_late"
  | "cancelled_holiday"
  | "absent"
  | "excused";

export interface AttendanceRecordLike {
  status: AttendanceStatusType;
  countedInStats: boolean;
  isFirstWeek?: boolean;
  isMidtermWeek?: boolean;
}

export interface CourseCalculationInput {
  courseId: string;
  courseCode: string;
  courseName: string;
  category: string; // "theory" | "lab" | "unclassified"
  thresholdPct: number; // 70 or 90
  records: AttendanceRecordLike[];
  remainingSlots: number;
}

export interface CourseAttendanceStats {
  courseId: string;
  courseCode: string;
  courseName: string;
  category: string;
  thresholdPct: number;
  attended: number;
  held: number;
  absent: number;
  excused: number;
  cancelled: number;
  currentPercentage: number;
  meetsThreshold: boolean;
  safeToSkip: number;
  mustAttend: number;
  remainingSlots: number;
  isAtRisk: boolean;
  maxPossiblePercentage: number;
}

/**
 * Computes attendance statistics for a single course according to specification §4.6.
 *
 * attended = count(status IN ["present", "running_late"] AND counted_in_stats = true)
 * held     = count(status NOT IN ["cancelled_holiday", "excused"] AND counted_in_stats = true)
 * percentage = attended / held * 100 (0 if held = 0)
 *
 * Safe-to-skip count: S = floor(A / threshold - H), capped at remaining slots and 0 minimum.
 * Must-attend count: minimum attendance needed from remaining slots to meet threshold at semester end.
 * Flagged "at risk" if mustAttend > remainingSlots.
 */
export function calculateCourseStats(input: CourseCalculationInput): CourseAttendanceStats {
  const { thresholdPct, records, remainingSlots } = input;
  const thresholdDecimal = thresholdPct / 100;

  let attended = 0;
  let held = 0;
  let absent = 0;
  let excused = 0;
  let cancelled = 0;

  for (const record of records) {
    if (record.status === "excused") {
      excused++;
      continue;
    }
    if (record.status === "cancelled_holiday") {
      cancelled++;
      continue;
    }

    if (!record.countedInStats) {
      // First-week and midterm-week records with countedInStats=false are not counted in percentages
      continue;
    }

    // Records that count in stats:
    held++;
    if (record.status === "present" || record.status === "running_late") {
      attended++;
    } else if (record.status === "absent") {
      absent++;
    }
  }

  const currentPercentage = held > 0 ? Number(((attended / held) * 100).toFixed(2)) : 0;
  const meetsThreshold = held === 0 || currentPercentage >= thresholdPct;

  // Safe-to-skip count S = floor(A / threshold - H)
  let rawSafeToSkip = 0;
  if (thresholdDecimal > 0 && held > 0) {
    rawSafeToSkip = Math.floor(attended / thresholdDecimal - held);
  }
  const safeToSkip = Math.max(0, Math.min(remainingSlots, rawSafeToSkip));

  // Must-attend count from remaining slots to reach threshold
  const totalFutureHeld = held + remainingSlots;
  const targetAttended = Math.ceil(totalFutureHeld * thresholdDecimal);
  const neededFromRemaining = Math.max(0, targetAttended - attended);
  const mustAttend = Math.min(neededFromRemaining, remainingSlots);
  const isAtRisk = neededFromRemaining > remainingSlots;

  const maxPossibleAttended = attended + remainingSlots;
  const maxPossiblePercentage =
    totalFutureHeld > 0
      ? Number(((maxPossibleAttended / totalFutureHeld) * 100).toFixed(2))
      : 100;

  return {
    courseId: input.courseId,
    courseCode: input.courseCode,
    courseName: input.courseName,
    category: input.category,
    thresholdPct,
    attended,
    held,
    absent,
    excused,
    cancelled,
    currentPercentage,
    meetsThreshold,
    safeToSkip,
    mustAttend: neededFromRemaining,
    remainingSlots,
    isAtRisk,
    maxPossiblePercentage,
  };
}
