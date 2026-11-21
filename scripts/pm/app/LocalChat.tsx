import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, Clock3, MessageCircle, Send } from "lucide-react";
import { v2Post } from "./api";
import { ErrorNotice } from "./components";
import { client, pmKeys } from "./state";
import {
  answersFrom,
  chatThread,
  choices,
  initialDraft,
  openQuestion,
  toggle,
  typeOther,
  type Draft,
  type LocalQuestion,
} from "./localChatModel";
import type { LocalRunView } from "./LocalDelivery";
import "./local-chat.css";

type ChatRun = Pick<LocalRunView, "run_id" | "activity" | "questions" | "messages" | "interrupted" | "canMessage">;

const hhmm = (at: string) => at.replace(/^.*T/u, "").slice(0, 5);

/** DLV-164. Answer one question; recommended options start selected. */
export function LocalQuestionCard({ runId, question }: { runId: string; question: LocalQuestion }) {
  const [draft, setDraft] = useState<Draft>(() => initialDraft(question));
  const send = useMutation({
    mutationFn: (answers: Record<string, string>) =>
      v2Post("local", { action: "answer", run_id: runId, question_id: question.id, answers }, 30_000),
    onSettled: () => client.invalidateQueries({ queryKey: pmKeys.all }),
  });
  const answers = answersFrom(question, draft);
  const locked = send.isPending || send.isSuccess;
  const submit = () => { if (answers && !locked) send.mutate(answers); };
  return (
    <form className="chat-question" aria-label="Question" onSubmit={(event) => { event.preventDefault(); submit(); }}>
      {question.questions.map((item, index) => {
        const entry = draft[item.question] ?? { picked: [], other: "" };
        const options = choices(item);
        const preview = options.find((choice) => entry.picked.includes(choice.value) && choice.preview)?.preview;
        const id = `${question.id}-${index}`;
        return (
          <fieldset key={item.question} disabled={locked}>
            <legend id={id}>
              <span className="chat-chip">{item.header}</span>
              <span>{item.question}</span>
            </legend>
            <div className="chat-options" role="group" aria-labelledby={id}>
              {options.map((choice) => (
                <button key={choice.label} type="button" className="chat-option"
                  aria-pressed={entry.picked.includes(choice.value)}
                  onClick={() => setDraft((current) => toggle(current, item, choice.value))}>
                  <span className="chat-option-label">
                    {choice.value}
                    {choice.recommended && <small>Recommended</small>}
                  </span>
                  {choice.description && <span className="chat-option-detail">{choice.description}</span>}
                </button>
              ))}
            </div>
            {preview && <pre className="chat-preview">{preview}</pre>}
            <input type="text" className="chat-other" aria-label={`Other · ${item.header}`} placeholder="Other"
              value={entry.other} maxLength={4000}
              onChange={(event) => { const value = event.target.value; setDraft((current) => typeOther(current, item, value)); }} />
          </fieldset>
        );
      })}
      <ErrorNotice error={send.error} />
      <div className="chat-send">
        <button type="submit" className="primary" disabled={!answers || locked}>
          {send.isSuccess ? <Check size={16} /> : <Send size={16} />}
          {send.isPending ? "Sending…" : send.isSuccess ? "Sent" : "Send"}
        </button>
      </div>
    </form>
  );
}

/** DLV-165. A free message to the agent: delivered at its next step, or resumes a waiting session. */
function Composer({ runId }: { runId: string }) {
  const [text, setText] = useState("");
  const send = useMutation({
    mutationFn: (value: string) => v2Post("local", { action: "message", run_id: runId, text: value }, 30_000),
    onSuccess: () => setText(""),
    onSettled: () => client.invalidateQueries({ queryKey: pmKeys.all }),
  });
  const value = text.trim();
  return (
    <form className="chat-composer" aria-label="Message" onSubmit={(event) => { event.preventDefault(); if (value && !send.isPending) send.mutate(value); }}>
      <ErrorNotice error={send.error} />
      <div className="chat-composer-row">
        <textarea rows={1} aria-label="Message" placeholder="Message" value={text} maxLength={4000}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
            event.preventDefault();
            if (value && !send.isPending) send.mutate(value);
          }} />
        <button type="submit" className="primary" aria-label="Send message" disabled={!value || send.isPending}>
          <Send size={16} />
        </button>
      </div>
    </form>
  );
}

function AskedQuestion({ question }: { question: LocalQuestion }) {
  return (
    <div className="chat-asked">
      {question.questions.map((item) => (
        <p key={item.question}><span className="chat-chip">{item.header}</span> {item.question}</p>
      ))}
      {question.state === "closed" && <small className="quiet">Not answered</small>}
    </div>
  );
}

/** The session as a conversation: ERA's narration, its questions, the owner's answers and messages. */
export function LocalChat({ run, limit = 40, compact = false, composer = true }: { run: ChatRun; limit?: number; compact?: boolean; composer?: boolean }) {
  const thread = chatThread(run, limit);
  const open = openQuestion(run);
  const list = useRef<HTMLOListElement>(null);
  const last = thread.at(-1)?.key;
  useEffect(() => {
    const node = list.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [last]);
  const writable = composer && !!run.canMessage;
  if (!thread.length && !writable) return null;
  return (
    <section className="local-chat" data-compact={compact || undefined} data-open={!!open || undefined} aria-label="Chat">
      {!compact && <h2><MessageCircle size={18} />Chat</h2>}
      {thread.length > 0 && <ol ref={list} className="chat-thread">
        {thread.map((entry) => {
          if (entry.kind === "agent")
            return <li key={entry.key} className="chat-agent"><p>{entry.text}</p><time dateTime={entry.at}>{hhmm(entry.at)}</time></li>;
          if (entry.kind === "owner")
            return (
              <li key={entry.key} className="chat-owner">
                <p>{entry.message.text}</p>
                <time dateTime={entry.at}>
                  {entry.message.delivered_at
                    ? <Check size={12} aria-label="Delivered" />
                    : <Clock3 size={12} aria-label="Queued" />}
                  {hhmm(entry.at)}
                </time>
              </li>
            );
          if (entry.kind === "answer")
            return (
              <li key={entry.key} className="chat-owner">
                {entry.question.questions.map((item) => (
                  <p key={item.question}>
                    {entry.question.questions.length > 1 && <span className="chat-chip">{item.header}</span>}
                    {entry.answers[item.question]}
                  </p>
                ))}
                <time dateTime={entry.at}>{hhmm(entry.at)}</time>
              </li>
            );
          return (
            <li key={entry.key} className="chat-agent chat-ask">
              {open?.id === entry.question.id
                ? <LocalQuestionCard key={entry.question.id} runId={run.run_id} question={entry.question} />
                : <AskedQuestion question={entry.question} />}
              <time dateTime={entry.at}>{hhmm(entry.at)}</time>
            </li>
          );
        })}
      </ol>}
      {writable && <Composer runId={run.run_id} />}
    </section>
  );
}
