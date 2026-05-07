import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B1B2B] px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-[440px]">
        {/* Logo */}
        <Link href="/" className="mb-6 flex items-center justify-center gap-2">
          <svg
            width="40"
            height="40"
            viewBox="0 0 36 36"
            fill="none"
            className="shrink-0"
          >
            <rect width="36" height="36" rx="8" fill="#FF6F3C" />
            <path
              d="M10 26V14l8-6 8 6v12h-5v-7h-6v7H10z"
              fill="white"
            />
          </svg>
          <span className="text-2xl font-bold text-white">Lodgist</span>
        </Link>

        {/* Tagline */}
        <p className="mb-8 text-center text-sm text-white/70">
          Nigeria{`'`}s Most Trusted Property Platform
        </p>

        {/* Card */}
        <div className="rounded-xl bg-white p-8 shadow-xl sm:p-10">
          {children}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-white/60">
          &copy; {new Date().getFullYear()} Lodgist. All rights reserved.
        </p>
      </div>
    </div>
  );
}
