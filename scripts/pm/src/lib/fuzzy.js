export function fuzzyScore(query, value) {
  const needle = String(query || "").toLowerCase().trim();
  const haystack = String(value || "").toLowerCase();
  if (!needle) return 1;
  const exact = haystack.indexOf(needle);
  if (exact >= 0) return 1000 - exact - (haystack.length - needle.length) * 0.01;
  let cursor = 0;
  let score = 0;
  let streak = 0;
  for (const char of needle) {
    const found = haystack.indexOf(char, cursor);
    if (found < 0) return -Infinity;
    streak = found === cursor ? streak + 1 : 0;
    score += 10 + streak * 4 - found * 0.03;
    cursor = found + 1;
  }
  return score;
}

export function fuzzyFind(query, entries, label = (entry) => entry) {
  return entries.map((entry) => ({ entry, score: fuzzyScore(query, label(entry)) }))
    .filter((result) => Number.isFinite(result.score)).sort((a, b) => b.score - a.score);
}

