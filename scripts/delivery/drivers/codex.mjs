// Codex SDK-backed delivery driver. The SDK is dynamically imported only when a
// driver is used, so dashboard and pure delivery modules remain dependency-free.

import { DriverAbortedError, DriverError, registerDriver } from "./driver.mjs";
import { agentEventType, normalizeUsage } from "../events.mjs";

const SDK_MODULE_SPECIFIER = "@openai/codex-sdk";
const PERMISSIVE_JSON_SCHEMA = Object.freeze({ type: "object" });

/** Build the exact SDK ThreadOptions for a delivery session. */
export function buildThreadOptions({ cwd, mode, model, effort } = {}) {
  if (mode !== "build" && mode !== "readonly") {
    throw new DriverError(`codex driver: unknown mode "${mode}"`);
  }

  const options = {
    workingDirectory: cwd,
    sandboxMode: mode === "build" ? "workspace-write" : "read-only",
    approvalPolicy: "never",
    networkAccessEnabled: false,
  };
  if (model) options.model = model;
  if (effort) options.modelReasoningEffort = effort;
  return options;
}

/** The runner currently requests structured output as a boolean. */
export function toTurnOptions(outputSchema) {
  if (!outputSchema) return {};
  return {
    outputSchema:
      typeof outputSchema === "object" && !Array.isArray(outputSchema)
        ? outputSchema
        : PERMISSIVE_JSON_SCHEMA,
  };
}

/** DW-10: TurnOptions.signal (dist/index.d.ts :167-172) — passed straight through, no bridging needed. */
export function withAbortSignal(turnOptions, signal) {
  return signal ? { ...turnOptions, signal } : turnOptions;
}

/** Normalize Codex's thread events into the delivery event vocabulary. */
export function mapCodexEventToEvents(event) {
  if (!event || typeof event !== "object") return [];

  if (event.type === "thread.started") {
    return [{ type: agentEventType("session.init"), data: { threadId: event.thread_id } }];
  }
  if (event.type === "turn.started") {
    return [{ type: agentEventType("turn.started"), data: {} }];
  }
  if (event.type === "turn.completed") {
    return [{ type: agentEventType("turn.result"), data: { usage: normalizeUsage(event.usage, "codex") } }];
  }
  if (event.type === "turn.failed") {
    return [{ type: agentEventType("turn.failed"), data: { message: event.error && event.error.message ? event.error.message : "turn failed" } }];
  }
  if (event.type === "error") {
    return [{ type: agentEventType("error"), data: { message: event.message || "SDK stream error" } }];
  }
  if (!event.type.startsWith("item.") || !event.item) return [];

  const { item } = event;
  if (item.type === "agent_message") {
    return item.text ? [{ type: agentEventType("message"), data: { message: item.text } }] : [];
  }
  if (item.type === "reasoning") {
    return item.text ? [{ type: agentEventType("reasoning"), data: { message: item.text } }] : [];
  }
  if (item.type === "command_execution") {
    return [
      {
        type: agentEventType("command"),
        data: {
          command: item.command,
          output: item.aggregated_output,
          status: item.status,
          ...(item.exit_code == null ? {} : { exitCode: item.exit_code }),
        },
      },
    ];
  }
  if (item.type === "file_change") {
    return [{ type: agentEventType("file_change"), data: { status: item.status, changes: item.changes || [] } }];
  }
  if (item.type === "mcp_tool_call") {
    return [
      {
        type: agentEventType("tool"),
        data: { server: item.server, tool: item.tool, status: item.status, ...(item.error ? { error: item.error.message } : {}) },
      },
    ];
  }
  if (item.type === "web_search") {
    return [{ type: agentEventType("web_search"), data: { query: item.query } }];
  }
  if (item.type === "todo_list") {
    return [{ type: agentEventType("todo"), data: { items: item.items || [] } }];
  }
  if (item.type === "error") {
    return [{ type: agentEventType("item.error"), data: { message: item.message || "agent item failed" } }];
  }
  return [];
}

