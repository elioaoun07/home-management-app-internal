export type DayPlanIntent = "rest" | "balanced" | "productive";

export interface Checkpoint {
  id: string;
  time: string; // "HH:MM"
  label: string;
  done_at?: string | null;
}

export interface DayPlan {
  id: string;
  user_id: string;
  plan_date: string; // "YYYY-MM-DD"
  title: string | null;
  intent: DayPlanIntent | null;
  notes: string | null;
  checkpoints: Checkpoint[];
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface DayPlansResponse {
  mine: DayPlan | null;
  partner: DayPlan | null;
}
