#!/usr/bin/env node
// scripts/delivery-v2/steward-mcp.mjs
// ERA Steward's tool server: a stdio MCP server that exposes exactly the four
// typed operations from steward-tools.mjs and nothing else. A compatible host
// or private MCP tunnel must connect this stdio process to the caller.
// The route allowlist (entry.mjs) restricts this credential's PM access only;
// it cannot disable the caller's other coding, delegation or shell tools.
//
//   node scripts/delivery-v2/steward-mcp.mjs pair <CODE>   one-time, owner-issued code (pnpm pm:pair)
//   node scripts/delivery-v2/steward-mcp.mjs               serve MCP on stdin/stdout
//
// Environment: PM_STEWARD_URL (default http://127.0.0.1:4317).
// No SDK dependency: the protocol surface used here is initialize, ping,
// tools/list and tools/call, newline-delimited JSON-RPC 2.0.

import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import { DEFAULT_BASE_URL, STEWARD_TOOL_DEFINITIONS, createStewardClient, handleStewardOperation } from "./steward-tools.mjs";

export const MCP_PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = Object.freeze({ name: "era-steward-tools", version: "1" });

/**
 * Handle one JSON-RPC message. Returns the response object, or null for a notification.
 *
 * @param {any} client
 * @param {any} message
 * @returns {Promise<Record<string, any>|null>}
 */
export async function handleMcpMessage(client, message) {
  const { id, method, params } = message || {};
  const reply = (result) => ({ jsonrpc: "2.0", id, result });
  const fail = (code, text) => ({ jsonrpc: "2.0", id, error: { code, message: text } });
  if (id === undefined || id === null) return null; // notifications/initialized and friends
  switch (method) {
    case "initialize":
      return reply({ protocolVersion: params?.protocolVersion || MCP_PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: SERVER_INFO });
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: STEWARD_TOOL_DEFINITIONS });
    case "tools/call": {
      const outcome = await handleStewardOperation(client, String(params?.name || ""), params?.arguments || {});
      return reply({ content: [{ type: "text", text: outcome.message + "\n" + JSON.stringify(outcome) }], isError: outcome.ok === false });
    }
    default:
      return fail(-32601, "method not found: " + String(method));
  }
}

export async function serve({ client, input = process.stdin, output = process.stdout }) {
  const lines = createInterface({ input });
  for await (const line of lines) {
    if (!line.trim()) continue;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      output.write(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } }) + "\n");
      continue;
    }
    const response = await handleMcpMessage(client, message);
    if (response) output.write(JSON.stringify(response) + "\n");
  }
}

if (process.argv[1] && process.argv[1].replace(/\\/gu, "/").endsWith("delivery-v2/steward-mcp.mjs")) {
  const root = fileURLToPath(new URL("../..", import.meta.url));
  const client = createStewardClient({ root, baseUrl: process.env.PM_STEWARD_URL || DEFAULT_BASE_URL });
  if (process.argv[2] === "pair") {
    const outcome = await client.pair(process.argv[3] || "");
    process.stdout.write(outcome.message + "\n");
    process.exit(outcome.ok ? 0 : 1);
  }
  await serve({ client });
}
