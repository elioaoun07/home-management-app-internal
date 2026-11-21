import { describe, expect, it } from "vitest";
import { futureRunAttention } from "../../scripts/pm/app/localRunAttention";
import { epoch, futurePlan, futureQuestion } from "./local-board-fixtures";

describe("Explicit future lane attention fixtures", () => {
  it("raises only the latest proposed plan and uses its recorded time", () => {
    expect(
      futureRunAttention({
        runId: "future-run",
        zone: "build",
        plans: [futurePlan()],
        questions: [],
      })[0],
    ).toMatchObject({
      kind: "plan",
      title: "Plan",
      level: "act",
      zone: "think",
      since: epoch + 1000,
      action: { run: "plan" },
    });
    expect(
      futureRunAttention({
        runId: "future-run",
        zone: "build",
        plans: [futurePlan(), futurePlan("approved")],
        questions: [],
      }),
    ).toEqual([]);
  });
  it("keeps actual choices, unknown question time, and blocking questions first", () => {
    const items = futureRunAttention({
      runId: "future-run",
      zone: "bench",
      plans: [futurePlan()],
      questions: [
        futureQuestion("optional"),
        futureQuestion("blocking", true),
        futureQuestion("answered", true, "answered"),
      ],
    });
    expect(
      items.map((item) =>
        item.kind === "question" ? item.id.split(":").at(-1) : item.kind,
      ),
    ).toEqual(["blocking", "plan", "optional"]);
    expect(items[0]).toMatchObject({
      title: "Question",
      zone: "bench",
      blocking: true,
      since: null,
      detail: "Choose deployment?",
      action: { run: "answer" },
      choices: [
        { label: "Local", answer: "Local (Recommended)", recommended: true },
        { label: "Hosted", answer: "Hosted", recommended: false },
      ],
    });
  });
});
