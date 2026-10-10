"use client";

// ─── Lodgist AuthContext ───────────────────────────────────────────────────
// React context providing authentication state, login/register/logout,
// passkey registration/authentication, and HNW status.

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import type { User } from "@/lib/types";
import {
  getToken,
  setToken,
  setStoredUser,
  getStoredUser,
  logout as doLogout,
} from "@/lib/auth";
import { authApi } from "@/lib/api";
import { track } from "@/lib/gtag";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AuthState {
  /** Whether we've finished checking stored auth on mount */
  isLoaded: boolean;
  /** Currently authenticated user, or null */
  user: Pick<User, "id" | "email" | "name" | "role" | "isHNW"> | null;
  /** Auth token */
  token: string | null;
}

export interface AuthContextValue extends AuthState {
  /** Register a new user with email + password */
  register: (email: string, password: string, name: string, phone?: string) => Promise<void>;
  /** Login with email + password */
  login: (email: string, password: string) => Promise<void>;
  /** Logout — clears token, user, and redirects to /login */
  logout: () => void;
  /** Register a passkey for the current user (FIDO2 ceremony) */
  registerPasskey: () => Promise<void>;
  /** Login with a passkey (FIDO2 ceremony) */
  loginWithPasskey: (email?: string) => Promise<void>;
  /** Refresh the user state from stored data */
  refreshUser: () => void;
  /** Update local user data (e.g., after HNW verification) */
  updateUser: (partial: Partial<Pick<User, "id" | "email" | "name" | "role" | "isHNW">>) => void;
}

// ─── Context ───────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  // Initialise from stored values synchronously
  const [state, setState] = useState<AuthState>(() => {
    if (typeof window !== "undefined") {
      const token = getToken();
      const user = getStoredUser();
      return { isLoaded: token !== null, user, token };
    }
    return { isLoaded: false, user: null, token: null };
  });

  // A signed-out visitor has no token, so the initialiser above leaves
  // isLoaded false. Finish the stored-auth check on mount so pages that wait
  // on isLoaded (admin queues, dashboard) show a sign-in state instead of
  // "Loading" forever.
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setState((prev) => (prev.isLoaded ? prev : { isLoaded: true, token: getToken(), user: getStoredUser() }));
    });
    return () => { active = false; };
  }, []);

  // ── Core Auth Methods ──

  const register = useCallback(
    async (email: string, password: string, name: string, phone?: string) => {
      const res = await authApi.register({ email, password, name, phone });
      setToken(res.token);
      setStoredUser(res.user);
      setState({ isLoaded: true, user: res.user, token: res.token });
      track("sign_up", { method: "email", ...(res.user?.role && { role: res.user.role }) });
    },
    []
  );

  const loginFn = useCallback(async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    if (!res.success || !res.data || !res.data.token) {
      throw new Error(res.message || "We could not sign you in. Check your email and password, or create an account.");
    }
    setToken(res.data.token);
    setStoredUser(res.data.user);
    setState({ isLoaded: true, user: res.data.user, token: res.data.token });
    track("login", { method: "email" });
  }, []);

  const logout = useCallback(() => {
    doLogout();
    setState({ isLoaded: true, user: null, token: null });
  }, []);

  // ── Passkey Methods ──
  // NOTE: Server returns options through JSON serialisation. At runtime the
  // data is compatible with @simplewebauthn/browser v13's optionsJSON API;
  // the type assertion below bridges the TypeScript type mismatch.

  const registerPasskey = useCallback(async () => {
    const currentUser = state.user;
    if (!currentUser) throw new Error("You must be logged in to register a passkey");

    const optionsRes = await authApi.passkeyRegisterOptions(currentUser.id);
    if (!optionsRes.success || !optionsRes.options) {
      throw new Error("Failed to get passkey registration options");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const credential = await startRegistration({ optionsJSON: optionsRes.options as any });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const verifyRes = await authApi.passkeyRegisterVerify(currentUser.id, credential as any);
    if (!verifyRes.success) {
      throw new Error(verifyRes.message || "Passkey registration failed");
    }
  }, [state.user]);

  const loginWithPasskey = useCallback(async (email?: string) => {
    const optionsRes = await authApi.passkeyLoginOptions(email);
    if (!optionsRes.success || !optionsRes.options) {
      throw new Error("Failed to get passkey authentication options");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const credential = await startAuthentication({ optionsJSON: optionsRes.options as any });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const verifyRes = await authApi.passkeyLoginVerify(credential as any);
    if (!verifyRes.token) {
      throw new Error("Passkey login failed");
    }

    setToken(verifyRes.token);
    setStoredUser(verifyRes.user);
    setState({ isLoaded: true, user: verifyRes.user, token: verifyRes.token });
  }, []);

  // ── Utility Methods ──

  const refreshUser = useCallback(() => {
    const user = getStoredUser();
    setState((prev) => ({ ...prev, user }));
  }, []);

  const updateUser = useCallback(
    (partial: Partial<Pick<User, "id" | "email" | "name" | "role" | "isHNW">>) => {
      const current = getStoredUser();
      if (current) {
        const updated = { ...current, ...partial };
        setStoredUser(updated);
        setState((prev) => ({ ...prev, user: updated }));
      }
    },
    []
  );

  // ── Render ──

  return (
    <AuthContext.Provider
      value={{
        ...state,
        register,
        login: loginFn,
        logout,
        registerPasskey,
        loginWithPasskey,
        refreshUser,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }
  return ctx;
}
