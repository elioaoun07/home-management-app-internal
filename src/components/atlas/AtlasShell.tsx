"use client";

import type { AtlasData, AtlasNode } from "@/features/atlas/types";
import { groupByCategory, searchNodes } from "@/features/atlas/utils";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Network } from "lucide-react";
import { useMemo, useState } from "react";
import AtlasDetail from "./AtlasDetail";
import AtlasSearch from "./AtlasSearch";
import AtlasTree from "./AtlasTree";

type Props = { data: AtlasData };

export default function AtlasShell({ data }: Props) {
  const tc = useThemeClasses();
  const [query, setQuery] = useState("");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(
    data.nodes[0]?.slug ?? null,
  );
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const filtered = useMemo(
    () => searchNodes(data.nodes, query),
    [data.nodes, query],
  );
  const groups = useMemo(() => groupByCategory(filtered), [filtered]);

  const selected: AtlasNode | null = useMemo(
    () => data.nodes.find((n) => n.slug === selectedSlug) ?? null,
    [data.nodes, selectedSlug],
  );

  function handleSelect(slug: string) {
    setSelectedSlug(slug);
    setMobileDetailOpen(true);
  }

  return (
    <div className={`min-h-[100dvh] pt-14 md:pt-16 ${tc.bgPage} ${tc.text}`}>
      <div className="mx-auto max-w-[1400px] px-3 md:px-6 py-4 md:py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${tc.bgSurface} border ${tc.border}`}
            >
              <Network className={`w-5 h-5 ${tc.text}`} />
            </div>
            <div>
              <h1 className="text-lg md:text-2xl font-semibold tracking-tight">
                Atlas
              </h1>
              <p className={`text-xs md:text-sm ${tc.textMuted}`}>
                {data.count} entries · generated{" "}
                {new Date(data.generatedAt).toLocaleString()}
              </p>
            </div>
          </div>
          <AtlasSearch value={query} onChange={setQuery} />
        </div>

        {/* Layout: tree (left) + detail (right) on desktop, stacked on mobile */}
        <div className="grid md:grid-cols-[minmax(280px,360px)_1fr] gap-4 md:gap-6">
          {/* Tree */}
          <div
            className={`rounded-2xl border ${tc.border} ${tc.bgSurface} overflow-hidden`}
          >
            <div className="max-h-[calc(100dvh-200px)] overflow-y-auto p-2">
              <AtlasTree
                groups={groups}
                selectedSlug={selectedSlug}
                onSelect={handleSelect}
              />
            </div>
          </div>

          {/* Detail (desktop) */}
          <div className="hidden md:block">
            <AtlasDetail node={selected} />
          </div>
        </div>
      </div>

      {/* Detail (mobile full-screen) */}
      <AnimatePresence>
        {mobileDetailOpen && selected ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className={`md:hidden fixed inset-0 z-50 ${tc.bgPage} overflow-y-auto`}
          >
            <div className="sticky top-0 z-10 backdrop-blur-md border-b border-white/5">
              <button
                onClick={() => setMobileDetailOpen(false)}
                className={`flex items-center gap-2 px-4 h-12 ${tc.text}`}
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="text-sm">Back to tree</span>
              </button>
            </div>
            <div className="p-4">
              <AtlasDetail node={selected} />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
