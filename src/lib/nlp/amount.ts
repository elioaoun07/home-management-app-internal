// src/lib/nlp/amount.ts
// HUB-75 — the ONE amount extractor shared by ERA's budget router and Hub
// chat's messageTransactionParser. Before this, each kept its own regex copy
// and they disagreed on the household's own notation: ERA missed `12$`
// (a trailing `\b` needs a word character after `$`) and neither read `500k`.
//
// Returns the amount in the currency's NATIVE units: `500k lbp` → 500000 LBP.
// Accounts keep native-currency balances (see src/lib/currency.ts); the
// "LBP in thousands" rule applies only to the preference exchange rate and the
// LBP-change field, never to an amount parsed from a sentence.

export type AmountCurrency = "USD" | "EUR" | "GBP" | "LBP";

export interface ExtractedAmount {
  /** Native-unit value, always > 0. */
  value: number;
  /** Currency named by an explicit marker; null when the sentence has none. */
  currency: AmountCurrency | null;
  /** True when a currency marker (symbol or word) was present. */
  marked: boolean;
  /** True when the `k` thousands shorthand was used (`500k`). */
  kShorthand: boolean;
}

/**
 * Digit-group token: plain "25"/"25.50", European "12,50", or thousands-grouped
 * "2,000" / "1,234,567.50"; optionally followed by a `k` thousands suffix that
 * is not the start of a unit word ("5km", "2kg" stay unread).
 */
const NUM = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:[.,]\d{1,2})?`;
const K = String.raw`k(?![a-z])`;
const TOKEN = `(${NUM})(${K})?`;

const SYMBOL_CURRENCY: Record<string, AmountCurrency> = {
  $: "USD",
  "€": "EUR",
  "£": "GBP",
};

function wordCurrency(word: string): AmountCurrency {
  const w = word.toLowerCase().replace(/\./g, "");
  if (w in SYMBOL_CURRENCY) return SYMBOL_CURRENCY[w];
  if (w === "lbp" || w === "ll" || w.startsWith("lira")) return "LBP";
  if (w.startsWith("eur")) return "EUR";
  return "USD"; // usd, dollar(s), buck(s)
}

/** Tier 1 — an explicit currency marker before or after the digits. */
const PREFIX_RE = new RegExp(String.raw`([$€£]|\b(?:usd|lbp)\b)\s?` + TOKEN, "i");
const SUFFIX_RE = new RegExp(
  TOKEN +
    String.raw`\s?(\$|€|£|usd|lbp|l\.l\.?|ll|liras?|dollars?|bucks?|euros?|eur)(?![a-z])`,
  "i",
);

/**
 * Tier 2 — no marker, so sentence POSITION must imply money.
 * "paid/spent/logged/…" are strong money verbs: the amount counts whether it's
 * the last token or immediately before for/on/at. "bought/buy" are weaker —
 * equally at home in front of a plain COUNT ("bought 2 shirts") — so for those
 * the amount must be the SENTENCE-FINAL token.
 */
const STRONG_POSITIONAL_RE = new RegExp(
  String.raw`\b(?:paid|pay|spent|spend|cost|costs|logged|log|recorded|record|charged)\b(?:\s+\w+){0,2}?\s+` +
    TOKEN +
    String.raw`\s*(?:[.?!]|$|\b(?:for|on|at)\b)`,
  "i",
);
const WEAK_POSITIONAL_RE = new RegExp(
  String.raw`\b(?:bought|buy)\b(?:\s+\w+){0,2}?\s+` + TOKEN + String.raw`\s*[.?!]*$`,
  "i",
);

/** Tier 3 (opt-in) — any number. Hub budget threads accept "20 fuel today". */
const BARE_RE = new RegExp(String.raw`(?<![\w.,])` + TOKEN + String.raw`(?![\w])`, "i");

/** Parse one digit token (+ optional `k`) to a number; undefined if not > 0. */
export function parseAmountToken(raw: string, k?: string): number | undefined {
  const trimmed = raw.trim();
  let n: number;
  if (/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(trimmed)) {
    n = Number(trimmed.replace(/,/g, ""));
  } else {
    n = Number(trimmed.replace(",", "."));
  }
  if (!Number.isFinite(n)) return undefined;
  if (k) n = Math.round(n * 1000 * 100) / 100;
  return n > 0 ? n : undefined;
}

export interface ExtractAmountOptions {
  /** Fall back to the first bare number when no marker/position implies money. */
  allowBare?: boolean;
}

export function extractAmount(
  text: string,
  opts: ExtractAmountOptions = {},
): ExtractedAmount | undefined {
  // Earliest marked amount wins: in "spent 12$ 5 times" the suffix `12$`
  // (index 6) must beat the prefix reading `$ 5` (index 8).
  const prefix = text.match(PREFIX_RE);
  const suffix = text.match(SUFFIX_RE);
  const marked: ExtractedAmount[] = [];
  const at: number[] = [];
  if (prefix) {
    const value = parseAmountToken(prefix[2], prefix[3]);
    if (value !== undefined) {
      marked.push({ value, currency: wordCurrency(prefix[1]), marked: true, kShorthand: Boolean(prefix[3]) });
      at.push(prefix.index ?? 0);
    }
  }
  if (suffix) {
    const value = parseAmountToken(suffix[1], suffix[2]);
    if (value !== undefined) {
      marked.push({ value, currency: wordCurrency(suffix[3]), marked: true, kShorthand: Boolean(suffix[2]) });
      at.push(suffix.index ?? 0);
    }
  }
  if (marked.length === 1) return marked[0];
  if (marked.length === 2) return at[0] <= at[1] ? marked[0] : marked[1];

  const positional = [STRONG_POSITIONAL_RE, WEAK_POSITIONAL_RE];
  if (opts.allowBare) positional.push(BARE_RE);
  for (const re of positional) {
    const m = text.match(re);
    if (!m) continue;
    const value = parseAmountToken(m[1], m[2]);
    if (value !== undefined) {
      return { value, currency: null, marked: false, kShorthand: Boolean(m[2]) };
    }
  }
  return undefined;
}
