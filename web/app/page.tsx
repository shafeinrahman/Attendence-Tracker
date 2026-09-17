"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import { TodayClassesView } from "@/components/TodayClassesView";
import { AnalyticsView } from "@/components/AnalyticsView";
import { RoutineUploader } from "@/components/RoutineUploader";
import { SemesterConfigView } from "@/components/SemesterConfigView";
import { OnlineMakeupModal } from "@/components/OnlineMakeupModal";
import { CourseAttendanceStats } from "@/lib/attendance-calculator";

export default function DashboardPage() {
  const [apiToken, setApiToken] = useState<string>("attendance-secret-token-12345");
  const [activeTab, setActiveTab] = useState<string>("today");

  const [activeSemester, setActiveSemester] = useState<any>(null);
  const [todaySlots, setTodaySlots] = useState<any[]>([]);
  const [todayHoliday, setTodayHoliday] = useState<any>(null);
  const [analyticsData, setAnalyticsData] = useState<{
    courses: CourseAttendanceStats[];
    overall: { attended: number; held: number; percentage: number };
  }>({
    courses: [],
    overall: { attended: 0, held: 0, percentage: 0 },
  });

  const [rescheduleSlot, setRescheduleSlot] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Load token from localStorage on client mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedToken = localStorage.getItem("attendance_api_token");
      if (savedToken) setApiToken(savedToken);
    }
  }, []);

  const handleUpdateToken = (token: string) => {
    setApiToken(token);
    if (typeof window !== "undefined") {
      localStorage.setItem("attendance_api_token", token);
    }
  };

  const getHeaders = useCallback(() => {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    };
  }, [apiToken]);

  // Fetch all dashboard data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);

      // 1. Fetch active semester
      const semRes = await fetch("/api/semesters", { headers: getHeaders() });
      if (semRes.ok) {
        const semData = await semRes.json();
        setActiveSemester(semData.semester);

        if (semData.semester) {
          // Check if today is a holiday
          const holidays = semData.semester.holidays || [];
          const foundHoliday = holidays.find(
            (h: any) => new Date(h.date).toISOString().slice(0, 10) === todayStr
          );
          setTodayHoliday(foundHoliday || null);
        }
      }

      // 2. Fetch today's slots and attendance
      const slotsRes = await fetch(`/api/slots?date=${todayStr}`, { headers: getHeaders() });
      const attRes = await fetch(`/api/attendance?date=${todayStr}`, { headers: getHeaders() });

      if (slotsRes.ok && attRes.ok) {
        const slotsData = await slotsRes.json();
        const attData = await attRes.json();

        const attMap = new Map<string, any>();
        for (const record of attData.records || []) {
          attMap.set(record.classSlotId, record);
        }

        const enrichedSlots = (slotsData.slots || []).map((s: any) => ({
          ...s,
          courseCode: s.course.code,
          courseName: s.course.name,
          attendanceRecord: attMap.get(s.id) || null,
        }));

        setTodaySlots(enrichedSlots);
      }

      // 3. Fetch analytics
      const analyticsRes = await fetch("/api/analytics", { headers: getHeaders() });
      if (analyticsRes.ok) {
        const aData = await analyticsRes.json();
        setAnalyticsData({
          courses: aData.courses || [],
          overall: aData.overall || { attended: 0, held: 0, percentage: 0 },
        });
      }
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handler: Log attendance for a slot
  const handleLogAttendance = async (slotId: string, status: string) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        classSlotId: slotId,
        date: todayStr,
        status,
        source: "desktop",
      }),
    });

    if (res.ok) {
      await fetchData();
    } else {
      const err = await res.json();
      alert(`Failed to update attendance: ${err.error}`);
    }
  };

  // Handler: Skip Today
  const handleSkipToday = async () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        date: todayStr,
        isBulkSkip: true,
        source: "desktop",
      }),
    });

    if (res.ok) {
      await fetchData();
    } else {
      const err = await res.json();
      alert(`Failed to execute Skip Today: ${err.error}`);
    }
  };

  // Handler: Reschedule as Online Makeup
  const handleCreateOnlineMakeup = async (data: any) => {
    const res = await fetch("/api/slots", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        courseId: data.courseId,
        specificDate: data.specificDate,
        startTime: data.startTime,
        endTime: data.endTime,
        sessionMode: "online",
        roomCode: "ONLINE",
        recurring: false,
        makeupForRecordId: data.makeupForRecordId,
      }),
    });

    if (res.ok) {
      await fetchData();
    } else {
      const err = await res.json();
      alert(`Failed to schedule online makeup: ${err.error}`);
    }
  };

  // Handler: Toggle Excuse
  const handleExcuseToggle = async (recordId: string, targetStatus: string) => {
    const res = await fetch("/api/attendance", {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({
        id: recordId,
        status: targetStatus,
      }),
    });

    if (res.ok) {
      await fetchData();
    } else {
      const err = await res.json();
      alert(`Failed to toggle excuse: ${err.error}`);
    }
  };

  // Handler: Export CSV or JSON
  const handleExport = async (format: "json" | "csv") => {
    window.open(`/api/export?format=${format}`, "_blank");
  };

  // Handler: Fetch detailed records for course
  const handleFetchCourseRecords = async (courseId: string) => {
    const res = await fetch(`/api/attendance?courseId=${courseId}`, { headers: getHeaders() });
    if (res.ok) {
      const data = await res.json();
      return data.records || [];
    }
    return [];
  };

  // Semester config handlers
  const handleUpdateSemester = async (data: any) => {
    if (!activeSemester?.id) return;
    const res = await fetch(`/api/semesters/${activeSemester.id}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to update semester");
    }
    await fetchData();
  };

  const handleCreateSemester = async (data: any) => {
    const res = await fetch("/api/semesters", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to create semester");
    }
    await fetchData();
  };

  const handleAddHoliday = async (data: { date: string; label: string }) => {
    const res = await fetch("/api/holidays", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to add holiday");
    }
    await fetchData();
  };

  const handleDeleteHoliday = async (holidayId: string) => {
    const res = await fetch(`/api/holidays?id=${holidayId}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to delete holiday");
    }
    await fetchData();
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Navbar
        activeSemester={activeSemester}
        apiToken={apiToken}
        onUpdateToken={handleUpdateToken}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onExport={handleExport}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "today" && (
          <TodayClassesView
            slots={todaySlots}
            todayHoliday={todayHoliday}
            onLogAttendance={handleLogAttendance}
            onSkipToday={handleSkipToday}
            onRescheduleOnline={(slot) => setRescheduleSlot(slot)}
            loading={loading}
          />
        )}

        {activeTab === "analytics" && (
          <AnalyticsView
            courses={analyticsData.courses}
            overall={analyticsData.overall}
            onExcuseToggle={handleExcuseToggle}
            fetchCourseRecords={handleFetchCourseRecords}
            loading={loading}
          />
        )}

        {activeTab === "routine" && (
          <RoutineUploader
            apiToken={apiToken}
            onCommitSuccess={() => {
              setActiveTab("today");
              fetchData();
            }}
          />
        )}

        {activeTab === "config" && (
          <SemesterConfigView
            activeSemester={activeSemester}
            onUpdateSemester={handleUpdateSemester}
            onCreateSemester={handleCreateSemester}
            onAddHoliday={handleAddHoliday}
            onDeleteHoliday={handleDeleteHoliday}
            apiToken={apiToken}
          />
        )}
      </main>

      {/* Reschedule Online Modal */}
      {rescheduleSlot && (
        <OnlineMakeupModal
          slot={rescheduleSlot}
          onClose={() => setRescheduleSlot(null)}
          onSubmit={handleCreateOnlineMakeup}
        />
      )}
    </div>
  );
}
