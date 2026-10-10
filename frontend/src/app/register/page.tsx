import type { Metadata } from "next";
import { safeNextPath } from "@/lib/returnPath";
import RegisterForm from "./RegisterForm";

export const metadata: Metadata = { title: "Create an account" };

// Server component: ?next is read and validated here, so the form itself is in
// the server HTML instead of an empty client-only fallback.
export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(typeof next === "string" ? next : null);
  return <RegisterForm nextPath={nextPath} />;
}
