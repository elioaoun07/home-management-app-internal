"use client";

// ERA "Taught phrases" — Stage 4 (HUB-30) management surface: inspect the
// phrasings learned from successful Ask AI actions, disable one without
// losing it, or delete it outright (Undo re-teaches it — see
// useTaughtPhrases.ts). Lives in the Brain dashboard: this IS a form of
// memory, just phrasing rather than a fact.

import { useEraTemplates } from "@/features/era/templates/useEraTemplates";
import {
  useDeleteTemplate,
  useSetTemplateEnabled,
} from "@/features/era/templates/useTaughtPhrases";
import { X } from "lucide-react";

const HUE = 220;

export function TaughtPhrasesSection() {
  const { data: templates, isLoading } = useEraTemplates();
  const setEnabled = useSetTemplateEnabled();
  const { deleteWithUndo } = useDeleteTemplate();

  const rows = templates ?? [];
  if (!isLoading && rows.length === 0) return null;

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: `hsla(${HUE}, 18%, 7%, 0.82)`,
        border: `1px solid hsla(${HUE}, 55%, 45%, 0.18)`,
        backdropFilter: "blur(14px)",
      }}
    >
      <p
        className="mb-3 text-[10px] font-semibold uppercase tracking-[0.13em]"
        style={{ color: `hsla(${HUE}, 60%, 65%, 0.65)` }}
      >
        Taught phrases
      </p>

      {isLoading ? (
        <div className="h-14 animate-pulse rounded-xl bg-white/5" />
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <div
              key={row.id}
              className="group relative flex items-center justify-between gap-2 rounded-xl px-3 py-2.5"
              style={{
                background: `hsla(${HUE}, 20%, 9%, 0.6)`,
                border: `1px solid hsla(${HUE}, 50%, 40%, 0.12)`,
                opacity: row.enabled ? 1 : 0.45,
              }}
            >
              <button
                type="button"
                onClick={() => setEnabled.mutate({ id: row.id, enabled: !row.enabled })}
                className="min-w-0 flex-1 text-left"
                title={row.enabled ? "Tap to disable" : "Tap to enable"}
              >
                <p className="truncate text-sm text-white/75">{row.pattern_text}</p>
                <p className="text-[10px] text-white/35">
                  {row.capability_id} · used {row.match_count}×{row.enabled ? "" : " · disabled"}
                </p>
              </button>

              <button
                type="button"
                onClick={() => deleteWithUndo(row)}
                aria-label="Delete taught phrase"
                className="shrink-0 rounded-full p-0.5 opacity-0 transition-opacity group-hover:opacity-60 hover:!opacity-100"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="mt-2 text-[10px] text-white/25" style={{ color: `hsla(${HUE}, 40%, 60%, 0.4)` }}>
        Learned when Ask AI resolves something the built-in router missed.
      </p>
    </div>
  );
}
