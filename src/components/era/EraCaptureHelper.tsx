"use client";

import { Fragment, useState, type CSSProperties } from "react";
import {
  ArrowLeft,
  Bell,
  BellOff,
  CalendarDays,
  Check,
  ChevronRight,
  Flag,
  ListChecks,
  MapPin,
  MoreHorizontal,
  Receipt,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/shared/Sheet";
import { useThemeClasses } from "@/hooks/useThemeClasses";
import type { EraCaptureHelper as Helper } from "@/features/era/useEraCapture";
import {
  applySentenceChoice,
  captureChoices,
  captureFocus,
  captureQuestion,
  captureTokens,
  type AssistChoice,
  type AssistToken,
} from "@/features/era/captureAssist";
import type { CaptureStep } from "@/features/era/captureProgress";
import { MODULE_COLORS } from "./eraHues";
import styles from "./EraComposer.module.css";

const CAPTURE_ACTIONS = [
  {
    kind: "reminder",
    label: "Reminder",
    icon: Bell,
    hue: MODULE_COLORS.schedule.hue,
  },
  {
    kind: "event",
    label: "Event",
    icon: CalendarDays,
    hue: MODULE_COLORS.schedule.hue,
  },
  {
    kind: "expense",
    label: "Expense",
    icon: Receipt,
    hue: MODULE_COLORS.financial.hue,
  },
  {
    kind: "shopping",
    label: "Shopping",
    icon: ListChecks,
    hue: MODULE_COLORS.recipe.hue,
  },
] as const;

const TOKEN_ICONS = {
  alert: Bell,
  silent: BellOff,
  place: MapPin,
  priority: Flag,
} as const;

function buzz() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator)
    navigator.vibrate?.(8);
}

/**
 * One conversational line: what ERA understood (tappable to correct), the one
 * question it still has, and the choices that answer it. Secondary choices
 * use the shared native sheet.
 */
