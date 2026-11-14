// Shared by the local route and browser; historical tests remain readable at
// their own URL but never become the current per-item testing entry again.
/**
 * @template {{status:string, created_at:string, stale?:boolean, supersededBy?:string|null, acceptance?:{state:string}, source?:{kind:string, ref:string}|null}} T
 * @param {T[]} handovers
 * @param {string|null|undefined} revision Current authored instructions, when available.
 * @returns {T[]}
 */
export function activeItemHandovers(handovers, revision) {
  return handovers
    .filter(
      (row) =>
        !row.stale &&
        !row.supersededBy &&
        !["superseded", "no-candidate"].includes(row.acceptance?.state || "") &&
        (!revision ||
          row.source?.kind !== "item-uat" ||
          row.source.ref.endsWith(`:${revision}`)),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
