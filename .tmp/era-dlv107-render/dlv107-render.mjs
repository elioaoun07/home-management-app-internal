// <stdin>
import React2 from "react";
import { renderToStaticMarkup } from "react-dom/server";

// scripts/pm/app/Work.tsx
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ClipboardCopy, LockKeyhole, Undo2 } from "lucide-react";

// fixture:./state
var useWorld = () => ({ world: { work: [], receipts: [globalThis.__receipt] }, runs: [], connected: true });
var useRoute = () => ({});
var useCommand = () => ({});

// fixture:./transport
var transport = {};

// scripts/pm/shared/links.mjs
function slugify(value) {
  return String(value || "").toLowerCase().replace(/<[^>]+>/g, "").replace(/[^\p{L}\p{N}\s_-]/gu, "").trim().replace(/\s/g, "-");
}

// scripts/pm/shared/work-id.mjs
var NUMBER = String.raw`\d+[a-z]?(?:\.\d+[a-z]?)*`;
var NUMBER_ONLY = new RegExp(`^${NUMBER}$`, "i");
var CHIP_ID_SOURCE = String.raw`[A-Z]{1,5}-?${NUMBER}`;
var CHIP_LINE = new RegExp(String.raw`^\s*-\s*\[[ xX]\]\s*\*\*(${CHIP_ID_SOURCE})\*\*`, "i");

// scripts/pm/shared/tasks.mjs
var CHIP_ID = new RegExp(String.raw`(?:^|\s)\*\*(${CHIP_ID_SOURCE})\*\*`, "i");

// scripts/pm/shared/history.mjs
var EXACT_LEAD = new RegExp(String.raw`^(${CHIP_ID_SOURCE})(?:\s*[:—–]\s+\S.*|\s+-\s+\S.*|\s*\(([^)]*)\))?$`, "i");

// scripts/pm/shared/product.mjs
var isTerminal = (state) => ["SHIPPED", "CANCELLED", "FAILED"].includes(state);

// scripts/pm/shared/portfolio.mjs
var KINDS = ["feature", "bug", "maintenance", "investigation", "verification"];

// scripts/pm/app/model.ts
var liveRuns = (runs) => runs.filter((run) => !isTerminal(run.state));
var runFor = (work, runs) => liveRuns(runs).find(
  (run) => run.item.id === work.id && run.item.campaign === work.module
);
var workPath = (work, from = "/explore") => `/work/${encodeURIComponent(work.module)}/${encodeURIComponent(work.id)}?from=${encodeURIComponent(from)}`;
var spacePath = (name) => `/space/${encodeURIComponent(name)}`;
var readerPath = (file, anchor, from) => `/read?file=${encodeURIComponent(file)}${anchor ? `&anchor=${encodeURIComponent(anchor)}` : ""}${from ? `&from=${encodeURIComponent(from)}` : ""}`;
var chipAnchor = (work) => slugify(work.idChip || work.id);
var checklistPath = (work, from) => readerPath(work.file, chipAnchor(work), from);
function briefPath(work, world, from) {
  const book = world.spaces.find((space) => space.name === work.module)?.book;
  return book && work.briefAnchor ? readerPath(book.relPath, work.briefAnchor, from) : checklistPath(work, from);
}
var KIND_OPTIONS = [...KINDS, "unclassified"];

// fixture:./components
import React from "react";
import { jsx } from "react/jsx-runtime";
var Empty = ({ children }) => /* @__PURE__ */ jsx("section", { children });
var Back = () => null;
var ErrorNotice = () => null;
var Markdown = () => null;
var OutcomeButton = () => null;
var SpaceIcon = () => null;
var WorkLink = () => null;

// fixture:./DeliveryV2
var useV2Runs = () => ({ data: { runs: [] } });
var V2RunLink = () => null;

