// src/features/healthcare/types.ts

export type AllergySeverity = "mild" | "moderate" | "severe" | "anaphylaxis";
export type HealthConditionKind = "condition" | "surgery" | "doctor_visit";
export type HealthConditionStatus = "active" | "resolved";
export type BloodType = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
/** course = fixed dose times until the course is done; as_needed = taken based on how you feel. */
export type MedicationMode = "course" | "as_needed";
export type MedicationFoodTiming = "any" | "empty_stomach" | "with_food";

export interface HealthProfile {
  id: string;
  managing_user_id: string;
  /** Account holder this profile belongs to; null = dependent (child, parent). */
  user_id: string | null;
  name: string;
  date_of_birth: string | null;
  blood_type: BloodType | null;
  notes: string | null;
  shared_with_household: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface HealthAllergy {
  id: string;
  profile_id: string;
  managing_user_id: string;
  allergen: string;
  severity: AllergySeverity;
  reaction_notes: string | null;
  /** Ingredient match terms for recipe warnings — user-editable. */
  keywords: string[];
  created_at: string;
  updated_at: string;
}

export interface HealthCondition {
  id: string;
  profile_id: string;
  managing_user_id: string;
  kind: HealthConditionKind;
  title: string;
  notes: string | null;
  occurred_on: string | null;
  status: HealthConditionStatus;
  catalogue_item_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface HealthVaccine {
  id: string;
  profile_id: string;
  managing_user_id: string;
  vaccine_name: string;
  dose_label: string | null;
  administered_on: string | null;
  next_due_on: string | null;
  provider: string | null;
  lot_number: string | null;
  notes: string | null;
  catalogue_item_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface HealthMedication {
  id: string;
  profile_id: string;
  managing_user_id: string;
  name: string;
  /** Free text — "1 pill", "500 mg", "5 ml". */
  dosage: string | null;
  mode: MedicationMode;
  food_timing: MedicationFoodTiming;
  /** Wall-clock "HH:MM" in `timezone` (course only). */
  dose_times: string[];
  /** IANA zone the dose times are expressed in. */
  timezone: string;
  /** First dose — slots before it don't exist. */
  starts_at: string;
  /** Exclusive end; null = ongoing. */
  ends_at: string | null;
  min_hours_between: number | null;
  max_per_day: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface HealthMedicationLog {
  id: string;
  medication_id: string;
  managing_user_id: string;
  /** Course dose slot; null = as-needed dose. */
  scheduled_at: string | null;
  taken_at: string;
  created_at: string;
}

/** Shape returned by the get_health_bundle() RPC (one call for the page). */
export interface HealthBundle {
  profiles: HealthProfile[];
  allergies: HealthAllergy[];
  conditions: HealthCondition[];
  vaccines: HealthVaccine[];
  medications: HealthMedication[];
  medication_logs: HealthMedicationLog[];
}

export interface CreateHealthProfileDTO {
  name: string;
  /** true = this profile is the current account holder themself */
  is_self?: boolean;
  date_of_birth?: string | null;
  blood_type?: BloodType | null;
  notes?: string | null;
  shared_with_household?: boolean;
}

export type UpdateHealthProfileDTO = Partial<Omit<CreateHealthProfileDTO, "is_self">>;

export interface CreateHealthAllergyDTO {
  profile_id: string;
  allergen: string;
  severity?: AllergySeverity;
  reaction_notes?: string | null;
  /** Omit to have the server seed keywords from the synonym map. */
  keywords?: string[];
}

export type UpdateHealthAllergyDTO = Partial<Omit<CreateHealthAllergyDTO, "profile_id">>;

export interface CreateHealthConditionDTO {
  profile_id: string;
  kind: HealthConditionKind;
  title: string;
  notes?: string | null;
  occurred_on?: string | null;
  status?: HealthConditionStatus;
  catalogue_item_id?: string | null;
}

export type UpdateHealthConditionDTO = Partial<Omit<CreateHealthConditionDTO, "profile_id">>;

export interface CreateHealthVaccineDTO {
  profile_id: string;
  vaccine_name: string;
  dose_label?: string | null;
  administered_on?: string | null;
  next_due_on?: string | null;
  provider?: string | null;
  lot_number?: string | null;
  notes?: string | null;
  catalogue_item_id?: string | null;
}

export type UpdateHealthVaccineDTO = Partial<Omit<CreateHealthVaccineDTO, "profile_id">>;

/** Full editable payload — PATCH replaces every field (the form always sends all). */
export interface SaveHealthMedicationDTO {
  name: string;
  dosage: string | null;
  mode: MedicationMode;
  food_timing: MedicationFoodTiming;
  dose_times: string[];
  timezone: string;
  starts_at: string;
  ends_at: string | null;
  min_hours_between: number | null;
  max_per_day: number | null;
  notes: string | null;
}

export interface CreateHealthMedicationDTO extends SaveHealthMedicationDTO {
  profile_id: string;
}

export interface SetMedicationDoseDTO {
  medication_id: string;
  taken: boolean;
  /** Course dose slot (ISO). */
  scheduled_at?: string | null;
  /** As-needed dose id — client-generated so a retry can't double-log. */
  log_id?: string | null;
  taken_at?: string | null;
}
