/** Planning facts only. Titles, acceptance and completion belong to the corpus. */
export interface SprintMember {
  workId: string;
  origin: { file: string; alias: string };
  points: number | null;
  reviewMinutes: number | null;
  estimateSource?: "effort" | "override";
  deliverableId?: string;
  carriedFromSprintId?: string;
}
export interface Sprint {
  id: string;
  name: string;
  goal: string;
  startDate: string;
  endExclusive: string;
  timezone: string;
  state: "draft" | "active" | "closed";
  strategy: "balanced" | "module";
  capacity: { unit: "points"; available: number; reviewMinutes: number };
  members: SprintMember[];
  commitment: {
    at: string;
    goal: string;
    members: (SprintMember & { criteriaRevision: string })[];
  } | null;
  scopeChanges: {
    at: string;
    action: "add" | "remove" | "carryover";
    workId: string;
    member: SprintMember;
    criteriaRevision?: string | null;
    fromSprintId?: string;
  }[];
  closed: {
    at: string;
    delivered: string[];
    cancelled: string[];
    carryover: string[];
  } | null;
}
export interface Planning {
  schema: "pm-planning@1";
  revision: number;
  sprints: Sprint[];
  deliverables: { id: string; title: string; targetDate?: string }[];
  commands?: { id: string; hash: string; revision: number }[];
}
export interface PlanningReadiness {
  status: "open" | "completed" | "cancelled" | "unresolved";
  state: "ready" | "needs-input" | "blocked";
  criteriaRevision: string | null;
  effort: string | null;
  reasons: { code: string; with?: string | null }[];
  dependencies: string[];
  file: string;
}
