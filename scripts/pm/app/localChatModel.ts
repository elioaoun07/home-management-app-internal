/** DLV-164. Owner questions a Local Claude session asked through AskUserQuestion. */
export interface LocalQuestionOption {
  label: string;
  description: string;
  preview?: string;
}
export interface LocalQuestionItem {
  question: string;
  header: string;
  multiSelect: boolean;
  options: LocalQuestionOption[];
}
export interface LocalQuestion {
  id: string;
  questions: LocalQuestionItem[];
  asked_at: string;
  answers: Record<string, string> | null;
  answered_at: string | null;
  delivered_at?: string | null;
  closed_at?: string | null;
  state: "open" | "answered" | "closed";
}
/** DLV-165: a free message from the owner; delivered once the agent received it. */
export interface LocalOwnerMessage {
  id: string;
  at: string;
  text: string;
  delivered_at: string | null;
}
export interface ChoiceView extends LocalQuestionOption {
  /** The text sent back as the answer: the agent's label without the marker. */
  value: string;
  recommended: boolean;
}
/** One question's selection: chosen option values plus free text ("Other"). */
export interface DraftEntry {
  picked: string[];
  other: string;
}
export type Draft = Record<string, DraftEntry>;

const MARKER = /\s*[([]\s*recommended\s*[)\]]/giu;

/** The agent marks its recommendation in the label; nothing else is inferred. */
export function choices(item: LocalQuestionItem): ChoiceView[] {
  return item.options.map((option) => {
    const value = option.label.replace(MARKER, "").trim() || option.label;
    return { ...option, value, recommended: value !== option.label };
  });
}

/** Recommended options start selected, so the default answer is one click. */
export function initialDraft(question: LocalQuestion): Draft {
  return Object.fromEntries(
    question.questions.map((item) => {
      const recommended = choices(item).filter((choice) => choice.recommended);
      const picked = item.multiSelect
        ? recommended.map((choice) => choice.value)
        : recommended.slice(0, 1).map((choice) => choice.value);
      return [item.question, { picked, other: "" }];
    }),
  );
}

export function toggle(
  draft: Draft,
  item: LocalQuestionItem,
  value: string,
): Draft {
  const entry = draft[item.question] ?? { picked: [], other: "" };
  const picked = item.multiSelect
    ? entry.picked.includes(value)
      ? entry.picked.filter((current) => current !== value)
      : [...entry.picked, value]
    : [value];
  // A single-select choice replaces any typed alternative.
  return {
    ...draft,
    [item.question]: { picked, other: item.multiSelect ? entry.other : "" },
  };
}

export function typeOther(
  draft: Draft,
  item: LocalQuestionItem,
  other: string,
): Draft {
  const entry = draft[item.question] ?? { picked: [], other: "" };
  return {
    ...draft,
    [item.question]: {
      picked: item.multiSelect || !other.trim() ? entry.picked : [],
      other,
    },
  };
}

/** The SDK's answers map, or null until every question has an answer. */
export function answersFrom(
  question: LocalQuestion,
  draft: Draft,
): Record<string, string> | null {
  const answers: Record<string, string> = {};
  for (const item of question.questions) {
    const entry = draft[item.question] ?? { picked: [], other: "" };
    const other = entry.other.trim();
    const value = item.multiSelect
      ? [...entry.picked, ...(other ? [other] : [])].join(", ")
      : other || entry.picked[0] || "";
    if (!value) return null;
    answers[item.question] = value;
  }
  return answers;
}

export function openQuestion(run: {
  questions?: LocalQuestion[];
  interrupted: boolean;
}): LocalQuestion | null {
  if (run.interrupted) return null;
  return run.questions?.find((question) => question.state === "open") ?? null;
}

export type ChatEntry =
  | { kind: "agent"; key: string; at: string; text: string }
  | { kind: "owner"; key: string; at: string; message: LocalOwnerMessage }
  | { kind: "question"; key: string; at: string; question: LocalQuestion }
  | {
      kind: "answer";
      key: string;
      at: string;
      question: LocalQuestion;
      answers: Record<string, string>;
    };

interface ChatActivity {
  at: string;
  summary: string | null;
  kind?: string;
  seq?: number;
  agent_json?: { role?: string } | string | null;
}

const role = (agent: ChatActivity["agent_json"]) => {
  if (!agent) return null;
  if (typeof agent !== "string") return agent.role ?? null;
  try {
    return (JSON.parse(agent) as { role?: string } | null)?.role ?? null;
  } catch {
    return null;
  }
};

/** Main-thread narration, the Q&A ledger and owner messages, oldest first. Subagent text stays in Activity. */
export function chatThread(
  run: { activity: ChatActivity[]; questions?: LocalQuestion[]; messages?: LocalOwnerMessage[] },
  limit = 40,
): ChatEntry[] {
  const entries: ChatEntry[] = [];
  run.activity.forEach((entry, index) => {
    if (entry.kind !== "message" || !entry.summary?.trim()) return;
    if (role(entry.agent_json) === "subagent") return;
    entries.push({
      kind: "agent",
      key: `m:${entry.seq ?? index}:${entry.at}`,
      at: entry.at,
      text: entry.summary,
    });
  });
  for (const question of run.questions ?? []) {
    entries.push({
      kind: "question",
      key: `q:${question.id}`,
      at: question.asked_at,
      question,
    });
    if (question.answers && question.answered_at)
      entries.push({
        kind: "answer",
        key: `a:${question.id}`,
        at: question.answered_at,
        question,
        answers: question.answers,
      });
  }
  for (const message of run.messages ?? [])
    entries.push({ kind: "owner", key: `o:${message.id}`, at: message.at, message });
  const order = { agent: 0, question: 1, answer: 2, owner: 3 };
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort(
      (a, b) =>
        Date.parse(a.entry.at) - Date.parse(b.entry.at) ||
        order[a.entry.kind] - order[b.entry.kind] ||
        a.index - b.index,
    )
    .map(({ entry }) => entry)
    .slice(-limit);
}
