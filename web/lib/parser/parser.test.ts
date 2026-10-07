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

    it("classifies 6-char alphanumeric room codes e.g. 09A-01C (theory) and AS1-15L (lab)", () => {
      const theoryRes = classifyByRoomCode("09A-01C");
      expect(theoryRes.category).toBe("theory");
      expect(theoryRes.thresholdPct).toBe(70);

      const labRes = classifyByRoomCode("AS1-15L");
      expect(labRes.category).toBe("lab");
      expect(labRes.thresholdPct).toBe(90);
    });

    it("classifies main building room codes 07B-12C (theory) and 10F-33L (lab)", () => {
      const mainTheory = classifyByRoomCode("07B-12C");
      expect(mainTheory.category).toBe("theory");
      expect(mainTheory.thresholdPct).toBe(70);

      const mainLab = classifyByRoomCode("10F-33L");
      expect(mainLab.category).toBe("lab");
      expect(mainLab.thresholdPct).toBe(90);
    });

    it("classifies annex building room codes ASG-12C (theory) and AS1-23L (lab)", () => {
      const annexTheory = classifyByRoomCode("ASG-12C");
      expect(annexTheory.category).toBe("theory");
      expect(annexTheory.thresholdPct).toBe(70);

      const annexLab = classifyByRoomCode("AS1-23L");
      expect(annexLab.category).toBe("lab");
      expect(annexLab.thresholdPct).toBe(90);
    });

    it("falls back to lab for courses ending with L when room is TBD", () => {
      const res = classifyByRoomCode("TBD", "CSE391L");
      expect(res.category).toBe("lab");
      expect(res.thresholdPct).toBe(90);
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

    it("parses grid with 6-character alphanumeric room codes (e.g. 09A-01C, AS1-15L)", () => {
      const md = `
| Time | Monday | Wednesday |
|---|---|---|
| 08:00 - 09:20 | CSE331 09A-01C | CSE331 [09A-01C] |
| 11:30 - 13:00 | - | CSE420 AS1-15L |
      `.trim();

      const slots = parseMarkdownRoutine(md);
      expect(slots.length).toBe(3);

      const slot1 = slots[0];
      expect(slot1.courseCode).toBe("CSE331");
      expect(slot1.roomCode).toBe("09A-01C");
      expect(slot1.category).toBe("theory");
      expect(slot1.thresholdPct).toBe(70);

      const labSlot = slots.find((s) => s.courseCode === "CSE420");
      expect(labSlot).toBeDefined();
      expect(labSlot?.roomCode).toBe("AS1-15L");
      expect(labSlot?.category).toBe("lab");
      expect(labSlot?.thresholdPct).toBe(90);
    });

    it("never parses section numbers like -01 as room codes and correctly identifies main/annex rooms", () => {
      const md = `
| Time | Sunday | Tuesday |
|---|---|---|
| 08:00 - 09:20 | CSE391L-01 | CSE391L-01 10F-33L |
| 09:30 - 10:50 | MAT110 - 02 07B-12C | CSE111L-03 <br> AS1-23L |
      `.trim();

      const slots = parseMarkdownRoutine(md);
      expect(slots.length).toBe(4);

      // Section only (no room): room must be TBD, never "-01"
      const secOnlySlot = slots.find((s) => s.dayOfWeek === 7 && s.startTime === "08:00");
      expect(secOnlySlot?.courseCode).toBe("CSE391L");
      expect(secOnlySlot?.roomCode).toBe("TBD");
      expect(secOnlySlot?.roomCode).not.toBe("-01");
      expect(secOnlySlot?.category).toBe("lab"); // Inferred from CSE391L

      // Main building room 10F-33L with section in cell
      const mainLabSlot = slots.find((s) => s.dayOfWeek === 2 && s.startTime === "08:00");
      expect(mainLabSlot?.courseCode).toBe("CSE391L");
      expect(mainLabSlot?.roomCode).toBe("10F-33L");
      expect(mainLabSlot?.category).toBe("lab");

      // Main building theory room 07B-12C
      const mainTheorySlot = slots.find((s) => s.dayOfWeek === 7 && s.startTime === "09:30");
      expect(mainTheorySlot?.courseCode).toBe("MAT110");
      expect(mainTheorySlot?.roomCode).toBe("07B-12C");
      expect(mainTheorySlot?.category).toBe("theory");

      // Annex building lab room AS1-23L with <br>
      const annexLabSlot = slots.find((s) => s.dayOfWeek === 2 && s.startTime === "09:30");
      expect(annexLabSlot?.courseCode).toBe("CSE111L");
      expect(annexLabSlot?.roomCode).toBe("AS1-23L");
      expect(annexLabSlot?.category).toBe("lab");
    });

    it("parses column-based tabular routine markdown tables with multi-day codes", () => {
      const md = `
| Course | Section | Day | Time | Room |
|---|---|---|---|---|
| CSE391L | 01 | ST | 08:00 - 09:20 | 10F-33L |
| MAT110 | 02 | MW | 09:30 - 10:50 | 07B-12C |
| CSE111L | 03 | Mon | 11:00 - 13:00 | AS1-23L |
      `.trim();

      const slots = parseMarkdownRoutine(md);
      // ST produces 2 slots (Sunday + Tuesday), MW produces 2 slots (Monday + Wednesday), Mon produces 1
      expect(slots.length).toBe(5);

      const sunSlot = slots.find((s) => s.courseCode === "CSE391L" && s.dayOfWeek === 7);
      expect(sunSlot).toBeDefined();
      expect(sunSlot?.roomCode).toBe("10F-33L");
      expect(sunSlot?.category).toBe("lab");

      const tueSlot = slots.find((s) => s.courseCode === "CSE391L" && s.dayOfWeek === 2);
      expect(tueSlot).toBeDefined();
      expect(tueSlot?.roomCode).toBe("10F-33L");

      const matSlot = slots.find((s) => s.courseCode === "MAT110" && s.dayOfWeek === 1);
      expect(matSlot?.roomCode).toBe("07B-12C");
      expect(matSlot?.category).toBe("theory");
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
