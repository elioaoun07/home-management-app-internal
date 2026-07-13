// Isomorphic markdown line scanner used by Node and the browser bundle.
function scanCore(raw, classify) {
  const rawLines = String(raw).split("\n");
  let bodyStart = 0;
  let frontmatterEnd = -1;
  if (/^---\s*$/.test(rawLines[0] || "")) {
    for (let index = 1; index < rawLines.length; index += 1) {
      if (/^---\s*$/.test(rawLines[index])) {
        frontmatterEnd = index;
        bodyStart = index + 1;
        break;
      }
    }
  }
  const lines = [];
  let inFence = false;
  let checkboxOrdinal = 0;
  for (let index = 0; index < rawLines.length; index += 1) {
    const rawLine = rawLines[index];
    if (index < bodyStart) {
      lines.push(classify(rawLine, index, "fm", { inFence: false }));
      continue;
    }
    const fence = rawLine.match(/^\s*(```|~~~)\s*([^\s`]*)/);
    if (fence) {
      lines.push(classify(rawLine, index, "fence-delim", { marker: fence[1], lang: fence[2] || "", inFence }));
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      lines.push(classify(rawLine, index, "in-fence", { inFence: true }));
      continue;
    }
    const checkbox = rawLine.match(/^(\s*)(?:[-*]|\d+\.)\s+\[([ xX])\]\s?(.*)$/);
    if (checkbox) {
      lines.push(classify(rawLine, index, "checkbox", {
        indent: checkbox[1].length,
        state: /x/i.test(checkbox[2]) ? "done" : "open",
        rest: checkbox[3], cbidx: checkboxOrdinal, inFence: false,
      }));
      checkboxOrdinal += 1;
      continue;
    }
    const heading = rawLine.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (heading) {
      lines.push(classify(rawLine, index, "heading", { level: heading[1].length, text: heading[2], inFence: false }));
      continue;
    }
    if (/^\s*[-*]\s+`\[[^\]]+\]`/.test(rawLine)) {
      lines.push(classify(rawLine, index, "skip-tag", { inFence: false }));
    } else if (/^\s*(?:[-*]|\d+\.)\s+/.test(rawLine)) {
      lines.push(classify(rawLine, index, "bullet", { inFence: false }));
    } else if (/^\s*\|.*\|\s*$/.test(rawLine)) {
      lines.push(classify(rawLine, index, "table-row", { inFence: false }));
    } else if (/^\s*$/.test(rawLine)) {
      lines.push(classify(rawLine, index, "blank", { inFence: false }));
    } else {
      lines.push(classify(rawLine, index, "text", { inFence: false }));
    }
  }
  return { frontmatterEnd, bodyStartLine: bodyStart, lines };
}

export function scanLines(raw) {
  return scanCore(raw, (rawLine, line, type, detail) => ({ raw: rawLine, line, type, ...detail }));
}

export function scanCheckboxes(raw) {
  return scanCore(raw, (_raw, line, type, detail) => ({ line, type, ...detail })).lines
    .filter((entry) => entry.type === "checkbox")
    .map(({ line, state }) => ({ line, state }));
}

