import { prepareItemCreate } from "@/lib/items/createContract";
import { localToISO } from "@/lib/utils/date";
import { describeWhen } from "@/lib/era/phrasing";
import { captureSchema, type ScheduleCapture } from "../../capture";
import { routeWrite } from "./routeWrite";

/** Structured native input still uses the source create contract + ERA receipt. */
export async function resolveScheduleCapture(input: ScheduleCapture) {
  const c = captureSchema.parse(input);
  if (c.kind !== "reminder" && c.kind !== "event")
    throw new Error("Invalid schedule capture");
  const start = localToISO(c.date, c.time);
  const end = c.kind === "event" ? localToISO(c.endDate, c.endTime) : undefined;
  if (end && end <= start) return { text: "End must follow start.", ok: false };
  const body = prepareItemCreate({
    type: c.kind,
    title: c.title,
    priority: c.priority,
    ...(c.location
      ? { location_text: c.location, location_context: "outside" }
      : {}),
    ...(c.kind === "event"
      ? { start_at: start, end_at: end }
      : { due_at: start }),
    suppress_default_alert: c.alert === "none",
    alerts:
      c.alert === "none"
        ? []
        : [
            {
              kind: "absolute",
              channel: "push",
              trigger_at: new Date(
                new Date(start).getTime() - Number(c.alert) * 60_000,
              ).toISOString(),
            },
          ],
  });
  const result = await routeWrite({
    call: { url: "/api/items", method: "POST", body },
    pickId: (json) => (json as { item?: { id?: string } })?.item?.id,
    artifact: {
      entity: c.kind,
      action: "created",
      title: c.title,
      ref: { date: c.date },
    },
    inverse: (id) => ({ url: `/api/items/${id}`, method: "DELETE" }),
    reply: `Added · ${c.title} · ${describeWhen(start)}`,
    idKey: c.kind === "event" ? "eventId" : "itemId",
    extraMetadata: { title: c.title, dueAt: start },
  });
  return result.metadata?.completion === "unknown"
    ? { ...result, metadata: { ...result.metadata, uncertain: true } }
    : result;
}
