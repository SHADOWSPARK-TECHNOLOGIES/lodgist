"use client";

import { useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { dashboard } from "@/lib/copy";
import type { DashboardTab } from "@/lib/types";

interface TabDefinition {
  id: DashboardTab;
  label: string;
  requiresHNW?: boolean;
}

const TABS: TabDefinition[] = [
  { id: "overview", label: dashboard.tabs.overview },
  { id: "listings", label: dashboard.tabs.listings },
  { id: "reviews", label: dashboard.tabs.reviews },
  { id: "passkeys", label: dashboard.tabs.passkeys },
  { id: "hnw", label: dashboard.tabs.hnw, requiresHNW: true },
];

interface DashboardShellProps {
  children: (activeTab: DashboardTab, setActiveTab: (tab: DashboardTab) => void) => ReactNode;
  title?: string;
}

export default function DashboardShell({ children, title }: DashboardShellProps) {
  const { user, logout, isLoaded } = useAuth();
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-400">{dashboard.loading}</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">{dashboard.sessionTitle}</h2>
          <p className="text-gray-500 mb-4">{dashboard.sessionBody}</p>
          <a href="/login" className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            {dashboard.goToLogin}
          </a>
        </div>
      </div>
    );
  }

  const visibleTabs = TABS.filter((t) => !t.requiresHNW || user.isHNW);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-gray-900">{title || dashboard.title}</h1>
            <div className="flex items-center gap-4">
              {user.isHNW && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  {dashboard.extraChecks}
                </span>
              )}
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-500 capitalize">{user.role.toLowerCase()}</p>
              </div>
              <button onClick={logout} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition">
                {dashboard.logout}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-1 -mb-px overflow-x-auto">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children(activeTab, setActiveTab)}
      </main>
    </div>
  );
}
