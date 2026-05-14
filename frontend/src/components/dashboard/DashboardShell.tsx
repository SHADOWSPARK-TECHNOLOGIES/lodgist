"use client";

// ─── DashboardShell ────────────────────────────────────────────────────────
// Main dashboard layout with tab navigation, session guard, and HNW indicator.

import { useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import type { DashboardTab } from "@/lib/types";

interface TabDefinition {
  id: DashboardTab;
  label: string;
  icon: string;
  requiresAuth?: boolean;
  requiresHNW?: boolean;
}

const TABS: TabDefinition[] = [
  { id: "overview", label: "Overview", icon: "📊" },
  { id: "listings", label: "Listings", icon: "🏠" },
  { id: "reviews", label: "Reviews", icon: "⭐" },
  { id: "passkeys", label: "Passkeys", icon: "🔑" },
  { id: "hnw", label: "HNW Verification", icon: "💎", requiresHNW: true },
];

interface DashboardShellProps {
  /** Render function receiving the active tab and a setter */
  children: (activeTab: DashboardTab, setActiveTab: (tab: DashboardTab) => void) => ReactNode;
  /** Optional title override */
  title?: string;
}

export default function DashboardShell({ children, title }: DashboardShellProps) {
  const { user, logout, isLoaded } = useAuth();
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-400">Loading dashboard...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Session Required</h2>
          <p className="text-gray-500 mb-4">Please log in to access the dashboard.</p>
          <a
            href="/login"
            className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  const visibleTabs = TABS.filter(
    (t) => !t.requiresHNW || user.isHNW
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-gray-900">
              {title || "Dashboard"}
            </h1>
            <div className="flex items-center gap-4">
              {/* HNW Badge */}
              {user.isHNW && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  💎 HNW Verified
                </span>
              )}
              {/* User Info */}
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-500 capitalize">{user.role.toLowerCase()}</p>
              </div>
              {/* Logout */}
              <button
                onClick={logout}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-1 -mb-px overflow-x-auto">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2
                  whitespace-nowrap transition
                  ${
                    activeTab === tab.id
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }
                `}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children(activeTab, setActiveTab)}
      </main>
    </div>
  );
}