export function EraCaptureHelper({
  helper: h,
  text,
  busy,
  nudge,
  setText,
  editLocation,
  refocus,
}: {
  helper: Helper;
  text: string;
  busy: boolean;
  /** Bumped when Send is pressed before a required detail. */
  nudge: number;
  setText: (next: string) => void;
  editLocation: (location: string) => void;
  refocus: () => void;
}) {
  const tc = useThemeClasses();
  const [inspection, setInspection] = useState<{
    step: CaptureStep;
    text: string;
  } | null>(null);
  const [panel, setPanel] = useState<"more" | "choices" | null>(null);
  const [search, setSearch] = useState("");
  const s = h.assist;
  if (!s) return null;
  const action = CAPTURE_ACTIONS.find((a) => a.kind === h.kind)!;
  const Icon = action.icon;
  const f = h.fields;
  const schedule = h.kind === "reminder" || h.kind === "event";
  const focus = captureFocus(s);
  const inspect = inspection?.text === text ? inspection.step : null;
  const step = inspect ?? focus.step;
  const fragment = inspect ? "" : focus.fragment;
  const blocked = h.loading || h.error || h.recurring;
  const choices = blocked ? [] : captureChoices(s, step, fragment);
  const ready = !!h.capture && !inspect;
  const question = h.error
    ? "Couldn't load choices"
    : h.loading
      ? "Loading choices…"
      : h.recurring
        ? "Continue in Schedule"
        : captureQuestion(h.kind!, step, { more: h.items.length > 0 });
  const tokens = captureTokens(s);
  const shown = choices.slice(
    0,
    choices.some((choice) => choice.label.length > 36) ? 2 : 4,
  );
  const filtered = choices.filter((choice) =>
    choice.label.toLowerCase().includes(search.toLowerCase()),
  );
  const accent = { "--capture-hue": action.hue } as CSSProperties;

  const close = () => {
    setInspection(null);
    setPanel(null);
    setSearch("");
    refocus();
  };
  const choose = (choice: AssistChoice) => {
    buzz();
    if (choice.sentence) setText(applySentenceChoice(text, choice, fragment));
    else h.change(step, choice.value);
    close();
  };
  const tapToken = (token: AssistToken) => {
    if (token.key === "location") editLocation(f.location);
    else if (token.step) {
      setInspection({ step: token.step, text });
      setPanel(null);
    }
    refocus();
  };
  const selected = (choice: AssistChoice) =>
    !choice.sentence && (f[step] ?? "") === choice.value;

  return (
    <section
      className={styles.helper}
      style={accent}
      aria-label={`${action.label} suggestions`}
    >
      <div className={styles.header}>
        <span className={styles.identity} data-ready={ready || undefined}>
          {ready ? (
            <Check className="size-3.5" aria-hidden />
          ) : (
            <Icon className="size-3.5" aria-hidden />
          )}
          {action.label}
        </span>
        <p
          key={`${step}:${h.loading}:${h.error}:${nudge}`}
          className={`${styles.question} ${nudge ? styles.nudged : ""}`}
          aria-live="polite"
        >
          {question}
        </p>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => setPanel("more")}
          aria-label="Change action"
          disabled={busy}
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => {
            h.dismiss();
            refocus();
          }}
          aria-label="Dismiss suggestions"
          disabled={busy}
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      {tokens.length > 0 && (
        <p className={styles.tokens}>
          {tokens.map((token, i) => {
            const TokenIcon = token.icon ? TOKEN_ICONS[token.icon] : null;
            const body = (
              <>
                {TokenIcon && <TokenIcon className="size-3" aria-hidden />}
                {token.label}
              </>
            );
            return (
              <Fragment key={token.key}>
                {i > 0 &&
                  (token.joiner ? (
                    <span className={styles.joiner}>{` ${token.joiner} `}</span>
                  ) : (
                    <span className={styles.separator} aria-hidden>
                      ·
                    </span>
                  ))}
                {token.step || token.key === "location" ? (
                  <button
                    type="button"
                    className={styles.token}
                    data-active={inspect === token.step || undefined}
                    onClick={() => tapToken(token)}
                    disabled={busy}
                  >
                    {body}
                  </button>
                ) : (
                  <span className={styles.tokenText}>{body}</span>
                )}
              </Fragment>
            );
          })}
        </p>
      )}
      {shown.length > 0 && (
        <div key={`${step}:${fragment}`} className={styles.choices}>
          {shown.map((choice) => (
            <button
              key={`${choice.sentence ?? "field"}:${choice.value}`}
              type="button"
              className={styles.choice}
              onClick={() => choose(choice)}
              disabled={busy}
              aria-pressed={selected(choice)}
            >
              {choice.label}
              {choice.detail && step !== "threadId" && (
                <span className={styles.detail}>{choice.detail}</span>
              )}
            </button>
          ))}
        </div>
      )}
      {(inspect ||
        h.recurring ||
        h.error ||
        (!blocked &&
          (choices.length > shown.length ||
            (step === "threadId" && choices.length > 0)))) && (
        <div className={styles.helperFooter}>
          {inspect && (
            <button
              type="button"
              className={styles.textButton}
              onClick={close}
            >
              <ArrowLeft className="size-3" aria-hidden />
              Back
            </button>
          )}
          {!blocked &&
            (choices.length > shown.length ||
              (step === "threadId" && choices.length > 0)) && (
              <button
                type="button"
                className={styles.textButton}
                onClick={() => setPanel("choices")}
              >
                {step === "threadId" ? "Browse lists" : "More"}
                <ChevronRight className="size-3" aria-hidden />
              </button>
            )}
          {h.recurring && (
            <a href="/reminders" className={styles.textButton}>
              Open Schedule
              <ChevronRight className="size-3" aria-hidden />
            </a>
          )}
          {h.error && (
            <button
              type="button"
              className={styles.textButton}
              onClick={h.dismiss}
            >
              Keep typing
            </button>
          )}
        </div>
      )}
      <Sheet
        open={panel !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPanel(null);
            setSearch("");
          }
        }}
      >
        <SheetContent
          side="bottom"
          aria-describedby={undefined}
          className={`${styles.picker} ${tc.bgPage} z-[80] max-h-[75dvh] scrollbar-hide`}
          style={accent}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            refocus();
          }}
        >
          <SheetHeader className="pr-10 pt-5">
            <SheetTitle>{panel === "more" ? action.label : question}</SheetTitle>
          </SheetHeader>
          {panel === "more" && (
            <div className={styles.rows}>
              {CAPTURE_ACTIONS.map(({ kind, label, icon: ActionIcon, hue }) => (
                <button
                  key={kind}
                  type="button"
                  className={styles.row}
                  aria-pressed={kind === h.kind}
                  onClick={() => {
                    h.switchKind(kind);
                    close();
                  }}
                >
                  <span
                    className={styles.identity}
                    style={{ "--capture-hue": hue } as CSSProperties}
                  >
                    <ActionIcon className="size-5" aria-hidden />
                  </span>
                  <span className={styles.rowText}>{label}</span>
                  {kind === h.kind && <Check className="size-4" aria-hidden />}
                </button>
              ))}
              {schedule && (
                <>
                  <div className={styles.rowDivider} />
                  <button
                    type="button"
                    className={styles.row}
                    onClick={() => {
                      setInspection({ step: "priority", text });
                      setPanel(null);
                      refocus();
                    }}
                  >
                    <Flag className="size-4 shrink-0" aria-hidden />
                    <span className={styles.rowText}>
                      Priority
                      <span className={styles.detail}>{f.priority}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={styles.row}
                    onClick={() => {
                      editLocation(f.location);
                      close();
                    }}
                  >
                    <MapPin className="size-4 shrink-0" aria-hidden />
                    <span className={styles.rowText}>
                      Location
                      <span className={styles.detail}>{f.location || "Add"}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0" aria-hidden />
                  </button>
                </>
              )}
            </div>
          )}
          {panel === "choices" && (
            <>
              <input
                type="search"
                className={styles.search}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search"
                aria-label={`Search ${question.toLowerCase().replace(/\?$/, "")}`}
              />
              <div className={styles.rows}>
                {filtered.map((choice) => (
                  <button
                    key={`${choice.sentence ?? "field"}:${choice.value}`}
                    type="button"
                    className={styles.row}
                    onClick={() => choose(choice)}
                  >
                    <span className={styles.rowText}>
                      {choice.label}
                      {choice.detail && (
                        <span className={styles.detail}>{choice.detail}</span>
                      )}
                    </span>
                    {selected(choice) && (
                      <Check className="size-4 shrink-0" aria-hidden />
                    )}
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className={styles.summary}>No matches</p>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}
