import { memo, useEffect, useRef, useState } from "react";
import type { LocalActivityEvent } from "../../localRunActivityModel";
import { TIMING } from "../config";
import { FoundryPortrait } from "./FoundryPortrait";

export interface CommsProps {
  message: LocalActivityEvent | null;
  history: readonly LocalActivityEvent[];
  state?: string;
}

export const Comms = memo(function Comms({
  message,
  history,
  state = "live",
}: CommsProps) {
  const [lastId, setLastId] = useState<string | null>(message?.id ?? null);
  const [visible, setVisible] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const paused = useRef(false),
    resume = useRef<() => void>(() => {});
  paused.current = state === "link-down";
  useEffect(() => {
    if (!paused.current) resume.current();
  }, [state]);
  useEffect(() => {
    if (message) setLastId(message.id);
  }, [message]);
  const current =
    message?.id === lastId
      ? message
      : (history.find((event) => event.id === lastId) ?? null);
  const text = current?.summary ?? "";
  const messageId = current?.id;
  useEffect(() => {
    setCollapsed(false);
    if (!messageId) return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    let count = preference.matches ? text.length : 0;
    let typing: ReturnType<typeof setTimeout> | null = null;
    const collapseAt = Date.now() + TIMING.comms;
    setVisible(count);
    const step = () => {
      typing = null;
      if (
        paused.current ||
        document.visibilityState === "hidden" ||
        count >= text.length
      )
        return;
      count += 1;
      setVisible(count);
      if (count < text.length) typing = setTimeout(step, TIMING.typeCharacter);
    };
    const continueTyping = () => {
      if (!paused.current && document.visibilityState !== "hidden") {
        if (typing === null && count < text.length)
          typing = setTimeout(step, TIMING.typeCharacter);
        if (Date.now() >= collapseAt) setCollapsed(true);
      }
    };
    const reduce = () => {
      if (preference.matches) {
        count = text.length;
        setVisible(count);
        if (typing !== null) clearTimeout(typing);
        typing = null;
      }
    };
    resume.current = continueTyping;
    continueTyping();
    const collapse = setTimeout(() => {
      if (!paused.current && document.visibilityState !== "hidden")
        setCollapsed(true);
    }, TIMING.comms);
    document.addEventListener("visibilitychange", continueTyping);
    preference.addEventListener("change", reduce);
    return () => {
      if (typing !== null) clearTimeout(typing);
      clearTimeout(collapse);
      document.removeEventListener("visibilitychange", continueTyping);
      preference.removeEventListener("change", reduce);
      resume.current = () => {};
    };
  }, [messageId, text]);
  return (
    <section
      className="board-comms"
      aria-label="COMMS"
      hidden={!current}
      data-collapsed={collapsed}
    >
      <FoundryPortrait state={state} />
      <button
        type="button"
        aria-label="COMMS"
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((value) => !value)}
      >
        <small>COMMS</small>
        <span
          className="stage-transmission-text"
          data-text={text}
          data-event-id={current?.id}
        >
          {text.slice(0, visible)}
        </span>
      </button>
    </section>
  );
});
