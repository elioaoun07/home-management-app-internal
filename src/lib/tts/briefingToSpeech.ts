/**
 * Converts raw briefing text into a valid SSML document for Azure Neural TTS.
 *
 * Pure function — no side effects, no LLM, no AI generation.
 * The narrative text from the briefing is mostly hardcoded patterns, so this
 * preprocessor matches those known patterns and rewrites them into natural,
 * conversational speech with proper SSML markup.
 */

const EMOJI_REGEX =
  /[\p{Emoji_Presentation}\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;

const GREETING_PATTERNS =
  /^(good morning|good afternoon|good evening|winding down|working late)/i;

/** Escape XML special characters in text content */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Collect consecutive numbered list items (  1. X\n  2. Y\n  3. Z)
 * and bullet items (  • X (time)\n  • Y (time)) into arrays so we can
 * join them into flowing sentences instead of paused individual items.
 */
function collectListRun(
  lines: string[],
  startIdx: number,
  pattern: RegExp,
): { items: string[]; endIdx: number } {
  const items: string[] = [];
  let i = startIdx;
  while (i < lines.length) {
    const m = lines[i].match(pattern);
    if (m) {
      items.push(m[1].trim());
      i++;
    } else {
      break;
    }
  }
  return { items, endIdx: i };
}

/** Join a list of items into a natural English sentence fragment.
 *  ["Nails"] → "Nails"
 *  ["Nails", "Budget"] → "Nails and Budget"
 *  ["Nails", "Budget", "Groceries"] → "Nails, Budget, and Groceries"
 */
function joinNaturally(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/** Apply SSML markup and text cleanup to a plain text fragment */
function applySSML(text: string): string {
  let result = text;

  // Strip emojis
  result = result.replace(EMOJI_REGEX, "");

  // Clean times: 7:00 PM → 7 PM, 12:00 AM → 12 AM
  result = result.replace(/(\d+):00\s*(AM|PM)/gi, "$1 $2");

  // Strip trailing period after bare numbers: "2." → "2"
  result = result.replace(/(\d+)\.\s*$/g, "$1");

  // Remove quotes around task names
  result = result.replace(/"([^"]+)"/g, "$1");

  // Escape XML special chars in content
  result = escapeXml(result.trim());

  if (!result) return "";

  // Ellipsis → gentle pause
  result = result.replace(/\.{3,}/g, '<break time="400ms"/>');
  result = result.replace(/…/g, '<break time="400ms"/>');

  // Em/en dash → pause
  result = result.replace(/\s*—\s*/g, ' <break time="250ms"/> ');
  result = result.replace(/\s*–\s*/g, ' <break time="250ms"/> ');

  // ALL-CAPS words (3+ letters) → emphasis
  result = result.replace(
    /\b([A-Z]{3,})\b/g,
    '<emphasis level="moderate">$1</emphasis>',
  );

  // Parenthetical text → slightly lower pitch
  result = result.replace(/\(([^)]+)\)/g, '<prosody pitch="-10%">$1</prosody>');

  return result;
}

/**
 * Conversational rewrites for known hardcoded narrative patterns.
 * These run on the full text BEFORE line-by-line processing,
 * turning stiff phrasing into warm, spoken English.
 */
function conversationalRewrite(text: string): string {
  let s = text;

  // --- Opening lines ---
  // "2 items remain for the rest of today." → "You've got 2 more things on your plate today."
  s = s.replace(
    /(\d+) items? remains? for the rest of today\./gi,
    "You've got $1 more things on your plate today.",
  );
  // "You have 3 items on your agenda today." → "You've got 3 things lined up today."
  s = s.replace(
    /You have (\d+) items? on your agenda today\./gi,
    "You've got $1 things lined up today.",
  );
  // "You've made it through today's schedule. Well done."
  s = s.replace(
    /You've made it through today's schedule\. Well done\./gi,
    "You've made it through everything today, well done.",
  );

  // --- Currently ---
  // 'Currently: "Nails" at 12:00 AM.' → "Right now you're on Nails."
  s = s.replace(
    /Currently:\s*"?([^".\n]+)"?\s*at\s*(\d+(?::\d+)?\s*(?:AM|PM))\./gi,
    "Right now you're on $1.",
  );

  // --- Next up ---
  // 'Next up at 5:00 PM: "Budget".' → "Next up at 5 PM is Budget."
  s = s.replace(
    /Next up at\s*(\d+(?::\d+)?\s*(?:AM|PM)):\s*"?([^".\n]+)"?\./gi,
    "Next up at $1 is $2.",
  );
  // 'In 30 minutes: "Budget".' → "And in about 30 minutes you've got Budget."
  s = s.replace(
    /In (\d+) minutes:\s*"?([^".\n]+)"?\./gi,
    "And in about $1 minutes you've got $2.",
  );

  // --- Key priorities header → replaced later with list join ---
  // (handled in the list collapsing logic below)

  // --- Time-sensitive warning ---
  s = s.replace(
    /💡\s*Heads up:\s*You have (\d+) items coming up in the next 2 hours\./gi,
    "Just a heads up, you have $1 things coming up in the next couple of hours.",
  );

  // --- Don't forget to prepare header ---
  s = s.replace(
    /📦\s*Don't forget to prepare:/gi,
    "Oh, and don't forget to prepare:",
  );

  // --- Schedule-clear messages ---
  s = s.replace(
    /Your schedule is clear\.\s*A perfect opportunity to focus on what matters most to you\./gi,
    "Your schedule is clear. A perfect chance to focus on what matters most.",
  );
  s = s.replace(
    /No scheduled commitments ahead\.\s*You have complete freedom to shape this time\./gi,
    "Nothing on your schedule. You've got complete freedom to use this time however you'd like.",
  );

  return s;
}

