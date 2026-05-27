import { cn } from "@/lib/utils";

export function TrustSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-xl border border-gray-100 bg-white p-4 shadow-sm space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div className="h-4 w-24 rounded bg-gray-200" />
        <div className="h-6 w-20 rounded-full bg-gray-200" />
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <div className="h-3.5 w-20 rounded bg-gray-200" />
          <div className="h-3.5 w-10 rounded bg-gray-200" />
        </div>
        <div className="h-2.5 w-full rounded-full bg-gray-200" />
        <div className="h-3 w-32 rounded bg-gray-100" />
      </div>
      <div className="border-t pt-3 space-y-3">
        <div className="h-4 w-36 rounded bg-gray-200" />
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-4 w-4 rounded-full bg-gray-200 shrink-0" />
            <div className="h-3.5 bg-gray-100 rounded flex-1" style={{ width: `${60 + (i % 3) * 15}%` }} />
            <div className="h-4 w-10 rounded-full bg-gray-100 shrink-0" />
          </div>
        ))}
      </div>
      <div className="h-10 w-full rounded-lg bg-gray-100" />
    </div>
  );
}

export default TrustSkeleton;