/**
 * Map one Codex SDK stream event to zero or more full-fidelity transcript
 * records (DW-1 `transcript/t-NNNN.ndjson`, `kind` one of `RECORD_KINDS`).
 * Mirrors `mapCodexEventToEvents` (which feeds the curated, truncated
 * events.ndjson timeline) but is untruncated at this layer — per-record byte
 * capping happens downstream in `buildRecord` (transcript.mjs). `runTurn`
 * below wires this to the driver's `onRaw` callback so live Codex runs get
 * the same full-fidelity capture the fake driver already exercised in tests
 * (previously only `fake.mjs` ever called `onRaw` — real runs only reached
 * the truncated events.ndjson).
 */
export function mapCodexEventToRawRecords(event) {
  if (!event || typeof event !== "object") return [];

  if (event.type === "thread.started") {
    return [{ kind: "system.init", threadId: event.thread_id }];
  }
  if (event.type === "turn.completed") {
    return [{ kind: "turn.result", usage: normalizeUsage(event.usage, "codex") }];
  }
  if (event.type === "turn.failed") {
    return [{ kind: "error", text: (event.error && event.error.message) || "turn failed" }];
  }
  if (event.type === "error") {
    return [{ kind: "error", text: event.message || "SDK stream error" }];
  }
  if (!event.type.startsWith("item.") || !event.item) return [];

  const { item } = event;
  if (item.type === "agent_message") {
    return item.text ? [{ kind: "assistant.text", text: item.text }] : [];
  }
  if (item.type === "reasoning") {
    return item.text ? [{ kind: "assistant.reasoning", text: item.text }] : [];
  }
  if (item.type === "command_execution") {
    return [
      {
        kind: "command",
        command: item.command,
        output: item.aggregated_output,
        status: item.status,
        ...(item.exit_code == null ? {} : { exitCode: item.exit_code }),
      },
    ];
  }
  if (item.type === "file_change") {
    return [{ kind: "file.change", status: item.status, changes: item.changes || [] }];
  }
  if (item.type === "mcp_tool_call") {
    return [
      {
        kind: "tool.use",
        tool: item.server && item.tool ? `${item.server}.${item.tool}` : item.tool || item.server,
        status: item.status,
        ...(item.error ? { error: item.error.message } : {}),
      },
    ];
  }
  if (item.type === "web_search") {
    return [{ kind: "web.search", query: item.query }];
  }
  if (item.type === "todo_list") {
    return [{ kind: "todo", items: item.items || [] }];
  }
  if (item.type === "error") {
    return [{ kind: "error", text: item.message || "agent item failed" }];
  }
  return [];
}

// ---- capability manifest (DW-2: pure data, no SDK import — verified against
// the installed @openai/codex-sdk 0.144.1 dist/index.d.ts) ----

/**
 * Pure-data capability manifest for the launch wizard / capabilities API.
 * Never imports the SDK — safe to call at dashboard startup.
 */
export function manifest() {
  return {
    provider: "codex",
    efforts: ["minimal", "low", "medium", "high", "xhigh"],
    effortDefault: "medium",
    supportsPerTurnModel: true,
    supportsPerTurnEffort: true,
    supportsAbort: true,
    supportsNativeFork: false,
    usage: { cacheCreation: false, reasoning: true, costReported: false },
    sandbox: "sandboxMode workspace-write/read-only + approvalPolicy never + network off",
  };
}

function preflightError(err) {
  return new DriverError(`codex driver: authentication preflight failed — ${(err && err.message) || err}`);
}

async function loadSdk() {
  try {
    return await import(SDK_MODULE_SPECIFIER);
  } catch (err) {
    throw new DriverError(`codex driver: ${SDK_MODULE_SPECIFIER} unavailable — ${(err && err.message) || err}`);
  }
}

/**
 * @param {{importSdk?: Function}} [options]
 * `importSdk` is a test seam for a fake `{Codex}` module; production callers use
 * the dynamic SDK import above and never contact the SDK during module loading.
 */
