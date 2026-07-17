"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  useCreateHealthAllergy,
  useCreateHealthCondition,
  useCreateHealthProfile,
  useCreateHealthVaccine,
  useDeleteHealthAllergy,
  useDeleteHealthCondition,
  useDeleteHealthProfile,
  useDeleteHealthVaccine,
  useHealthBundle,
  useUpdateHealthAllergy,
  useUpdateHealthCondition,
  useUpdateHealthProfile,
  useUpdateHealthVaccine,
} from "@/features/healthcare/hooks";
import type {
  AllergySeverity,
  BloodType,
  HealthAllergy,
  HealthCondition,
  HealthConditionKind,
  HealthProfile,
  HealthVaccine,
} from "@/features/healthcare/types";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { deriveDefaultKeywords } from "@/lib/health/allergenMatch";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  HeartPulse,
  Loader2,
  Pencil,
  Plus,
  Stethoscope,
  Syringe,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

const SEVERITIES: AllergySeverity[] = ["mild", "moderate", "severe", "anaphylaxis"];
const BLOOD_TYPES: BloodType[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const CONDITION_KINDS: Array<{ value: HealthConditionKind; label: string }> = [
  { value: "condition", label: "Condition" },
  { value: "surgery", label: "Surgery" },
  { value: "doctor_visit", label: "Doctor visit" },
];

// Severity chips: amber/orange ramp; red is deliberately reserved for
// anaphylaxis — a safety-critical medical flag, not a decorative row color.
const SEVERITY_STYLES: Record<AllergySeverity, string> = {
  mild: "bg-cyan-500/10 text-cyan-300",
  moderate: "bg-amber-500/10 text-amber-300",
  severe: "bg-orange-500/10 text-orange-300",
  anaphylaxis: "bg-red-500/10 text-red-300",
};

const inputCls =
  "w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-white/30";
const labelCls = "block text-xs text-white/60 mb-1";

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const tc = useThemeClasses();
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      {/* Floating panel: opaque page background (Hard Rule 15 — never glass). */}
      <div
        className={cn(
          "relative w-full sm:max-w-md max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-white/10 p-5",
          tc.bgPage,
        )}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-medium text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 -m-2 text-white/60 hover:text-white"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Profile form ─────────────────────────────────────────────────────────────

function ProfileForm({
  existing,
  onClose,
}: {
  existing: HealthProfile | null;
  onClose: () => void;
}) {
  const create = useCreateHealthProfile();
  const update = useUpdateHealthProfile();
  const [name, setName] = useState(existing?.name ?? "");
  const [dob, setDob] = useState(existing?.date_of_birth ?? "");
  const [blood, setBlood] = useState<BloodType | "">(existing?.blood_type ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [isSelf, setIsSelf] = useState(false);
  const [shared, setShared] = useState(existing?.shared_with_household ?? false);

  const submit = () => {
    const data = {
      name: name.trim(),
      date_of_birth: dob || null,
      blood_type: blood || null,
      notes: notes.trim() || null,
      shared_with_household: shared,
    };
    if (existing) {
      update.mutate(
        {
          id: existing.id,
          data,
          previous: {
            name: existing.name,
            date_of_birth: existing.date_of_birth,
            blood_type: existing.blood_type,
            notes: existing.notes,
            shared_with_household: existing.shared_with_household,
          },
        },
        { onSuccess: onClose },
      );
    } else {
      create.mutate({ ...data, is_self: isSelf }, { onSuccess: onClose });
    }
  };

  const pending = create.isPending || update.isPending;
  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Name</label>
        <input
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Elio"
          autoFocus
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Date of birth</label>
          <input
            type="date"
            className={inputCls}
            value={dob}
            onChange={(e) => setDob(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Blood type</label>
          <select
            className={inputCls}
            value={blood}
            onChange={(e) => setBlood(e.target.value as BloodType | "")}
          >
            <option value="">Unknown</option>
            {BLOOD_TYPES.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className={labelCls}>Notes</label>
        <textarea
          className={cn(inputCls, "min-h-[64px]")}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      {!existing && (
        <label className="flex items-center gap-2 text-sm text-white/80">
          <input
            type="checkbox"
            checked={isSelf}
            onChange={(e) => setIsSelf(e.target.checked)}
          />
          This profile is me
        </label>
      )}
      <label className="flex items-center gap-2 text-sm text-white/80">
        <input
          type="checkbox"
          checked={shared}
          onChange={(e) => setShared(e.target.checked)}
        />
        <span>
          Share with household{" "}
          <span className="text-white/50">
            (partner sees conditions & vaccines; allergies are always shared)
          </span>
        </span>
      </label>
      <Button
        className="w-full"
        disabled={!name.trim() || pending}
        onClick={submit}
      >
        {pending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
        {existing ? "Save changes" : "Create profile"}
      </Button>
    </div>
  );
}

// ── Allergy form ─────────────────────────────────────────────────────────────

function AllergyForm({
  profileId,
  existing,
  onClose,
}: {
  profileId: string;
  existing: HealthAllergy | null;
  onClose: () => void;
}) {
  const create = useCreateHealthAllergy();
  const update = useUpdateHealthAllergy();
  const [allergen, setAllergen] = useState(existing?.allergen ?? "");
  const [severity, setSeverity] = useState<AllergySeverity>(
    existing?.severity ?? "moderate",
  );
  const [notes, setNotes] = useState(existing?.reaction_notes ?? "");
  const [keywordsText, setKeywordsText] = useState(
    existing?.keywords.join(", ") ?? "",
  );
  const [keywordsTouched, setKeywordsTouched] = useState(!!existing);

  // Live preview of the keywords the matcher will use.
  const effectiveKeywords = useMemo(() => {
    if (keywordsTouched) {
      return keywordsText
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
    }
    return allergen.trim() ? deriveDefaultKeywords(allergen) : [];
  }, [allergen, keywordsText, keywordsTouched]);

  const submit = () => {
    if (existing) {
      update.mutate(
        {
          id: existing.id,
          data: {
            allergen: allergen.trim(),
            severity,
            reaction_notes: notes.trim() || null,
            keywords: effectiveKeywords,
          },
          previous: {
            allergen: existing.allergen,
            severity: existing.severity,
            reaction_notes: existing.reaction_notes,
            keywords: existing.keywords,
          },
        },
        { onSuccess: onClose },
      );
    } else {
      create.mutate(
        {
          profile_id: profileId,
          allergen: allergen.trim(),
          severity,
          reaction_notes: notes.trim() || null,
          ...(keywordsTouched ? { keywords: effectiveKeywords } : {}),
        },
        { onSuccess: onClose },
      );
    }
  };

  const pending = create.isPending || update.isPending;
  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Allergen</label>
        <input
          className={inputCls}
          value={allergen}
          onChange={(e) => setAllergen(e.target.value)}
          placeholder="e.g. peanut, dairy, sesame"
          autoFocus
        />
      </div>
      <div>
        <label className={labelCls}>Severity</label>
        <div className="flex flex-wrap gap-2">
          {SEVERITIES.map((s) => (
            <button
              key={s}
              onClick={() => setSeverity(s)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs capitalize border",
                severity === s
                  ? cn(SEVERITY_STYLES[s], "border-white/30")
                  : "text-white/60 border-white/10 hover:border-white/30",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className={labelCls}>Reaction notes</label>
        <textarea
          className={cn(inputCls, "min-h-[56px]")}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <div>
        <label className={labelCls}>
          Recipe match keywords (comma-separated)
        </label>
        <textarea
          className={cn(inputCls, "min-h-[56px]")}
          value={keywordsTouched ? keywordsText : effectiveKeywords.join(", ")}
          onFocus={() => {
            if (!keywordsTouched) {
              setKeywordsText(effectiveKeywords.join(", "));
              setKeywordsTouched(true);
            }
          }}
          onChange={(e) => setKeywordsText(e.target.value)}
        />
        <p className="text-xs text-white/40 mt-1">
          Recipes containing any of these words get flagged. Edit to fix false
          matches.
        </p>
      </div>
      <Button
        className="w-full"
        disabled={!allergen.trim() || pending}
        onClick={submit}
      >
        {pending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
        {existing ? "Save changes" : "Add allergy"}
      </Button>
    </div>
  );
}

// ── Condition form ───────────────────────────────────────────────────────────

function ConditionForm({
  profileId,
  existing,
  onClose,
}: {
  profileId: string;
  existing: HealthCondition | null;
  onClose: () => void;
}) {
  const create = useCreateHealthCondition();
  const update = useUpdateHealthCondition();
  const [kind, setKind] = useState<HealthConditionKind>(existing?.kind ?? "condition");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [occurredOn, setOccurredOn] = useState(existing?.occurred_on ?? "");
  const [status, setStatus] = useState<"active" | "resolved">(
    existing?.status ?? "active",
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");

  const submit = () => {
    const data = {
      kind,
      title: title.trim(),
      occurred_on: occurredOn || null,
      status,
      notes: notes.trim() || null,
    };
    if (existing) {
      update.mutate(
        {
          id: existing.id,
          data,
          previous: {
            kind: existing.kind,
            title: existing.title,
            occurred_on: existing.occurred_on,
            status: existing.status,
            notes: existing.notes,
          },
        },
        { onSuccess: onClose },
      );
    } else {
      create.mutate({ profile_id: profileId, ...data }, { onSuccess: onClose });
    }
  };

  const pending = create.isPending || update.isPending;
  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Type</label>
        <div className="flex gap-2">
          {CONDITION_KINDS.map((k) => (
            <button
              key={k.value}
              onClick={() => setKind(k.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs border",
                kind === k.value
                  ? "bg-white/10 text-white border-white/30"
                  : "text-white/60 border-white/10 hover:border-white/30",
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className={labelCls}>Title</label>
        <input
          className={inputCls}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Asthma, Appendectomy, Cardiology check-up"
          autoFocus
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Date</label>
          <input
            type="date"
            className={inputCls}
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select
            className={inputCls}
            value={status}
            onChange={(e) => setStatus(e.target.value as "active" | "resolved")}
          >
            <option value="active">Active</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>
      <div>
        <label className={labelCls}>Notes</label>
        <textarea
          className={cn(inputCls, "min-h-[64px]")}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <Button
        className="w-full"
        disabled={!title.trim() || pending}
        onClick={submit}
      >
        {pending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
        {existing ? "Save changes" : "Add record"}
      </Button>
    </div>
  );
}

// ── Vaccine form ─────────────────────────────────────────────────────────────

function VaccineForm({
  profileId,
  existing,
  onClose,
}: {
  profileId: string;
  existing: HealthVaccine | null;
  onClose: () => void;
}) {
  const create = useCreateHealthVaccine();
  const update = useUpdateHealthVaccine();
  const [name, setName] = useState(existing?.vaccine_name ?? "");
  const [doseLabel, setDoseLabel] = useState(existing?.dose_label ?? "");
  const [administeredOn, setAdministeredOn] = useState(
    existing?.administered_on ?? "",
  );
  const [nextDueOn, setNextDueOn] = useState(existing?.next_due_on ?? "");
  const [provider, setProvider] = useState(existing?.provider ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");

  const submit = () => {
    const data = {
      vaccine_name: name.trim(),
      dose_label: doseLabel.trim() || null,
      administered_on: administeredOn || null,
      next_due_on: nextDueOn || null,
      provider: provider.trim() || null,
      notes: notes.trim() || null,
    };
    if (existing) {
      update.mutate(
        {
          id: existing.id,
          data,
          previous: {
            vaccine_name: existing.vaccine_name,
            dose_label: existing.dose_label,
            administered_on: existing.administered_on,
            next_due_on: existing.next_due_on,
            provider: existing.provider,
            notes: existing.notes,
          },
        },
        { onSuccess: onClose },
      );
    } else {
      create.mutate({ profile_id: profileId, ...data }, { onSuccess: onClose });
    }
  };

  const pending = create.isPending || update.isPending;
  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Vaccine</label>
        <input
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Tetanus, Flu, COVID-19"
          autoFocus
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Dose</label>
          <input
            className={inputCls}
            value={doseLabel}
            onChange={(e) => setDoseLabel(e.target.value)}
            placeholder="Dose 1 / Booster"
          />
        </div>
        <div>
          <label className={labelCls}>Provider</label>
          <input
            className={inputCls}
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Given on</label>
          <input
            type="date"
            className={inputCls}
            value={administeredOn}
            onChange={(e) => setAdministeredOn(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Next due</label>
          <input
            type="date"
            className={inputCls}
            value={nextDueOn}
            onChange={(e) => setNextDueOn(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className={labelCls}>Notes</label>
        <textarea
          className={cn(inputCls, "min-h-[56px]")}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <Button
        className="w-full"
        disabled={!name.trim() || pending}
        onClick={submit}
      >
        {pending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
        {existing ? "Save changes" : "Add vaccine"}
      </Button>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

type ModalState =
  | { type: "profile"; existing: HealthProfile | null }
  | { type: "allergy"; existing: HealthAllergy | null }
  | { type: "condition"; existing: HealthCondition | null }
  | { type: "vaccine"; existing: HealthVaccine | null }
  | null;

export default function HealthcareClient() {
  const tc = useThemeClasses();
  const { data: bundle, isLoading } = useHealthBundle();
  const deleteProfile = useDeleteHealthProfile();
  const deleteAllergy = useDeleteHealthAllergy();
  const deleteCondition = useDeleteHealthCondition();
  const deleteVaccine = useDeleteHealthVaccine();

  const profiles = useMemo(() => bundle?.profiles ?? [], [bundle]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);

  const activeProfile =
    profiles.find((p) => p.id === selectedProfileId) ?? profiles[0] ?? null;

  const allergies = (bundle?.allergies ?? []).filter(
    (a) => !activeProfile || a.profile_id === activeProfile.id,
  );
  const conditions = (bundle?.conditions ?? []).filter(
    (c) => !activeProfile || c.profile_id === activeProfile.id,
  );
  const vaccines = (bundle?.vaccines ?? []).filter(
    (v) => !activeProfile || v.profile_id === activeProfile.id,
  );

  if (isLoading) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center", tc.pageBg)}>
        <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen pb-24", tc.pageBg)}>
      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-5">
        <div className="flex items-center gap-3">
          <HeartPulse className="w-6 h-6 text-white/80" />
          <div>
            <h1 className="text-xl font-semibold text-white">Health</h1>
            <p className="text-sm text-white/50">
              Profiles, allergies, medical history & vaccines
            </p>
          </div>
        </div>

        {/* Profile chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProfileId(p.id)}
              className={cn(
                "shrink-0 px-4 py-2 rounded-full text-sm border flex items-center gap-1.5",
                activeProfile?.id === p.id
                  ? "bg-white/15 text-white border-white/30"
                  : "text-white/60 border-white/10 hover:border-white/30",
              )}
            >
              {p.name}
              {p.shared_with_household && (
                <Users className="w-3.5 h-3.5 text-white/50" />
              )}
            </button>
          ))}
          <button
            onClick={() => setModal({ type: "profile", existing: null })}
            className="shrink-0 px-3 py-2 rounded-full text-sm text-white/60 border border-dashed border-white/20 hover:border-white/40 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> Profile
          </button>
        </div>

        {profiles.length === 0 ? (
          <Card className={cn("p-8 text-center", tc.surfaceBg, "border-white/10")}>
            <HeartPulse className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-white/80 mb-1">No health profiles yet</p>
            <p className="text-sm text-white/50 mb-4">
              Create a profile for yourself, your partner, or a family member.
            </p>
            <Button onClick={() => setModal({ type: "profile", existing: null })}>
              <Plus className="w-4 h-4 mr-1" /> Create profile
            </Button>
          </Card>
        ) : (
          activeProfile && (
            <>
              {/* Profile summary */}
              <Card className={cn("p-4", tc.surfaceBg, "border-white/10")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm text-white/70 space-y-0.5">
                    {activeProfile.date_of_birth && (
                      <p>Born {activeProfile.date_of_birth}</p>
                    )}
                    {activeProfile.blood_type && (
                      <p>Blood type {activeProfile.blood_type}</p>
                    )}
                    {activeProfile.notes && (
                      <p className="text-white/50">{activeProfile.notes}</p>
                    )}
                    {!activeProfile.date_of_birth &&
                      !activeProfile.blood_type &&
                      !activeProfile.notes && (
                        <p className="text-white/40">No details yet</p>
                      )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      className="p-2 text-white/50 hover:text-white"
                      onClick={() =>
                        setModal({ type: "profile", existing: activeProfile })
                      }
                      aria-label="Edit profile"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      className="p-2 text-white/50 hover:text-amber-400"
                      onClick={() => deleteProfile.mutate(activeProfile.id)}
                      aria-label="Delete profile"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>

              {/* Allergies */}
              <Card className={cn("p-4", tc.surfaceBg, "border-white/10")}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-medium text-white flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    Allergies
                  </h2>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setModal({ type: "allergy", existing: null })}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add
                  </Button>
                </div>
                {allergies.length === 0 ? (
                  <p className="text-sm text-white/40">
                    No allergies recorded. Allergies are visible to the whole
                    household and flag matching recipes.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {allergies.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white/90 text-sm font-medium">
                              {a.allergen}
                            </span>
                            <Badge
                              className={cn(
                                "capitalize border-0",
                                SEVERITY_STYLES[a.severity],
                              )}
                            >
                              {a.severity}
                            </Badge>
                          </div>
                          {a.reaction_notes && (
                            <p className="text-xs text-white/50 mt-0.5 truncate">
                              {a.reaction_notes}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            className="p-2 text-white/50 hover:text-white"
                            onClick={() =>
                              setModal({ type: "allergy", existing: a })
                            }
                            aria-label="Edit allergy"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            className="p-2 text-white/50 hover:text-amber-400"
                            onClick={() => deleteAllergy.mutate(a.id)}
                            aria-label="Delete allergy"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              {/* Medical history */}
              <Card className={cn("p-4", tc.surfaceBg, "border-white/10")}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-medium text-white flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-cyan-400" />
                    Medical history
                  </h2>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setModal({ type: "condition", existing: null })}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add
                  </Button>
                </div>
                {conditions.length === 0 ? (
                  <p className="text-sm text-white/40">
                    No conditions, surgeries, or visits recorded.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {conditions.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white/90 text-sm font-medium">
                              {c.title}
                            </span>
                            <Badge className="border-0 bg-white/10 text-white/60 capitalize">
                              {c.kind.replace("_", " ")}
                            </Badge>
                            {c.status === "active" && c.kind === "condition" && (
                              <Badge className="border-0 bg-cyan-500/10 text-cyan-300">
                                active
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-white/50 mt-0.5">
                            {c.occurred_on ?? ""}
                            {c.notes ? ` — ${c.notes}` : ""}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            className="p-2 text-white/50 hover:text-white"
                            onClick={() =>
                              setModal({ type: "condition", existing: c })
                            }
                            aria-label="Edit record"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            className="p-2 text-white/50 hover:text-amber-400"
                            onClick={() => deleteCondition.mutate(c.id)}
                            aria-label="Delete record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              {/* Vaccines */}
              <Card className={cn("p-4", tc.surfaceBg, "border-white/10")}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-medium text-white flex items-center gap-2">
                    <Syringe className="w-4 h-4 text-pink-400" />
                    Vaccines
                  </h2>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setModal({ type: "vaccine", existing: null })}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add
                  </Button>
                </div>
                {vaccines.length === 0 ? (
                  <p className="text-sm text-white/40">No vaccines recorded.</p>
                ) : (
                  <ul className="space-y-2">
                    {vaccines.map((v) => (
                      <li
                        key={v.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white/90 text-sm font-medium">
                              {v.vaccine_name}
                            </span>
                            {v.dose_label && (
                              <Badge className="border-0 bg-white/10 text-white/60">
                                {v.dose_label}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-white/50 mt-0.5">
                            {v.administered_on && `Given ${v.administered_on}`}
                            {v.next_due_on && ` · Next due ${v.next_due_on}`}
                            {v.provider && ` · ${v.provider}`}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            className="p-2 text-white/50 hover:text-white"
                            onClick={() =>
                              setModal({ type: "vaccine", existing: v })
                            }
                            aria-label="Edit vaccine"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            className="p-2 text-white/50 hover:text-amber-400"
                            onClick={() => deleteVaccine.mutate(v.id)}
                            aria-label="Delete vaccine"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </>
          )
        )}
      </div>

      {/* Modals */}
      {modal?.type === "profile" && (
        <Modal
          title={modal.existing ? "Edit profile" : "New profile"}
          onClose={() => setModal(null)}
        >
          <ProfileForm existing={modal.existing} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === "allergy" && activeProfile && (
        <Modal
          title={modal.existing ? "Edit allergy" : `Allergy — ${activeProfile.name}`}
          onClose={() => setModal(null)}
        >
          <AllergyForm
            profileId={activeProfile.id}
            existing={modal.existing}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
      {modal?.type === "condition" && activeProfile && (
        <Modal
          title={
            modal.existing ? "Edit record" : `Medical record — ${activeProfile.name}`
          }
          onClose={() => setModal(null)}
        >
          <ConditionForm
            profileId={activeProfile.id}
            existing={modal.existing}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
      {modal?.type === "vaccine" && activeProfile && (
        <Modal
          title={modal.existing ? "Edit vaccine" : `Vaccine — ${activeProfile.name}`}
          onClose={() => setModal(null)}
        >
          <VaccineForm
            profileId={activeProfile.id}
            existing={modal.existing}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
