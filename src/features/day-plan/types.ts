export type DayPlanIntent = "rest" | "balanced" | "productive";

export interface ChecklistItem {
  id: string;
  label: string;
  done_at?: string | null;
  sort_order: number;
}

export interface DayPlan {
  id: string;
  user_id: string;
  plan_date: string; // "YYYY-MM-DD"
  title: string | null;
  intent: DayPlanIntent | null;
  notes: string | null;
  checklist: ChecklistItem[];
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface DayPlansResponse {
  mine: DayPlan | null;
  partner: DayPlan | null;
}
