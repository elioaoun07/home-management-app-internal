// Track touched line identities through zero-context hunks. File-overlap churn
// remains a separately labelled fallback; missing/noncontiguous ranges are unknown.
export function reworkLines(sessions, firstDone) {
  if (!firstDone) return null;
  const tracked = new Map();
  let count = 0,
    previous = null,
    known = true;
  for (const s of sessions) {
    const after = s.startedAt > firstDone;
    if (previous && s.base !== previous) known = false;
    if (!s.changeFacts) known = false;
    for (const c of s.changeFacts || []) {
      const oldFile = c.beforeFile || c.file,
        old = tracked.get(oldFile) || new Set(),
        next = new Set();
      if (!c.hunks) {
        known = false;
        continue;
      }
      for (const h of c.hunks) {
        const hits = [...old].filter(
          (line) => line >= h.oldStart && line < h.oldStart + h.oldLines,
        ).length;
        if (after && hits) count += hits + h.newLines;
      }
      for (const line of old) {
        let offset = 0,
          removed = false;
        for (const h of c.hunks) {
          if (
            h.oldLines &&
            line >= h.oldStart &&
            line < h.oldStart + h.oldLines
          ) {
            removed = true;
            break;
          }
          if (h.oldLines ? line >= h.oldStart + h.oldLines : line > h.oldStart)
            offset += h.newLines - h.oldLines;
        }
        if (!removed) next.add(line + offset);
      }
      for (const h of c.hunks)
        for (let line = h.newStart; line < h.newStart + h.newLines; line++)
          next.add(line);
      tracked.delete(oldFile);
      tracked.set(c.file, next);
    }
    previous = s.head || null;
  }
  return known ? count : null;
}
