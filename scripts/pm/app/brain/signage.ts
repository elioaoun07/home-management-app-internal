import * as T from "three";

type Treatment = "lintel" | "nameplate" | "floor" | "engraving";

// One mipped atlas for physical signs. The gutter keeps adjacent signs out of
// oblique texture samples. Static signs using this material can share a draw.
export function makeSignage() {
  const sheet = document.createElement("canvas");
  sheet.width = 2048;
  sheet.height = 1296;
  const ctx = sheet.getContext("2d")!;
  const texture = new T.CanvasTexture(sheet);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 8;
  const material = new T.MeshBasicMaterial({
    map: texture, alphaTest: .2, toneMapped: false, polygonOffset: true,
    polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  const cells = new Map<string, number>();
  const cellWidth = 512, cellHeight = 144, gutter = 6;

  return (parent: T.Object3D, name: string, y: number, width: number, style: Treatment = "nameplate") => {
    const key = style + "/" + name;
    const slot = cells.get(key) ?? cells.size;
    const left = (slot % 4) * cellWidth + gutter;
    const top = Math.floor(slot / 4) * cellHeight + gutter;
    const w = cellWidth - gutter * 2, h = cellHeight - gutter * 2;
    if (!cells.has(key)) {
      cells.set(key, slot);
      ctx.save();
      ctx.translate(left, top);
      const plate = style === "lintel" || style === "nameplate";
      if (plate) {
        const paint = ctx.createLinearGradient(0, 0, 0, h);
        paint.addColorStop(0, "#233039");
        paint.addColorStop(.11, "#15242c");
        paint.addColorStop(.78, "#111d24");
        paint.addColorStop(1, "#19272d");
        ctx.fillStyle = paint;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#54616a";
        ctx.fillRect(0, 0, w, 3);
        ctx.fillStyle = "#0a131a";
        ctx.fillRect(0, h - 5, w, 5);
      }
      if (plate) {
        for (const x of [16, w - 16]) {
          ctx.fillStyle = "#52616a";
          ctx.beginPath();
          ctx.arc(x, h / 2, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.fillStyle = style === "floor" ? "#a0a69e" : "#d9e1de";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.font = `500 ${style === "nameplate" ? 98 : 91}px Bahnschrift, "Segoe UI", sans-serif`;
      const metrics = ctx.measureText(name);
      const baseline = (h + metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
      ctx.fillText(name, w / 2, baseline, w - (plate ? 45 : 10));
      ctx.restore();
      texture.needsUpdate = true;
    }
    const geometry = new T.PlaneGeometry(width, width * h / w);
    const uv = geometry.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, (left + uv.getX(i) * w) / sheet.width, 1 - (top + (1 - uv.getY(i)) * h) / sheet.height);
    }
    const sign = new T.Mesh(geometry, material);
    sign.position.set(0, y, .38);
    parent.add(sign);
    return sign;
  };
}
