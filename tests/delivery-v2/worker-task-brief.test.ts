import { beforeEach, describe, expect, it, vi } from "vitest";
import { fingerprint } from "../../scripts/delivery-v2/contracts.mjs";

const fs = vi.hoisted(() => ({ files: new Map<string, string>(), link: false, options: null as unknown }));
vi.mock("node:fs", () => ({
  writeFileSync: (path: string, text: string, options: unknown) => {
    if (fs.files.has(path)) throw Object.assign(new Error("exists"), { code: "EEXIST" });
    fs.options = options; fs.files.set(path, text);
  },
  readFileSync: (path: string) => fs.files.get(path),
  lstatSync: () => ({ isFile: () => !fs.link, isSymbolicLink: () => fs.link }),
}));
import { installTaskBrief } from "../../scripts/delivery-v2/worker/task-brief.mjs";

beforeEach(() => { fs.files.clear(); fs.link = false; fs.options = null; });
describe("worker recovery input materialization (isolated filesystem)", () => {
  const text = '{"binding":"Inspect before editing","plan":{"revision":2}}';
  const digest = fingerprint(text);
  const brief = { text, digest, path: "/tmp/era-task-brief-" + digest.replace(/[^a-z0-9]/gi, "") + ".json" };
  it("writes exact supervisor bytes read-only and accepts an identical retry", () => {
    expect(installTaskBrief(brief)).toBe(brief.path);
    expect(fs.options).toEqual({ flag: "wx", mode: 0o400 });
    expect(fs.files.get(brief.path)).toBe(text);
    expect(installTaskBrief(brief)).toBe(brief.path);
    expect(fs.files.size).toBe(1);
  });
  it.each([false, true])("refuses changed bytes or a link (link=%s)", link => {
    fs.files.set(brief.path, link ? text : "replaced"); fs.link = link;
    expect(() => installTaskBrief(brief)).toThrow("exists");
  });
});
