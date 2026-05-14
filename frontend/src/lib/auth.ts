// ─── Lodgist Auth Utilities ────────────────────────────────────────────────
// Client-side token management and passkey helper wrappers.

import type { User } from "./types";

// ─── Token Storage ─────────────────────────────────────────────────────────

const TOKEN_KEY = "lodgist_token";
const USER_KEY = "lodgist_user";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// ─── User Storage ──────────────────────────────────────────────────────────

export function setStoredUser(user: Pick<User, "id" | "email" | "name" | "role" | "isHNW">): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getStoredUser(): Pick<User, "id" | "email" | "name" | "role" | "isHNW"> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Pick<User, "id" | "email" | "name" | "role" | "isHNW">;
  } catch {
    return null;
  }
}

export function updateStoredUser(partial: Partial<Pick<User, "id" | "email" | "name" | "role" | "isHNW">>): void {
  const current = getStoredUser();
  if (current) {
    setStoredUser({ ...current, ...partial });
  }
}

// ─── Auth State Check ──────────────────────────────────────────────────────

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function isHNW(): boolean {
  const user = getStoredUser();
  return user?.isHNW ?? false;
}

// ─── WebAuthn / Passkey Helpers ────────────────────────────────────────────

/**
 * Check if the browser supports WebAuthn (FIDO2/Passkeys).
 */
export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined"
  );
}

/**
 * Check if the platform authenticator (i.e., built-in biometrics/TPM) is available.
 * This is async because the browser needs to query the authenticator.
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
    const available =
      await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch {
    return false;
  }
}

/**
 * Check if a conditional mediation (autofill) is available for passkeys.
 */
export async function isConditionalMediationAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
    const available =
      await PublicKeyCredential.isConditionalMediationAvailable();
    return available;
  } catch {
    return false;
  }
}

// ─── Logout ────────────────────────────────────────────────────────────────

export function logout(): void {
  removeToken();
  // Reload to reset all client state
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}
