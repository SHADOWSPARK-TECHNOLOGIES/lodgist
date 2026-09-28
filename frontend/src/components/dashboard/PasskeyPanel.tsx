"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { authApi } from "@/lib/api";
import { isWebAuthnSupported, isPlatformAuthenticatorAvailable } from "@/lib/auth";
import { passkeys } from "@/lib/copy";
import type { PasskeyCredential } from "@/lib/types";

export default function PasskeyPanel() {
  const { registerPasskey } = useAuth();
  const [items, setItems] = useState<PasskeyCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [passkeySupported] = useState(() => isWebAuthnSupported());
  const [platformAvailable, setPlatformAvailable] = useState(false);

  useEffect(() => {
    isPlatformAuthenticatorAvailable().then(setPlatformAvailable);
  }, []);

  const fetchPasskeys = useCallback(async () => {
    try {
      const res = await authApi.listPasskeys();
      if (res.success && res.data) setItems(res.data);
    } catch {
      setError(passkeys.loadFailed);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPasskeys();
  }, [fetchPasskeys]);

  const handleRegister = async () => {
    setRegistering(true);
    setError(null);
    try {
      await registerPasskey();
      await fetchPasskeys();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : passkeys.registerFailed);
    } finally {
      setRegistering(false);
    }
  };

  const handleDelete = async (credentialId: string) => {
    setDeletingId(credentialId);
    setError(null);
    try {
      const res = await authApi.deletePasskey(credentialId);
      if (res.success) setItems((prev) => prev.filter((pk) => pk.credentialId !== credentialId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : passkeys.deleteFailed);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-NG", {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{passkeys.title}</h2>
          <p className="text-sm text-gray-500">{passkeys.subtitle}</p>
        </div>
        <button
          onClick={handleRegister}
          disabled={registering || !passkeySupported || !platformAvailable}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {registering ? passkeys.adding : passkeys.add}
        </button>
      </div>
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      {!passkeySupported && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">{passkeys.unsupported}</div>
      )}
      {loading ? (
        <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500 font-medium">{passkeys.emptyTitle}</p>
          <p className="text-sm text-gray-400 mt-1">{passkeys.emptyBody}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((pk) => (
            <div key={pk.credentialId} className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-4">
              <div>
                <p className="font-medium text-gray-900">
                  {pk.name}
                  {pk.backedUp && <span className="ml-2 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{passkeys.synced}</span>}
                </p>
                <p className="text-xs text-gray-500">
                  {pk.deviceType === "platform" ? passkeys.thisPhone : passkeys.otherDevice}
                  {" \u00b7 "}{passkeys.created} {formatDate(pk.createdAt)}
                  {pk.lastUsedAt ? ` \u00b7 ${passkeys.lastUsed} ${formatDate(pk.lastUsedAt)}` : ""}
                </p>
              </div>
              <button onClick={() => handleDelete(pk.credentialId)} disabled={deletingId === pk.credentialId} className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md transition disabled:opacity-50">
                {deletingId === pk.credentialId ? passkeys.removing : passkeys.remove}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
