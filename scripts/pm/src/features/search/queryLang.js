const FILTERS = new Set(["m", "t", "s", "is", "f"]);

export function parseQuery(input) {
  const filters = {};
  const terms = [];
  const tokens = String(input || "").match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  for (const token of tokens) {
    const match = token.match(/^([^:]+):(.*)$/);
    if (match && FILTERS.has(match[1].toLowerCase())) filters[match[1].toLowerCase()] = match[2].replace(/^"|"$/g, "");
    else terms.push(token.replace(/^"|"$/g, ""));
  }
  return { filters, text: terms.join(" ").trim() };
}

export function matchesFilters(item, filters) {
  if (filters.m && !String(item.module || "").toLowerCase().includes(filters.m.toLowerCase())) return false;
  if (filters.t && String(item.type || "task").toLowerCase() !== filters.t.toLowerCase()) return false;
  if (filters.s && String(item.severity || "").toLowerCase() !== filters.s.toLowerCase()) return false;
  if (filters.is && String(item.state || "").toLowerCase() !== filters.is.toLowerCase()) return false;
  if (filters.f && !String(item.file || item.relPath || "").toLowerCase().includes(filters.f.toLowerCase())) return false;
  return true;
}

