// Script to generate catalogue icons from SVG
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const svgPath = path.join(__dirname, "../public/catalogue-icon.svg");
const outputDir = path.join(__dirname, "../public");

const sizes = [
  { name: "catalogue-180.png", size: 180 },
  { name: "catalogue-192.png", size: 192 },
  { name: "catalogue-512.png", size: 512 },
  { name: "catalogue-maskable-512.png", size: 512 },
];

async function generateIcons() {
  const svgBuffer = fs.readFileSync(svgPath);

  for (const { name, size } of sizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(outputDir, name));
    console.log(`Generated ${name}`);
  }

  console.log("All icons generated successfully!");
}

generateIcons().catch(console.error);
