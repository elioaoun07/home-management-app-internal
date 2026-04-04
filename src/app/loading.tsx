import { Skeleton } from "@/components/ui/skeleton";

export default function RootLoading() {
  return (
    <div className="min-h-screen bg-[var(--theme-bg)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-2xl" />
        <Skeleton className="h-3 w-32 rounded-full" />
      </div>
    </div>
  );
}
