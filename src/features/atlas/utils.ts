"use client";

import type { AtlasNode } from "./types";

export const CATEGORY_LABELS: Record<string, string> = {
  auth: "Auth & Onboarding",
  "main-tab": "Main Tabs",
  "standalone-page": "Standalone Pages",
  utility: "Utility Routes",
  feature: "Feature Modules",
  junction: "Junction Modules",
  background: "Background / Cron",
  uncategorized: "Uncategorized",
};

export const CATEGORY_ORDER = [
  "main-tab",
  "standalone-page",
  "utility",
  "auth",
  "feature",
  "junction",
  "background",
  "uncategorized",
];

export function groupByCategory(nodes: AtlasNode[]) {
  const map = new Map<string, AtlasNode[]>();
  for (const n of nodes) {
    const key = n.category || "uncategorized";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(n);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.title.localeCompare(b.title));
  }
  return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({
    category: c,
    label: CATEGORY_LABELS[c] ?? c,
    nodes: map.get(c)!,
  }));
}

export function searchNodes(nodes: AtlasNode[], query: string): AtlasNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  return nodes.filter((n) => {
    if (n.title.toLowerCase().includes(q)) return true;
    if (n.slug.toLowerCase().includes(q)) return true;
    if (n.route?.toLowerCase().includes(q)) return true;
    if (n.tags.some((t) => t.toLowerCase().includes(q))) return true;
    for (const v of Object.values(n.sections)) {
      if (v.toLowerCase().includes(q)) return true;
    }
    return false;
  });
}
