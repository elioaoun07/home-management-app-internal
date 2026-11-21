#!/usr/bin/env node
// DLV-165. The `ask_owner` tool for Local Codex sessions, which have no built-in
// question tool. Codex starts this stdio MCP server from the private
// config.toml the supervisor writes. The tool only validates and acknowledges:
// the worker reads the call's arguments from Codex's event stream, records the
// question and parks the session. No answer ever comes from here.
import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";
import { normalizeQuestion } from "./local-questions.mjs";

export const MCP_PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = Object.freeze({ name: "era-owner", version: "1" });
export const ASK_OWNER_ACK = "Question sent to the owner. End your turn now with one short line; their answer arrives as your next message.";

const option = { type: "object", required: ["label", "description"], additionalProperties: false, properties: {
  label: { type: "string", description: "1-5 words. End your recommended option's label with \" (Recommended)\" and list it first." },
  description: { type: "string", description: "What choosing this means." },
  preview: { type: "string", description: "Optional snippet or mockup shown when the option is selected." },
} };
export const ASK_OWNER_TOOL = Object.freeze({
  name: "ask_owner",
  description: "Ask the owner when you are blocked on a decision that is genuinely theirs. Put your recommended option first. After calling, end your turn; the answer arrives as your next message. Do not use it for choices with a sensible default.",
  inputSchema: { type: "object", required: ["questions"], additionalProperties: false, properties: {
    questions: { type: "array", minItems: 1, maxItems: 4, items: { type: "object", required: ["question", "header", "options"], additionalProperties: false, properties: {
      question: { type: "string", description: "The full question, ending with a question mark." },
      header: { type: "string", description: "A chip label, at most 12 characters." },
      multiSelect: { type: "boolean" },
      options: { type: "array", minItems: 2, maxItems: 4, items: option },
    } } },
  } },
});

/** @returns {Record<string, any>|null} */
export function handleAskMessage(message) {
  const { id, method, params } = message || {};
  const reply = (result) => ({ jsonrpc: "2.0", id, result });
  if (id === undefined || id === null) return null;
  switch (method) {
    case "initialize":
      return reply({ protocolVersion: params?.protocolVersion || MCP_PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: SERVER_INFO });
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: [ASK_OWNER_TOOL] });
    case "tools/call": {
      if (params?.name !== ASK_OWNER_TOOL.name) return reply({ content: [{ type: "text", text: "Unknown tool." }], isError: true });
      const checked = normalizeQuestion({ id: randomUUID(), questions: params?.arguments?.questions });
      return checked.ok
        ? reply({ content: [{ type: "text", text: ASK_OWNER_ACK }], isError: false })
        : reply({ content: [{ type: "text", text: `Not sent: ${checked.reason} Fix the question and call again.` }], isError: true });
    }
    default:
      return { jsonrpc: "2.0", id, error: { code: -32601, message: "method not found: " + String(method) } };
  }
}

export async function serve({ input = process.stdin, output = process.stdout } = {}) {
  for await (const line of createInterface({ input })) {
    if (!line.trim()) continue;
    let message;
    try { message = JSON.parse(line); }
    catch { output.write(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } }) + "\n"); continue; }
    const response = handleAskMessage(message);
    if (response) output.write(JSON.stringify(response) + "\n");
  }
}

if (process.argv[1] && process.argv[1].replace(/\\/gu, "/").endsWith("delivery-v2/local-ask-mcp.mjs")) await serve();
