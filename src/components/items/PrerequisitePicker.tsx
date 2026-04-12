"use client";

import { useNfcTags } from "@/features/nfc/hooks";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import type { CreatePrerequisiteInput } from "@/types/prerequisites";
import { ChevronDown, Nfc, Plus, Trash2, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// Supported condition types with labels
const CONDITION_TYPES = [
  {
    value: "nfc_state_change" as const,
    label: "NFC Tag State",
    icon: Nfc,
    available: true,
  },
  {
    value: "item_completed" as const,
    label: "Item Completed",
    icon: Zap,
    available: false,
  },
  {
    value: "time_window" as const,
    label: "Time Window",
    icon: Zap,
    available: false,
  },
  {
    value: "schedule" as const,
    label: "Schedule",
    icon: Zap,
    available: false,
  },
] as const;

interface PrerequisitePickerProps {
  value: CreatePrerequisiteInput[];
  onChange: (prerequisites: CreatePrerequisiteInput[]) => void;
  /** Whether to show in compact mode (mobile form) */
  compact?: boolean;
  className?: string;
}

export function PrerequisitePicker({
  value,
  onChange,
  compact = false,
  className,
}: PrerequisitePickerProps) {
  const themeClasses = useThemeClasses();
  const { data: nfcTags = [] } = useNfcTags();
  const [expanded, setExpanded] = useState(value.length > 0 || compact);
  const autoAddedRef = useRef(false);

  const addPrerequisite = useCallback(() => {
    // Default to nfc_state_change if tags exist, otherwise first available
    const defaultTagId = nfcTags.length > 0 ? nfcTags[0].id : "";
    const defaultState =
      nfcTags.length > 0 && nfcTags[0].states.length > 0
        ? nfcTags[0].states[0]
        : "";
    onChange([
      ...value,
      {
        condition_type: "nfc_state_change",
        condition_config: { tag_id: defaultTagId, target_state: defaultState },
        logic_group: 0,
      },
    ]);
    setExpanded(true);
  }, [value, onChange, nfcTags]);

  const removePrerequisite = useCallback(
    (index: number) => {
      onChange(value.filter((_, i) => i !== index));
    },
    [value, onChange],
  );

  const updatePrerequisite = useCallback(
    (index: number, updates: Partial<CreatePrerequisiteInput>) => {
      const next = value.map((p, i) =>
        i === index ? { ...p, ...updates } : p,
      );
      onChange(next);
    },
    [value, onChange],
  );

  // In compact mode (mobile form), auto-add a default condition on mount
  // so user goes from "enable triggers" → "configure condition" in 2 steps
  useEffect(() => {
    if (
      compact &&
      value.length === 0 &&
      nfcTags.length > 0 &&
      !autoAddedRef.current
    ) {
      autoAddedRef.current = true;
      addPrerequisite();
    }
  }, [compact, value.length, nfcTags.length, addPrerequisite]);

  if (!expanded && value.length === 0) {
    return (
      <button
        type="button"
        onClick={() => {
          setExpanded(true);
          if (nfcTags.length > 0) addPrerequisite();
        }}
        className={cn(
          "flex items-center gap-2 text-sm transition-colors",
          "text-white/50 hover:text-white/80",
          className,
        )}
      >
        <Zap className="w-4 h-4" />
        <span>Add trigger condition</span>
      </button>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <button
        type="button"
        onClick={() => {
          if (value.length === 0) setExpanded(false);
        }}
        className="flex items-center gap-2 text-sm font-medium text-white/70"
      >
        <Zap className="w-4 h-4" />
        <span>
          Trigger Conditions{" "}
          {value.length > 0 && (
            <span className="text-white/40">({value.length})</span>
          )}
        </span>
        {value.length === 0 && (
          <ChevronDown className="w-3 h-3 ml-auto text-white/40" />
        )}
      </button>

      {/* Info text */}
      {value.length === 0 && expanded && (
        <p className="text-xs text-white/40">
          Items with trigger conditions start as dormant and activate when
          conditions are met.
        </p>
      )}

      {/* Prerequisite list */}
      {value.map((prereq, index) => (
        <PrerequisiteRow
          key={index}
          prereq={prereq}
          index={index}
          nfcTags={nfcTags}
          compact={compact}
          onUpdate={updatePrerequisite}
          onRemove={removePrerequisite}
        />
      ))}

      {/* Add button */}
      {expanded && (
        <button
          type="button"
          onClick={addPrerequisite}
          disabled={nfcTags.length === 0}
          className={cn(
            "flex items-center gap-2 text-xs transition-colors rounded-lg px-3 py-2",
            nfcTags.length === 0
              ? "text-white/30 cursor-not-allowed"
              : "text-white/50 hover:text-white/80 hover:bg-white/5",
          )}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add condition</span>
        </button>
      )}

      {nfcTags.length === 0 && expanded && (
        <p className="text-xs text-amber-300/70">
          No NFC tags configured. Create tags in the NFC admin to use trigger
          conditions.
        </p>
      )}
    </div>
  );
}

// ============================================
// Individual Prerequisite Row
// ============================================

interface PrerequisiteRowProps {
  prereq: CreatePrerequisiteInput;
  index: number;
  nfcTags: Array<{
    id: string;
    tag_slug: string;
    label: string;
    location_name: string | null;
    states: string[];
  }>;
  compact: boolean;
  onUpdate: (index: number, updates: Partial<CreatePrerequisiteInput>) => void;
  onRemove: (index: number) => void;
}

function PrerequisiteRow({
  prereq,
  index,
  nfcTags,
  compact,
  onUpdate,
  onRemove,
}: PrerequisiteRowProps) {
  const themeClasses = useThemeClasses();
  const config = prereq.condition_config as unknown as Record<string, unknown>;

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-2">
      {/* Row header: type selector + remove */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <select
            value={prereq.condition_type}
            onChange={(e) => {
              const type = e.target
                .value as CreatePrerequisiteInput["condition_type"];
              if (type === "nfc_state_change") {
                const defaultTag = nfcTags[0];
                onUpdate(index, {
                  condition_type: type,
                  condition_config: {
                    tag_id: defaultTag?.id ?? "",
                    target_state: defaultTag?.states[0] ?? "",
                  },
                });
              }
            }}
            className={cn(
              "w-full rounded-lg px-3 py-1.5 text-sm bg-white/5 border border-white/10 text-white",
              "focus:outline-none focus:ring-1 focus:ring-cyan-500/50",
            )}
          >
            {CONDITION_TYPES.map((t) => (
              <option
                key={t.value}
                value={t.value}
                disabled={!t.available}
                className="bg-zinc-900 text-white"
              >
                {t.label}
                {!t.available ? " (Coming Soon)" : ""}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* NFC State Change config */}
      {prereq.condition_type === "nfc_state_change" && (
        <NfcStateConfig
          tagId={(config.tag_id as string) ?? ""}
          targetState={(config.target_state as string) ?? ""}
          nfcTags={nfcTags}
          compact={compact}
          onChange={(tagId, targetState) =>
            onUpdate(index, {
              condition_config: { tag_id: tagId, target_state: targetState },
            })
          }
        />
      )}
    </div>
  );
}

// ============================================
// NFC State Change Configuration
// ============================================

interface NfcStateConfigProps {
  tagId: string;
  targetState: string;
  nfcTags: Array<{
    id: string;
    tag_slug: string;
    label: string;
    location_name: string | null;
    states: string[];
  }>;
  compact: boolean;
  onChange: (tagId: string, targetState: string) => void;
}

function NfcStateConfig({
  tagId,
  targetState,
  nfcTags,
  compact,
  onChange,
}: NfcStateConfigProps) {
  const selectedTag = nfcTags.find((t) => t.id === tagId);

  return (
    <div
      className={cn("gap-2", compact ? "flex flex-col" : "grid grid-cols-2")}
    >
      {/* Tag selector */}
      <div className="space-y-1">
        <label className="text-xs text-white/40">NFC Tag</label>
        <select
          value={tagId}
          onChange={(e) => {
            const newTag = nfcTags.find((t) => t.id === e.target.value);
            onChange(e.target.value, newTag?.states[0] ?? "");
          }}
          className={cn(
            "w-full rounded-lg px-3 py-1.5 text-sm bg-white/5 border border-white/10 text-white",
            "focus:outline-none focus:ring-1 focus:ring-cyan-500/50",
          )}
        >
          {nfcTags.map((tag) => (
            <option
              key={tag.id}
              value={tag.id}
              className="bg-zinc-900 text-white"
            >
              {tag.label}
              {tag.location_name ? ` (${tag.location_name})` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* State selector */}
      <div className="space-y-1">
        <label className="text-xs text-white/40">When state is</label>
        <select
          value={targetState}
          onChange={(e) => onChange(tagId, e.target.value)}
          className={cn(
            "w-full rounded-lg px-3 py-1.5 text-sm bg-white/5 border border-white/10 text-white",
            "focus:outline-none focus:ring-1 focus:ring-cyan-500/50",
          )}
        >
          {selectedTag?.states.map((state) => (
            <option
              key={state}
              value={state}
              className="bg-zinc-900 text-white"
            >
              {state}
            </option>
          )) ?? (
            <option value="" className="bg-zinc-900 text-white">
              Select a tag first
            </option>
          )}
        </select>
      </div>
    </div>
  );
}
