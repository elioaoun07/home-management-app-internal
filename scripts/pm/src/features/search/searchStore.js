import { signal } from "@preact/signals";
import { createSearchService } from "./searchIndex.js";

export const searchReady = signal(false);
export const searchService = createSearchService();
let fingerprints = new Map();
export function syncSearch(files) {
  const next = new Map(files.map((file) => [file.relPath, file.mtimeMs]));
  const run = () => {
    if (!searchReady.value) searchService.build(files);
    else {
      for (const path of fingerprints.keys()) if (!next.has(path)) searchService.remove(path);
      for (const file of files) if (fingerprints.get(file.relPath) !== file.mtimeMs) searchService.replace(file);
    }
    fingerprints = next;
    searchReady.value = true;
  };
  if (typeof requestIdleCallback === "function") requestIdleCallback(run, { timeout: 800 }); else setTimeout(run, 0);
}
