// src/types/catalogue.ts

export type UUID = string;

// =============================================================================
// MODULE TYPES
// =============================================================================

export type CatalogueModuleType =
  | "budget" // Desired purchases, savings goals
  | "recipe" // Meal planning, recipes
  | "tasks" // Personal/work tasks
  | "healthcare" // Doctors, exams, allergies
  | "trips" // Travel destinations, journeys
  | "fitness" // Gym workouts, exercises
  | "learning" // Skills, courses, practice tracking
  | "contacts" // Important contacts by category
  | "documents" // Important documents tracking
  | "movies" // Movies to watch, watched, favorites
  | "inventory" // Home inventory with barcode scanning
  | "custom"; // User-defined modules

export const MODULE_TYPE_LABELS: Record<CatalogueModuleType, string> = {
  budget: "Budget & Wishlist",
  recipe: "Recipes",
  tasks: "Tasks",
  healthcare: "Healthcare",
  trips: "Trips & Travel",
  fitness: "Fitness",
  learning: "Learning & Skills",
  contacts: "Contacts",
  documents: "Documents",
  movies: "Movies & Shows",
  inventory: "Home Inventory",
  custom: "Custom",
};

export const MODULE_ICONS: Record<CatalogueModuleType, string> = {
  budget: "wallet",
  recipe: "chef-hat",
  tasks: "check-square",
  healthcare: "heart-pulse",
  trips: "plane",
  fitness: "dumbbell",
  learning: "graduation-cap",
  contacts: "users",
  documents: "file-text",
  movies: "film",
  inventory: "package",
  custom: "folder",
};

export const MODULE_COLORS: Record<
  CatalogueModuleType,
  { color: string; from: string; to: string }
> = {
  budget: { color: "#10b981", from: "#10b981", to: "#059669" },
  recipe: { color: "#f59e0b", from: "#f59e0b", to: "#d97706" },
  tasks: { color: "#8b5cf6", from: "#8b5cf6", to: "#7c3aed" },
  healthcare: { color: "#ef4444", from: "#ef4444", to: "#dc2626" },
  trips: { color: "#06b6d4", from: "#06b6d4", to: "#0891b2" },
  fitness: { color: "#ec4899", from: "#ec4899", to: "#db2777" },
  learning: { color: "#6366f1", from: "#6366f1", to: "#4f46e5" },
  contacts: { color: "#14b8a6", from: "#14b8a6", to: "#0d9488" },
  documents: { color: "#64748b", from: "#64748b", to: "#475569" },
  movies: { color: "#a855f7", from: "#a855f7", to: "#9333ea" },
  inventory: { color: "#f97316", from: "#f97316", to: "#ea580c" },
  custom: { color: "#3b82f6", from: "#3b82f6", to: "#2563eb" },
};

// =============================================================================
// ITEM STATUS & PRIORITY
// =============================================================================

export type CatalogueItemStatus =
  | "active"
  | "completed"
  | "in_progress"
  | "paused"
  | "cancelled"
  | "archived";

export type CataloguePriority =
  | "low"
  | "normal"
  | "high"
  | "urgent"
  | "critical";

export const STATUS_LABELS: Record<CatalogueItemStatus, string> = {
  active: "Active",
  completed: "Completed",
  in_progress: "In Progress",
  paused: "Paused",
  cancelled: "Cancelled",
  archived: "Archived",
};

export const STATUS_COLORS: Record<CatalogueItemStatus, string> = {
  active: "#10b981",
  completed: "#22c55e",
  in_progress: "#3b82f6",
  paused: "#f59e0b",
  cancelled: "#6b7280",
  archived: "#64748b",
};

export const PRIORITY_LABELS: Record<CataloguePriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
  critical: "Critical",
};

export const PRIORITY_COLORS: Record<CataloguePriority, string> = {
  low: "#10b981",
  normal: "#3b82f6",
  high: "#f59e0b",
  urgent: "#f97316",
  critical: "#ef4444",
};

// =============================================================================
// CORE TYPES
// =============================================================================

export interface CatalogueModule {
  id: UUID;
  user_id: UUID;
  type: CatalogueModuleType;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  gradient_from: string | null;
  gradient_to: string | null;
  is_system: boolean;
  is_enabled: boolean;
  position: number;
  settings_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Virtual fields (populated in queries)
  category_count?: number;
  item_count?: number;
}

export interface CatalogueCategory {
  id: UUID;
  user_id: UUID;
  module_id: UUID;
  name: string;
  description: string | null;
  parent_id: UUID | null;
  depth: number;
  path: string;
  icon: string | null;
  color: string | null;
  position: number;
  is_expanded: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  // Virtual fields
  item_count?: number;
  children?: CatalogueCategory[];
}

export interface CatalogueItem {
  id: UUID;
  user_id: UUID;
  module_id: UUID;
  category_id: UUID | null;
  name: string;
  description: string | null;
  notes: string | null;
  status: CatalogueItemStatus;
  priority: CataloguePriority;
  icon: string | null;
  color: string | null;
  image_url: string | null;
  position: number;
  is_pinned: boolean;
  is_favorite: boolean;
  tags: string[];
  metadata_json: Record<string, unknown>;
  progress_current: number | null;
  progress_target: number | null;
  progress_unit: string | null;
  next_due_date: string | null;
  frequency: string | null;
  last_completed_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  // Virtual fields
  sub_items?: CatalogueSubItem[];
  category?: CatalogueCategory;
}

