// Only invoked by the supervisor with scrubbed env; protocol in local-worker-channel.mjs.
import { createExecutor } from "./adapters/registry.mjs";
import { makeExecutionRef } from "./adapters/adapter.mjs";
import { assertNoLocalSecrets } from "./local-guardrails.mjs";
import { ownerChannel } from "./local-worker-channel.mjs";

const channel = ownerChannel({ input: process.stdin, write: (line, done) => process.stdout.write(line, done) });
const request = JSON.parse(await channel.request);
assertNoLocalSecrets(request.workspace.root);
const selected = await createExecutor(request.settings.executor, { local: true, env: process.env, codexOptions: { env: process.env } });
if (!selected.ok) throw new Error(selected.refusal.detail);
const runOptions = {
  observeActivity: value => channel.send({ type: "activity", value }),
  askOwner: channel.askOwner,
  takeOwnerMessages: channel.takeMessages,
};
// DLV-165: a parked session continues under a new job id with its native identity.
const result = request.resume
  ? await selected.adapter.resume(makeExecutionRef({ backend_id: request.executionRef.backend_id,
    dispatch_key: request.resume.dispatch_key, native_ref: request.resume.native_ref }), request, runOptions)
  : await selected.adapter.start(request, runOptions);
channel.finish({ type: "result", value: result });
