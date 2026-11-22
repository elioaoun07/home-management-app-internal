// DLV-164 / DLV-165. The Local session conversation ledger: questions the agent
// asked (AskUserQuestion for Claude, the era_owner ask_owner tool for Codex),
// the owner's answers, and the owner's free messages. The supervisor owns this
// record; nothing here infers an answer or a message.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const LIMITS = { questions: 4, options: [2, 4], question: 2000, header: 40, label: 200, description: 1000, preview: 4000, answer: 4000, message: 4000 };
const text = (value, max) => typeof value === "string" && value.trim() !== "" && value.length <= max ? value : null;

/** The tool input → a stored question, or the reason the agent is refused. */
export function normalizeQuestion(value) {
  const id = typeof value?.id === "string" && /^[\w-]{1,200}$/u.test(value.id) ? value.id : null;
  if (!id) return { ok: false, reason: "The question had no usable id." };
  const raw = Array.isArray(value.questions) ? value.questions : [];
  if (raw.length < 1 || raw.length > LIMITS.questions) return { ok: false, reason: "Ask between one and four questions." };
  const questions = [];
  for (const entry of raw) {
    const question = text(entry?.question, LIMITS.question);
    const header = text(entry?.header, LIMITS.header) || "Question";
    const options = Array.isArray(entry?.options) ? entry.options : [];
    if (!question) return { ok: false, reason: "Each question needs its text." };
    if (options.length < LIMITS.options[0] || options.length > LIMITS.options[1]) return { ok: false, reason: "Each question needs two to four options." };
    const clean = [];
    for (const option of options) {
      const label = text(option?.label, LIMITS.label);
      if (!label) return { ok: false, reason: "Each option needs a label." };
      const description = typeof option?.description === "string" ? option.description.slice(0, LIMITS.description) : "";
      const preview = text(option?.preview, LIMITS.preview);
      clean.push({ label, description, ...(preview ? { preview } : {}) });
    }
    if (new Set(clean.map(option => option.label)).size !== clean.length) return { ok: false, reason: "Option labels must be distinct." };
    questions.push({ question, header, multiSelect: entry?.multiSelect === true, options: clean });
  }
  // Answers are keyed by question text, exactly as AskUserQuestion expects them.
  if (new Set(questions.map(entry => entry.question)).size !== questions.length) return { ok: false, reason: "Each question needs distinct text." };
  return { ok: true, question: { id, questions } };
}

/** Owner answers → the `answers` map. Every question needs one. */
export function normalizeAnswers(entry, answers) {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return { ok: false, reason: "answers-required" };
  const out = {};
  for (const { question } of entry.questions) {
    const value = typeof answers[question] === "string" ? answers[question].trim() : "";
    if (!value) return { ok: false, reason: "answer-every-question" };
    if (value.length > LIMITS.answer) return { ok: false, reason: "answer-too-long" };
    out[question] = value;
  }
  if (Object.keys(answers).some(key => !Object.hasOwn(out, key))) return { ok: false, reason: "unknown-question-text" };
  return { ok: true, answers: out };
}

export function normalizeMessage(value) {
  const message = typeof value === "string" ? value.trim() : "";
  if (!message) return { ok: false, reason: "message-required" };
  if (message.length > LIMITS.message) return { ok: false, reason: "message-too-long" };
  return { ok: true, text: message };
}

/** Keep the game timeline on its compact SDK summary. Older recordings may
 * also hold the full final reply, independently of the activity excerpt. Bind
 * it only to the same observed main-thread row with an unambiguous timestamp. */
export function localMessageBodies(rows, observed) {
  const last = observed?.activity?.findLast(entry => entry.kind === "message" && entry.agent?.role === "main");
  const final = typeof observed?.finalText === "string" ? observed.finalText : "";
  const candidates = last?.summary && final.startsWith(last.summary)
    ? rows.filter(row => row.kind === "message" && row.at === last.at && row.summary && final.startsWith(row.summary))
    : [];
  return rows.map(row => {
    if (row.kind !== "message" || !row.summary) return row;
    const recovered = candidates.length === 1 && candidates[0] === row;
    const text = recovered ? final : row.summary;
    const excerpt = !recovered && [240, 400, 16_384].includes(text.length);
    return { ...row, summary: row.summary.slice(0, 240),
      ...(text.length > 240 && { message_text: text }), message_excerpt: excerpt };
  });
}

/** `{questions, messages}`; a phase-1 array file reads as questions only. */
export function readLedger(file) {
  if (!existsSync(file)) return { questions: [], messages: [] };
  try {
    const value = JSON.parse(readFileSync(file, "utf8"));
    if (Array.isArray(value)) return { questions: value, messages: [] };
    return {
      questions: Array.isArray(value?.questions) ? value.questions : [],
      messages: Array.isArray(value?.messages) ? value.messages : [],
    };
  } catch { return { questions: [], messages: [] }; }
}

export function writeLedger(file, ledger) {
  mkdirSync(dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify({ questions: ledger.questions, messages: ledger.messages }, null, 2));
  renameSync(temp, file);
}

/** Read projection: an unanswered question is open only while its session can still take the answer. */
export function projectQuestions(entries, answerable) {
  return entries.map(entry => ({ ...entry,
    state: entry.answers ? "answered" : !entry.closed_at && answerable ? "open" : "closed" }));
}

/** The next prompt for a parked session: answers first, then the owner's messages.
 * @param {{answered?:{questions:{question:string}[], answers:Record<string,string>}[], messages?:{text:string}[]}} input */
export function resumePrompt({ answered = [], messages = [] }) {
  const parts = [];
  for (const entry of answered) {
    parts.push("The owner answered your question:\n" +
      entry.questions.map(item => `- ${item.question}\n  Answer: ${entry.answers[item.question]}`).join("\n"));
  }
  if (messages.length) parts.push(ownerMessageText(messages));
  parts.push("Continue the task.");
  return parts.join("\n\n");
}

/** Owner messages as delivered into a running session.
 * @param {{text:string}[]} messages */
export function ownerMessageText(messages) {
  return (messages.length === 1 ? "Message from the owner:\n" : "Messages from the owner:\n") +
    messages.map(message => message.text).join("\n\n");
}
