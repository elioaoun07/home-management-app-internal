// Replay-only stand-in for local-worker.mjs, using the real stdin/stdout channel.
// mode "ask": relays one question and parks. mode "listen": waits for an owner
// message, takes it as delivered, and finishes.
import { ownerChannel } from "../../../scripts/delivery-v2/local-worker-channel.mjs";

const channel = ownerChannel({ input: process.stdin, write: (line, done) => process.stdout.write(line, done) });
const request = JSON.parse(await channel.request);
channel.send({ type: "activity", value: { kind: "status", summary: `fixture ${request.mode}` } });
if (request.mode === "ask") {
  const reply = await channel.askOwner({ questions: request.questions }, { id: "toolu_fixture" });
  channel.finish({ type: "result", value: { status: "finished", executionRef: { native_ref: "native-fixture" },
    observations: { nativeOutcome: reply.park ? "parked" : "failed", parked: reply.park ? { id: reply.id } : null, reply } } });
} else {
  let text = null;
  for (let tries = 0; tries < 250 && !text; tries++) {
    text = channel.takeMessages();
    if (!text) await new Promise(resolve => setTimeout(resolve, 20));
  }
  channel.finish({ type: "result", value: { status: "finished", observations: { nativeOutcome: "succeeded", delivered: text } } });
}
