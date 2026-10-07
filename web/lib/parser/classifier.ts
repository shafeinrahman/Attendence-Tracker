export interface CourseClassification {
  category: "theory" | "lab" | "unclassified";
  thresholdPct: number;
  categorySource: "inferred" | "manual";
}

/**
 * Regex-classify room code (§4.2):
 * Suffix 'C' -> theory (threshold 70%)
 * Suffix 'L' -> lab (threshold 90%)
 * Anything else -> unclassified (default 70%, requires manual review)
 */
export function classifyByRoomCode(roomCode: string, courseCode?: string): CourseClassification {
  const trimmed = (roomCode || "").trim().toUpperCase();

  // Check for room code ending in 'L' (e.g. 10F-33L, AS1-23L, L-201L, LAB)
  if (/[0-9]L$|^L-[0-9]+|LAB/i.test(trimmed) || trimmed.endsWith("L")) {
    return {
      category: "lab",
      thresholdPct: 90.0,
      categorySource: "inferred",
    };
  }

  // Check for room code ending in 'C' (e.g. 07B-12C, ASG-12C, 402C, UB402C)
  if (/[0-9]C$|^C-[0-9]+|CLASSROOM|THEORY/i.test(trimmed) || trimmed.endsWith("C")) {
    return {
      category: "theory",
      thresholdPct: 70.0,
      categorySource: "inferred",
    };
  }

  // Fallback: check course code suffix (e.g. CSE391L -> lab)
  if (courseCode) {
    const cleanCourse = courseCode.trim().toUpperCase();
    if (cleanCourse.endsWith("L") && cleanCourse.length >= 4) {
      return {
        category: "lab",
        thresholdPct: 90.0,
        categorySource: "inferred",
      };
    }
  }

  return {
    category: "unclassified",
    thresholdPct: 70.0,
    categorySource: "inferred",
  };
}
