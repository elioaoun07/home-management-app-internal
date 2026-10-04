import { describe, expect, it } from "vitest";
import { type ActivityEvent, activitySourceHref } from "./types";

const ID = "00000000-0000-4000-8000-000000000001";
const event = (over: Partial<ActivityEvent>): ActivityEvent => ({
  id: "1",
  occurred_at: "2026-10-04T10:00:00Z",
  module: "era",
  feature: "messages",
  action: "sent",
  source_table: "era_messages",
  source_id: ID,
  title: "Added · Laura",
  actor_id: null,
  owner_id: ID,
  actor_name: "You",
  changed_fields: [],
  parent_id: null,
  available: true,
  ...over,
});

describe("activitySourceHref", () => {
  it("an ERA row opens what the turn wrote", () => {
    expect(activitySourceHref(event({ href: `/catalogue?item=${ID}` }))).toBe(`/catalogue?item=${ID}`);
    expect(activitySourceHref(event({}))).toBe("/era");
  });

  it("items open in the planner; catalogue items open their detail", () => {
    expect(activitySourceHref(event({ module: "schedule", source_table: "items" }))).toBe(`/reminders?openId=${ID}`);
    expect(
      activitySourceHref(event({ module: "schedule", source_table: "item_subtasks", parent_id: ID })),
    ).toBe(`/reminders?openId=${ID}`);
    expect(activitySourceHref(event({ module: "catalogue", source_table: "catalogue_items" }))).toBe(
      `/catalogue?item=${ID}`,
    );
  });
});