export function createCodexDriver(options = {}) {
  const importSdk = options.importSdk || loadSdk;
  let started = false;
  let currentRef = null;
  let thread = null;
  let currentOptions = null;

  async function createThread({ ref } = {}) {
    const sdk = await importSdk();
    if (!sdk || typeof sdk.Codex !== "function") {
      throw new DriverError("codex driver: SDK did not export Codex");
    }
    const codex = new sdk.Codex();
    return ref ? codex.resumeThread(ref.id, currentOptions) : codex.startThread(currentOptions);
  }

  async function startSession({ cwd, mode, model, effort } = {}) {
    if (started) throw new DriverError("codex driver: session already started");
    currentOptions = buildThreadOptions({ cwd, mode, model, effort });
    thread = await createThread();

    try {
      await thread.run("Reply with exactly: OK");
    } catch (err) {
      throw preflightError(err);
    }
    if (!thread.id) {
      throw new DriverError("codex driver: authentication preflight failed — SDK did not establish a thread id");
    }

    started = true;
    currentRef = { id: thread.id, cwd, mode, model: model || null, effort: effort || null };
    return { ref: currentRef, cwd, mode };
  }

  // `overrides.mode` lets the runner resume the thread under a different
  // phase mode than it was first established with (e.g. readonly → build) —
  // see the matching comment in drivers/claude.mjs. `ref` itself is never
  // mutated, so the historical mode persisted in state.json is untouched.
  async function resume(ref, overrides = {}) {
    if (!ref || !ref.id) throw new DriverError("codex driver: resume requires a ref with an id");
    const mode = (overrides && overrides.mode) || ref.mode;
    currentOptions = buildThreadOptions({ cwd: ref.cwd, mode, model: ref.model, effort: ref.effort });
    thread = await createThread({ ref });
    started = true;
    currentRef = ref;
    return { ref: currentRef, cwd: ref.cwd, mode };
  }

  async function runTurn(handle, prompt, { outputSchema, onEvent, onRaw, effort, signal } = {}) {
    void handle;
    if (!started || !thread || !currentRef) throw new DriverError("codex driver: cannot run a turn before startSession/resume");
    if (typeof prompt !== "string" || !prompt.trim()) throw new DriverError("codex driver: prompt must be a non-empty string");
    if (effort) {
      currentOptions = { ...currentOptions, modelReasoningEffort: effort };
      thread = await createThread({ ref: currentRef });
      currentRef.effort = effort;
    }

    let finalText = "";
    let usage = null;
    let failure = null;
    try {
      const { events } = await thread.runStreamed(prompt, withAbortSignal(toTurnOptions(outputSchema), signal));
      for await (const event of events) {
        if (event.type === "thread.started" && event.thread_id) currentRef.id = event.thread_id;
        if (event.type === "item.completed" && event.item && event.item.type === "agent_message") finalText = event.item.text || "";
        if (event.type === "turn.completed") usage = normalizeUsage(event.usage, "codex");
        if (event.type === "turn.failed") failure = (event.error && event.error.message) || "turn failed";
        if (event.type === "error") failure = event.message || "SDK stream error";
        for (const normalized of mapCodexEventToEvents(event)) {
          if (typeof onEvent === "function") onEvent(normalized);
        }
        if (typeof onRaw === "function") {
          for (const record of mapCodexEventToRawRecords(event)) onRaw(record);
        }
      }
    } catch (err) {
      if (signal && signal.aborted) {
        throw new DriverAbortedError("codex driver: turn aborted by owner");
      }
      throw new DriverError(`codex driver: stream failed — ${(err && err.message) || err}`);
    }
    if (signal && signal.aborted) {
      throw new DriverAbortedError("codex driver: turn aborted by owner");
    }
    if (failure) throw new DriverError(`codex driver: turn failed — ${failure}`);
    if (!usage) throw new DriverError("codex driver: stream ended without a turn.completed event");
    return { finalText, usage };
  }

  return { kind: "codex", manifest, startSession, resume, runTurn };
}

registerDriver("codex", createCodexDriver);
