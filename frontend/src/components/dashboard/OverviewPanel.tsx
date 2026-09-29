"use client";

// ─── OverviewPanel ─────────────────────────────────────────────────────────
// Dashboard overview tab showing key stats, TruthIndex, HNW status, and
// recent activity.

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { truthIndexApi } from "@/lib/api";
import { dashboard, auth, overview } from "@/lib/copy";
import type { TruthIndexResponse } from "@/lib/types";

export default function OverviewPanel() {
  const { user } = useAuth();
  const [truthIndex, setTruthIndex] = useState<TruthIndexResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    truthIndexApi
      .get(user.id)
      .then((res) => {
        if (res.success && res.data) setTruthIndex(res.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) return null;

  const truthScore = truthIndex?.truthIndex;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* TruthIndex Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">{dashboard.overview.truthScore}</p>
            <span className="text-2xl">🛡️</span>
          </div>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {loading ? (
              <span className="animate-pulse text-gray-300">--</span>
            ) : (
              truthScore != null ? `${Math.round(truthScore)}/100` : auth.notAvailable
            )}
          </p>
          <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                (truthScore ?? 0) >= 70
                  ? "bg-green-500"
                  : (truthScore ?? 0) >= 40
                  ? "bg-yellow-500"
                  : "bg-red-500"
              }`}
              style={{ width: `${truthScore ?? 0}%` }}
            />
          </div>
        </div>

        {/* HNW Status Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">{dashboard.overview.hnwStatus}</p>
            <span className="text-2xl">{user.isHNW ? "💎" : "🏦"}</span>
          </div>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {user.isHNW ? dashboard.hnw.verified : dashboard.hnw.standard}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {user.isHNW
              ? dashboard.hnw.verifiedDesc
              : dashboard.hnw.standardDesc}
          </p>
        </div>

        {/* Role Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">{dashboard.overview.accountType}</p>
            <span className="text-2xl">👤</span>
          </div>
          <p className="mt-2 text-3xl font-bold text-gray-900 capitalize">
            {user.role.toLowerCase()}
          </p>
          <p className="mt-1 text-xs text-gray-500">{user.email}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">{dashboard.overview.passkey}</p>
            <span className="text-2xl">🔑</span>
          </div>
          <p className="mt-2 text-xl font-bold text-gray-900">{dashboard.overview.signInMethod}</p>
          <p className="mt-1 text-xs text-gray-500">{dashboard.overview.signInBody}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{overview.quick}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <a
            href="/listings"
            className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
          >
            <span className="text-xl">🔍</span>
            <span className="text-sm font-medium text-gray-700">{overview.browse}</span>
          </a>
          {user.role === "LANDLORD" && (
            <a
              href="/listings/new"
              className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
            >
              <span className="text-xl">➕</span>
              <span className="text-sm font-medium text-gray-700">{overview.newListing}</span>
            </a>
          )}
          <button
            onClick={() => truthIndexApi.recalculate()}
            className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition text-left"
          >
            <span className="text-xl">🔄</span>
            <span className="text-sm font-medium text-gray-700">{overview.recalculate}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
