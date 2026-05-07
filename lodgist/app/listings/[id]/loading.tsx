import { Skeleton } from "@/components/ui/skeleton";

export default function ListingDetailLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb skeleton */}
      <div className="mx-auto max-w-7xl px-4 pt-6 pb-2 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-2" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-2" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
          {/* ── LEFT COLUMN ──────────────────────────────────────────────── */}
          <div className="space-y-8">
            {/* Image gallery skeleton */}
            <Skeleton className="aspect-[16/9] w-full rounded-xl" />

            {/* Property info skeleton */}
            <div className="rounded-xl border bg-white p-6 sm:p-8">
              <div className="space-y-3">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex gap-3">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
              <div className="mt-6 flex gap-6 border-t pt-6">
                <Skeleton className="h-12 w-24" />
                <Skeleton className="h-12 w-24" />
                <Skeleton className="h-12 w-24" />
              </div>
              <div className="mt-6 border-t pt-6 space-y-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
              </div>
            </div>

            {/* Truth Index skeleton */}
            <div className="rounded-xl border bg-white p-6">
              <Skeleton className="mb-4 h-6 w-32" />
              <div className="flex justify-center py-4">
                <Skeleton className="h-24 w-24 rounded-full" />
              </div>
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                    <Skeleton className="h-2 w-full rounded-full" />
                  </div>
                ))}
              </div>
            </div>

            {/* Reviews skeleton */}
            <div className="rounded-xl border bg-white p-6">
              <Skeleton className="mb-4 h-6 w-24" />
              <Skeleton className="h-24 w-full rounded-lg" />
              <div className="mt-4 space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN ─────────────────────────────────────────────── */}
          <div className="space-y-6">
            {/* Landlord card skeleton */}
            <div className="rounded-xl border bg-white p-6">
              <div className="flex items-start gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="space-y-1 text-center">
                    <Skeleton className="mx-auto h-5 w-16" />
                    <Skeleton className="mx-auto h-3 w-20" />
                  </div>
                ))}
              </div>
              <Skeleton className="mt-4 h-10 w-full rounded-lg" />
            </div>

            {/* Booking form skeleton */}
            <div className="rounded-xl border bg-white p-6">
              <Skeleton className="mb-4 h-6 w-36" />
              <div className="space-y-3">
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-20 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            </div>

            {/* Report fraud skeleton */}
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
