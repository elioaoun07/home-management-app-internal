import { useEffect, useState } from "react";
import { useCommand, useRoute, useWorld, type UndoSnapshot } from "./state";
import { transport } from "./transport";
import { scanCheckboxes } from "../shared/md-scan.mjs";
import { PageTitle, Markdown, ErrorNotice, Sheet } from "./components";
import { UndoNotice } from "./Work";
import type { SourceFile } from "./types";
import { useFileUndo } from "./LibraryActions";
import { headingAnchors } from "../shared/links.mjs";
import { DetailLink } from "./DetailLink";

const parent = (p: string) => p.split("/").slice(0, -1).join("/");
export const readerBody = (raw: string) =>
  raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, (block) =>
    block.replace(/[^\r\n]/g, ""),
  );
const savedPaths = (key: string): string[] => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value)
      ? value.filter((p): p is string => typeof p === "string")
      : [];
  } catch {
    return [];
  }
};
export function DocumentNavigation({ file }: { file: SourceFile }) {
  const { world } = useWorld();
  const [pins, setPins] = useState(() => savedPaths("pm-pins"));
  const siblings = world.files
    .filter((f) => parent(f.relPath) === parent(file.relPath))
    .sort((a, b) =>
      a.relPath.localeCompare(b.relPath, undefined, { numeric: true }),
    );
  const at = siblings.findIndex((f) => f.relPath === file.relPath);
  const toggle = () => {
    const next = pins.includes(file.relPath)
      ? pins.filter((p) => p !== file.relPath)
      : [...pins, file.relPath];
    setPins(next);
    try {
      localStorage.setItem("pm-pins", JSON.stringify(next));
    } catch {}
  };
  useEffect(() => {
    try {
      localStorage.setItem(
        "pm-recents",
        JSON.stringify(
          [
            file.relPath,
            ...savedPaths("pm-recents").filter((p) => p !== file.relPath),
          ].slice(0, 5),
        ),
      );
    } catch {}
  }, [file.relPath]);
  return (
    <nav className="cockpit-tools" aria-label="Document navigation">
      <button
        className="secondary"
        aria-pressed={pins.includes(file.relPath)}
        onClick={toggle}
      >
        {pins.includes(file.relPath) ? "Unpin" : "Pin"}
      </button>
      {[at - 1, at + 1].map(
        (i) =>
          siblings[i] && (
            <a
              key={i}
              className="secondary"
              href={`#/read?file=${encodeURIComponent(siblings[i].relPath)}`}
            >
              {i < at ? "Previous" : "Next"}
            </a>
          ),
      )}
      <select
        aria-label="Contents"
        value=""
        onChange={(e) =>
          document
            .getElementById(e.target.value)
            ?.scrollIntoView({ block: "start" })
        }
      >
        <option value="">Contents</option>
        {headingAnchors(readerBody(file.raw)).map((h) => (
          <option key={h.anchor} value={h.anchor}>
            {h.text}
          </option>
        ))}
      </select>
    </nav>
  );
}
export function DocumentBody({ file }: { file: SourceFile }) {
  const command = useCommand(),
    { connected } = useWorld();
  const [undo, setUndo] = useState<UndoSnapshot[] | null>(null);
  const change = async (ordinal: number) => {
    const row = scanCheckboxes(file.raw)[ordinal];
    const result = await command.mutateAsync({
      op: "toggle",
      body: {
        file: file.relPath,
        cbidx: ordinal,
        expectLine: file.raw.split(/\r?\n/)[row.line],
        expectState: row.state,
      },
    });
    if (result.undo) setUndo(result.undo);
  };
  return (
    <>
      <ErrorNotice error={command.error} />
      <Markdown
        raw={readerBody(file.raw)}
        file={file.relPath}
        onToggle={
          transport().capabilities.planWrites && connected && !command.isPending
            ? (ordinal) => {
                void change(ordinal).catch(() => {});
              }
            : undefined
        }
      />
      {undo && <UndoNotice snapshots={undo} onClose={() => setUndo(null)} />}
    </>
  );
}
export function FileTools({
  path = "",
  folder = false,
  onChange,
}: {
  path?: string;
  folder?: boolean;
  onChange?: (path: string, kind?: string) => void;
}) {
  const { world, connected } = useWorld(),
    command = useCommand();
  const [op, setOp] = useState(""),
    [name, setName] = useState(""),
    [dir, setDir] = useState(parent(path)),
    [kind, setKind] = useState("file");
  const [order, setOrder] = useState<string[]>([]);
  const { save: setInverse, busy: undoPending } = useFileUndo();
  const folders = [
    "",
    ...new Set([
      ...(world.directories || []),
      ...world.files.flatMap((f) => {
        const parts = f.relPath.split("/");
        return parts
          .slice(0, -1)
          .map((_, i) => parts.slice(0, i + 1).join("/"));
      }),
    ]),
  ].sort();
  if (
    transport().capabilities.kind !== "local" ||
    !transport().capabilities.planWrites
  )
    return null;
  const open = (action: string) => {
    const target = folder ? path : parent(path);
    setOp(action);
    setName(
      action === "create"
        ? ""
        : path.split("/").at(-1)?.replace(/\.md$/i, "") || "",
    );
    setDir(action === "move" ? parent(path) : target);
    const list = world.files
      .filter(
        (f) =>
          parent(f.relPath) === target &&
          /^\d+\s*-/.test(f.relPath.split("/").at(-1) || ""),
      )
      .map((f) => f.relPath.split("/").at(-1)!)
      .sort((a, b) => parseInt(a) - parseInt(b));
    setOrder(list);
  };
  const submit = async () => {
    const body =
      op === "create"
        ? { dir, name, kind }
        : op === "move"
          ? { from: path, toDir: dir }
          : op === "rename"
            ? { path, name }
            : op === "reorder"
              ? { dir, order }
              : { path };
    const result = await command.mutateAsync({ op, body });
    const back = folder
      ? `/library?folder=${encodeURIComponent(path)}`
      : `/read?file=${encodeURIComponent(path)}`;
    const originalName = path.split("/").at(-1) || "";
    if (op === "create" && result.path)
      setInverse([{ op: "delete", body: { path: result.path } }], "/library");
    if (op === "rename" && result.path)
      setInverse(
        [{ op: "rename", body: { path: result.path, name: originalName } }],
        back,
      );
    if (op === "move" && result.path)
      setInverse(
        [
          { op: "move", body: { from: result.path, toDir: parent(path) } },
          { op: "rename", body: { name: originalName }, previousPath: "path" },
        ],
        back,
      );
    if (op === "delete" && result.trashed)
      setInverse(
        [
          { op: "move", body: { from: result.trashed, toDir: parent(path) } },
          { op: "rename", body: { name: originalName }, previousPath: "path" },
        ],
        back,
      );
    if (op === "reorder" && result.undo)
      setInverse([{ op: "restore", body: { snapshots: result.undo } }], back);
    setOp("");
    if (result.path)
      onChange?.(
        result.path,
        op === "create" ? kind : folder ? "folder" : "file",
      );
    else if (op === "delete") location.hash = "/library";
    else if (op === "reorder" && !folder && order.includes(originalName))
      onChange?.(
        `${dir ? dir + "/" : ""}${order.indexOf(originalName) + 1} - ${originalName.replace(/^\d+\s*-+\s*/, "")}`,
        "file",
      );
  };
  return (
    <>
      <div className="cockpit-tools">
        {[
          "create",
          ...(path ? ["rename", "move", "reorder", "delete"] : []),
        ].map((action) => (
          <button
            className="secondary"
            key={action}
            disabled={!connected || command.isPending || undoPending}
            onClick={() => open(action)}
          >
            {action[0].toUpperCase() + action.slice(1)}
          </button>
        ))}
      </div>
      <Sheet
        title={op ? op[0].toUpperCase() + op.slice(1) : "Files"}
        open={!!op}
        onClose={() => setOp("")}
      >
        <form
          className="library-form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit().catch(() => {});
          }}
        >
          <ErrorNotice error={command.error} />
          {["create", "rename"].includes(op) && (
            <label>
              Name{" "}
              <input
                aria-label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
          )}
          {["create", "move"].includes(op) && (
            <label>
              Folder{" "}
              <select
                aria-label="Folder"
                value={dir}
                onChange={(e) => setDir(e.target.value)}
              >
                {folders
                  .filter(
                    (f) =>
                      op !== "move" ||
                      !path ||
                      (f !== path && !f.startsWith(path + "/")),
                  )
                  .map((f) => (
                    <option key={f} value={f}>
                      {f || "PM root"}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {op === "create" && (
            <label>
              Type{" "}
              <select
                aria-label="Type"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                <option value="file">Document</option>
                <option value="folder">Folder</option>
              </select>
            </label>
          )}
          {op === "delete" && <p>Move to trash?</p>}
          {op === "reorder" &&
            order.map((n, i) => (
              <div className="cockpit-tools" key={n}>
                <span>{n}</span>
                {[-1, 1].map((d) => (
                  <button
                    type="button"
                    className="secondary"
                    key={d}
                    disabled={i + d < 0 || i + d >= order.length}
                    aria-label={`${d < 0 ? "Up" : "Down"} ${n}`}
                    onClick={() => {
                      const next = [...order];
                      [next[i], next[i + d]] = [next[i + d], next[i]];
                      setOrder(next);
                    }}
                  >
                    {d < 0 ? "↑" : "↓"}
                  </button>
                ))}
              </div>
            ))}
          <button
            className="primary"
            disabled={command.isPending || undoPending}
          >
            {op === "delete" ? "Trash" : "Save"}
          </button>
        </form>
      </Sheet>
    </>
  );
}
export function Library() {
  const { world, connected } = useWorld(),
    route = useRoute(),
    command = useCommand();
  const [search, setSearch] = useState(route.query.get("q") || ""),
    [capture, setCapture] = useState(route.query.get("capture") || "");
  const { save: setInverse } = useFileUndo();
  const folder = route.query.get("folder") || "";
  const files = world.files.filter(
    (f) =>
      (!folder || f.relPath.startsWith(folder + "/")) &&
      `${f.relPath}\n${f.raw}`.toLowerCase().includes(search.toLowerCase()),
  );
  const [pins, setPins] = useState(() => savedPaths("pm-pins"));
  const recents = savedPaths("pm-recents");
  return (
    <div className="cockpit">
      <PageTitle title="Library" />
      <nav className="cockpit-tools">
        <a href="#/explore">Work</a>
        <a href="#/attention">Decisions</a>
        <a href="#/activity">History</a>
        <a href="#/read?file=0%20-%20Inbox.md">Inbox</a>
      </nav>
      {route.query.has("capture") && (
        <form
          className="library-form"
          onSubmit={(e) => {
            e.preventDefault();
            void command
              .mutateAsync({
                op: "append",
                body: {
                  file: "0 - Inbox.md",
                  afterHeading: "New",
                  line: `- [ ] ${capture.trim().replace(/\r?\n/g, " · ")}`,
                },
              })
              .then((result) => {
                if (result.undo)
                  setInverse(
                    [{ op: "restore", body: { snapshots: result.undo } }],
                    "/library",
                  );
                location.hash = "/read?file=0%20-%20Inbox.md";
              })
              .catch(() => {});
          }}
        >
          <textarea
            aria-label="Item capture"
            value={capture}
            onChange={(e) => setCapture(e.target.value)}
          />
          <button
            className="primary"
            disabled={
              !capture.trim() ||
              !connected ||
              command.isPending ||
              !transport().capabilities.capture
            }
          >
            Capture
          </button>
          <ErrorNotice error={command.error} />
        </form>
      )}
      <FileTools
        key={folder}
        path={folder}
        folder
        onChange={(p, kind) =>
          (location.hash =
            kind === "folder"
              ? `/library?folder=${encodeURIComponent(p)}`
              : `/read?file=${encodeURIComponent(p)}`)
        }
      />
      <nav className="cockpit-tools">
        <a href="#/library">All documents</a>
        {world.directories
          ?.filter((d) => parent(d) === folder)
          .map((d) => (
            <a key={d} href={`#/library?folder=${encodeURIComponent(d)}`}>
              {d.split("/").at(-1)}/
            </a>
          ))}
      </nav>
      <input
        type="search"
        aria-label="Search documents"
        placeholder="Search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {[
        { label: "Pinned", paths: pins },
        { label: "Recent", paths: recents },
      ].map((group) => (
        <details key={group.label}>
          <summary>{group.label}</summary>
          {group.paths
            .filter((p) => world.files.some((f) => f.relPath === p))
            .map((p) => (
              <a
                key={p}
                className="session-identity"
                href={`#/read?file=${encodeURIComponent(p)}`}
              >
                {p}
              </a>
            ))}
        </details>
      ))}
      <div className="library-files">
        {files.map((f) => (
          <DetailLink
            key={f.relPath}
            href={`#/read?file=${encodeURIComponent(f.relPath)}`}
            onPin={() => {
              const next = pins.includes(f.relPath)
                ? pins.filter((p) => p !== f.relPath)
                : [...pins, f.relPath];
              setPins(next);
              try {
                localStorage.setItem("pm-pins", JSON.stringify(next));
              } catch {}
            }}
          >
            {f.relPath}
          </DetailLink>
        ))}
      </div>
    </div>
  );
}
