"use client";

import {
  BillIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@/components/icons/FuturisticIcons";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { cn } from "@/lib/utils";
import JSZip from "jszip";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ReceiptEntry = {
  transaction_id: string;
  date: string;
  description: string | null;
  amount: number;
  receipt_path: string | null;
  signed_url: string | null;
};

export default function ReceiptsArchivePage() {
  const tc = useThemeClasses();
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [receipts, setReceipts] = useState<ReceiptEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReceiptEntry | null>(null);

  const fetchReceipts = async (y: number) => {
    setLoading(true);
    setFetchError(null);
    setReceipts(null);
    try {
      const res = await fetch(`/api/receipts/export?year=${y}`);
      if (!res.ok) throw new Error("Failed to load receipts");
      const json = await res.json();
      setReceipts(json.receipts ?? []);
    } catch {
      setFetchError("Could not load receipts. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const changeYear = (delta: number) => {
    const next = year + delta;
    setYear(next);
    setReceipts(null);
  };

  const handleExport = async () => {
    if (!receipts?.length) return;
    setExporting(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder(`receipts_${year}`)!;

      // Build manifest CSV
      const rows = ["transaction_id,date,description,amount,filename"];

      await Promise.all(
        receipts.map(async (r) => {
          if (!r.signed_url) return;
          const slug = (r.description ?? "no-desc")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .slice(0, 40);
          const filename = `${r.date}_${r.transaction_id.slice(0, 8)}_${slug}.jpg`;
          rows.push(
            `${r.transaction_id},${r.date},"${(r.description ?? "").replace(/"/g, '""')}",${r.amount},${filename}`,
          );
          try {
            const imgRes = await fetch(r.signed_url);
            const blob = await imgRes.blob();
            folder.file(filename, blob);
          } catch {
            // Skip failed downloads silently
          }
        }),
      );

      folder.file("manifest.csv", rows.join("\n"));

      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipts_${year}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail — user can retry
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "hsl(var(--main-bg))" }}>
      {/* Header */}
      <div className={cn("sticky top-0 z-10 border-b border-white/5 px-4 py-3 flex items-center gap-3", tc.bgPage)}>
        <button
          onClick={() => router.back()}
          className={cn("p-2 rounded-lg transition-colors", tc.hoverBgSubtle)}
        >
          <ChevronLeftIcon className={cn("w-5 h-5", tc.headerText)} />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <BillIcon className={cn("w-5 h-5", tc.text, tc.glow)} />
          <h1 className="text-base font-semibold text-white">Receipts Archive</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Year selector */}
        <div className={cn("flex items-center justify-between px-4 py-3 rounded-2xl border", tc.border, "bg-white/5")}>
          <button
            onClick={() => changeYear(-1)}
            className={cn("p-2 rounded-lg transition-colors", tc.hoverBgSubtle)}
          >
            <ChevronLeftIcon className={cn("w-5 h-5", tc.text)} />
          </button>
          <span className="text-lg font-bold text-white">{year}</span>
          <button
            onClick={() => changeYear(1)}
            disabled={year >= currentYear}
            className={cn("p-2 rounded-lg transition-colors", year >= currentYear ? "opacity-30" : tc.hoverBgSubtle)}
          >
            <ChevronRightIcon className={cn("w-5 h-5", tc.text)} />
          </button>
        </div>

        {/* Load button */}
        {receipts === null && !loading && (
          <button
            onClick={() => fetchReceipts(year)}
            className="w-full py-3.5 rounded-2xl neo-gradient text-white text-sm font-semibold active:scale-[0.98] transition-all"
          >
            Load {year} receipts
          </button>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12 gap-3">
            <div className={cn("w-6 h-6 rounded-full border-2 animate-spin", tc.border, "border-t-transparent")} />
            <p className="text-sm text-white/50">Loading receipts…</p>
          </div>
        )}

        {/* Error */}
        {fetchError && (
          <p className="text-sm text-red-400 text-center bg-red-500/10 rounded-xl px-3 py-3">{fetchError}</p>
        )}

        {/* Results */}
        {receipts !== null && !loading && (
          <>
            <div className="flex items-center justify-between">
              <p className={cn("text-sm", tc.textMuted)}>
                {receipts.length} receipt{receipts.length !== 1 ? "s" : ""} in {year}
              </p>
              {receipts.length > 0 && (
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold neo-gradient text-white active:scale-95 transition-all",
                    exporting && "opacity-60",
                  )}
                >
                  <DownloadOutlineIcon className="w-4 h-4" />
                  {exporting ? "Exporting…" : "Export ZIP"}
                </button>
              )}
            </div>

            {receipts.length === 0 ? (
              <div className="text-center py-16 space-y-2">
                <BillIcon className={cn("w-10 h-10 mx-auto", tc.textMuted)} />
                <p className={cn("text-sm", tc.textMuted)}>No receipts for {year}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {receipts.map((r) => (
                  <button
                    key={r.transaction_id}
                    onClick={() => setSelected(r)}
                    className={cn(
                      "rounded-2xl border overflow-hidden text-left transition-all active:scale-95 hover:border-white/20",
                      tc.border, "bg-white/5",
                    )}
                  >
                    {r.signed_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.signed_url}
                        alt="Receipt"
                        className="w-full h-36 object-cover"
                      />
                    ) : (
                      <div className="w-full h-36 flex items-center justify-center bg-white/5">
                        <BillIcon className={cn("w-8 h-8", tc.textMuted)} />
                      </div>
                    )}
                    <div className="px-3 py-2 space-y-0.5">
                      <p className="text-xs text-white/60">{r.date}</p>
                      <p className={cn("text-sm font-medium truncate", tc.text)}>
                        {r.description || "—"}
                      </p>
                      <p className="text-xs text-emerald-400">${Number(r.amount).toFixed(2)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Lightbox */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setSelected(null)}
        >
          <div className="relative max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            {selected.signed_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selected.signed_url} alt="Receipt" className="w-full rounded-2xl shadow-2xl" />
            )}
            <div className={cn("mt-3 p-4 rounded-2xl border space-y-1", tc.border, tc.bgPage)}>
              <p className="text-xs text-white/50">ID: {selected.transaction_id}</p>
              <p className="text-sm text-white">{selected.description || "—"}</p>
              <p className="text-xs text-white/50">{selected.date} · ${Number(selected.amount).toFixed(2)}</p>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white/10 backdrop-blur flex items-center justify-center"
            >
              <span className="text-white text-sm">✕</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DownloadOutlineIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
