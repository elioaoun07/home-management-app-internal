// src/app/pm/live/page.tsx
// Thin route wrapper — real UI lives in components/.
// Access is gated by src/middleware.ts (matcher includes /pm/live).
import { PmLiveApp } from "@/components/pm-live/PmLiveApp";

export default function PmLivePage() {
  return <PmLiveApp />;
}
