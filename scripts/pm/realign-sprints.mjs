import { randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readPlanning, writePlanningCommand } from "./planning.mjs";
import { realignmentPreview } from "./shared/sprint-realignment.mjs";

export function realignSprints({ root, toDate, apply = false }) {
  const pmDir = join(root, "ERA Notes", "10 - Project Management");
  const planning = readPlanning(pmDir);
  const first = [...planning.sprints]
    .filter((sprint) => sprint.state !== "closed")
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: first?.timezone || "Asia/Beirut",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const preview = realignmentPreview(
    planning,
    toDate || (first && first.startDate > today ? first.startDate : today),
  );
  if (apply && preview.days)
    writePlanningCommand({
      root,
      pmDir,
      data: { files: [] },
      command: {
        action: "realign",
        toDate: preview.toDate,
        expectedRevision: planning.revision,
        command_id: randomUUID(),
      },
    });
  return { ...preview, applied: apply && preview.days !== 0 };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const args = process.argv.slice(2);
    if (
      args.some(
        (arg, i) =>
          arg !== "--apply" && arg !== "--to" && args[i - 1] !== "--to",
      ) ||
      (args.includes("--to") && !args[args.indexOf("--to") + 1])
    )
      throw new Error("Usage: pnpm pm:realign [--to YYYY-MM-DD] [--apply]");
    const result = realignSprints({
      root: resolve(dirname(fileURLToPath(import.meta.url)), "../.."),
      toDate: args.includes("--to")
        ? args[args.indexOf("--to") + 1]
        : undefined,
      apply: args.includes("--apply"),
    });
    process.stdout.write(
      `${result.applied ? "Applied" : "Preview"}: ${result.days > 0 ? "+" : ""}${result.days} days\n`,
    );
    for (const sprint of result.sprints)
      process.stdout.write(
        `${sprint.name}: ${sprint.before} → ${sprint.startDate} (ends before ${sprint.endExclusive})\n`,
      );
    if (!result.applied) process.stdout.write("Use --apply to save.\n");
  } catch (error) {
    process.stderr.write(error.message + "\n");
    process.exitCode = 1;
  }
}
