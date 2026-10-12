// src/lib/fitness/server.ts
// Server helpers for /api/fitness/* (route handlers only): one RPC error map.
import { NextResponse } from "next/server";

export const FITNESS_MIGRATION = "migrations/2026-10-12_fitness-module.sql";
export const NO_STORE = { "Cache-Control": "no-store" } as const;

interface PgError {
  code?: string;
  message: string;
  details?: string | null;
}

/**
 * Status contract. Only a returned PostgreSQL error proves the write rolled
 * back; anything else is "unknown" and the client reconciles through the
 * operation receipt (GET /api/fitness/operations/[id]) before retrying.
 */
export function fitnessRpcError(error: PgError): NextResponse {
  const code = error.code ?? "";
  const rolledBack = /^[A-Z0-9]{5}$/.test(code);
  const completion = { status: code === "PGRST202" ? "not_started" : rolledBack ? "rolled_back" : "unknown" };
  const json = (status: number, body: Record<string, unknown>) =>
    NextResponse.json({ ...body, completion }, { status, headers: NO_STORE });

  // Missing deployment prerequisite: report it, never fall back to partial writes.
  if (code === "PGRST202" || code === "42883" || code === "42P01" || code === "PGRST205")
    return json(503, { error: "Fitness database migration not applied", prerequisite: FITNESS_MIGRATION });
  if (code === "42501") return json(403, { error: error.message });
  if (code === "P0002") return json(404, { error: error.message });
  if (code === "FT409") {
    let server: unknown = null;
    try { server = error.details ? JSON.parse(error.details) : null; } catch { server = null; }
    return json(409, { error: error.message, conflict: true, server });
  }
  if (code === "FT422") return json(422, { error: error.message });
  if (code === "23505") {
    const text = `${error.message} ${error.details ?? ""}`;
    if (text.includes("fitness_sessions_one_open_key")) return json(409, { error: "Finish or discard the open workout first", reason: "open_session" });
    if (text.includes("fitness_plans_one_live_key")) return json(409, { error: "Another plan is active", reason: "live_plan" });
    if (text.includes("fitness_plans_fingerprint_key")) return json(409, { error: "Plan already imported", reason: "duplicate" });
    if (text.includes("fitness_sessions_slot_week_key")) return json(409, { error: "Slot already done this week", reason: "slot_done" });
    return json(409, { error: "Already exists", reason: "duplicate" });
  }
  if (code === "22023" || code === "22P02" || code === "23514" || code === "22007" || code === "22008")
    return json(400, { error: error.message });
  return json(rolledBack ? 500 : 502, { error: rolledBack ? "Save failed" : "Save unverified" });
}
