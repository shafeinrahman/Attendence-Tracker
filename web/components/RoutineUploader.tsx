"use client";

import React from "react";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { ParsedSlot } from "@/lib/parser/markdown-parser";

interface RoutineUploaderProps {
  onCommitSuccess: () => void;
  apiToken: string;
}

const DAY_NAMES = [
  "",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export function RoutineUploader({ onCommitSuccess, apiToken }: RoutineUploaderProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [pastedMarkdown, setPastedMarkdown] = React.useState("");
  const [parsing, setParsing] = React.useState(false);
  const [committing, setCommitting] = React.useState(false);
  const [parsedSlots, setParsedSlots] = React.useState<
    (ParsedSlot & { categorySource?: "inferred" | "manual" })[]
  >([]);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [commitMessage, setCommitMessage] = React.useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setParseError(null);
    }
  };

  const handleParse = async () => {
    setParsing(true);
    setParseError(null);
    setCommitMessage(null);

    try {
      let res: Response;
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        res = await fetch("/api/routine/parse", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiToken}`,
          },
          body: formData,
        });
      } else if (pastedMarkdown.trim()) {
        res = await fetch("/api/routine/parse", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiToken}`,
          },
          body: JSON.stringify({ markdown: pastedMarkdown }),
        });
      } else {
        setParseError("Please select a file or paste a Markdown table.");
        setParsing(false);
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to parse routine");
      }

      if (data.slots.length === 0) {
        setParseError("No slots detected. Check the table format or try pasting a Markdown table.");
      } else {
        setParsedSlots(
          data.slots.map((s: ParsedSlot) => ({
            ...s,
            categorySource: "inferred",
          }))
        );
      }
    } catch (err: any) {
      setParseError(err.message);
    } finally {
      setParsing(false);
    }
  };

  const handleCategoryChange = (index: number, newCategory: "theory" | "lab" | "unclassified") => {
    setParsedSlots((prev) => {
      const updated = [...prev];
      const slot = updated[index];
      const newThreshold = newCategory === "lab" ? 90.0 : 70.0;

      // Update this slot and all other slots with the same course code to keep consistent
      return updated.map((s) => {
        if (s.courseCode === slot.courseCode) {
          return {
            ...s,
            category: newCategory,
            thresholdPct: newThreshold,
            categorySource: "manual",
          };
        }
        return s;
      });
    });
  };

  const handleSlotFieldChange = (index: number, field: keyof ParsedSlot, value: any) => {
    setParsedSlots((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleDeleteSlot = (index: number) => {
    setParsedSlots((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCommit = async () => {
    setCommitting(true);
    setCommitMessage(null);
    try {
      const res = await fetch("/api/routine/commit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({ slots: parsedSlots }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to commit routine");

      setCommitMessage(
        `Successfully saved ${data.committedCourses} courses and ${data.committedSlots} class slots!`
      );
      setTimeout(() => {
        onCommitSuccess();
      }, 1500);
    } catch (err: any) {
      setParseError(err.message);
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-indigo-400" />
            <span>Markdown Routine Ingestion</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Ingest your class schedule via Markdown table format. Paste your routine table directly or upload a Markdown file (.md).
          </p>
        </div>

        {/* Tabs for File vs Paste */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* File Upload Box */}
          <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500/60 rounded-xl p-6 text-center bg-slate-950/50 flex flex-col items-center justify-center transition">
            <div className="flex items-center gap-3 text-slate-400 mb-3">
              <FileText className="w-8 h-8 text-indigo-400" />
            </div>
            <label className="cursor-pointer">
              <span className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-600 transition inline-block">
                Choose Markdown File (.md, .txt)
              </span>
              <input
                type="file"
                accept=".md,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            {file && (
              <div className="mt-3 text-xs text-indigo-300 font-medium">
                Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </div>
            )}
          </div>

          {/* Paste Markdown Box */}
          <div className="flex flex-col space-y-2">
            <label className="text-xs font-semibold text-slate-300">
              Or Paste Markdown Routine Grid:
            </label>
            <textarea
              rows={4}
              value={pastedMarkdown}
              onChange={(e) => {
                setPastedMarkdown(e.target.value);
                setFile(null);
              }}
              placeholder={`| Time | Monday | Wednesday |\n|---|---|---|\n| 08:00 - 09:20 | CSE331 09A-01C | CSE331 09A-01C |\n| 11:30 - 13:00 | - | CSE420 AS1-15L |`}
              className="w-full h-full min-h-[100px] bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {parseError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{parseError}</span>
          </div>
        )}

        <button
          onClick={handleParse}
          disabled={parsing || (!file && !pastedMarkdown.trim())}
          className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 transition flex items-center gap-2 disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          <span>{parsing ? "Parsing Routine..." : "Parse & Detect Schedule"}</span>
        </button>
      </div>

      {/* Review Screen */}
      {parsedSlots.length > 0 && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Routine Review & Override</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {parsedSlots.length} Slots Detected
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Room suffix 'C' is auto-classified as Theory (70%), 'L' as Lab (90%). Overrides are permanently saved as manual.
              </p>
            </div>

            <button
              onClick={handleCommit}
              disabled={committing}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-600/20 transition flex items-center gap-2 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{committing ? "Saving to Database..." : "Commit & Save Routine"}</span>
            </button>
          </div>

          {commitMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{commitMessage}</span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Course Code</th>
                  <th className="py-2.5 px-3">Room</th>
                  <th className="py-2.5 px-3">Category & Threshold</th>
                  <th className="py-2.5 px-3">Day of Week</th>
                  <th className="py-2.5 px-3">Start Time</th>
                  <th className="py-2.5 px-3">End Time</th>
                  <th className="py-2.5 px-3 text-right">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {parsedSlots.map((slot, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40">
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={slot.courseCode}
                        onChange={(e) =>
                          handleSlotFieldChange(idx, "courseCode", e.target.value.toUpperCase())
                        }
                        className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 font-bold focus:outline-none focus:border-indigo-500 w-28"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={slot.roomCode}
                        onChange={(e) =>
                          handleSlotFieldChange(idx, "roomCode", e.target.value.toUpperCase())
                        }
                        className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono focus:outline-none focus:border-indigo-500 w-24"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <select
                          value={slot.category}
                          onChange={(e) =>
                            handleCategoryChange(
                              idx,
                              e.target.value as "theory" | "lab" | "unclassified"
                            )
                          }
                          className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500"
                        >
                          <option value="theory">Theory (70%)</option>
                          <option value="lab">Lab (90%)</option>
                          <option value="unclassified">Unclassified (70%)</option>
                        </select>
                        {slot.categorySource === "manual" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Manual
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <select
                        value={slot.dayOfWeek}
                        onChange={(e) =>
                          handleSlotFieldChange(idx, "dayOfWeek", parseInt(e.target.value))
                        }
                        className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500"
                      >
                        {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                          <option key={d} value={d}>
                            {DAY_NAMES[d]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="time"
                        value={slot.startTime}
                        onChange={(e) => handleSlotFieldChange(idx, "startTime", e.target.value)}
                        className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500 w-24"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="time"
                        value={slot.endTime}
                        onChange={(e) => handleSlotFieldChange(idx, "endTime", e.target.value)}
                        className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500 w-24"
                      />
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={() => handleDeleteSlot(idx)}
                        className="p-1 text-slate-400 hover:text-rose-400 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
