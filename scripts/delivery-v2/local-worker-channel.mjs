// DLV-164 / DLV-165. The worker's half of the supervisor line protocol.
// stdin:  line 1 = the job request; then {type:"message", id, text} owner messages.
// stdout: activity, {type:"question"}, {type:"delivered", ids}, and the final result.
// A question never waits here: it is recorded upstream and the session parks.
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import { normalizeQuestion, ownerMessageText } from "./local-questions.mjs";

/** @param {{input:NodeJS.ReadableStream, write:(line:string, done?:()=>void)=>void}} io */
export function ownerChannel({ input, write }) {
  const lines = createInterface({ input, crlfDelay: Infinity });
  const inbox = [];
  let resolveRequest = () => {};
  const request = new Promise(resolve => { resolveRequest = resolve; });
  let received = false;
  lines.on("line", line => {
    if (!received) { received = true; resolveRequest(line); return; }
    let message = null;
    try { message = JSON.parse(line); } catch { return; }
    if (message?.type === "message" && typeof message.id === "string" && typeof message.text === "string" && !inbox.some(item => item.id === message.id))
      inbox.push({ id: message.id, text: message.text });
  });
  lines.on("close", () => { if (!received) { received = true; resolveRequest(""); } });
  const send = (value, done) => write(JSON.stringify(value) + "\n", done);
  /** Validate and relay one question. `park` means: end the turn now. */
  const askOwner = async (value, { id } = {}) => {
    const questionId = typeof id === "string" && /^[\w-]{1,200}$/u.test(id) ? id : randomUUID();
    const asked = normalizeQuestion({ id: questionId, questions: value?.questions });
    if (!asked.ok) return { refused: asked.reason };
    send({ type: "question", value: asked.question });
    return { park: true, id: questionId };
  };
  /** Owner messages not yet given to the agent, as one text; marks them delivered. */
  const takeMessages = () => {
    if (!inbox.length) return null;
    const taken = inbox.splice(0);
    send({ type: "delivered", ids: taken.map(item => item.id) });
    return ownerMessageText(taken);
  };
  /** Write the final record, then release stdin so the process can exit. */
  const finish = value => send(value, () => { lines.close(); if (typeof input.destroy === "function") input.destroy(); });
  return { request, askOwner, takeMessages, send, finish };
}
