// src/lib/catalogue/moduleRoles.ts
// Catalogue modules ERA owns by role (HUB-94). A role lives in
// settings_json.era_role, unique per user (catalogue_modules_era_role_uidx).
// A custom module the owner already named "Places"/"Locations" is adopted.

export interface RoleModule {
  type?: string;
  name?: string;
  settings_json?: Record<string, unknown> | null;
}

const PLACES_NAME_RE = /^(?:my\s+)?(?:places|locations)$/i;

export function isPlacesModule(m: RoleModule | null | undefined): boolean {
  if (!m) return false;
  if (m.settings_json?.era_role === "places") return true;
  return (m.type ?? "custom") === "custom" && PLACES_NAME_RE.test((m.name ?? "").trim());
}

/** The Places module: the role-marked one first, else one adopted by name. */
export function pickPlacesModule<T extends RoleModule>(modules: T[]): T | null {
  return (
    modules.find((m) => m.settings_json?.era_role === "places") ??
    modules.find((m) => isPlacesModule(m)) ??
    null
  );
}
