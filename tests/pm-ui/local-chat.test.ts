// DLV-164. Owner questions in the Local session view: recorded ledger only.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import {
  answersFrom,
  chatThread,
  choices,
  initialDraft,
  openQuestion,
  toggle,
  typeOther,
  type LocalQuestion,
} from "../../scripts/pm/app/localChatModel";
import { LocalChat } from "../../scripts/pm/app/LocalChat";
import { localRunAttention } from "../../scripts/pm/app/localRunAttention";
import { liveness } from "../../scripts/pm/app/localRunLiveness";
import { sceneAt, buildTimeline } from "../../scripts/pm/app/localRunScene";
import { sessionBoard } from "../../scripts/pm/app/sessionBoardModel";
import { groupDelivery } from "../../scripts/pm/app/deliveryHomeModel";
import { coreSessionState } from "../../scripts/pm/app/coreState";
import { buildWorld } from "../../scripts/pm/app/model";
import type { V2RunSummary } from "../../scripts/pm/app/types";
import { at, boardRun, epoch, row } from "./local-board-fixtures";

const storage = { question: "Which store should hold drafts?", header: "Storage", multiSelect: false,
  options: [{ label: "localStorage", description: "Simpler." }, { label: "IndexedDB (Recommended)", description: "Matches the offline queue.", preview: "db.put(draft)" }] };
const extras = { question: "Which extras?", header: "Extras", multiSelect: true,
  options: [{ label: "Undo (Recommended)", description: "" }, { label: "Sync", description: "" }, { label: "Export [recommended]", description: "" }] };
const asked = (changes: Partial<LocalQuestion> = {}): LocalQuestion => ({
  id: "toolu_1", questions: [storage], asked_at: at(20), answers: null, answered_at: null, closed_at: null, state: "open", ...changes,
});

describe("DLV-164 recommended answers", () => {
  it("reads the agent's marker, strips it from the answer and preselects it", () => {
    expect(choices(storage).map(({ value, recommended }) => ({ value, recommended }))).toEqual([
      { value: "localStorage", recommended: false }, { value: "IndexedDB", recommended: true },
    ]);
    const draft = initialDraft(asked({ questions: [storage, extras] }));
    expect(draft).toEqual({ [storage.question]: { picked: ["IndexedDB"], other: "" }, [extras.question]: { picked: ["Undo", "Export"], other: "" } });
    expect(answersFrom(asked({ questions: [storage, extras] }), draft)).toEqual({ [storage.question]: "IndexedDB", [extras.question]: "Undo, Export" });
  });
  it("never invents a default when nothing is recommended", () => {
    const plain = { ...storage, options: storage.options.map(option => ({ ...option, label: option.label.replace(" (Recommended)", "") })) };
    const question = asked({ questions: [plain] });
    expect(answersFrom(question, initialDraft(question))).toBeNull();
  });
  it("lets Other replace a single choice and join a multi-select", () => {
    const question = asked({ questions: [storage, extras] });
    let draft = typeOther(initialDraft(question), storage, "SQLite");
    expect(draft[storage.question]).toEqual({ picked: [], other: "SQLite" });
    draft = toggle(draft, storage, "localStorage");
    expect(draft[storage.question]).toEqual({ picked: ["localStorage"], other: "" });
    draft = typeOther(toggle(draft, extras, "Undo"), extras, "Search");
    expect(answersFrom(question, draft)).toEqual({ [storage.question]: "localStorage", [extras.question]: "Export, Search" });
  });
});

describe("DLV-164 chat thread", () => {
  it("orders main-thread narration, the question and the owner's answer", () => {
    const run = boardRun({
      activity: [row(10, "message", "Reading the brief"), { ...row(15, "message", "subagent note"), agent_json: { role: "subagent" } }, row(30, "message", "Using IndexedDB")],
      questions: [asked({ answers: { [storage.question]: "IndexedDB" }, answered_at: at(25), state: "answered" })],
    });
    expect(chatThread(run).map(entry => entry.kind === "agent" ? entry.text : entry.kind)).toEqual(["Reading the brief", "question", "answer", "Using IndexedDB"]);
  });
  it("places owner messages in the thread with their delivery state", () => {
    const run = boardRun({ activity: [row(10, "message", "Starting")], messages: [{ id: "m1", at: at(12), text: "Use IndexedDB", delivered_at: at(14) }, { id: "m2", at: at(20), text: "Add a test", delivered_at: null }], canMessage: true });
    expect(chatThread(run).map(entry => entry.kind)).toEqual(["agent", "owner", "owner"]);
    const html = renderToStaticMarkup(createElement(QueryClientProvider, { client: new QueryClient() }, createElement(LocalChat, { run })));
    expect(html).toContain('aria-label="Delivered"');
    expect(html).toContain('aria-label="Queued"');
    expect(html).toContain('aria-label="Send message"');
    const closed = renderToStaticMarkup(createElement(QueryClientProvider, { client: new QueryClient() }, createElement(LocalChat, { run: { ...run, canMessage: false } })));
    expect(closed).not.toContain('aria-label="Send message"');
    const quiet = renderToStaticMarkup(createElement(QueryClientProvider, { client: new QueryClient() }, createElement(LocalChat, { run: boardRun({ activity: [], canMessage: true }) })));
    expect(quiet).toContain('aria-label="Send message"');
    expect(quiet).not.toContain("<ol");
  });
  it("shows only an open, uninterrupted question as answerable", () => {
    expect(openQuestion(boardRun({ questions: [asked()] }))?.id).toBe("toolu_1");
    expect(openQuestion(boardRun({ questions: [asked()], interrupted: true }))).toBeNull();
    expect(openQuestion(boardRun({ questions: [asked({ state: "closed" })] }))).toBeNull();
  });
  it("renders the question card with the recommendation selected and Send enabled", () => {
    const html = renderToStaticMarkup(createElement(QueryClientProvider, { client: new QueryClient() },
      createElement(LocalChat, { run: boardRun({ activity: [row(10, "message", "Reading the brief")], questions: [asked()] }) })));
    expect(html).toContain('aria-label="Chat"');
    expect(html).toContain("Which store should hold drafts?");
    expect(html).toMatch(/aria-pressed="true"[^>]*><span class="chat-option-label">IndexedDB<small>Recommended<\/small>/u);
    expect(html).toContain("db.put(draft)");
    expect(html).not.toMatch(/disabled=""[^>]*>.*Send/u);
    const closed = renderToStaticMarkup(createElement(QueryClientProvider, { client: new QueryClient() },
      createElement(LocalChat, { run: boardRun({ questions: [asked({ state: "closed", closed_at: at(40) })] }) })));
    expect(closed).toContain("Not answered");
    expect(closed).not.toContain("<form");
  });
});

