import { Skeleton } from "@/components/ui/skeleton";

function WidgetSkeleton({ height = 180 }: { height?: number }) {
  return (
    <div className="rounded-xl overflow-hidden bg-white/[0.03] border border-white/[0.06] animate-pulse">
      <div className="px-4 pt-3 pb-1">
        <div className="h-3 w-24 rounded bg-white/10" />
      </div>
      <div className="px-4 pb-4 pt-1">
        <div className="rounded-lg bg-white/5" style={{ height }} />
      </div>
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[var(--theme-bg)] pb-32">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Tab bar */}
        <div className="flex gap-2 py-2">
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="h-9 w-20 rounded-full" />
          <Skeleton className="h-9 w-16 rounded-full" />
          <Skeleton className="h-9 w-20 rounded-full" />
        </div>

        {/* Date range + filter controls */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40 rounded-lg" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        </div>

        {/* Widget grid */}
        <div className="grid grid-cols-1 gap-4">
          <WidgetSkeleton height={120} />
          <WidgetSkeleton height={200} />
          <div className="grid grid-cols-2 gap-4">
            <WidgetSkeleton height={140} />
            <WidgetSkeleton height={140} />
          </div>
          <WidgetSkeleton height={220} />
          <WidgetSkeleton height={180} />
        </div>
      </div>

      {/* Bottom nav placeholder */}
      <div className="fixed bottom-0 left-0 right-0 h-[72px] bg-white/5" />
    </div>
  );
}
