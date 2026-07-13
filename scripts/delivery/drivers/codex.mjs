// Codex SDK-backed delivery driver. The SDK is dynamically imported only when a
// driver is used, so dashboard and pure delivery modules remain dependency-free.

import { DriverError, registerDriver } from "./driver.mjs";
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

  async function resume(ref) {
    if (!ref || !ref.id) throw new DriverError("codex driver: resume requires a ref with an id");
    currentOptions = buildThreadOptions({ cwd: ref.cwd, mode: ref.mode, model: ref.model, effort: ref.effort });
    thread = await createThread({ ref });
    started = true;
    currentRef = ref;
    return { ref: currentRef, cwd: ref.cwd, mode: ref.mode };
  }

  async function runTurn(handle, prompt, { outputSchema, onEvent, effort } = {}) {
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
      const { events } = await thread.runStreamed(prompt, toTurnOptions(outputSchema));
      for await (const event of events) {
        if (event.type === "thread.started" && event.thread_id) currentRef.id = event.thread_id;
        if (event.type === "item.completed" && event.item && event.item.type === "agent_message") finalText = event.item.text || "";
        if (event.type === "turn.completed") usage = normalizeUsage(event.usage, "codex");
        if (event.type === "turn.failed") failure = (event.error && event.error.message) || "turn failed";
        if (event.type === "error") failure = event.message || "SDK stream error";
        for (const normalized of mapCodexEventToEvents(event)) {
          if (typeof onEvent === "function") onEvent(normalized);
        }
      }
    } catch (err) {
      throw new DriverError(`codex driver: stream failed — ${(err && err.message) || err}`);
    }
    if (failure) throw new DriverError(`codex driver: turn failed — ${failure}`);
    if (!usage) throw new DriverError("codex driver: stream ended without a turn.completed event");
    return { finalText, usage };
  }

  return { kind: "codex", startSession, resume, runTurn };
}

registerDriver("codex", createCodexDriver);
