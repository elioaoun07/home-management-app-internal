// scripts/delivery-v2/qualification.mjs
// Command Center Phase 3 — qualification receipts bound to an exact executor,
// runtime and boundary configuration (DLV-96).
//
// A profile is qualified only by observations (adapter.mjs `finalizeProfile`).
// Until now nothing *loaded* observations: `describeExecutor` was always called
// with `observations: null`, so every profile stayed unqualified by construction
// rather than by evidence. This module is the loader, and it is deliberately
// narrow about what counts:
//
//   - only receipts of QUALIFICATION_RECEIPT_SCHEMA, which a harness writes after
//     running the unmodified battery with its negative control;
//   - only receipts whose digest still matches their body (an edited receipt is
//     refused, not repaired);
//   - only receipts whose binding — backend, SDK version inside the worker, the
//     boundary configuration digest and the battery digest — equals the binding
//     of the runtime that would execute the job now. A receipt for another image,
//     another flag set or another SDK version qualifies nothing.
//
// What a loaded receipt does NOT do: decide admission. It supplies control
// observations; `finalizeProfile` and `admitProfile` still decide, unchanged.
// Older records (`delivery-v2/qualification@1`, `delivery-v2/isolation-feasibility@1`)
// remain history and are never read as qualifying.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { ContractError, canonicalJson, contentId, deepFreeze, fingerprint, normalizePath } from "./contracts.mjs";
import { CONTROL_STATES } from "./adapters/adapter.mjs";

export const QUALIFICATION_RECEIPT_SCHEMA = "delivery-v2/executor-qualification@1";
export const QUALIFICATION_DIR = ".delivery/v2/artifacts/qualification";

/** Every field a receipt is bound to. All must match the runtime's own binding. */
export const BINDING_FIELDS = Object.freeze(["backend_id", "sdk_version", "boundary_digest", "battery_digest"]);

export const QUALIFICATION_REFUSALS = Object.freeze({
  NONE: "no-qualification-receipt",
  NO_BINDING: "runtime-binding-unavailable",
  TAMPERED: "qualification-receipt-altered",
  BINDING: "qualification-binding-mismatch",
  BACKEND: "qualification-for-another-executor",
});

const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";

function receiptBody(receipt) {
  const body = { ...receipt };
  delete body.receipt_id;
  delete body.receipt_digest;
  return body;
}

/**
 * Build one immutable receipt.
 *
 * `controls` is keyed by control id with the states `classifyControls` produces;
 * a verified control must cite evidence, exactly as `makeControl` requires later.
 *
 * @param {{backend_id:string, binding:Record<string, string>,
 *   controls:Record<string, {state:string, verified:boolean, evidence_ref:(string|null), note?:string}>,
 *   negativeControl:{valid:boolean}, harness:{name:string, run:string}, observed_at:string,
 *   notes?:string[]}} input
 */
export function makeQualificationReceipt({ backend_id, binding, controls, negativeControl, harness, observed_at, notes = [] }) {
  if (!isNonEmptyString(backend_id)) throw new ContractError("qualification receipt needs backend_id");
  for (const field of BINDING_FIELDS) {
    const value = field === "backend_id" ? backend_id : binding && binding[field];
    if (!isNonEmptyString(value)) throw new ContractError("qualification receipt binding needs " + field);
  }
  if (binding.backend_id && binding.backend_id !== backend_id) {
    throw new ContractError("qualification receipt binding names a different backend");
  }
  if (!negativeControl || typeof negativeControl.valid !== "boolean") {
    throw new ContractError("qualification receipt needs the negative-control verdict");
  }
  const normalizedControls = {};
  for (const [id, control] of Object.entries(controls || {})) {
    if (!CONTROL_STATES.includes(control.state)) throw new ContractError("control " + id + " has an unknown state");
    if (control.verified && !isNonEmptyString(control.evidence_ref)) {
      throw new ContractError("control " + id + " is verified without an evidence reference");
    }
    // A battery with an invalid negative control proves nothing: its controls are
    // kept for the record and downgraded to unverified.
    const verified = Boolean(control.verified) && negativeControl.valid;
    normalizedControls[id] = {
      state: verified ? control.state : "unknown",
      verified,
      evidence_ref: verified ? control.evidence_ref : null,
      note: control.note || null,
    };
  }
  const body = {
    schema: QUALIFICATION_RECEIPT_SCHEMA,
    backend_id,
    binding: Object.fromEntries(BINDING_FIELDS.map((field) => [field, field === "backend_id" ? backend_id : String(binding[field])])),
    controls: normalizedControls,
    negativeControl: { valid: negativeControl.valid, failures: negativeControl.failures || [] },
    harness: { name: String(harness && harness.name), run: String(harness && harness.run) },
    observed_at: String(observed_at),
    notes: [...notes],
  };
  return deepFreeze({ receipt_id: contentId("qr", body), receipt_digest: fingerprint(canonicalJson(body)), ...body });
}