/**
 * Convert raw briefing text to a complete SSML document for Azure Neural TTS.
 *
 * @param rawText - The briefing narrative as displayed on screen
 * @returns Complete SSML document string
 */
export function briefingToSpeech(rawText: string): string {
  // Step 1: Conversational rewrites on the full text
  let text = conversationalRewrite(rawText);

  // Step 2: Split into lines and process, collapsing lists into sentences
  const lines = text.split("\n");
  const fragments: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip blank lines (they'll become natural pauses below)
    if (!trimmed) {
      i++;
      continue;
    }

    // --- Numbered list run: "  1. X\n  2. Y\n  3. Z" → flowing sentence ---
    const numberedMatch = line.match(/^\s*\d+\.\s+(.+)/);
    if (numberedMatch) {
      const { items, endIdx } = collectListRun(lines, i, /^\s*\d+\.\s+(.+)/);
      // Check if previous fragment was "Key priorities for today:" or similar header
      const lastFrag = fragments[fragments.length - 1] || "";
      const isAfterPrioritiesHeader = /priorities|main things/i.test(lastFrag);

      const cleaned = items.map((item) => applySSML(item));
      const sentence = joinNaturally(cleaned);

      if (isAfterPrioritiesHeader) {
        // Replace the header + list with one flowing sentence
        fragments[fragments.length - 1] = applySSML(
          `Your top priorities are ${sentence}.`,
        );
      } else {
        fragments.push(`${sentence}.`);
      }
      i = endIdx;
      continue;
    }

    // --- Bullet list run: "  • X (time)\n  • Y (time)" → flowing sentence ---
    const bulletMatch = line.match(/^\s*[•●▸▹►\-]\s+(.+)/);
    if (bulletMatch) {
      const { items, endIdx } = collectListRun(
        lines,
        i,
        /^\s*[•●▸▹►\-]\s+(.+)/,
      );
      const cleaned = items.map((item) => applySSML(item));
      const sentence = joinNaturally(cleaned);
      fragments.push(`${sentence}.`);
      i = endIdx;
      continue;
    }

    // --- "Key priorities for today:" header → rewrite to natural lead-in ---
    if (/^Key priorities for today:/i.test(trimmed)) {
      // Push a placeholder that the numbered-list handler will merge with
      fragments.push(`<break time="300ms"/>Your top priorities are: `);
      i++;
      continue;
    }

    // --- Regular line ---
    // Add a small pause between sections (after blank lines)
    if (i > 0 && lines[i - 1]?.trim() === "" && fragments.length > 0) {
      fragments.push('<break time="350ms"/>');
    }

    const processed = applySSML(trimmed);
    if (processed) {
      // First line / greeting gets a slight warmth bump (pitch only, no rate change)
      const isGreeting =
        fragments.length === 0 || GREETING_PATTERNS.test(trimmed);
      if (isGreeting) {
        fragments.push(`<prosody pitch="+5%">${processed}</prosody>`);
      } else {
        fragments.push(processed);
      }
    }

    i++;
  }

  const body = fragments.join("\n    ");

  // Clean up multiple consecutive breaks
  const cleaned = body.replace(
    /(<break[^/]*\/>\s*){3,}/g,
    '<break time="400ms"/>',
  );

  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis"
       xmlns:mstts="http://www.w3.org/2001/mstts"
       xml:lang="en-US">
  <voice name="en-US-AvaMultilingualNeural">
    ${cleaned}
  </voice>
</speak>`;
}
