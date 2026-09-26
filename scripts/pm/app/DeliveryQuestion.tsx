import type { V2Question } from "./types";
import { questionPresentation } from "./deliveryQuestionModel";
import "./delivery-question.css";

export function DeliveryQuestion({
  question,
  answer,
  disabled,
  onAnswerChange,
  onSend,
}: {
  question: V2Question;
  answer: string;
  disabled: boolean;
  onAnswerChange: (answer: string) => void;
  onSend: () => void;
}) {
  const { prompt, choices } = questionPresentation(question.text);
  const promptId = "question-" + question.question_id;
  return (
    <section className="gate-panel delivery-question">
      <span className="eyebrow">Question · r{question.plan_revision}</span>
      <h2 id={promptId}>{prompt}</h2>
      {!!choices.length && (
        <div
          className="question-choices"
          role="group"
          aria-labelledby={promptId}
        >
          {choices.map((choice) => (
            <button
              key={choice.answer}
              type="button"
              className="question-choice"
              aria-pressed={answer === choice.answer}
              disabled={disabled}
              onClick={() => onAnswerChange(choice.answer)}
            >
              <span>{choice.label}</span>
              {choice.recommended && <small>Recommended</small>}
            </button>
          ))}
        </div>
      )}
      <label>
        Answer
        <textarea
          rows={3}
          value={answer}
          onChange={(event) => onAnswerChange(event.target.value)}
        />
      </label>
      <div className="gate-actions">
        <button
          type="button"
          className="primary"
          disabled={disabled || !answer.trim()}
          onClick={onSend}
        >
          Send
        </button>
      </div>
    </section>
  );
}
