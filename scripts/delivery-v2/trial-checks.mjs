// DLV-107 protected acceptance check. Render the actual missing-item component
// against synthetic shipped/discarded receipts; never ship a real backlog item.
import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(process.argv[2] || process.cwd());
// Keep the emitted bundle under the workspace: it stays writable on Windows and
// can resolve the external React packages from this project's node_modules.
const out = resolve(process.argv[3] || join(root, ".tmp", "era-dlv107-render"));
const expectOld = process.argv.includes("--expect-current-bug");
mkdirSync(out, { recursive: true });
const bundle = await build({
  stdin: { contents: `import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import {WorkView} from './scripts/pm/app/Work.tsx'; export const render = campaign => renderToStaticMarkup(React.createElement(WorkView,{campaign,id:'DLV-107'}));`, resolveDir: root, loader: "tsx" },
  bundle: true, platform: "node", format: "esm", packages: "external", write: false,
  jsx: "automatic", logLevel: "silent",
  plugins: [{ name: "synthetic-world", setup(builder) {
    builder.onResolve({ filter: /^\.\/(state|transport|components|DeliveryV2)$/ }, args => args.importer.replaceAll("\\", "/").endsWith("/app/Work.tsx") ? { path: args.path, namespace: "fixture" } : undefined);
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ loader: "jsx", resolveDir: root, contents: args.path === "./state"
      ? "export const useWorld=()=>({world:{work:[],receipts:[globalThis.__receipt]},runs:[],connected:true});export const useRoute=()=>({});export const useCommand=()=>({});"
      : args.path === "./transport" ? "export const transport={};"
        : args.path === "./DeliveryV2" ? "export const useV2Runs=()=>({data:{runs:[]}});export const V2RunLink=()=>null;"
          : "import React from 'react';export const Empty=({children})=><section>{children}</section>;export const Back=()=>null;export const ErrorNotice=()=>null;export const Markdown=()=>null;export const OutcomeButton=()=>null;export const SpaceIcon=()=>null;export const WorkLink=()=>null;" }));
  } }],
});
const path = join(out, "dlv107-render.mjs");
writeFileSync(path, bundle.outputFiles[0].text);
const { render } = await import(pathToFileURL(path).href);
let checked = 0;
for (const campaign of ["Delivery", "Hub & ERA", "PM Tooling"]) {
  for (const kind of ["shipped", "discarded"]) {
    globalThis.__receipt = { id: "DLV-107", module: campaign, kind };
    const markup = render(campaign);
    const href = /href="([^"]+)"/u.exec(markup)?.[1].replaceAll("&amp;", "&");
    if (!href) throw new Error("Missing history link for " + kind);
    const [pathPart, search] = href.slice(1).split("?");
    if (!pathPart.endsWith("/" + encodeURIComponent(campaign))) throw new Error("Campaign identity lost: " + href);
    const query = new URLSearchParams(search);
    if (expectOld ? query.get("view") !== "story" || query.has("tab") : query.get("tab") !== "story") throw new Error("History navigation failed: " + href);
    checked += 1;
  }
}
process.stdout.write((expectOld ? "Known bug reproduced" : "History navigation passed") + ": " + checked + " synthetic cases\n");