// scripts/pm/app/Work.tsx
import { Fragment, jsx as jsx2, jsxs } from "react/jsx-runtime";
function UndoNotice({
  snapshots,
  onClose
}) {
  const command = useCommand();
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (command.isPending || command.error) return;
    const timer = setTimeout(() => close.current(), 4e3);
    return () => clearTimeout(timer);
  }, [command.isPending, command.error]);
  return /* @__PURE__ */ jsxs("div", { className: "undo-notice", role: "status", children: [
    /* @__PURE__ */ jsx2("span", { children: "Saved" }),
    /* @__PURE__ */ jsxs(
      "button",
      {
        disabled: command.isPending,
        onClick: () => command.mutate(
          { op: "restore", body: { snapshots } },
          { onSuccess: onClose }
        ),
        children: [
          /* @__PURE__ */ jsx2(Undo2, { size: 15 }),
          "Undo"
        ]
      }
    ),
    command.error && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx2("span", { children: command.error.message }),
      /* @__PURE__ */ jsx2("button", { onClick: onClose, children: "Dismiss" })
    ] })
  ] });
}
function WorkView({ campaign, id }) {
  const { world, runs, connected } = useWorld();
  const route = useRoute();
  const v2 = useV2Runs();
  const work = world.work.find(
    (item) => item.id === id && item.module === campaign
  );
  const command = useCommand();
  const [undo, setUndo] = useState(null);
  const [copied, setCopied] = useState(false);
  const attempts = (v2.data?.runs || []).filter(
    (run2) => run2.campaign === campaign && String(run2.alias || "").toUpperCase() === String(id).toUpperCase()
  );
  if (!work)
    return /* @__PURE__ */ jsxs("div", { className: "focus-page", children: [
      /* @__PURE__ */ jsx2(Back, {}),
      attempts.length ? /* @__PURE__ */ jsxs("section", { className: "focus-section", children: [
        /* @__PURE__ */ jsx2("h1", { children: id }),
        /* @__PURE__ */ jsx2("h2", { children: "Delivery history" }),
        attempts.map((attempt) => /* @__PURE__ */ jsx2(V2RunLink, { run: attempt, from: route.full }, attempt.run_id))
      ] }) : /* @__PURE__ */ jsx2(Empty, { title: "This outcome has moved on", children: /* @__PURE__ */ jsxs("a", { className: "secondary", href: `#${spacePath(campaign)}?tab=story`, children: [
        "See what changed",
        /* @__PURE__ */ jsx2(ArrowRight, { size: 16 })
      ] }) }),
      undo && /* @__PURE__ */ jsx2(UndoNotice, { snapshots: undo, onClose: () => setUndo(null) })
    ] });
  const choices = world.choices.filter(
    (choice) => work.decisionIds.includes(choice.id)
  );
  const followers = world.work.filter(
    (item) => work.dependentIds.includes(item.id)
  );
  const run = runFor(work, runs);
  const source = world.spaces.find((space) => space.name === campaign)?.book?.relPath || work.file;
  const change = async (op, extra = {}) => {
    const result = await command.mutateAsync({
      op,
      body: {
        file: work.file,
        cbidx: work.cbidx,
        expectLine: work.rawLine,
        expectId: work.idChip,
        expectState: work.state,
        ...extra
      }
    });
    if (result.undo) setUndo(result.undo);
  };
  const copyForCli = async () => {
    const text = [
      `${work.id} \u2014 ${work.title}`,
      `Source: ${work.file}`,
      `Outcome: ${work.outcome}`,
      work.contract && `Acceptance:
${work.contract}`
    ].filter(Boolean).join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
    }
  };
  const checklistHref = checklistPath(work, route.full);
  const briefHref = briefPath(work, world, route.full);
  return /* @__PURE__ */ jsxs("div", { className: "focus-page", children: [
    /* @__PURE__ */ jsx2(Back, { fallback: spacePath(campaign), label: "Back to your place" }),
    /* @__PURE__ */ jsxs("header", { className: "outcome-heading", children: [
      /* @__PURE__ */ jsxs("a", { className: "outcome-space", href: `#${spacePath(campaign)}`, children: [
        /* @__PURE__ */ jsx2(SpaceIcon, { name: campaign, size: 19 }),
        campaign,
        /* @__PURE__ */ jsx2("span", { children: work.label })
      ] }),
      /* @__PURE__ */ jsx2("h1", { children: work.title }),
      /* @__PURE__ */ jsxs("div", { className: "outcome-status", children: [
        /* @__PURE__ */ jsx2("span", { children: work.state === "done" ? "Completed" : work.blocked ? "Waiting" : work.section === "Now" ? "In focus" : work.section === "Next" ? "Up next" : "Someday" }),
        work.effort && /* @__PURE__ */ jsxs("small", { children: [
          work.effort,
          " effort"
        ] })
      ] })
    ] }),
    work.outcome.replace(/[.!?]$/, "") !== work.title.replace(/[.!?]$/, "") && /* @__PURE__ */ jsx2("p", { className: "outcome-intent", children: work.outcome }),
    /* @__PURE__ */ jsxs("div", { className: "outcome-primary", children: [
      /* @__PURE__ */ jsx2(
        OutcomeButton,
        {
          work,
          run,
          from: route.full,
          disabled: !connected
        }
      ),
      /* @__PURE__ */ jsxs("button", { className: "secondary", onClick: () => void copyForCli(), children: [
        /* @__PURE__ */ jsx2(ClipboardCopy, { size: 15 }),
        copied ? "Copied" : "Open in CLI"
      ] }),
      work.blocked && /* @__PURE__ */ jsxs("span", { children: [
        /* @__PURE__ */ jsx2(LockKeyhole, { size: 14 }),
        "Prerequisites below"
      ] })
    ] }),
    work.dependencies.length > 0 && /* @__PURE__ */ jsxs("section", { className: "focus-section", children: [
      /* @__PURE__ */ jsx2("h2", { children: "Before this can move" }),
      work.dependencies.map((dependency) => {
        const target = world.work.find((item) => item.id === dependency.id);
        return /* @__PURE__ */ jsxs("div", { className: "dependency", children: [
          /* @__PURE__ */ jsx2(
            "span",
            {
              className: `dependency-mark ${["Completed", "Shipped"].includes(dependency.status) ? "done" : ""}`,
              children: ["Completed", "Shipped"].includes(dependency.status) ? /* @__PURE__ */ jsx2(Check, { size: 14 }) : /* @__PURE__ */ jsx2(LockKeyhole, { size: 13 })
            }
          ),
          target ? /* @__PURE__ */ jsxs("a", { href: `#${workPath(target, route.full)}`, children: [
            target.title,
            /* @__PURE__ */ jsxs("small", { children: [
              dependency.status,
              " \xB7 ",
              target.module
            ] })
          ] }) : /* @__PURE__ */ jsxs("span", { children: [
            dependency.id,
            /* @__PURE__ */ jsx2("small", { children: dependency.status })
          ] }),
          target && /* @__PURE__ */ jsx2(ArrowRight, { size: 16 })
        ] }, dependency.id);
      })
    ] }),
    choices.length > 0 && /* @__PURE__ */ jsxs("section", { className: "focus-section", children: [
      /* @__PURE__ */ jsx2("h2", { children: "A choice to make" }),
      choices.map((choice) => /* @__PURE__ */ jsxs(
        "a",
        {
          className: "choice-link",
          href: `#/attention?id=${choice.id}&from=${encodeURIComponent(route.full)}`,
          children: [
            /* @__PURE__ */ jsx2("span", { children: choice.text }),
            /* @__PURE__ */ jsx2(ArrowRight, { size: 17 })
          ]
        },
        choice.id
      ))
    ] }),
    /* @__PURE__ */ jsxs("details", { className: "focus-disclosure", children: [
      /* @__PURE__ */ jsx2("summary", { children: "What done looks like" }),
      /* @__PURE__ */ jsx2(
        Markdown,
        {
          raw: work.contract || "No acceptance recorded.",
          file: source
        }
      )
    ] }),
    followers.length > 0 && /* @__PURE__ */ jsxs("details", { className: "focus-disclosure", children: [
      /* @__PURE__ */ jsxs("summary", { children: [
        "What this opens up ",
        /* @__PURE__ */ jsx2("span", { children: followers.length })
      ] }),
      followers.map((item) => /* @__PURE__ */ jsx2(WorkLink, { work: item, from: route.full, compact: true }, item.key))
    ] }),
    !!attempts.length && /* @__PURE__ */ jsxs("section", { className: "focus-section", children: [
      /* @__PURE__ */ jsx2("h2", { children: "Delivery history" }),
      attempts.map((attempt) => /* @__PURE__ */ jsx2(V2RunLink, { run: attempt, from: route.full }, attempt.run_id))
    ] }),
    transport().capabilities.planWrites && /* @__PURE__ */ jsxs("details", { className: "focus-disclosure", children: [
      /* @__PURE__ */ jsx2("summary", { children: "Organize" }),
      /* @__PURE__ */ jsxs("div", { className: "organize-actions", children: [
        /* @__PURE__ */ jsxs("label", { children: [
          "When",
          /* @__PURE__ */ jsx2(
            "select",
            {
              value: work.section,
              disabled: !connected || command.isPending || work.state !== "open",
              onChange: (event) => void change("move-task", {
                toHeading: event.target.value
              }).catch(() => {
              }),
              children: ["Now", "Next", "Later"].map((lane) => /* @__PURE__ */ jsx2("option", { children: lane }, lane))
            }
          )
        ] }),
        /* @__PURE__ */ jsxs(
          "button",
          {
            className: "secondary",
            disabled: !connected || command.isPending,
            onClick: () => void change("toggle").catch(() => {
            }),
            children: [
              work.state === "done" ? "Reopen" : "Complete",
              /* @__PURE__ */ jsx2(Check, { size: 15 })
            ]
          }
        ),
        work.state === "done" && /* @__PURE__ */ jsx2(
          "button",
          {
            className: "secondary",
            disabled: !connected || command.isPending,
            onClick: () => void change("ship").catch(() => {
            }),
            children: "Ship"
          }
        ),
        /* @__PURE__ */ jsx2(
          "button",
          {
            className: "text-button",
            disabled: !connected || command.isPending,
            onClick: () => void change("discard").catch(() => {
            }),
            children: "Discard"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsx2(ErrorNotice, { error: command.error }),
    /* @__PURE__ */ jsxs("details", { className: "focus-disclosure", children: [
      /* @__PURE__ */ jsx2("summary", { children: "References" }),
      /* @__PURE__ */ jsxs("a", { className: "plain-link", href: `#${checklistHref}`, children: [
        "Checklist",
        /* @__PURE__ */ jsx2(ArrowRight, { size: 15 })
      ] }),
      briefHref !== checklistHref && /* @__PURE__ */ jsxs("a", { className: "plain-link", href: `#${briefHref}`, children: [
        "Brief",
        /* @__PURE__ */ jsx2(ArrowRight, { size: 15 })
      ] }),
      /* @__PURE__ */ jsxs("details", { children: [
        /* @__PURE__ */ jsx2("summary", { children: "Discovery matches" }),
        work.topicEvidence.map((match) => /* @__PURE__ */ jsx2("p", { children: match.evidence }, match.id))
      ] })
    ] }),
    undo && /* @__PURE__ */ jsx2(UndoNotice, { snapshots: undo, onClose: () => setUndo(null) })
  ] });
}

// <stdin>
var render = (campaign) => renderToStaticMarkup(React2.createElement(WorkView, { campaign, id: "DLV-107" }));
export {
  render
};
