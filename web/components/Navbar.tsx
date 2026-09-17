"use client";

import React from "react";
import {
  Calendar,
  Download,
  AlertTriangle,
  Key,
  ShieldCheck,
  GraduationCap,
} from "lucide-react";

interface NavbarProps {
  activeSemester: any;
  apiToken: string;
  onUpdateToken: (token: string) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onExport: (format: "json" | "csv") => void;
}

export function Navbar({
  activeSemester,
  apiToken,
  onUpdateToken,
  activeTab,
  setActiveTab,
  onExport,
}: NavbarProps) {
  const [showTokenInput, setShowTokenInput] = React.useState(false);
  const [tempToken, setTempToken] = React.useState(apiToken);

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
                  Companion
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

            {/* Token config button */}
            <button
              onClick={() => setShowTokenInput(!showTokenInput)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
              title="Configure API Token"
            >
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">API Token</span>
            </button>
          </div>
        </div>

        {/* Token input drawer */}
        {showTokenInput && (
          <div className="py-2.5 px-4 my-2 rounded-lg bg-slate-800/90 border border-slate-700 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-300">Set API Token / PIN:</span>
              <input
                type="password"
                value={tempToken}
                onChange={(e) => setTempToken(e.target.value)}
                placeholder="Enter API token..."
                className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200 focus:outline-none focus:border-indigo-500 flex-1 max-w-sm"
              />
            </div>
            <button
              onClick={() => {
                onUpdateToken(tempToken);
                setShowTokenInput(false);
              }}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium transition"
            >
              Save Token
            </button>
          </div>
        )}

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
