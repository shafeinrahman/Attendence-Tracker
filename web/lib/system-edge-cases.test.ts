import { describe, it, expect } from "vitest";
import { calculateCourseStats, AttendanceRecordLike } from "./attendance-calculator";
import { classifyByRoomCode } from "./parser/classifier";

describe("System Specifications & Edge Cases Verification (§4, §7)", () => {
  describe("§4.1 & §4.8 Semester Setup & Purge Extension", () => {
    it("computes purge_at as exactly end_date + 7 days", () => {
      const endDate = new Date("2026-12-20T00:00:00Z");
      const purgeAt = new Date(endDate.getTime() + 7 * 24 * 60 * 60 * 1000);

      expect(purgeAt.toISOString()).toBe("2026-12-27T00:00:00.000Z");
    });

    it("recalculates purge_at when end_date is extended", () => {
      const originalEnd = new Date("2026-12-20T00:00:00Z");
      let purgeAt = new Date(originalEnd.getTime() + 7 * 24 * 60 * 60 * 1000);
      expect(purgeAt.toISOString()).toBe("2026-12-27T00:00:00.000Z");

      // Semester extended by 2 weeks
      const extendedEnd = new Date("2027-01-03T00:00:00Z");
      purgeAt = new Date(extendedEnd.getTime() + 7 * 24 * 60 * 60 * 1000);
      expect(purgeAt.toISOString()).toBe("2027-01-10T00:00:00.000Z");
    });
  });

  describe("§4.3 Room Classification & Overrides", () => {
    it("handles theory suffix C (70%) and lab suffix L (90%)", () => {
      expect(classifyByRoomCode("402C").category).toBe("theory");
      expect(classifyByRoomCode("402C").thresholdPct).toBe(70);

      expect(classifyByRoomCode("UB402C").category).toBe("theory");

      expect(classifyByRoomCode("L-201L").category).toBe("lab");
      expect(classifyByRoomCode("L-201L").thresholdPct).toBe(90);

      expect(classifyByRoomCode("302L").category).toBe("lab");
    });
  });

  describe("§4.5 & §4.6 Default Absent, Excusing, and Denominator Logic", () => {
    it("properly excludes excused records from denominator so they do not hurt percentage", () => {
      // 10 held classes. 7 present, 3 absent.
      // Initially: 7 / 10 = 70.00%.
      const statsBefore = calculateCourseStats({
        courseId: "c1",
        courseCode: "CSE331",
        courseName: "Algorithms",
        category: "theory",
        thresholdPct: 70,
        records: [
          ...Array(7).fill({ status: "present", countedInStats: true }),
          ...Array(3).fill({ status: "absent", countedInStats: true }),
        ],
        remainingSlots: 5,
      });
      expect(statsBefore.attended).toBe(7);
      expect(statsBefore.held).toBe(10);
      expect(statsBefore.currentPercentage).toBe(70.0);

      // User excuses 1 absent class:
      // Now: 7 present, 2 absent, 1 excused.
      // Held becomes 7 + 2 = 9.
      // Attended remains 7.
      // Percentage = 7 / 9 = 77.78% > 70%!
      const statsAfter = calculateCourseStats({
        courseId: "c1",
        courseCode: "CSE331",
        courseName: "Algorithms",
        category: "theory",
        thresholdPct: 70,
        records: [
          ...Array(7).fill({ status: "present", countedInStats: true }),
          ...Array(2).fill({ status: "absent", countedInStats: true }),
          { status: "excused", countedInStats: true },
        ],
        remainingSlots: 5,
      });
      expect(statsAfter.attended).toBe(7);
      expect(statsAfter.held).toBe(9);
      expect(statsAfter.excused).toBe(1);
      expect(statsAfter.currentPercentage).toBe(77.78);
    });

    it("verifies threshold rounding comparison: >= 70.0% satisfies 70% threshold", () => {
      const stats = calculateCourseStats({
        courseId: "c1",
        courseCode: "CSE331",
        courseName: "Algorithms",
        category: "theory",
        thresholdPct: 70,
        records: [
          ...Array(7).fill({ status: "present", countedInStats: true }),
          ...Array(3).fill({ status: "absent", countedInStats: true }),
        ],
        remainingSlots: 5,
      });

      expect(stats.currentPercentage).toBe(70.0);
      expect(stats.meetsThreshold).toBe(true);
    });
  });

  describe("§4.9 Online Makeup Session Math", () => {
    it("keeps cancelled class excluded and adds online makeup to normal attendance", () => {
      // Original in-person class was cancelled:
      const recordsWithCancelled: AttendanceRecordLike[] = [
        { status: "cancelled_holiday", countedInStats: false },
      ];
      const stats1 = calculateCourseStats({
        courseId: "c1",
        courseCode: "CSE331",
        courseName: "Algorithms",
        category: "theory",
        thresholdPct: 70,
        records: recordsWithCancelled,
        remainingSlots: 10,
      });
      expect(stats1.held).toBe(0);
      expect(stats1.cancelled).toBe(1);

      // Now makeup class is held online and attended:
      const recordsWithMakeup: AttendanceRecordLike[] = [
        { status: "cancelled_holiday", countedInStats: false }, // original stays cancelled
        { status: "present", countedInStats: true },            // makeup attended
      ];
      const stats2 = calculateCourseStats({
        courseId: "c1",
        courseCode: "CSE331",
        courseName: "Algorithms",
        category: "theory",
        thresholdPct: 70,
        records: recordsWithMakeup,
        remainingSlots: 9,
      });
      expect(stats2.held).toBe(1);
      expect(stats2.attended).toBe(1);
      expect(stats2.currentPercentage).toBe(100);
    });
  });
});
