import AtlasShell from "@/components/atlas/AtlasShell";
import type { AtlasData } from "@/features/atlas/types";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const dynamic = "force-static";

export const metadata = {
  title: "Atlas · Page & Feature Map",
};

function loadAtlas(): AtlasData {
  try {
    const file = join(process.cwd(), "public", "atlas", "atlas.json");
    const raw = readFileSync(file, "utf8");
    return JSON.parse(raw) as AtlasData;
  } catch {
    return { generatedAt: new Date().toISOString(), count: 0, nodes: [] };
  }
}

export default function AtlasPage() {
  const data = loadAtlas();
  return <AtlasShell data={data} />;
}
