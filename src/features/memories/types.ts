export interface Memory {
  id: string;
  household_id: string;
  created_by: string;
  label: string;
  value: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface MemoryInsert {
  label: string;
  value: string;
  tags?: string[];
}
