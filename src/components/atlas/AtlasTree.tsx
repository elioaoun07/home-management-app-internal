"use client";

import type { AtlasNode } from "@/features/atlas/types";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

type Group = { category: string; label: string; nodes: AtlasNode[] };

type Props = {
  groups: Group[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
};

export default function AtlasTree({ groups, selectedSlug, onSelect }: Props) {
  const tc = useThemeClasses();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function toggle(cat: string) {
    setCollapsed((c) => ({ ...c, [cat]: !c[cat] }));
  }

  if (groups.length === 0) {
    return (
      <div className={`p-6 text-sm ${tc.textMuted}`}>
        No entries match your search.
      </div>
    );
  }

  return (
    <ul className="space-y-1">
      {groups.map((g) => {
        const open = !collapsed[g.category];
        return (
          <li key={g.category}>
            <button
              onClick={() => toggle(g.category)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs uppercase tracking-wider font-semibold ${tc.textMuted} ${tc.bgHover}`}
            >
              <motion.span
                animate={{ rotate: open ? 90 : 0 }}
                transition={{ duration: 0.15 }}
                className="inline-flex"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </motion.span>
              <span>{g.label}</span>
              <span className="ml-auto text-[10px] opacity-60">
                {g.nodes.length}
              </span>
            </button>
            <AnimatePresence initial={false}>
              {open ? (
                <motion.ul
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="overflow-hidden ml-3 border-l border-white/5 pl-2 space-y-0.5"
                >
                  {g.nodes.map((n) => {
                    const active = n.slug === selectedSlug;
                    return (
                      <li key={n.slug}>
                        <button
                          onClick={() => onSelect(n.slug)}
                          className={`w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors ${
                            active
                              ? `${tc.bgActive} ${tc.textHighlight}`
                              : `${tc.bgHover} ${tc.text}`
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="truncate">{n.title}</span>
                            {n.route && n.route !== "n/a" ? (
                              <span
                                className={`ml-auto text-[10px] font-mono ${tc.textFaint}`}
                              >
                                {n.route}
                              </span>
                            ) : null}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </motion.ul>
              ) : null}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
}
