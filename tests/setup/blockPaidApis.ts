// No test may spend paid API quota (owner rule, 2026-10-12; Hard Rule #29).
// Every Vitest process refuses requests to paid model/speech hosts, whatever
// SDK or script makes them. Live passes are owner-run, outside the suite.
const PAID_HOSTS = [
  /(^|\.)anthropic\.com$/,
  /(^|\.)generativelanguage\.googleapis\.com$/,
  /(^|\.)aiplatform\.googleapis\.com$/,
  /(^|\.)cognitive\.microsoft\.com$/,
  /(^|\.)speech\.microsoft\.com$/,
  /(^|\.)openai\.azure\.com$/,
];

function hostOf(input: RequestInfo | URL): string | null {
  try {
    const url = input instanceof Request ? input.url : String(input);
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

const realFetch = globalThis.fetch;
globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const host = hostOf(input);
  if (host && PAID_HOSTS.some((h) => h.test(host)))
    return Promise.reject(new Error(`Paid API call blocked in tests: ${host}`));
  return realFetch(input, init);
};
