"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Download,
  AlertTriangle,
  GraduationCap,
  LogOut,
  User,
} from "lucide-react";

interface NavbarProps {
  activeSemester: any;
  apiToken: string;
  onUpdateToken: (token: string) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onExport: (format: "json" | "csv") => void;
  userEmail?: string | null;
}

export function Navbar({
  activeSemester,
  activeTab,
  setActiveTab,
  onExport,
  userEmail,
}: NavbarProps) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(userEmail || null);

  useEffect(() => {
    if (!email && typeof window !== "undefined") {
      const stored = localStorage.getItem("attendance_user_email");
      if (stored) setEmail(stored);
    }
  }, [email]);

  const handleLogout = async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("attendance_api_token");
      localStorage.removeItem("attendance_user_email");
    }
    // Clear cookies
    document.cookie = "attendance_jwt=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";
    document.cookie = "authjs.session-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";
    router.push("/login");
  };

  // Compute days until purge if active semester exists
  let daysUntilPurge: number | null = null;
  if (activeSemester?.purgeAt) {
    const purgeDate = new Date(activeSemester.purgeAt);
    const now = new Date();
    const diffTime = purgeDate.getTime() - now.getTime();
    daysUntilPurge = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  const tabs = [
    { id: "today", label: "Today's Classes" },
    { id: "analytics", label: "Analytics & Courses" },
    { id: "routine", label: "Routine Ingestion" },
    { id: "config", label: "Semester & Holidays" },
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Attendance Tracker
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-medium border border-indigo-500/30">
                  Multi-User
                </span>
              </span>
              {activeSemester && (
                <div className="flex items-center text-xs text-slate-400 gap-2">
                  <Calendar className="w-3 h-3" />
                  <span>{activeSemester.name}</span>
                  <span>•</span>
                  <span>
                    {new Date(activeSemester.startDate).toLocaleDateString()} –{" "}
                    {new Date(activeSemester.endDate).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Purge Alert Warning */}
          {daysUntilPurge !== null && daysUntilPurge <= 7 && daysUntilPurge > 0 && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs animate-pulse">
              <AlertTriangle className="w-4 h-4" />
              <span>Data purges in {daysUntilPurge} day{daysUntilPurge === 1 ? "" : "s"}! Remember to export.</span>
            </div>
          )}

          {/* Quick Actions & Auth */}
          <div className="flex items-center space-x-3">
            {/* Export Dropdown */}
            <div className="relative group">
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
                title="Export attendance records"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export</span>
              </button>
              <div className="absolute right-0 mt-1 w-32 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 hidden group-hover:block z-50">
                <button
                  onClick={() => onExport("csv")}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white"
                >
                  Export CSV
                </button>
                <button
                  onClick={() => onExport("json")}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white"
                >
                  Export JSON
                </button>
              </div>
            </div>

            {/* User Account badge & Logout */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
                <User className="w-3.5 h-3.5 text-indigo-400" />
                <span className="max-w-[150px] truncate">{email || "Account"}</span>
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-medium border border-rose-500/30 transition"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 overflow-x-auto pb-1 scrollbar-none">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                  active
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
