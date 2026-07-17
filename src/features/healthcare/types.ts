// src/features/healthcare/types.ts

export type AllergySeverity = "mild" | "moderate" | "severe" | "anaphylaxis";
export type HealthConditionKind = "condition" | "surgery" | "doctor_visit";
export type HealthConditionStatus = "active" | "resolved";
export type BloodType = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";

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

/** Shape returned by the get_health_bundle() RPC (one call for the page). */
export interface HealthBundle {
  profiles: HealthProfile[];
  allergies: HealthAllergy[];
  conditions: HealthCondition[];
  vaccines: HealthVaccine[];
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
