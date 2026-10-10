import type { Metadata } from "next";
import { safeNextPath } from "@/lib/returnPath";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

// Server component: ?next is read and validated here, so the form itself is in
// the server HTML instead of an empty client-only fallback.
export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(typeof next === "string" ? next : null);
  return <LoginForm nextPath={nextPath} />;
}