/** Is this receipt's body still the body it was digested over? */
export function verifyQualificationReceipt(receipt) {
  if (!receipt || receipt.schema !== QUALIFICATION_RECEIPT_SCHEMA) return false;
  try {
    const body = receiptBody(receipt);
    return receipt.receipt_digest === fingerprint(canonicalJson(body)) && receipt.receipt_id === contentId("qr", body);
  } catch {
    return false;
  }
}

/**
 * Persist a receipt. An existing file with the same id and different bytes is a
 * refusal: receipts are written once.
 *
 * @param {{root:string, receipt:ReturnType<typeof makeQualificationReceipt>}} input
 */
export function writeQualificationReceipt({ root, receipt }) {
  if (!verifyQualificationReceipt(receipt)) throw new ContractError(QUALIFICATION_REFUSALS.TAMPERED);
  const dir = join(root, ...QUALIFICATION_DIR.split("/"));
  mkdirSync(dir, { recursive: true });
  const path = join(dir, receipt.receipt_id + ".json");
  const text = JSON.stringify(receipt, null, 2) + "\n";
  if (existsSync(path) && readFileSync(path, "utf8") !== text) {
    throw new ContractError("qualification receipt " + receipt.receipt_id + " already exists with different content");
  }
  writeFileSync(path, text, "utf8");
  return normalizePath(path);
}

/**
 * Load the newest receipt bound to exactly this executor and runtime.
 *
 * Returns observations for `describeProfile` or null, plus every receipt it
 * considered and why it was set aside, so a refusal can name its cause.
 *
 * @param {{root:string, backend_id:string, binding:(Record<string, string>|null),
 *   listFiles?:(dir:string)=>string[], readFile?:(path:string)=>string}} input
 */
export function loadQualification({ root, backend_id, binding, listFiles = null, readFile = null }) {
  const dir = join(root, ...QUALIFICATION_DIR.split("/"));
  const list = listFiles || ((path) => (existsSync(path) ? readdirSync(path).filter((name) => name.endsWith(".json")) : []));
  const read = readFile || ((path) => readFileSync(path, "utf8"));
  const refuse = (code, detail, considered = []) =>
    deepFreeze({ ok: false, observations: null, qualification_ref: null, observed_at: null, binding, refusals: [{ code, detail }], considered });

  if (!binding || BINDING_FIELDS.some((field) => !isNonEmptyString(field === "backend_id" ? backend_id : binding[field]))) {
    return refuse(QUALIFICATION_REFUSALS.NO_BINDING, "the worker runtime could not state its binding; nothing can qualify against it");
  }

  const considered = [];
  let best = null;
  for (const name of list(dir)) {
    let receipt;
    try {
      receipt = JSON.parse(read(join(dir, name)));
    } catch {
      continue;
    }
    if (!receipt || receipt.schema !== QUALIFICATION_RECEIPT_SCHEMA) continue;
    if (!verifyQualificationReceipt(receipt)) {
      considered.push({ file: name, verdict: QUALIFICATION_REFUSALS.TAMPERED });
      continue;
    }
    if (receipt.backend_id !== backend_id) {
      considered.push({ file: name, verdict: QUALIFICATION_REFUSALS.BACKEND });
      continue;
    }
    const mismatched = BINDING_FIELDS.filter(
      (field) => String(receipt.binding[field]) !== String(field === "backend_id" ? backend_id : binding[field]),
    );
    if (mismatched.length) {
      considered.push({ file: name, verdict: QUALIFICATION_REFUSALS.BINDING, fields: mismatched });
      continue;
    }
    considered.push({ file: name, verdict: "bound" });
    if (!best || String(receipt.observed_at) > String(best.observed_at)) best = receipt;
  }

  if (!best) {
    return refuse(
      considered.length ? QUALIFICATION_REFUSALS.BINDING : QUALIFICATION_REFUSALS.NONE,
      considered.length
        ? "no receipt is bound to this executor, SDK version, boundary and battery"
        : "no qualification receipt exists for " + backend_id,
      considered,
    );
  }
  return deepFreeze({
    ok: true,
    observations: { controls: best.controls },
    qualification_ref: best.receipt_id,
    observed_at: best.observed_at,
    binding,
    refusals: [],
    considered,
  });
}
