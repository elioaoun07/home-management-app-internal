// src/app/pm/live/page.tsx
// Thin route wrapper. Access is gated by src/middleware.ts (matcher includes /pm/live).
//
// Command Center Phase 4 (R63): /pm/live mounts the same Command Center views as
// `pnpm pm`, over the authenticated relay. The earlier relay UI stays reachable at
// `?ui=legacy` as the rollback until real phone acceptance, and still opens the V1
// session links older notifications carry (`?view=delivery&session=<id>`).
import { PmLiveApp } from "@/components/pm-live/PmLiveApp";
import { CommandCenterEntry } from "./CommandCenterEntry";

export default async function PmLivePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  if (params.ui === "legacy" || typeof params.session === "string") return <PmLiveApp />;
  return <CommandCenterEntry view={typeof params.view === "string" ? params.view : null} />;
}
