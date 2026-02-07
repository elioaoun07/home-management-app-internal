// Script to generate all app icons from SVGs
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const outputDir = path.join(__dirname, "../public");

const iconSets = [
  {
    svg: path.join(__dirname, "../public/appicon.svg"),
    outputs: [
      { name: "appicon-192.png", size: 192 },
      { name: "appicon-512.png", size: 512 },
      { name: "appicon-maskable-512.png", size: 512 },
      { name: "apple-touch-icon.png", size: 180 },
    ],
  },
  {
    svg: path.join(__dirname, "../public/catalogue-icon.svg"),
    outputs: [
      { name: "catalogue-180.png", size: 180 },
      { name: "catalogue-192.png", size: 192 },
      { name: "catalogue-512.png", size: 512 },
      { name: "catalogue-maskable-512.png", size: 512 },
    ],
  },
];

async function generateIcons() {
  for (const set of iconSets) {
    const svgBuffer = fs.readFileSync(set.svg);
    for (const { name, size } of set.outputs) {
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(path.join(outputDir, name));
      console.log(`  ✓ ${name} (${size}x${size})`);
    }
    console.log(`  Done: ${path.basename(set.svg)}\n`);
  }
  console.log("All icons generated successfully!");
}

generateIcons().catch(console.error);
