/** Calendar-only translation: no regrouping, membership edits or lifecycle changes.
 * @param {{sprints: Array<{id: string, name: string, startDate: string, endExclusive: string, state: string, members: Array<{deliverableId?: string}>}>, deliverables: Array<{id: string, title: string, targetDate?: string}>}} planning
 * @param {string} toDate
 */
export function realignmentPreview(planning, toDate) {
  const noon = (day) => new Date(day + "T12:00:00Z");
  if (
    !/^\d{4}-\d{2}-\d{2}$/u.test(toDate) ||
    !Number.isFinite(noon(toDate).getTime()) ||
    noon(toDate).toISOString().slice(0, 10) !== toDate
  )
    throw new Error("Choose a valid start date");
  const moving = planning.sprints
    .filter((sprint) => sprint.state !== "closed")
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (!moving.length) throw new Error("No unfinished sprints to realign");
  const fromDate = moving[0].startDate;
  const days = Math.round(
    (noon(toDate).getTime() - noon(fromDate).getTime()) / 86400000,
  );
  const shift = (day) => {
    const date = noon(day);
    date.setUTCDate(date.getUTCDate() + days);
    const result = date.toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(result))
      throw new Error("Date is outside the supported range");
    return result;
  };
  const sprints = moving.map((sprint) => ({
    id: sprint.id,
    name: sprint.name,
    before: sprint.startDate,
    startDate: shift(sprint.startDate),
    endExclusive: shift(sprint.endExclusive),
  }));
  for (const moved of sprints) {
    if (
      planning.sprints.some(
        (sprint) =>
          sprint.state === "closed" &&
          moved.startDate < sprint.endExclusive &&
          moved.endExclusive > sprint.startDate,
      )
    )
      throw new Error("New dates overlap a closed sprint");
  }
  const linked = new Set(
    moving.flatMap((sprint) =>
      sprint.members.flatMap((member) =>
        member.deliverableId ? [member.deliverableId] : [],
      ),
    ),
  );
  const historical = new Set(
    planning.sprints
      .filter((sprint) => sprint.state === "closed")
      .flatMap((sprint) =>
        sprint.members.map((member) => member.deliverableId),
      ),
  );
  const deliverables = planning.deliverables
    .filter(
      (entry) =>
        entry.targetDate && linked.has(entry.id) && !historical.has(entry.id),
    )
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      before: entry.targetDate,
      targetDate: shift(entry.targetDate),
    }));
  return { days, fromDate, toDate, sprints, deliverables };
}
