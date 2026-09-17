import { describe, it, expect } from "vitest";
import { parseMarkdownRoutine } from "./markdown-parser";
import { parseTextRoutine } from "./pdf-parser";
import { classifyByRoomCode } from "./classifier";

describe("Routine Parser Engine (§4.2)", () => {
  describe("Room Code Classifier", () => {
    it("classifies suffix C as theory with 70% threshold", () => {
      const res = classifyByRoomCode("402C");
      expect(res.category).toBe("theory");
      expect(res.thresholdPct).toBe(70);
    });

    it("classifies suffix L as lab with 90% threshold", () => {
      const res = classifyByRoomCode("L-201L");
      expect(res.category).toBe("lab");
      expect(res.thresholdPct).toBe(90);
    });

    it("classifies ambiguous room codes as unclassified", () => {
      const res = classifyByRoomCode("AUDITORIUM");
      expect(res.category).toBe("unclassified");
      expect(res.thresholdPct).toBe(70);
    });
  });

  describe("Markdown Table Parser", () => {
    it("parses grid where rows are times and columns are days", () => {
      const md = `
| Time | Monday | Wednesday | Thursday |
|---|---|---|---|
| 09:30 - 11:00 | CSE331 402C | CSE331 402C | - |
| 14:00 - 17:00 | - | - | CSE331L L-201L |
      `.trim();

      const slots = parseMarkdownRoutine(md);
      expect(slots.length).toBe(3);

      const monSlot = slots.find((s) => s.dayOfWeek === 1);
      expect(monSlot).toBeDefined();
      expect(monSlot?.courseCode).toBe("CSE331");
      expect(monSlot?.roomCode).toBe("402C");
      expect(monSlot?.category).toBe("theory");
      expect(monSlot?.startTime).toBe("09:30");
      expect(monSlot?.endTime).toBe("11:00");

      const thuSlot = slots.find((s) => s.dayOfWeek === 4);
      expect(thuSlot).toBeDefined();
      expect(thuSlot?.courseCode).toBe("CSE331L");
      expect(thuSlot?.roomCode).toBe("L-201L");
      expect(thuSlot?.category).toBe("lab");
      expect(thuSlot?.thresholdPct).toBe(90);
    });

    it("parses grid where rows are days and columns are times", () => {
      const md = `
| Day | 09:30 - 11:00 | 11:30 - 13:00 |
|---|---|---|
| Sunday | CSE110 301C | MAT101 501C |
| Tuesday | CSE110 301C | - |
      `.trim();

      const slots = parseMarkdownRoutine(md);
      expect(slots.length).toBe(3);

      const sunSlot = slots.find((s) => s.dayOfWeek === 7 && s.startTime === "09:30");
      expect(sunSlot).toBeDefined();
      expect(sunSlot?.courseCode).toBe("CSE110");
      expect(sunSlot?.roomCode).toBe("301C");
      expect(sunSlot?.category).toBe("theory");
    });
  });

  describe("Text & Line Routine Parser (PDF / OCR output)", () => {
    it("extracts slots from line-based text", () => {
      const text = `
University Class Routine - Fall 2026
Monday
09:30 - 11:00 CSE331 402C
Wednesday 09:30 - 11:00 CSE331 402C
Thursday 14:00 - 17:00 CSE331L 201L
      `.trim();

      const slots = parseTextRoutine(text);
      expect(slots.length).toBe(3);

      const lab = slots.find((s) => s.courseCode === "CSE331L");
      expect(lab).toBeDefined();
      expect(lab?.category).toBe("lab");
      expect(lab?.thresholdPct).toBe(90);
    });
  });
});
