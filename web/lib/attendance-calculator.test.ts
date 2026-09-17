import { describe, it, expect } from "vitest";
import { calculateCourseStats, AttendanceRecordLike } from "./attendance-calculator";

describe("Attendance Calculation Engine (§4.6)", () => {
  it("computes 100% when all held classes are attended", () => {
    const records: AttendanceRecordLike[] = [
      { status: "present", countedInStats: true },
      { status: "present", countedInStats: true },
      { status: "running_late", countedInStats: true }, // running_late counts as attended
    ];

    const stats = calculateCourseStats({
      courseId: "c1",
      courseCode: "CSE331",
      courseName: "Algorithms",
      category: "theory",
      thresholdPct: 70,
      records,
      remainingSlots: 10,
    });

    expect(stats.attended).toBe(3);
    expect(stats.held).toBe(3);
    expect(stats.currentPercentage).toBe(100);
    expect(stats.meetsThreshold).toBe(true);
  });

  it("excludes cancelled_holiday and excused records from denominator and statistics", () => {
    const records: AttendanceRecordLike[] = [
      { status: "present", countedInStats: true },
      { status: "running_late", countedInStats: true },
      { status: "absent", countedInStats: true },
      { status: "cancelled_holiday", countedInStats: false }, // holiday excluded
      { status: "excused", countedInStats: true }, // excused excluded from denominator
    ];

    const stats = calculateCourseStats({
      courseId: "c1",
      courseCode: "CSE331",
      courseName: "Algorithms",
      category: "theory",
      thresholdPct: 70,
      records,
      remainingSlots: 10,
    });

    // attended = present (1) + running_late (1) = 2
    // held = present (1) + running_late (1) + absent (1) = 3
    // excused and cancelled are NOT in held
    expect(stats.attended).toBe(2);
    expect(stats.held).toBe(3);
    expect(stats.excused).toBe(1);
    expect(stats.cancelled).toBe(1);
    expect(stats.currentPercentage).toBeCloseTo(66.67, 1);
    expect(stats.meetsThreshold).toBe(false);
  });

  it("ignores first-week and midterm-week records when countedInStats = false", () => {
    const records: AttendanceRecordLike[] = [
      { status: "absent", countedInStats: false, isFirstWeek: true },
      { status: "absent", countedInStats: false, isMidtermWeek: true },
      { status: "present", countedInStats: true },
      { status: "present", countedInStats: true },
    ];

    const stats = calculateCourseStats({
      courseId: "c1",
      courseCode: "CSE331",
      courseName: "Algorithms",
      category: "theory",
      thresholdPct: 70,
      records,
      remainingSlots: 5,
    });

    expect(stats.attended).toBe(2);
    expect(stats.held).toBe(2);
    expect(stats.currentPercentage).toBe(100);
  });

  it("calculates safe-to-skip correctly: S = floor(A / threshold - H)", () => {
    // attended = 18, held = 20, threshold = 70% (0.7)
    // 18 / 0.7 = 25.714. 25.714 - 20 = 5.714 -> floor is 5.
    // If we skip 5: attended = 18, held = 25 -> 18/25 = 72% >= 70%
    // If we skip 6: attended = 18, held = 26 -> 18/26 = 69.2% < 70%
    const records: AttendanceRecordLike[] = [
      ...Array(18).fill({ status: "present", countedInStats: true }),
      ...Array(2).fill({ status: "absent", countedInStats: true }),
    ];

    const stats = calculateCourseStats({
      courseId: "c1",
      courseCode: "CSE331",
      courseName: "Algorithms",
      category: "theory",
      thresholdPct: 70,
      records,
      remainingSlots: 10,
    });

    expect(stats.attended).toBe(18);
    expect(stats.held).toBe(20);
    expect(stats.safeToSkip).toBe(5);
  });

  it("caps safe-to-skip at remaining slots", () => {
    const records: AttendanceRecordLike[] = [
      ...Array(20).fill({ status: "present", countedInStats: true }),
    ];

    const stats = calculateCourseStats({
      courseId: "c1",
      courseCode: "CSE331",
      courseName: "Algorithms",
      category: "theory",
      thresholdPct: 70,
      records,
      remainingSlots: 3, // only 3 classes left in semester
    });

    expect(stats.safeToSkip).toBe(3);
  });

  it("calculates must-attend and flags at-risk when threshold is mathematically impossible", () => {
    // Lab course with 90% threshold.
    // Held so far: 10. Attended: 5. Absent: 5. Current % = 50%.
    // Remaining slots: 10. Total possible held: 20.
    // To get 90% of 20, needed attended: 18.
    // Maximum possible attended: 5 + 10 = 15 < 18.
    // Needed from remaining: 18 - 5 = 13 > 10.
    const records: AttendanceRecordLike[] = [
      ...Array(5).fill({ status: "present", countedInStats: true }),
      ...Array(5).fill({ status: "absent", countedInStats: true }),
    ];

    const stats = calculateCourseStats({
      courseId: "lab1",
      courseCode: "CSE331L",
      courseName: "Algorithms Lab",
      category: "lab",
      thresholdPct: 90,
      records,
      remainingSlots: 10,
    });

    expect(stats.currentPercentage).toBe(50);
    expect(stats.safeToSkip).toBe(0);
    expect(stats.mustAttend).toBe(13);
    expect(stats.isAtRisk).toBe(true);
    expect(stats.maxPossiblePercentage).toBe(75);
  });
});
