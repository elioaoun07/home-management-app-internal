export function parseFrontmatter(raw) {
  const lines = String(raw).split("\n");
  if (!/^---\s*$/.test(lines[0] || "")) return { meta: {}, body: String(raw), bodyStartLine: 0 };
  let end = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (/^---\s*$/.test(lines[index])) { end = index; break; }
  }
  if (end < 0) return { meta: {}, body: String(raw), bodyStartLine: 0 };
  const meta = {};
  let activeList = null;
  for (const line of lines.slice(1, end)) {
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && activeList) { meta[activeList].push(item[1].trim()); continue; }
    const pair = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (!pair) continue;
    const value = pair[2].trim().replace(/^['"]|['"]$/g, "");
    if (!value) { meta[pair[1]] = []; activeList = pair[1]; }
    else { meta[pair[1]] = value; activeList = null; }
  }
  return { meta, body: lines.slice(end + 1).join("\n"), bodyStartLine: end + 1 };
}

