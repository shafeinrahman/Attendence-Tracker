"use client";

import React from "react";
import {
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronRight,
  Sparkles,
  BookOpen,
  MapPin,
  Trash2,
} from "lucide-react";
import { CourseAttendanceStats } from "@/lib/attendance-calculator";

interface AnalyticsViewProps {
  courses: CourseAttendanceStats[];
  overall: {
    attended: number;
    held: number;
    percentage: number;
  };
  onExcuseToggle: (recordId: string, currentStatus: string) => Promise<void>;
  fetchCourseRecords: (courseId: string) => Promise<any[]>;
  onDropCourse?: (courseId: string) => Promise<void>;
  loading: boolean;
}

export function AnalyticsView({
  courses,
  overall,
  onExcuseToggle,
  fetchCourseRecords,
  onDropCourse,
  loading,
}: AnalyticsViewProps) {
  const [selectedCourse, setSelectedCourse] = React.useState<CourseAttendanceStats | null>(null);
  const [courseRecords, setCourseRecords] = React.useState<any[]>([]);
  const [loadingRecords, setLoadingRecords] = React.useState(false);
  const [droppingCourseId, setDroppingCourseId] = React.useState<string | null>(null);

  const handleDropClick = async (course: CourseAttendanceStats) => {
    if (!onDropCourse) return;
    const confirmed = confirm(
      `Are you sure you want to drop course ${course.courseCode} (${course.courseName})?\n\nThis will permanently delete all associated class slots and attendance records.`
    );
    if (!confirmed) return;

    setDroppingCourseId(course.courseId);
    try {
      await onDropCourse(course.courseId);
      if (selectedCourse?.courseId === course.courseId) {
        setSelectedCourse(null);
      }
    } catch (err: any) {
      alert(`Failed to drop course: ${err.message}`);
    } finally {
      setDroppingCourseId(null);
    }
  };

  const handleSelectCourse = async (course: CourseAttendanceStats) => {
    setSelectedCourse(course);
    setLoadingRecords(true);
    try {
      const records = await fetchCourseRecords(course.courseId);
      setCourseRecords(records);
    } finally {
      setLoadingRecords(false);
    }
  };

  const handleToggleExcuse = async (recordId: string, currentStatus: string) => {
    await onExcuseToggle(recordId, currentStatus);
    if (selectedCourse) {
      const updated = await fetchCourseRecords(selectedCourse.courseId);
      setCourseRecords(updated);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overall Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
          <div className="text-xs text-slate-400 font-medium">Overall Attendance</div>
          <div className="text-3xl font-extrabold text-white mt-2 flex items-baseline gap-2">
            <span>{overall.percentage}%</span>
            <span className="text-xs font-normal text-slate-400">
              ({overall.attended} / {overall.held} held classes)
            </span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                overall.percentage >= 75 ? "bg-emerald-500" : overall.percentage >= 60 ? "bg-amber-500" : "bg-rose-500"
              }`}
              style={{ width: `${Math.min(100, overall.percentage)}%` }}
            />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
          <div className="text-xs text-slate-400 font-medium">Active Courses</div>
          <div className="text-3xl font-extrabold text-white mt-2">
            {courses.length}
          </div>
          <div className="text-xs text-slate-400 mt-2">
            {courses.filter((c) => c.meetsThreshold).length} on track •{" "}
            <span className="text-rose-400 font-medium">
              {courses.filter((c) => !c.meetsThreshold).length} below threshold
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
          <div className="text-xs text-slate-400 font-medium">Risk Status</div>
          <div className="text-3xl font-extrabold mt-2 flex items-center gap-2">
            {courses.some((c) => c.isAtRisk) ? (
              <span className="text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-7 h-7" /> At Risk
              </span>
            ) : (
              <span className="text-emerald-400 flex items-center gap-2">
                <ShieldCheck className="w-7 h-7" /> All Safe
              </span>
            )}
          </div>
          <div className="text-xs text-slate-400 mt-2">
            {courses.filter((c) => c.isAtRisk).length} course(s) flagged as mathematically at risk
          </div>
        </div>
      </div>

      {/* Courses Grid */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-400" />
          <span>Course Projections & Safe-to-Skip</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((c) => {
            return (
              <div
                key={c.courseId}
                onClick={() => handleSelectCourse(c)}
                className={`p-5 rounded-2xl border cursor-pointer transition hover:scale-[1.01] flex flex-col justify-between ${
                  c.isAtRisk
                    ? "bg-rose-950/20 border-rose-500/40 hover:border-rose-500"
                    : c.meetsThreshold
                    ? "bg-slate-900 border-slate-800 hover:border-slate-700"
                    : "bg-amber-950/20 border-amber-500/40 hover:border-amber-500"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-base font-bold text-white">{c.courseCode}</span>
                      <div className="text-xs text-slate-400 truncate max-w-[200px]">{c.courseName}</div>
                      {c.roomCodes && c.roomCodes.length > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-indigo-300 font-mono mt-1">
                          <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span>Room: {c.roomCodes.join(", ")}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                          c.category === "lab"
                            ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                            : "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                        }`}
                      >
                        {c.category} ({c.thresholdPct}%)
                      </span>
                      {onDropCourse && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDropClick(c);
                          }}
                          disabled={droppingCourseId === c.courseId}
                          title="Drop Course"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Percentage */}
                  <div className="mt-4 flex items-baseline justify-between">
                    <div className="text-2xl font-black text-white">
                      {c.currentPercentage}%
                    </div>
                    <div className="text-xs text-slate-400">
                      {c.attended} attended / {c.held} held
                    </div>
                  </div>

                  {/* Progress bar with threshold marker */}
                  <div className="relative w-full bg-slate-800 h-2 rounded-full mt-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        c.meetsThreshold ? "bg-emerald-500" : "bg-amber-500"
                      }`}
                      style={{ width: `${Math.min(100, c.currentPercentage)}%` }}
                    />
                  </div>

                  {/* Badges / Projections */}
                  <div className="mt-4 space-y-1.5 text-xs">
                    {/* Safe to skip */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/60 border border-slate-700/60">
                      <span className="text-slate-400">Safe to skip:</span>
                      <span className={`font-bold ${c.safeToSkip > 0 ? "text-emerald-400" : "text-slate-400"}`}>
                        {c.safeToSkip} class{c.safeToSkip === 1 ? "" : "es"}
                      </span>
                    </div>

                    {/* Must attend */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/60 border border-slate-700/60">
                      <span className="text-slate-400">Must attend:</span>
                      <span className="font-bold text-slate-200">
                        {c.mustAttend} of remaining {c.remainingSlots}
                      </span>
                    </div>

                    {/* At risk banner */}
                    {c.isAtRisk && (
                      <div className="p-2 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-center gap-1.5 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Cannot reach {c.thresholdPct}%! Max: {c.maxPossiblePercentage}%</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-indigo-400 font-medium">
                  <span>View Attendance Log & Excuse</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Attendance Log Modal */}
      {selectedCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>{selectedCourse.courseCode}</span>
                  <span className="text-xs text-slate-400 font-normal">
                    — {selectedCourse.courseName}
                  </span>
                </h3>
                <div className="flex items-center gap-3 mt-1">
                  {selectedCourse.roomCodes && selectedCourse.roomCodes.length > 0 && (
                    <span className="text-xs text-indigo-300 font-mono flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-indigo-400" />
                      <span>Room: {selectedCourse.roomCodes.join(", ")}</span>
                    </span>
                  )}
                  <p className="text-xs text-slate-400">
                    Click 'Excuse' to remove a missed class from the percentage math entirely.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onDropCourse && (
                  <button
                    onClick={() => handleDropClick(selectedCourse)}
                    disabled={droppingCourseId === selectedCourse.courseId}
                    className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold border border-rose-500/30 flex items-center gap-1.5 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Drop Course</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedCourse(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 transition"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              {loadingRecords ? (
                <div className="py-8 text-center text-slate-400 text-sm">Loading records...</div>
              ) : courseRecords.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-sm">No attendance records logged yet for this course.</div>
              ) : (
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Time / Room</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Flags</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {courseRecords.map((r) => {
                      const isExcused = r.status === "excused";
                      const isAbsent = r.status === "absent";
                      const dateDisplay = new Date(r.date).toISOString().slice(0, 10);

                      return (
                        <tr key={r.id} className="hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 font-mono font-medium text-slate-200">
                            {dateDisplay}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300 font-mono">
                            {r.classSlot?.startTime} • <span className="text-indigo-300 font-semibold">Room: {r.classSlot?.roomCode || "N/A"}</span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold capitalize">
                            <span
                              className={`inline-flex items-center gap-1 ${
                                r.status === "present"
                                  ? "text-emerald-400"
                                  : r.status === "running_late"
                                  ? "text-amber-400"
                                  : r.status === "absent"
                                  ? "text-rose-400"
                                  : r.status === "excused"
                                  ? "text-indigo-400"
                                  : "text-slate-400"
                              }`}
                            >
                              {r.status.replace("_", " ")}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-slate-400">
                            {r.isFirstWeek && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 mr-1">First Week</span>
                            )}
                            {r.isMidtermWeek && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 mr-1">Midterm Week</span>
                            )}
                            {!r.countedInStats && !r.isFirstWeek && !r.isMidtermWeek && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">Excluded</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {isAbsent && (
                              <button
                                onClick={() => handleToggleExcuse(r.id, "excused")}
                                className="px-2.5 py-1 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-semibold border border-indigo-500/40 transition"
                              >
                                Mark Excused
                              </button>
                            )}
                            {isExcused && (
                              <button
                                onClick={() => handleToggleExcuse(r.id, "absent")}
                                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                              >
                                Unmark Excused
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
