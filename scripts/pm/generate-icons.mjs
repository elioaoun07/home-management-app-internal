#!/usr/bin/env node
// Generate PM Command Center PWA icons from scripts/pm/assets/pm-icon.svg.
// Standalone on purpose — scripts/generate-icons.cjs writes into the deployed
// app's public/, while these PNGs stay under scripts/pm/assets/ and are
// committed so pm-server needs no image tooling at runtime.
//   pnpm pm:icons
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(HERE, "assets");
const SRC = join(ASSETS, "pm-icon.svg");
const OUTPUTS = [
  { size: 180, file: "pm-180.png" },
  { size: 192, file: "pm-192.png" },
  { size: 512, file: "pm-512.png" },
  { size: 512, file: "pm-maskable-512.png" },
];

let sharp = null;
try {
  sharp = (await import("sharp")).default;
} catch {
  // fall back to resvg below
}

if (sharp) {
  for (const { size, file } of OUTPUTS) {
    console.log(`  ${file} (${size}x${size})`);
    await sharp(SRC, { density: Math.max(72, size) })
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(join(ASSETS, file));
  }
} else {
  console.log("  sharp unavailable — using @resvg/resvg-js");
  const { Resvg } = await import("@resvg/resvg-js");
  const svg = readFileSync(SRC, "utf8");
  for (const { size, file } of OUTPUTS) {
    console.log(`  ${file} (${size}x${size})`);
    const resvg = new Resvg(svg, { fitTo: { mode: "width", value: size }, background: "rgba(0,0,0,0)" });
    writeFileSync(join(ASSETS, file), resvg.render().asPng());
  }
}
console.log("PM icons generated in scripts/pm/assets/");
