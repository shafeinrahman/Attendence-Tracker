"use client";

import React from "react";
import {
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Ban,
  ShieldCheck,
  Globe,
  FastForward,
  Sparkles,
} from "lucide-react";

interface SlotWithAttendance {
  id: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  startTime: string;
  endTime: string;
  roomCode: string;
  sessionMode: "in_person" | "online";
  specificDate?: string | null;
  attendanceRecord?: {
    id: string;
    status: string;
    isBulkSkip: boolean;
    countedInStats: boolean;
  } | null;
}

interface TodayClassesViewProps {
  slots: SlotWithAttendance[];
  todayHoliday?: { label?: string } | null;
  onLogAttendance: (slotId: string, status: string) => Promise<void>;
  onSkipToday: () => Promise<void>;
  onRescheduleOnline: (slot: SlotWithAttendance) => void;
  loading: boolean;
}

export function TodayClassesView({
  slots,
  todayHoliday,
  onLogAttendance,
  onSkipToday,
  onRescheduleOnline,
  loading,
}: TodayClassesViewProps) {
  const [updatingSlotId, setUpdatingSlotId] = React.useState<string | null>(null);
  const [skipTodayLoading, setSkipTodayLoading] = React.useState(false);

  const handleStatusChange = async (slotId: string, status: string) => {
    setUpdatingSlotId(slotId);
    try {
      await onLogAttendance(slotId, status);
    } finally {
      setUpdatingSlotId(null);
    }
  };

  const handleSkipToday = async () => {
    if (!confirm("Are you sure you want to skip all remaining classes today? This logs them as Absent.")) {
      return;
    }
    setSkipTodayLoading(true);
    try {
      await onSkipToday();
    } finally {
      setSkipTodayLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Skip Today */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800/80 border border-slate-800 shadow-xl">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>Today's Classes</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
              {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Track real-time status or adjust classes with quick actions.
          </p>
        </div>

        {/* Skip Today Button */}
        {!todayHoliday && slots.length > 0 && (
          <button
            onClick={handleSkipToday}
            disabled={skipTodayLoading || loading}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-sm font-semibold border border-rose-500/30 transition shadow-sm hover:shadow-rose-500/10 disabled:opacity-50"
          >
            <FastForward className="w-4 h-4 text-rose-400" />
            <span>{skipTodayLoading ? "Marking Absent..." : "Skip Today (All Classes)"}</span>
          </button>
        )}
      </div>

      {/* Holiday Announcement */}
      {todayHoliday && (
        <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center gap-3 text-indigo-200">
          <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" />
          <div className="text-sm">
            <span className="font-semibold">Campus Holiday:</span>{" "}
            {todayHoliday.label || "Institution closed today"}. All classes are marked as Cancelled/Holiday and excluded from attendance statistics.
          </div>
        </div>
      )}

      {/* Class Cards */}
      {slots.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40">
          <Clock className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-medium text-slate-300">No Classes Scheduled Today</h3>
          <p className="text-sm text-slate-500 mt-1">
            Enjoy your free day, or import/configure routines in the Routine tab.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {slots.map((slot) => {
            const currentStatus = slot.attendanceRecord?.status;
            const isOnline = slot.sessionMode === "online";
            const isUpdating = updatingSlotId === slot.id;

            return (
              <div
                key={slot.id}
                className={`p-5 rounded-2xl border transition-all duration-200 ${
                  currentStatus === "present"
                    ? "bg-emerald-950/20 border-emerald-500/30"
                    : currentStatus === "running_late"
                    ? "bg-amber-950/20 border-amber-500/30"
                    : currentStatus === "absent"
                    ? "bg-rose-950/20 border-rose-500/30"
                    : currentStatus === "cancelled_holiday"
                    ? "bg-slate-900/60 border-slate-700/60 opacity-80"
                    : "bg-slate-900 border-slate-800 hover:border-slate-700"
                }`}
              >
                {/* Top: Code, Mode & Time */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-white tracking-tight">
                        {slot.courseCode}
                      </span>
                      {isOnline ? (
                        <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 font-medium border border-sky-500/30">
                          <Globe className="w-3 h-3" /> Online
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-medium border border-slate-700">
                          <MapPin className="w-3 h-3" /> {slot.roomCode}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">
                      {slot.courseName}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs font-mono text-slate-300">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    <span>
                      {slot.startTime} – {slot.endTime}
                    </span>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="flex items-center justify-between py-2 border-y border-slate-800/80 my-3 text-xs">
                  <span className="text-slate-400 font-medium">Logged Status:</span>
                  <span className="font-semibold capitalize flex items-center gap-1.5">
                    {currentStatus === "present" && (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Present
                      </span>
                    )}
                    {currentStatus === "running_late" && (
                      <span className="text-amber-400 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" /> Running Late (Attended)
                      </span>
                    )}
                    {currentStatus === "absent" && (
                      <span className="text-rose-400 flex items-center gap-1">
                        <XCircle className="w-4 h-4" /> Absent
                        {slot.attendanceRecord?.isBulkSkip && " (Day Skip)"}
                      </span>
                    )}
                    {currentStatus === "cancelled_holiday" && (
                      <span className="text-slate-400 flex items-center gap-1">
                        <Ban className="w-4 h-4" /> Cancelled / Holiday
                      </span>
                    )}
                    {currentStatus === "excused" && (
                      <span className="text-indigo-400 flex items-center gap-1">
                        <ShieldCheck className="w-4 h-4" /> Excused (Excluded)
                      </span>
                    )}
                    {!currentStatus && (
                      <span className="text-slate-500 italic">Not logged yet</span>
                    )}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-1.5 text-xs">
                    <button
                      onClick={() => handleStatusChange(slot.id, "present")}
                      disabled={isUpdating}
                      className={`py-1.5 px-2 rounded-lg font-medium border transition text-center ${
                        currentStatus === "present"
                          ? "bg-emerald-600 border-emerald-500 text-white"
                          : "bg-slate-800/80 hover:bg-emerald-950/40 border-slate-700 hover:border-emerald-500/50 text-slate-300"
                      }`}
                    >
                      Present
                    </button>
                    <button
                      onClick={() => handleStatusChange(slot.id, "running_late")}
                      disabled={isUpdating}
                      className={`py-1.5 px-2 rounded-lg font-medium border transition text-center ${
                        currentStatus === "running_late"
                          ? "bg-amber-600 border-amber-500 text-white"
                          : "bg-slate-800/80 hover:bg-amber-950/40 border-slate-700 hover:border-amber-500/50 text-slate-300"
                      }`}
                    >
                      Running Late
                    </button>
                    <button
                      onClick={() => handleStatusChange(slot.id, "absent")}
                      disabled={isUpdating}
                      className={`py-1.5 px-2 rounded-lg font-medium border transition text-center ${
                        currentStatus === "absent"
                          ? "bg-rose-600 border-rose-500 text-white"
                          : "bg-slate-800/80 hover:bg-rose-950/40 border-slate-700 hover:border-rose-500/50 text-slate-300"
                      }`}
                    >
                      Absent
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    <button
                      onClick={() => handleStatusChange(slot.id, "cancelled_holiday")}
                      disabled={isUpdating}
                      className={`py-1.5 px-2 rounded-lg font-medium border transition text-center ${
                        currentStatus === "cancelled_holiday"
                          ? "bg-slate-700 border-slate-600 text-white"
                          : "bg-slate-800/50 hover:bg-slate-800 border-slate-700/60 text-slate-400"
                      }`}
                    >
                      Cancelled / Holiday
                    </button>
                    <button
                      onClick={() => handleStatusChange(slot.id, "excused")}
                      disabled={isUpdating}
                      className={`py-1.5 px-2 rounded-lg font-medium border transition text-center ${
                        currentStatus === "excused"
                          ? "bg-indigo-600 border-indigo-500 text-white"
                          : "bg-slate-800/50 hover:bg-indigo-950/40 border-slate-700/60 text-slate-400"
                      }`}
                    >
                      Mark Excused
                    </button>
                  </div>

                  {/* Reschedule as Online (available if cancelled or upcoming) */}
                  {(currentStatus === "cancelled_holiday" || !currentStatus) && (
                    <button
                      onClick={() => onRescheduleOnline(slot)}
                      className="w-full mt-2 py-1.5 px-3 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 text-xs font-medium border border-sky-500/30 flex items-center justify-center gap-1.5 transition"
                    >
                      <Globe className="w-3.5 h-3.5 text-sky-400" />
                      <span>Reschedule as Online Makeup</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