export interface CatalogueSubItem {
  id: UUID;
  user_id: UUID;
  item_id: UUID;
  name: string;
  description: string | null;
  is_completed: boolean;
  completed_at: string | null;
  position: number;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// INPUT TYPES
// =============================================================================

export interface CreateModuleInput {
  type?: CatalogueModuleType;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  gradient_from?: string;
  gradient_to?: string;
}

export interface UpdateModuleInput {
  id: UUID;
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  gradient_from?: string;
  gradient_to?: string;
  is_enabled?: boolean;
  position?: number;
  settings_json?: Record<string, unknown>;
}

export interface CreateCategoryInput {
  module_id: UUID;
  name: string;
  description?: string;
  parent_id?: UUID;
  icon?: string;
  color?: string;
}

export interface UpdateCategoryInput {
  id: UUID;
  name?: string;
  description?: string;
  parent_id?: UUID;
  icon?: string;
  color?: string;
  position?: number;
  is_expanded?: boolean;
}

export interface CreateItemInput {
  module_id: UUID;
  category_id?: UUID;
  name: string;
  description?: string;
  notes?: string;
  status?: CatalogueItemStatus;
  priority?: CataloguePriority;
  icon?: string;
  color?: string;
  image_url?: string;
  tags?: string[];
  metadata_json?: Record<string, unknown>;
  progress_current?: number;
  progress_target?: number;
  progress_unit?: string;
  next_due_date?: string;
  frequency?: string;
}

export interface UpdateItemInput {
  id: UUID;
  category_id?: UUID | null;
  name?: string;
  description?: string;
  notes?: string;
  status?: CatalogueItemStatus;
  priority?: CataloguePriority;
  icon?: string;
  color?: string;
  image_url?: string;
  is_pinned?: boolean;
  is_favorite?: boolean;
  tags?: string[];
  metadata_json?: Record<string, unknown>;
  progress_current?: number;
  progress_target?: number;
  progress_unit?: string;
  next_due_date?: string;
  frequency?: string;
  position?: number;
}

export interface CreateSubItemInput {
  item_id: UUID;
  name: string;
  description?: string;
  metadata_json?: Record<string, unknown>;
}

export interface UpdateSubItemInput {
  id: UUID;
  name?: string;
  description?: string;
  is_completed?: boolean;
  position?: number;
  metadata_json?: Record<string, unknown>;
}

// =============================================================================
// MODULE-SPECIFIC METADATA TYPES
// =============================================================================

export interface BudgetItemMetadata {
  target_amount?: number;
  current_saved?: number;
  price_range?: { min: number; max: number };
  where_to_buy?: string;
  links?: { label: string; url: string }[];
}

export interface RecipeItemMetadata {
  servings?: number;
  prep_time_mins?: number;
  cook_time_mins?: number;
  ingredients?: { name: string; quantity: string; unit: string }[];
  steps?: string[];
  dietary_tags?: string[];
  source_url?: string;
}

export interface TaskItemMetadata {
  due_date?: string;
  estimated_duration_mins?: number;
  assigned_to?: string;
  subtasks?: { name: string; completed: boolean }[];
  context?: string; // 'home', 'office', 'errands', etc.
}

export interface HealthcareItemMetadata {
  doctor_name?: string;
  specialty?: string;
  phone?: string;
  email?: string;
  address?: string;
  clinic_name?: string;
  frequency?: string;
  last_visit?: string;
  next_appointment?: string;
  notes?: string;
}

export interface TripItemMetadata {
  location?: string;
  country?: string;
  region?: string;
  estimated_cost?: number;
  best_season?: string;
  duration_days?: number;
  activities?: string[];
  accommodation_ideas?: string[];
  transportation?: string;
}

export interface FitnessItemMetadata {
  muscle_groups?: string[];
  equipment?: string[];
  sets?: number;
  reps?: number;
  weight?: number;
  duration_mins?: number;
  rest_between_sets?: number;
  video_url?: string;
  schedule?: string[]; // days of week
}

export interface LearningItemMetadata {
  skill_level?: "beginner" | "intermediate" | "advanced" | "expert";
  total_hours?: number;
  completed_hours?: number;
  progress_percent?: number;
  resources?: { title: string; url: string; type: string }[];
  milestones?: { name: string; target_date: string; completed: boolean }[];
  practice_log?: { date: string; duration_mins: number; notes: string }[];
}

export interface ContactItemMetadata {
  phone?: string;
  email?: string;
  address?: string;
  relationship?: string;
  birthday?: string;
  company?: string;
  job_title?: string;
  notes?: string;
  social_links?: { platform: string; url: string }[];
}

export interface DocumentItemMetadata {
  document_type?: string;
  issue_date?: string;
  expiry_date?: string;
  issuer?: string;
  document_number?: string;
  file_url?: string;
  reminder_before_days?: number;
}

// =============================================================================
// QUERY/FILTER TYPES
// =============================================================================

export interface CatalogueFilters {
  module_id?: UUID;
  category_id?: UUID;
  status?: CatalogueItemStatus | CatalogueItemStatus[];
  priority?: CataloguePriority | CataloguePriority[];
  is_pinned?: boolean;
  is_favorite?: boolean;
  tags?: string[];
  search?: string;
  has_due_date?: boolean;
  due_before?: string;
  due_after?: string;
}

export interface CatalogueSortOptions {
  field:
    | "position"
    | "name"
    | "created_at"
    | "updated_at"
    | "priority"
    | "next_due_date";
  direction: "asc" | "desc";
}

// =============================================================================
// AGGREGATE TYPES
// =============================================================================

export interface CatalogueStats {
  total_items: number;
  by_status: Record<CatalogueItemStatus, number>;
  by_priority: Record<CataloguePriority, number>;
  by_module: Record<UUID, number>;
  upcoming_due: number;
  overdue: number;
}

export interface ModuleWithDetails extends CatalogueModule {
  categories: CatalogueCategory[];
  recent_items: CatalogueItem[];
  stats: {
    total_items: number;
    completed_items: number;
    in_progress_items: number;
  };
}
