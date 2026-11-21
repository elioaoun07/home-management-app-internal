import type { LocalScene } from "../localRunScene";
const memo = new WeakMap<LocalScene, Map<string, number>>();
/** Five lamps represent a machine's observed share of the last two minutes. */
export function dutyLeds(snapshot: LocalScene, station: string) {
  let shares = memo.get(snapshot);
  if (!shares) {
    const rows = snapshot.events.filter(
      (event) =>
        snapshot.at - Date.parse(event.at) >= 0 &&
        snapshot.at - Date.parse(event.at) <= 120000,
    );
    shares = new Map();
    rows.forEach((row) =>
      shares!.set(row.station, (shares!.get(row.station) ?? 0) + 1),
    );
    shares.forEach((count, key) =>
      shares!.set(
        key,
        Math.max(0, Math.min(5, Math.round((count / rows.length) * 5))),
      ),
    );
    memo.set(snapshot, shares);
  }
  return shares.get(station) ?? 0;
}
