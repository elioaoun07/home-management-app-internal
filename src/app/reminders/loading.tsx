import { Skeleton } from "@/components/ui/skeleton";

export default function RemindersLoading() {
  return (
    <div className="min-h-screen bg-[var(--theme-bg)] pb-32">
      <div className="p-4 space-y-4">
        {/* Quick stats — 3-column grid */}
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-4 rounded-xl bg-white/5 flex flex-col items-center gap-2"
            >
              <Skeleton className="h-7 w-10" />
              <Skeleton className="h-3 w-14" />
            </div>
          ))}
        </div>

        {/* Focus card — next item due */}
        <div className="p-5 rounded-2xl bg-white/5 space-y-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-48" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>

        {/* Section: Overdue */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          {[1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 rounded-xl bg-white/5"
            >
              <Skeleton className="h-5 w-5 rounded" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-6 w-6 rounded-full" />
            </div>
          ))}
        </div>

        {/* Section: Today */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-14" />
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 rounded-xl bg-white/5"
            >
              <Skeleton className="h-5 w-5 rounded" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-6 w-6 rounded-full" />
            </div>
          ))}
        </div>

        {/* Section: Upcoming */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          {[1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 rounded-xl bg-white/5"
            >
              <Skeleton className="h-5 w-5 rounded" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-6 w-6 rounded-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom nav placeholder */}
      <div className="fixed bottom-0 left-0 right-0 h-[72px] bg-white/5" />
    </div>
  );
}
