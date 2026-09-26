import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DeliveryQuestion } from "../../scripts/pm/app/DeliveryQuestion";
import { questionPresentation } from "../../scripts/pm/app/deliveryQuestionModel";
import { normalizePlanBody } from "../../scripts/delivery-v2/interaction.mjs";
import type { V2Question } from "../../scripts/pm/app/types";

const text =
  "Where should this open?\nA) A new page\nB) The current panel (Recommended)\nC) A dialog";
const question: V2Question = {
  question_id: "q-preview",
  plan_revision: 3,
  stage: "plan",
  text,
  blocking: true,
  status: "open",
  answer: null,
};

describe("Delivery question presentation", () => {
  it("puts only an explicitly recommended answer first and preserves its supplied text", () => {
    const result = questionPresentation(text);
    expect(result.prompt).toBe("Where should this open?");
    expect(result.choices).toEqual([
      {
        label: "The current panel",
        answer: "The current panel (Recommended)",
        recommended: true,
      },
      { label: "A new page", answer: "A new page", recommended: false },
      { label: "A dialog", answer: "A dialog", recommended: false },
    ]);
  });

  it("never chooses a recommendation based on position or wording", () => {
    const result = questionPresentation(
      "Which path?\nA) Default path\nB) Safer path",
    );
    expect(result.choices.map((choice) => choice.label)).toEqual([
      "Default path",
      "Safer path",
    ]);
    expect(result.choices.every((choice) => !choice.recommended)).toBe(true);
    expect(
      questionPresentation(
        "Which path?\nA) Risky (not recommended)\nB) Other",
      ).choices.every((choice) => !choice.recommended),
    ).toBe(true);
  });

  it.each([
    "Which path?\nOptions:\n1. Keep it\n2. Change it [Recommended]",
    "Which path?\nChoices:\n- Keep it\n- Change it [Recommended]",
    "Which path?\n**Options**:\n**A)** Keep it\n**B)** **Change it [Recommended]**",
  ])("supports explicitly labeled choice lists: %s", (input) => {
    const result = questionPresentation(input);
    expect(result.prompt).toBe("Which path?");
    expect(result.choices.map((choice) => choice.label)).toEqual([
      "Change it",
      "Keep it",
    ]);
  });

  it.each([
    "Should this be a dialog or a page?",
    "Please confirm:\n1. Which page?\n2. Which icon?",
    "What should happen?\n- Existing page is slow\n- Dialogs are inconsistent",
    "Choose:\nA) One path\nC) Another path",
    "Choose:\nA) One path\nB) Another path\nPlease explain why.",
    "Choose:\nA) Same path\nB) Same path",
  ])(
    "preserves ambiguous/freeform questions without inventing choices: %s",
    (input) => {
      expect(questionPresentation(input)).toEqual({
        prompt: input,
        choices: [],
      });
    },
  );

  it("works with the current retained plan contract without adding fields", () => {
    const normalized = normalizePlanBody({
      outcome: "Open an item",
      questions: [{ text, blocking: true }],
    });
    expect(Object.keys(normalized.body.questions[0]).sort()).toEqual([
      "blocking",
      "text",
    ]);
    expect(
      questionPresentation(normalized.body.questions[0].text).choices,
    ).toHaveLength(3);
  });

  it("renders recommendations without preselecting an answer or enabling Send", () => {
    const html = renderToStaticMarkup(
      createElement(DeliveryQuestion, {
        question,
        answer: "",
        disabled: false,
        onAnswerChange: vi.fn(),
        onSend: vi.fn(),
      }),
    );
    expect(html.indexOf("The current panel")).toBeLessThan(
      html.indexOf("A new page"),
    );
    expect(html).toContain("Recommended");
    expect(html).not.toContain('aria-pressed="true"');
    expect(html).toContain('class="primary" disabled=""');
    expect(html).toContain("<textarea");
  });

  it("selects into the editable answer only; sending remains a separate action", () => {
    const onAnswerChange = vi.fn();
    const onSend = vi.fn();
    const element = DeliveryQuestion({
      question,
      answer: "",
      disabled: false,
      onAnswerChange,
      onSend,
    });
    const choices = element.props.children[2];
    choices.props.children[0].props.onClick();
    expect(onAnswerChange).toHaveBeenCalledExactlyOnceWith(
      "The current panel (Recommended)",
    );
    expect(onSend).not.toHaveBeenCalled();

    const chosen = DeliveryQuestion({
      question,
      answer: "The current panel (Recommended)",
      disabled: false,
      onAnswerChange,
      onSend,
    });
    expect(
      chosen.props.children[2].props.children[0].props["aria-pressed"],
    ).toBe(true);
    const textarea = chosen.props.children[3].props.children[1];
    textarea.props.onChange({
      target: { value: "The panel, with a back button" },
    });
    expect(onAnswerChange).toHaveBeenLastCalledWith(
      "The panel, with a back button",
    );
    expect(onSend).not.toHaveBeenCalled();
    chosen.props.children[4].props.children.props.onClick();
    expect(onSend).toHaveBeenCalledOnce();
  });

  it("blocks selection and Send when the existing command is disabled", () => {
    const html = renderToStaticMarkup(
      createElement(DeliveryQuestion, {
        question,
        answer: "A new page",
        disabled: true,
        onAnswerChange: vi.fn(),
        onSend: vi.fn(),
      }),
    );
    expect(html.match(/disabled=""/gu)).toHaveLength(4);
    expect(html).toContain('aria-pressed="true"');
  });
});
