// The board/search filter grammar: `key:value` tokens, everything else is free text.
//   m:      module / campaign      (substring)
//   t:      record type            (exact — doc | heading | task | bug)
//   s:      severity               (exact — blocker | friction | annoyance | parked)
//   is:     state                  (exact — open | done)
//   f:      file path              (substring)
//   lane:   Now / Next / Later     (exact, case-insensitive)
//   e:      effort                 (exact — S | M | L; `effort:` is accepted too)
//   id:     ID chip                (substring, so `id:BUD` matches every Budget item)
const FILTERS = new Set(["m", "t", "s", "is", "f", "lane", "e", "effort", "id"]);

export function parseQuery(input) {
  const filters = {};
  const terms = [];
  const tokens = String(input || "").match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  for (const token of tokens) {
    const match = token.match(/^([^:]+):(.*)$/);
    if (match && FILTERS.has(match[1].toLowerCase())) {
      const key = match[1].toLowerCase();
      filters[key === "effort" ? "e" : key] = match[2].replace(/^"|"$/g, "");
    } else terms.push(token.replace(/^"|"$/g, ""));
  }
  return { filters, text: terms.join(" ").trim() };
}

export function matchesFilters(item, filters) {
  if (filters.m && !String(item.module || "").toLowerCase().includes(filters.m.toLowerCase())) return false;
  if (filters.t && String(item.type || "task").toLowerCase() !== filters.t.toLowerCase()) return false;
  if (filters.s && String(item.severity || "").toLowerCase() !== filters.s.toLowerCase()) return false;
  if (filters.is && String(item.state || "").toLowerCase() !== filters.is.toLowerCase()) return false;
  if (filters.f && !String(item.file || item.relPath || "").toLowerCase().includes(filters.f.toLowerCase())) return false;
  if (filters.lane && String(item.section || "").toLowerCase() !== filters.lane.toLowerCase()) return false;
  if (filters.e && String(item.effort || "").toLowerCase() !== filters.e.toLowerCase()) return false;
  if (filters.id && !String(item.idChip || "").toLowerCase().includes(filters.id.toLowerCase())) return false;
  return true;
}
