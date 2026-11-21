import type { LocalScene } from "../localRunScene";
export interface HostCheckReadout {
  start: number | null;
  finish: number | null;
  exit: number | null;
  result: boolean;
  running: boolean;
}
const instant = (value: string | undefined) => {
  const n = value ? Date.parse(value) : NaN;
  return Number.isFinite(n) ? n : null;
};
/** Only a host timestamp or its exact supervisor row proves a start. */
export function hostCheckReadout(
  scene: LocalScene,
  name: string,
): HostCheckReadout {
  const check = scene.run.checks.find((check) => check.name === name);
  const row = scene.events.find(
    (event) =>
      ["event", "check"].includes(event.kind) &&
      event.label !== "Tool requested" &&
      event.summary === `${name} started`,
  );
  const resultRow = scene.events.find(
    (event) =>
      event.kind === "check" &&
      event.detail === name &&
      new RegExp(
        `^${name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}:\\s*(-?\\d+|null)$`,
        "u",
      ).test(event.summary),
  );
  const rawStart = instant(check?.started_at) ?? instant(row?.at),
    rawFinish = instant(check?.finished_at) ?? instant(resultRow?.at);
  const start = rawStart !== null && rawStart <= scene.at ? rawStart : null,
    finish = rawFinish !== null && rawFinish <= scene.at ? rawFinish : null;
  const result = !!check || !!resultRow;
  const rowExit = resultRow?.summary.match(/:\s*(-?\d+|null)$/u)?.[1];
  const exit = check
    ? check.exit
    : rowExit && rowExit !== "null"
      ? Number(rowExit)
      : null;
  return {
    start,
    finish,
    exit,
    result,
    running: scene.phase === "checking" && start !== null && !result,
  };
}
export function checkDuration(
  readout: HostCheckReadout,
  at: number,
): number | null {
  const end = readout.finish ?? (readout.running ? at : null);
  return readout.start !== null && end !== null && end >= readout.start
    ? end - readout.start
    : null;
}
export function observedCheckTime(
  scene: LocalScene,
  state: string,
  at: number,
  replay: boolean,
): number {
  if (scene.run.interrupted || state === "signal-lost") {
    const signals = [
      ...scene.events.map((event) => Date.parse(event.at)),
      ...scene.run.checks.map((check) => instant(check.finished_at)),
    ].filter(
      (time): time is number =>
        time !== null && Number.isFinite(time) && time <= scene.at,
    );
    return signals.length ? Math.max(...signals) : scene.at;
  }
  if (replay) return at;
  return state === "link-down" ? scene.at : at;
}
