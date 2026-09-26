export interface QuestionChoice {
  label: string;
  answer: string;
  recommended: boolean;
}

/**
 * Questions currently retain only text. Present explicit options already in that
 * text; never derive answers or a recommendation from a question's meaning.
 * Ambiguous lists stay intact as free text.
 */
export function questionPresentation(text: string): {
  prompt: string;
  choices: QuestionChoice[];
} {
  const fallback = { prompt: text, choices: [] };
  const lines = text.trim().split(/\r?\n/u);
  const heading = lines.findIndex((line) =>
    /^\s*(?:\*\*)?(?:options|choices)(?:\*\*)?:\s*$/iu.test(line),
  );
  const start =
    heading >= 0
      ? heading + 1
      : lines.findIndex((line) =>
          /^\s*(?:\*\*)?[A-Z][).](?:\*\*)?\s+\S/u.test(line),
        );
  if (start < 1) return fallback;

  const optionLines = lines.slice(start).filter((line) => line.trim());
  if (optionLines.length < 2 || optionLines.length > 6) return fallback;
  const choices: QuestionChoice[] = [];
  const markers: string[] = [];
  for (const line of optionLines) {
    const match = line.match(
      /^\s*(?:\*\*)?([A-Z][).]|\d+[).]|[-*•])(?:\*\*)?\s+(\S.*)$/u,
    );
    if (!match || (heading < 0 && !/^[A-Z]/u.test(match[1]))) return fallback;
    markers.push(match[1]);
    const answer = match[2].trim();
    const readable = answer.replace(/\*\*|__/gu, "");
    const recommended = /(?:\(recommended\)|\[recommended\])/iu.test(readable);
    const label = readable
      .replace(/\s*(?:\(recommended\)|\[recommended\])/giu, "")
      .trim();
    if (!label) return fallback;
    choices.push({ label, answer, recommended });
  }
  // Do not reinterpret multiple numbered questions or mixed list formats.
  const alphabetical = markers.every(
    (marker, index) =>
      marker === String.fromCharCode(65 + index) + markers[0].slice(-1),
  );
  const numeric = markers.every(
    (marker, index) => marker === String(index + 1) + markers[0].slice(-1),
  );
  const bullets = markers.every(
    (marker) => marker === markers[0] && /^[-*•]$/u.test(marker),
  );
  if (!alphabetical && !numeric && !bullets) return fallback;

  const prompt = lines
    .slice(0, heading >= 0 ? heading : start)
    .join("\n")
    .trim();
  if (
    !prompt ||
    new Set(choices.map((choice) => choice.answer)).size !== choices.length
  )
    return fallback;
  return {
    prompt,
    choices: choices.sort(
      (a, b) => Number(b.recommended) - Number(a.recommended),
    ),
  };
}
