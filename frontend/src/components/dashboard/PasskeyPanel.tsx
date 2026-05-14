"use client";

// ─── PasskeyPanel ──────────────────────────────────────────────────────────
// Dashboard tab for managing registered passkeys (list, register, delete).

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { authApi } from "@/lib/api";
import { isWebAuthnSupported, isPlatformAuthenticatorAvailable } from "@/lib/auth";
import type { PasskeyCredential } from "@/lib/types";

export default function PasskeyPanel() {
  const { registerPasskey } = useAuth();
  const [passkeys, setPasskeys] = useState<PasskeyCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Lazy initialisation — synchronous check, no effect needed
  const [passkeySupported] = useState(() => isWebAuthnSupported());
  const [platformAvailable, setPlatformAvailable] = useState(false);

  useEffect(() => {
    // Async platform check — must run asynchronously in an effect
    isPlatformAuthenticatorAvailable().then(setPlatformAvailable);
  }, []);

  const fetchPasskeys = useCallback(async () => {
    try {
      const res = await authApi.listPasskeys();
      if (res.success && res.data) {
        setPasskeys(res.data);
      }
    } catch {
      setError("Failed to load passkeys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPasskeys();
  }, [fetchPasskeys]);

  const handleRegister = async () => {
    setRegistering(true);
    setError(null);
    try {
      await registerPasskey();
      await fetchPasskeys();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setRegistering(false);
    }
  };

  const handleDelete = async (credentialId: string) => {
    setDeletingId(credentialId);
    setError(null);
    try {
      const res = await authApi.deletePasskey(credentialId);
      if (res.success) {
        setPasskeys((prev) => prev.filter((pk) => pk.credentialId !== credentialId));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete passkey");
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Passkey Management</h2>
          <p className="text-sm text-gray-500">
            Register and manage passkeys for passwordless authentication
          </p>
        </div>
        <button
          onClick={handleRegister}
          disabled={registering || !passkeySupported || !platformAvailable}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {registering ? "Registering..." : "➕ Add Passkey"}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Passkey Support Warning */}
      {!passkeySupported && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
          WebAuthn is not supported in this browser. Passkeys require a modern browser.
        </div>
      )}

      {/* Passkey List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-20 bg-gray-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : passkeys.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-4xl mb-3">🔑</p>
          <p className="text-gray-500 font-medium">No passkeys registered</p>
          <p className="text-sm text-gray-400 mt-1">
            Add a passkey for faster, passwordless login
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {passkeys.map((pk) => (
            <div
              key={pk.credentialId}
              className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-4"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                  {pk.deviceType === "platform" ? "📱" : "🔐"}
                </span>
                <div>
                  <p className="font-medium text-gray-900">
                    {pk.name}
                    {pk.backedUp && (
                      <span className="ml-2 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                        Synced
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {pk.deviceType === "platform" ? "Platform (built-in)" : "Cross-platform"}{" "}
                    · Created {formatDate(pk.createdAt)}
                    {pk.lastUsedAt && ` · Last used ${formatDate(pk.lastUsedAt)}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(pk.credentialId)}
                disabled={deletingId === pk.credentialId}
                className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md transition disabled:opacity-50"
              >
                {deletingId === pk.credentialId ? "Removing..." : "Remove"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
