"use client";

import React from "react";
import {
  Calendar,
  MapPin,
  Sparkles,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Save,
  BookOpen,
} from "lucide-react";

interface SemesterConfigViewProps {
  activeSemester: any;
  courses?: any[];
  onUpdateSemester: (data: any) => Promise<void>;
  onCreateSemester: (data: any) => Promise<void>;
  onAddHoliday: (data: { date: string; label: string }) => Promise<void>;
  onDeleteHoliday: (holidayId: string) => Promise<void>;
  onDropCourse?: (courseId: string) => Promise<void>;
  apiToken: string;
}

export function SemesterConfigView({
  activeSemester,
  courses,
  onUpdateSemester,
  onCreateSemester,
  onAddHoliday,
  onDeleteHoliday,
  onDropCourse,
  apiToken,
}: SemesterConfigViewProps) {
  // Semester form state
  const [name, setName] = React.useState(activeSemester?.name || "Fall 2026");
  const [startDate, setStartDate] = React.useState(
    activeSemester?.startDate ? new Date(activeSemester.startDate).toISOString().slice(0, 10) : ""
  );
  const [endDate, setEndDate] = React.useState(
    activeSemester?.endDate ? new Date(activeSemester.endDate).toISOString().slice(0, 10) : ""
  );
  const [midtermStart, setMidtermStart] = React.useState(
    activeSemester?.midtermWeekStart
      ? new Date(activeSemester.midtermWeekStart).toISOString().slice(0, 10)
      : ""
  );
  const [midtermEnd, setMidtermEnd] = React.useState(
    activeSemester?.midtermWeekEnd
      ? new Date(activeSemester.midtermWeekEnd).toISOString().slice(0, 10)
      : ""
  );

  // Geofence state
  const [latitude, setLatitude] = React.useState(
    activeSemester?.geofence?.latitude?.toString() || "23.777176"
  );
  const [longitude, setLongitude] = React.useState(
    activeSemester?.geofence?.longitude?.toString() || "90.399452"
  );
  const [radiusMeters, setRadiusMeters] = React.useState(
    activeSemester?.geofence?.radiusMeters?.toString() || "300"
  );

  // New Holiday state
  const [newHolidayDate, setNewHolidayDate] = React.useState("");
  const [newHolidayLabel, setNewHolidayLabel] = React.useState("");

  const [saving, setSaving] = React.useState(false);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const handleSaveSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    const payload = {
      name,
      startDate,
      endDate,
      midtermWeekStart: midtermStart || null,
      midtermWeekEnd: midtermEnd || null,
      geofence: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        radiusMeters: parseFloat(radiusMeters),
      },
    };

    try {
      if (activeSemester?.id) {
        await onUpdateSemester(payload);
        setSuccessMsg("Semester settings updated successfully! Purge date & stats retroactively recalculated.");
      } else {
        await onCreateSemester(payload);
        setSuccessMsg("Semester created successfully!");
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddHolidaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayDate) return;

    try {
      await onAddHoliday({
        date: newHolidayDate,
        label: newHolidayLabel,
      });
      setNewHolidayDate("");
      setNewHolidayLabel("");
      setSuccessMsg("Holiday created! Associated classes proactively cancelled & any absent records converted.");
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Semester Configuration Card */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-400" />
            <span>Semester Setup & Academic Calendar</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure dates, non-graded midterm week, and campus geofence coordinates.
          </p>
        </div>

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSaveSemester} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Semester Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Start Date (First Week Non-Graded)
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                End Date (Auto Purge = End + 7d)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Midterm Week Config */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              <span>Midterm Week Dates (Pausable & Excluded from Stats)</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Can be specified anytime during the semester. Saving will retroactively set `counted_in_stats = false` for all records in this range.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Midterm Week Start</label>
                <input
                  type="date"
                  value={midtermStart}
                  onChange={(e) => setMidtermStart(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Midterm Week End</label>
                <input
                  type="date"
                  value={midtermEnd}
                  onChange={(e) => setMidtermEnd(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Campus Geofence Config */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="text-xs font-semibold text-sky-300 flex items-center gap-1.5">
              <MapPin className="w-4 h-4" />
              <span>Campus Geofence (Used by Android GeofencingClient)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Radius (meters)</label>
                <input
                  type="number"
                  value={radiusMeters}
                  onChange={(e) => setRadiusMeters(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 transition flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? "Saving Settings..." : "Save Semester Configuration"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Whole-Day Holidays Manager (§4.10) */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <span>Whole-Day Holidays</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Setting a holiday proactively marks classes as cancelled, suppresses all notifications, and retroactively flips any existing absent records to cancelled.
          </p>
        </div>

        {/* Add Holiday Form */}
        <form onSubmit={handleAddHolidaySubmit} className="flex flex-col sm:flex-row gap-3">
          <input
            type="date"
            value={newHolidayDate}
            onChange={(e) => setNewHolidayDate(e.target.value)}
            required
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
          />
          <input
            type="text"
            placeholder="Holiday label (e.g. University Closure, Eid)"
            value={newHolidayLabel}
            onChange={(e) => setNewHolidayLabel(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 transition flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Holiday</span>
          </button>
        </form>

        {/* Existing Holidays List */}
        <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden">
          {!activeSemester?.holidays || activeSemester.holidays.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              No holidays added for this semester yet.
            </div>
          ) : (
            activeSemester.holidays.map((h: any) => (
              <div
                key={h.id}
                className="p-3.5 flex items-center justify-between hover:bg-slate-800/30 transition text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono font-medium text-slate-200">
                    {new Date(h.date).toISOString().slice(0, 10)}
                  </span>
                  <span className="text-slate-300 font-semibold">{h.label || "Holiday"}</span>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px]">
                    Notifications Suppressed
                  </span>
                </div>
                <button
                  onClick={() => onDeleteHoliday(h.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-400 transition"
                  title="Remove holiday"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Enrolled Courses & Drop Option */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            <span>Enrolled Courses</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Manage your enrolled courses. Dropping a course will remove its classes and attendance records.
          </p>
        </div>

        <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden">
          {!courses || courses.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              No courses enrolled for this semester yet.
            </div>
          ) : (
            courses.map((c: any) => {
              const id = c.courseId || c.id;
              const code = c.courseCode || c.code;
              const name = c.courseName || c.name;
              return (
                <div
                  key={id}
                  className="p-3.5 flex items-center justify-between hover:bg-slate-800/30 transition text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-white tracking-wide">{code}</span>
                    <span className="text-slate-400 truncate max-w-xs">{name}</span>
                    {c.roomCodes && c.roomCodes.length > 0 && (
                      <span className="font-mono text-indigo-300 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-indigo-400" />
                        <span>Room: {c.roomCodes.join(", ")}</span>
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] uppercase border border-slate-700">
                      {c.category} ({c.thresholdPct}%)
                    </span>
                  </div>
                  {onDropCourse && (
                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to drop course ${code}? This will remove all associated slots and attendance records.`)) {
                          onDropCourse(id);
                        }
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30 transition"
                      title="Drop Course"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Drop Course</span>
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
