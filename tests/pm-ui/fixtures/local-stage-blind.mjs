// Test-only, randomized unlabeled crops. The reviewer receives the PNG alone;
// the mapping is kept in a separate sealed file until the answers are recorded.
import { randomInt } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { sha256, specimen } from "./local-stage-board.mjs";

export async function runBlindGallery(browser, assets, code, evidence, record) {
  const directory = `${evidence}/blind`;
  mkdirSync(directory, { recursive: true });
  const ids = ["brief", "setup", "explore", "think", "build", "bench", "seal", "verify", "handover", "test", "ship"];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const context = await browser.newContext({ viewport: { width: 1280, height: 1030 }, deviceScaleFactor: 1, serviceWorkers: "block" });
  await context.route("**/*", (route) => route.abort());
  const page = await context.newPage();
  await page.setContent("<!doctype html><html><body></body></html>");
  await page.addStyleTag({ content: assets.bundle.css });
  await page.addScriptTag({ content: code });
  const mapping = [], images = [];
  for (const [index, id] of ids.entries()) {
    const letter = String.fromCharCode(65 + index);
    const crop = await page.evaluate((request) => window.__artGallery.renderCrop(request),
      { run: specimen(), theme: "blue", mode: "zone", id });
    const bytes = Buffer.from(crop.dataUrl.split(",")[1], "base64");
    writeFileSync(`${directory}/${letter}.png`, bytes);
    mapping.push({ letter, zone: id, sha256: sha256(bytes), width: crop.width, height: crop.height });
    images.push({ letter, dataUrl: crop.dataUrl });
  }
  await page.setContent(`<!doctype html><html><head><style>
    *{box-sizing:border-box}body{margin:0;background:#10141d;color:#eef3fb;font:22px monospace}
    main{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;padding:24px;width:1280px}
    figure{margin:0;height:310px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:1px solid #344050}
    figcaption{height:28px}img{height:260px;max-width:276px;object-fit:contain}
    </style></head><body><main>${images.map(({ letter, dataUrl }) =>
      `<figure><figcaption>${letter}</figcaption><img src="${dataUrl}"></figure>`).join("")}</main></body></html>`);
  await page.locator("img").evaluateAll(async (nodes) => Promise.all(nodes.map((node) => node.decode())));
  const path = `${directory}/blind-contact-sheet.png`;
  await page.screenshot({ path, fullPage: true });
  record("blind/blind-contact-sheet");
  writeFileSync(`${directory}/sealed-mapping.json`, JSON.stringify({
    status: "sealed until the blind reviewer records all eleven answers",
    galleryBundle: sha256(code), productBundle: assets.bundleFacts, theme: "blue", mapping,
  }, null, 2));
  await context.close();
  return { image: path, crops: images.map(({ letter }) => `${directory}/${letter}.png`), count: ids.length };
}
