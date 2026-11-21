import { stripVTControlCharacters } from "node:util";

/** Keep diagnostic identities and totals before their optional error context. */
export function decisiveLines(text) {
  const lines = stripVTControlCharacters(String(text ?? "")).split(/\r?\n/u).map(line => line.trimEnd());
  const kept = new Set();
  const take = indexes => {
    const fresh = indexes.filter(index => !kept.has(index));
    if (kept.size + fresh.length <= 12) fresh.forEach(index => kept.add(index));
  };
  const fail = [], totals = [], other = [];
  const lintRow = /^\s*\d+:\d+\s+(?:error|warning)\b/u;
  const lintFileBefore = index => {
    for (let i = index - 1; i >= 0; i--) {
      const line = lines[i];
      if (!line.trim() || lintRow.test(line)) continue;
      return !/^\s/u.test(line) && /[\\/]|^\S.*\.[a-z0-9]+$/iu.test(line) ? i : null;
    }
    return null;
  };
  lines.forEach((line, index) => {
    if (/^\s*FAIL(?:\s|$)/u.test(line)) fail.push(index);
    else if (/^\s*(?:Test Files|Tests)\s+/u.test(line)) totals.push(index);
    else if (/\berror TS\d+\b/u.test(line) || /^\s*fatal:/u.test(line)) other.push([index]);
    else if (/^\s*\d+:\d+\s+error\b/u.test(line)) {
      const file = lintFileBefore(index);
      other.push(file === null ? [index] : [file, index]);
    }
  });
  totals.forEach(index => take([index]));
  fail.forEach(index => take([index]));
  other.forEach(take);
  fail.forEach((index, position) => {
    if (!kept.has(index)) return;
    const end = fail[position + 1] ?? lines.length;
    for (let i = index + 1; i < end; i++) {
      if (/^\s*(?:Test Files|Tests)\s+/u.test(lines[i])) break;
      if (/^\s*(?:AssertionError|Error)(?::|\s|$)/u.test(lines[i])) { take([i]); break; }
    }
  });
  return kept.size ? [...kept].sort((a, b) => a - b).map(index => lines[index]).join("\n")
    : lines.filter(line => line.trim()).slice(-12).join("\n");
}
