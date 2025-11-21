"use client";

import TransactionsTable, {
  Tx,
} from "@/components/dashboard/TransactionsTable";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { useEffect, useMemo, useState } from "react";

type Props = {
  rows: Tx[];
  start: string;
  end: string;
  showUser?: boolean;
};

type Patch = Partial<{
  date: string;
  amount: number | string;
  description: string | null;
  category_id: string | null | "";
  subcategory_id: string | null | "";
}> & { id: string };

export default function DashboardClient({ rows, start, end, showUser }: Props) {
  const [tableRows, setTableRows] = useState<Tx[]>(rows);
  const [allRows] = useState<Tx[]>(rows); // immutable snapshot of initial server rows for fast client filtering
  const [range, setRange] = useState<{ start: string; end: string }>({
    start,
    end,
  });
  const [pending, setPending] = useState<Record<string, Patch>>({});
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [results, setResults] = useState<{ ok: number; fail: number } | null>(
    null
  );
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const dirtyIds = useMemo(() => new Set(Object.keys(pending)), [pending]);

  // Get current theme for dynamic styling
  const { theme: currentTheme } = useTheme();

  // Listen for quick view range changes and filter locally without reload
  useEffect(() => {
    function onSetRange(e: Event) {
      const detail = (e as CustomEvent).detail as {
        start?: string;
        end?: string;
      };
      if (!detail?.start || !detail?.end) return;
      setRange({ start: detail.start, end: detail.end });
      const s = detail.start;
      const eStr = detail.end;
      setTableRows(allRows.filter((r) => r.date >= s && r.date <= eStr));
      // Also reflect in the page URL inputs if present (optional; form owns defaults)
      const startInput = document.getElementById(
        "start"
      ) as HTMLInputElement | null;
      const endInput = document.getElementById(
        "end"
      ) as HTMLInputElement | null;
      if (startInput) startInput.value = s;
      if (endInput) endInput.value = eStr;
    }
    window.addEventListener("dashboard:setRange", onSetRange as any);
    return () =>
      window.removeEventListener("dashboard:setRange", onSetRange as any);
  }, [allRows]);

  // Enhance native date inputs to filter instantly on change
  useEffect(() => {
    const startInput = document.getElementById(
      "start"
    ) as HTMLInputElement | null;
    const endInput = document.getElementById("end") as HTMLInputElement | null;
    if (!startInput || !endInput) return;

    const handler = () => {
      const s = startInput.value || range.start;
      const e = endInput.value || range.end;
      if (!s || !e) return;
      setRange({ start: s, end: e });
      setTableRows(allRows.filter((r) => r.date >= s && r.date <= e));
      // Update URL without reload for shareability
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("start", s);
        url.searchParams.set("end", e);
        window.history.replaceState({}, "", url.toString());
      } catch {}
    };

    startInput.addEventListener("change", handler);
    endInput.addEventListener("change", handler);
    startInput.addEventListener("input", handler);
    endInput.addEventListener("input", handler);

    return () => {
      startInput.removeEventListener("change", handler);
      endInput.removeEventListener("change", handler);
      startInput.removeEventListener("input", handler);
      endInput.removeEventListener("input", handler);
    };
  }, [allRows, range.start, range.end]);

  const handleDeferredChange = (updatedRow: Tx, patch: Patch) => {
    setTableRows((prev) =>
      prev.map((r) => (r.id === updatedRow.id ? updatedRow : r))
    );
    setPending((prev) => {
      const existing = prev[patch.id] || { id: patch.id };
      const merged: Patch = { ...existing, ...patch };
      return { ...prev, [patch.id]: merged };
    });
    setResults(null);
    setErrorMsg(null);
  };

  const discardChanges = () => {
    setPending({});
    setTableRows(rows);
    setResults(null);
    setErrorMsg(null);
  };

  const saveAll = async () => {
    const patches = Object.values(pending);
    if (patches.length === 0 || saving) return;
    setSaving(true);
    setErrorMsg(null);
    setResults(null);
    setRowErrors({});
    let ok = 0;
    let fail = 0;
    const updatedMap: Record<string, Tx> = {};
    for (const p of patches) {
      try {
        const res = await fetch("/api/transactions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p),
        });
        if (!res.ok) {
          fail++;
          try {
            const j = await res.json();
            setRowErrors((prev) => ({ ...prev, [p.id]: j?.error || "Failed" }));
          } catch {
            setRowErrors((prev) => ({ ...prev, [p.id]: "Failed" }));
          }
          continue;
        }
        const updated: Tx = await res.json();
        ok++;
        updatedMap[updated.id] = updated;
      } catch (e) {
        fail++;
        setRowErrors((prev) => ({ ...prev, [p.id]: "Network error" }));
      }
    }
    // Apply successful updates
    if (ok > 0) {
      setTableRows((prev) => prev.map((r) => updatedMap[r.id] ?? r));
      // Clear only the ones that succeeded
      setPending((prev) => {
        const next: Record<string, Patch> = {};
        for (const [id, patch] of Object.entries(prev)) {
          if (!updatedMap[id]) next[id] = patch;
        }
        return next;
      });
    }
    if (fail > 0) {
      setErrorMsg(
        `Failed to save ${fail} change${fail > 1 ? "s" : ""}. Please retry.`
      );
    }
    setResults({ ok, fail });
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Top toolbar removed as requested; using only bottom sticky bar and floating Save */}
      <TransactionsTable
        rows={tableRows}
        start={start}
        end={end}
        showUser={showUser ?? new Set(rows.map((r) => r.user_id)).size > 1}
        deferredSave
        dirtyIds={dirtyIds}
        onDeferredChange={handleDeferredChange}
        saving={saving}
        rowErrors={rowErrors}
        onSaveRow={async (id) => {
          const patch = pending[id];
          if (!patch) return;
          setSaving(true);
          setRowErrors((prev) => ({ ...prev, [id]: "" }));
          try {
            const res = await fetch("/api/transactions", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(patch),
            });
            if (!res.ok) {
              try {
                const j = await res.json();
                setRowErrors((prev) => ({
                  ...prev,
                  [id]: j?.error || "Failed",
                }));
              } catch {
                setRowErrors((prev) => ({ ...prev, [id]: "Failed" }));
              }
              return;
            }
            const updated: Tx = await res.json();
            setTableRows((prev) =>
              prev.map((r) => (r.id === id ? updated : r))
            );
            setPending((prev) => {
              const next = { ...prev };
              delete next[id];
              return next;
            });
            setRowErrors((prev) => {
              const next = { ...prev };
              delete next[id];
              return next;
            });
          } finally {
            setSaving(false);
          }
        }}
        onDiscardRow={(id) => {
          setPending((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
          // revert local row to the original server value if available
          const original = rows.find((r) => r.id === id);
          if (original) {
            setTableRows((prev) =>
              prev.map((r) => (r.id === id ? original : r))
            );
          }
          setRowErrors((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }}
      />

      {/* Sticky save bar */}
      {dirtyIds.size > 0 && (
        <div className="sticky bottom-0 z-20 border-t bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 p-3">
            <div className="text-sm text-muted-foreground">
              {dirtyIds.size} pending change{dirtyIds.size > 1 ? "s" : ""}
              {results && results.ok > 0 ? (
                <span className="ml-2 text-green-600">
                  • Saved {results.ok}
                </span>
              ) : null}
              {results && results.fail > 0 ? (
                <span className="ml-2 text-red-600">
                  • Failed {results.fail}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={discardChanges}
                disabled={saving}
              >
                Discard
              </Button>
              <Button onClick={saveAll} disabled={saving}>
                {saving ? "Saving…" : `Save changes (${dirtyIds.size})`}
              </Button>
            </div>
          </div>
          {errorMsg ? (
            <div className="mx-auto max-w-5xl pb-3 px-3 text-sm text-red-600">
              {errorMsg}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
