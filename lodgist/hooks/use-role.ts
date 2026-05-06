import { useSession } from "next-auth/react";

/**
 * Safely reads the session, returning null during static generation
 * when no SessionProvider is available.
 */
function useSafeSession() {
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useSession();
  } catch {
    // Throws during static generation: "useSession must be wrapped in a
    // <SessionProvider />". We return null to indicate no session context.
    return null;
  }
}

export const useRole = () => {
  const sessionResult = useSafeSession();

  if (!sessionResult) {
    return {
      role: null,
      isLoading: true,
    };
  }

  return {
    role: (sessionResult.data as { user?: { role?: string } } | null)?.user?.role ?? null,
    isLoading: sessionResult.status === "loading",
  };
};

