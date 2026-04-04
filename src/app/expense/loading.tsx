import { Skeleton } from "@/components/ui/skeleton";

export default function ExpenseLoading() {
  return (
    <main className="h-[100dvh] overflow-hidden bg-[var(--theme-bg)]">
      {/* Header area with progress indicator */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      {/* Progress bar */}
      <div className="px-4 pb-3">
        <Skeleton className="h-1 w-full rounded-full" />
      </div>

      {/* Inline tags row */}
      <div className="px-4 pb-4 flex gap-2">
        <Skeleton className="h-7 w-20 rounded-full" />
        <Skeleton className="h-7 w-16 rounded-full" />
        <Skeleton className="h-7 w-24 rounded-full" />
      </div>

      {/* Hero amount card */}
      <div className="px-4 pb-4">
        <div className="rounded-2xl bg-white/5 p-6 space-y-4">
          <Skeleton className="h-4 w-16 mx-auto" />
          <Skeleton className="h-12 w-40 mx-auto rounded-xl" />
          <div className="flex justify-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
        </div>
      </div>

      {/* LBP toggle row */}
      <div className="px-4 pb-4">
        <Skeleton className="h-8 w-32" />
      </div>

      {/* Account carousel placeholder */}
      <div className="px-4 space-y-3">
        <Skeleton className="h-4 w-20" />
        <div className="flex gap-3 overflow-hidden">
          <Skeleton className="h-20 w-32 rounded-xl shrink-0" />
          <Skeleton className="h-20 w-32 rounded-xl shrink-0" />
          <Skeleton className="h-20 w-32 rounded-xl shrink-0" />
          <Skeleton className="h-20 w-32 rounded-xl shrink-0" />
        </div>
      </div>

      {/* Bottom nav placeholder */}
      <div className="fixed bottom-0 left-0 right-0 h-[72px] bg-white/5" />
    </main>
  );
}
