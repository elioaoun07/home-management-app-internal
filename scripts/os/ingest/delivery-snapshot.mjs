// Transfer cheap facts from the supervisor's already-open read-only view to the
// cockpit worker. Never open, checkpoint or copy a live SQLite/WAL database.
/** @typedef {ReturnType<typeof import("../../delivery-v2/store.mjs").openStore>} Store */
/** @typedef {{
 * runs: ReturnType<Store["listRuns"]>,
 * work: [string, ReturnType<Store["getWorkRef"]>][],
 * jobs: [string, ReturnType<Store["listJobs"]>][],
 * usage: [string, ReturnType<Store["listUsageReadings"]>][],
 * candidates: [string, ReturnType<Store["listCandidates"]>][],
 * results: [string, ReturnType<Store["listResults"]>][],
 * applications: [string, ReturnType<Store["listApplications"]>][],
 * activity: [string, ReturnType<Store["listActivity"]>][],
 * decisions: [string, ReturnType<Store["listDecisions"]>][],
 * evidence: [string, ReturnType<Store["listEvidence"]>][]
 * }} DeliverySnapshot */
export function captureDeliverySnapshot(store) {
  if (!store) return null;
  const runs = store.listRuns();
  /** @type {DeliverySnapshot} */
  const snapshot = {
    runs,
    work: [],
    jobs: [],
    usage: [],
    candidates: [],
    results: [],
    applications: [],
    activity: [],
    decisions: [],
    evidence: [],
  };
  for (const run of runs) {
    snapshot.work.push([run.work_id, store.getWorkRef(run.work_id)]);
    const jobs = store.listJobs(run.run_id);
    snapshot.jobs.push([run.run_id, jobs]);
    for (const job of jobs)
      snapshot.usage.push([job.job_id, store.listUsageReadings(job.job_id)]);
    const candidates = store.listCandidates(run.run_id);
    snapshot.candidates.push([run.run_id, candidates]);
    for (const candidate of candidates)
      snapshot.evidence.push([
        `${run.run_id}:${candidate.candidate_id}`,
        store.listEvidence(run.run_id, candidate.candidate_id),
      ]);
    snapshot.results.push([run.run_id, store.listResults(run.run_id)]);
    snapshot.applications.push([
      run.run_id,
      store.listApplications(run.run_id),
    ]);
    snapshot.activity.push([
      run.run_id,
      store.listActivity?.(run.run_id, -1) || [],
    ]);
    snapshot.decisions.push([run.run_id, store.listDecisions(run.run_id)]);
  }
  if (!store.readOnlySnapshotCurrent())
    throw new Error("Delivery snapshot changed during capture");
  return snapshot;
}

/** @param {DeliverySnapshot} snapshot */
export function deliverySnapshotStore(snapshot) {
  const tables = Object.fromEntries(
    Object.entries(snapshot)
      .filter(([key]) => key !== "runs")
      .map(([key, rows]) => [key, new Map(rows)]),
  );
  return {
    listRuns: () => snapshot.runs,
    getWorkRef: (id) => tables.work.get(id) ?? null,
    listJobs: (id) => tables.jobs.get(id) || [],
    listUsageReadings: (id) => tables.usage.get(id) || [],
    listCandidates: (id) => tables.candidates.get(id) || [],
    listEvidence: (run, candidate) =>
      tables.evidence.get(`${run}:${candidate}`) || [],
    listResults: (id) => tables.results.get(id) || [],
    latestResult: (id) => (tables.results.get(id) || []).at(-1) ?? null,
    listApplications: (id) => tables.applications.get(id) || [],
    listActivity: (id) => tables.activity.get(id) || [],
    listDecisions: (id) => tables.decisions.get(id) || [],
  };
}
