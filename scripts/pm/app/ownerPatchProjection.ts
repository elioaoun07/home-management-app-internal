import * as T from "three";

// The reader owns file selection and the complete patch. Project just the first
// changed hunk from those same bytes onto the glass above the Merge emitter.
export function mountPatchProjection(berth: T.Group) {
  const material = new T.MeshBasicMaterial({
    side: T.DoubleSide,
    toneMapped: false,
    alphaTest: .45,
  });
  const screen = new T.Mesh(new T.PlaneGeometry(2.62, 1.42), material);
  screen.position.set(0, 2.07, 0.2);
  const rays = new T.BufferGeometry();
  const corners = new T.Float32BufferAttribute(new Float32Array(9), 3);
  rays.setAttribute("position", corners);
  const beam = new T.Mesh(rays, new T.MeshBasicMaterial({
    color: "#75cdd9", transparent: true, opacity: .10, depthWrite: false,
    blending: T.AdditiveBlending, side: T.DoubleSide, toneMapped: false,
  }));
  berth.add(screen, beam);
  screen.visible = false;
  beam.visible = false;
  let previous: string | null | undefined;
  let previousCompact = false;
  let previousAspect = 0;
  let pageRatio = 1;

  function fitGlass(aspect: number) {
    // Frame the glass at its station's walk-up position. Portrait has less
    // horizontal field of view, so reflow those lines onto a narrower panel.
    const width = Math.min(2.62, 2 * aspect);
    const height = width * pageRatio;
    screen.scale.set(width / 2.62, height / 1.42, 1);
    corners.setXYZ(0, 0, 1.30, -.05);
    corners.setXYZ(1, -width * .48, screen.position.y - height / 2, .19);
    corners.setXYZ(2, width * .48, screen.position.y - height / 2, .19);
    corners.needsUpdate = true;
    rays.computeBoundingSphere();
    previousAspect = aspect;
  }
  return (patch: string | null | undefined, compact: boolean, aspect = 16 / 9) => {
    if (patch === previous && compact === previousCompact) {
      if (screen.visible && aspect !== previousAspect) fitGlass(aspect);
      return;
    }
    previous = patch;
    previousCompact = compact;
    material.map?.dispose();
    material.map = null;
    screen.visible = beam.visible = false;
    if (!patch) return;
    let path = "",
      hunk = "";
    const removed: string[] = [],
      added: string[] = [];
    for (const line of patch.split(/\r?\n/u)) {
      if (line.startsWith("@@ ")) {
        if (added.length || removed.length) break;
        hunk = line;
      } else if (hunk) {
        if (line.startsWith("diff --git ")) break;
        if (line.startsWith("+") && added.length < 2) added.push(line);
        if (line.startsWith("-") && removed.length < 2) removed.push(line);
      } else if (/^(\+\+\+|---) /u.test(line) && !line.endsWith("/dev/null")) {
        path =
          line
            .slice(4)
            .replace(/^[ab]\//u, "")
            .split("/")
            .at(-1) || "";
      }
      if (added.length === 2 && removed.length === 2) break;
    }
    if (!added.length && !removed.length) return;
    const page = document.createElement("canvas");
    page.width = compact ? 540 : 840;
    const g = page.getContext("2d");
    if (!g) return;
    const fontSize = compact ? 27 : 29;
    const lineHeight = fontSize + 6;
    const codeFont = fontSize + "px monospace";
    g.font = codeFont;
    const columns = Math.floor((page.width - 94) / g.measureText("M").width);
    const preview = compact ? [...removed.slice(0, 1), ...added.slice(0, 1)] : [...removed, ...added];
    const rows = preview.map(line => {
      const code = line.slice(1).replace(/\t/gu, "  ");
      const lines = [code.slice(0, columns)];
      if (code.length > columns) lines.push(code.length > columns * 2
        ? code.slice(columns, columns * 2 - 1) + "…" : code.slice(columns));
      return { change: line[0], lines, height: lines.length * lineHeight + 12 };
    });
    page.height = 123 + rows.reduce((total, row) => total + row.height + 4, 0);
    pageRatio = page.height / page.width;
    fitGlass(aspect);
    g.beginPath();
    g.moveTo(22, 4); g.lineTo(page.width - 4, 4); g.lineTo(page.width - 4, page.height - 22);
    g.lineTo(page.width - 22, page.height - 4); g.lineTo(4, page.height - 4);
    g.lineTo(4, 22); g.closePath();
    const glass = g.createLinearGradient(0, 0, 0, page.height);
    glass.addColorStop(0, "#18333e"); glass.addColorStop(.24, "#10242c"); glass.addColorStop(1, "#10202c");
    g.fillStyle = glass; g.fill(); g.strokeStyle = "#92cdd3"; g.lineWidth = 3; g.stroke();
    g.fillStyle = "#e1f5f6";
    g.font = "600 29px monospace";
    g.fillText(path || "Diff", 24, 45, page.width - 48);
    g.fillStyle = "#a7b9d3";
    g.font = "22px monospace";
    g.fillText(hunk.split("@@")[1]?.trim() || "", 24, 81);
    g.font = codeFont;
    let y = 105;
    for (const { change, lines, height } of rows) {
      g.fillStyle = change === "+" ? "#183c3c" : "#332f4b";
      g.fillRect(14, y, page.width - 28, height);
      g.fillStyle = change === "+" ? "#a4f5d5" : "#e0c9ff";
      g.fillText(change, 26, y + fontSize + 3);
      lines.forEach((text, i) =>
        g.fillText(text, 60, y + fontSize + 3 + lineHeight * i),
      );
      y += height + 4;
    }
    const texture = new T.CanvasTexture(page);
    texture.colorSpace = T.SRGBColorSpace;
    texture.anisotropy = 4;
    material.map = texture;
    material.needsUpdate = true;
    screen.visible = beam.visible = true;
  };
}