describe("DLV-164 owner-turn projections", () => {
  it("turns an open question into a blocking act item and an owner-turn caption", () => {
    const run = boardRun({ activity: [row(0, "status", "Native session started"), row(20, "status", "Question: Storage")], questions: [asked()] });
    expect(localRunAttention(run, new Set(), epoch + 30_000)[0]).toMatchObject({ kind: "question", level: "act", blocking: true, title: "Question", detail: storage.question, action: { run: "answer" } });
    const health = liveness(run, epoch + 600_000);
    expect(health).toMatchObject({ state: "your-turn", caption: "Question for you" });
    expect(liveness(boardRun({ questions: [asked({ state: "closed" })] }), epoch + 600_000).state).toBe("stale");
  });
  it("hides a later question and answer from an earlier replay frame", () => {
    const run = boardRun({ activity: [row(0, "status", "Native session started"), row(40, "message", "done")],
      questions: [asked({ answers: { [storage.question]: "IndexedDB" }, answered_at: at(30), state: "answered" })] });
    const timeline = buildTimeline(run);
    expect(sceneAt(timeline, epoch + 10_000).run.questions).toEqual([]);
    expect(sceneAt(timeline, epoch + 25_000).run.questions).toMatchObject([{ answers: null, state: "closed" }]);
    expect(sceneAt(timeline, epoch + 60_000).run.questions).toMatchObject([{ state: "answered" }]);
    const messages = buildTimeline(boardRun({ activity: [row(0, "status", "Native session started"), row(40, "message", "done")], messages: [{ id: "m", at: at(30), text: "hi", delivered_at: at(31) }] }));
    expect(sceneAt(messages, epoch + 10_000).run.messages).toEqual([]);
    expect(sceneAt(messages, epoch + 60_000).run.messages).toHaveLength(1);
  });
  it("never reports a parked session as interrupted on the Bridge core", () => {
    const local = { run_id: "local-1", engine: "v2", lane: "local", alias: "BUD-1", campaign: "Budget", file: null, title: "Example", lifecycle: "ACTIVE",
      closed_outcome: null, waiting_reason: null, executor: "claude", model: null, effort: null, stage: "building", branch: null, active: false,
      ownerAction: "Question", ownerActionKind: "local-question", created_at: "2026-11-14T10:00:00Z", updated_at: "2026-11-14T11:00:00Z" } as V2RunSummary;
    expect(coreSessionState({ needs: 1, running: 0, uncertain: false, v1Runs: [], v2Runs: [local] })).toMatchObject({ state: "attention", label: "Awaiting you" });
    expect(coreSessionState({ needs: 0, running: 0, uncertain: false, v1Runs: [], v2Runs: [{ ...local, ownerActionKind: "inspect-session" }] })).toMatchObject({ state: "failed", label: "Session interrupted" });
  });
  it("puts a running Local session with a question under Needs you", () => {
    const summary: V2RunSummary = { run_id: "local-1", engine: "v2", lane: "local", alias: "BUD-1", campaign: "Budget", file: "Budget/4 - Checklist.md",
      title: "Example", lifecycle: "ACTIVE", closed_outcome: null, waiting_reason: null, executor: "claude", model: null, effort: null,
      stage: "building", branch: null, active: true, ownerAction: "Question", ownerActionKind: "local-question",
      created_at: "2026-11-14T10:00:00Z", updated_at: "2026-11-14T11:00:00Z" } as V2RunSummary;
    const world = buildWorld({ files: [], generatedAt: "2026-11-14T12:00:00Z" });
    const board = sessionBoard({ world, statusKnown: true, v2: [summary] });
    expect(board.lanes.find(lane => lane.id === "needs")!.cards).toMatchObject([{ status: "Question", action: "Answer" }]);
    expect(board.lanes.find(lane => lane.id === "running")!.cards).toEqual([]);
    expect(groupDelivery({ v1Runs: [], v2Runs: [summary], requests: [] }).needs).toHaveLength(1);
  });
});
