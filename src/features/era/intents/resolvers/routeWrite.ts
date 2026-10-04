// src/features/era/intents/resolvers/routeWrite.ts
// The era-wire adapter template — "ERA using the app's functionality".
// One existing app route does the write; the result always carries the same
// four things: a one-line reply, the new id (metadata), the Artifact, and the
// Undo through the route's own inverse. New wirings call this instead of
// hand-rolling safeFetch/try/catch; only the spec differs per feature.

import {
  type EraArtifact,
  type EraArtifactAction,
  type EraArtifactEntity,
  type EraArtifactRef,
  eraArtifact,
} from "@/lib/era/artifacts";
import { safeFetch } from "@/lib/safeFetch";

export interface RouteWriteResult {
  text: string;
  ok: boolean;
  metadata?: Record<string, unknown>;
  artifacts?: EraArtifact[];
  undo?: () => Promise<boolean>;
}

interface RouteCall {
  url: string;
  method: "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
}

export interface RouteWriteSpec {
  /** The route the manual form already calls. */
  call: RouteCall;
  /** The written row's id from the route's response (null → treated as failure). */
  pickId: (json: unknown) => string | null | undefined;
  artifact: { entity: EraArtifactEntity; action: EraArtifactAction; title: string; ref?: EraArtifactRef };
  /** The route's own inverse for Undo (Hard Rule #1). */
  inverse?: (id: string) => RouteCall;
  /** Receipt line, e.g. `Added · Laura`. */
  reply: string;
  failReply?: string;
  /** Metadata key for the id, e.g. "contactId". */
  idKey: string;
  extraMetadata?: Record<string, unknown>;
}

function send(call: RouteCall) {
  return safeFetch(call.url, {
    method: call.method,
    ...(call.body !== undefined
      ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(call.body) }
      : {}),
    timeoutMs: 8_000,
  });
}

export async function routeWrite(spec: RouteWriteSpec): Promise<RouteWriteResult> {
  const fail: RouteWriteResult = { text: spec.failReply ?? "Couldn't do that.", ok: false };
  try {
    const res = await send(spec.call);
    if (!res.ok) return fail;
    const id = spec.pickId(await res.json().catch(() => null));
    if (!id) return fail;
    const inverse = spec.inverse?.(id);
    return {
      text: spec.reply,
      ok: true,
      metadata: { [spec.idKey]: id, ...spec.extraMetadata },
      artifacts: [eraArtifact(spec.artifact.entity, spec.artifact.action, id, spec.artifact.title, spec.artifact.ref)],
      undo: inverse ? async () => (await send(inverse).catch(() => null))?.ok ?? false : undefined,
    };
  } catch {
    return fail;
  }
}
