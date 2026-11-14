// Only invoked by the supervisor with scrubbed env and a request on stdin.
import { createExecutor } from "./adapters/registry.mjs";
import { assertNoLocalSecrets } from "./local-guardrails.mjs";
let input = "";
for await (const chunk of process.stdin) input += chunk;
const request = JSON.parse(input);
assertNoLocalSecrets(request.workspace.root);
const selected = await createExecutor(request.settings.executor, { local: true, env: process.env, codexOptions: { env: process.env } });
if (!selected.ok) throw new Error(selected.refusal.detail);
const result = await selected.adapter.start(request, {
  observeActivity: value => process.stdout.write(JSON.stringify({ type: "activity", value }) + "\n"),
});
process.stdout.write(JSON.stringify({ type: "result", value: result }) + "\n");
