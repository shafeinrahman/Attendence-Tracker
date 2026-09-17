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
export function classifyByRoomCode(roomCode: string): CourseClassification {
  const trimmed = (roomCode || "").trim().toUpperCase();

  // Check for room code ending in 'C' (e.g. 402C, UB402C)
  if (/[0-9]C$|^C-[0-9]+|CLASSROOM|THEORY/i.test(trimmed) || trimmed.endsWith("C")) {
    return {
      category: "theory",
      thresholdPct: 70.0,
      categorySource: "inferred",
    };
  }

  // Check for room code ending in 'L' (e.g. L-201L, 201L, LAB)
  if (/[0-9]L$|^L-[0-9]+|LAB/i.test(trimmed) || trimmed.endsWith("L")) {
    return {
      category: "lab",
      thresholdPct: 90.0,
      categorySource: "inferred",
    };
  }

  return {
    category: "unclassified",
    thresholdPct: 70.0,
    categorySource: "inferred",
  };
}
