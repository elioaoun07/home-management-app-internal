import { z } from "zod";
import { authenticateLocal } from "../delivery-v2/local-auth.mjs";

const rescanSchema = z.object({}).strict();
export async function routeCockpitRescan({
  root,
  reader,
  headers,
  loopbackPeer,
  body,
}) {
  if (
    !loopbackPeer ||
    headers["sec-fetch-site"] === "cross-site" ||
    !headers.origin ||
    headers.origin !== `http://${headers.host}`
  )
    return { status: 403, json: { error: "local-same-origin-required" } };
  const auth = authenticateLocal({ root, headers });
  if (!auth.ok)
    return { status: auth.status, json: { error: auth.refusal.code } };
  if (auth.kind !== "browser")
    return { status: 403, json: { error: "local-browser-required" } };
  if (!rescanSchema.safeParse(body).success)
    return { status: 400, json: { error: "invalid-rescan" } };
  await reader.rescan();
  const cockpit = reader.read();
  return cockpit.stale
    ? { status: 503, json: { error: "setup-rescan-unavailable" } }
    : { status: 200, json: { cockpit } };
}
