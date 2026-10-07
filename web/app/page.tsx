"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { TodayClassesView } from "@/components/TodayClassesView";
import { AnalyticsView } from "@/components/AnalyticsView";
import { RoutineUploader } from "@/components/RoutineUploader";
import { SemesterConfigView } from "@/components/SemesterConfigView";
import { OnlineMakeupModal } from "@/components/OnlineMakeupModal";
import { CourseAttendanceStats } from "@/lib/attendance-calculator";
import { Loader2 } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const [apiToken, setApiToken] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
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
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);

  // Check auth session / token on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedToken = localStorage.getItem("attendance_api_token");
      const savedId = localStorage.getItem("attendance_student_id") || localStorage.getItem("attendance_user_email");

      if (!savedToken) {
        // Attempt to check if cookie session exists via /api/auth/me
        fetch("/api/auth/me")
          .then((res) => {
            if (res.ok) return res.json();
            throw new Error("Unauthenticated");
          })
          .then((data) => {
            setUserEmail(data.user.studentId || data.user.email);
            setCheckingAuth(false);
          })
          .catch(() => {
            router.push("/login");
          });
      } else {
        // Verify saved token validity with server
        fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${savedToken}` },
        })
          .then((res) => {
            if (res.ok) return res.json();
            throw new Error("Invalid session");
          })
          .then((data) => {
            setApiToken(savedToken);
            setUserEmail(data.user?.studentId || savedId);
            setCheckingAuth(false);
          })
          .catch(() => {
            localStorage.removeItem("attendance_api_token");
            localStorage.removeItem("attendance_student_id");
            localStorage.removeItem("attendance_user_email");
            router.push("/login");
          });
      }
    }
  }, [router]);

  const handleUpdateToken = (token: string) => {
    setApiToken(token);
    if (typeof window !== "undefined") {
      localStorage.setItem("attendance_api_token", token);
    }
  };

  const getHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiToken) {
      headers["Authorization"] = `Bearer ${apiToken}`;
    }
    return headers;
  }, [apiToken]);

  // Fetch all dashboard data
  const fetchData = useCallback(async () => {
    if (checkingAuth) return;
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);

      // 1. Fetch active semester
      const semRes = await fetch("/api/semesters", { headers: getHeaders() });
      if (semRes.status === 401) {
        router.push("/login");
        return;
      }

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
        } else {
          setTodayHoliday(null);
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
  }, [checkingAuth, getHeaders, router]);

  useEffect(() => {
    if (!checkingAuth) {
      fetchData();
    }
  }, [checkingAuth, fetchData]);

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

  const handleDropCourse = async (courseId: string) => {
    const res = await fetch(`/api/courses/${courseId}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to drop course");
    }
    await fetchData();
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          <span>Authenticating session...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Navbar
        activeSemester={activeSemester}
        apiToken={apiToken}
        onUpdateToken={handleUpdateToken}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onExport={handleExport}
        userEmail={userEmail}
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
            onDropCourse={handleDropCourse}
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
            courses={analyticsData.courses}
            onUpdateSemester={handleUpdateSemester}
            onCreateSemester={handleCreateSemester}
            onAddHoliday={handleAddHoliday}
            onDeleteHoliday={handleDeleteHoliday}
            onDropCourse={handleDropCourse}
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
