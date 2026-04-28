export type AtlasCategory =
  | "auth"
  | "main-tab"
  | "standalone-page"
  | "feature"
  | "junction"
  | "utility"
  | "background"
  | "uncategorized";

export type AtlasNode = {
  slug: string;
  title: string;
  category: AtlasCategory | string;
  route: string | null;
  type: "page" | "feature" | "junction" | "api-only" | string;
  parent: string | null;
  children: string[];
  status: "active" | "wip" | "deprecated" | string;
  tags: string[];
  sections: Record<string, string>;
  screenshots: string[];
  sourceFile: string;
};

export type AtlasData = {
  generatedAt: string;
  count: number;
  nodes: AtlasNode[];
};
