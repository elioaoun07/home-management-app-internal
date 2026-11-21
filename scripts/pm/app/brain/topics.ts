import type { ERAModuleKey } from "@/components/shared/ERAMark";

const inherited = {
  financial: ["Budget", 175], recipe: ["Recipes", 28], schedule: ["Schedule", 256],
  memory: ["Brain", 220], chat: ["Hub & ERA", 190], trip: ["Trips", 155],
  health: ["Healthcare", 352], home: ["Home", 205], fitness: ["Fitness", 40],
  outfit: ["Outfits", 325], meal: ["Meal planning", 42],
} as const satisfies Record<ERAModuleKey, readonly [string, number]>;

export const topics = {
  ...inherited,
  notifications: ["Notifications & Alerts", 52], native: ["Native App", 204],
  delivery: ["Delivery", 164], tooling: ["PM Tooling", 267], general: ["General", 215],
} as const;
export type Topic = keyof typeof topics;

export const campaigns = {
  Budget: ["BUD", "financial"], Schedule: ["SCH", "schedule"], Kitchen: ["KIT", "recipe"],
  Trips: ["TRIP", "trip"], "Hub & ERA": ["HUB", "chat"], "Notifications & Alerts": ["NOTIF", "notifications"],
  "PM Tooling": ["R", "tooling"], Delivery: ["DLV", "delivery"], Outfits: ["OUT", "outfit"],
  Healthcare: ["HLTH", "health"], "Native App": ["NAT", "native"],
} as const satisfies Record<string, readonly [string, Topic]>;

export function deliveryTopic(work: { id: string; campaign?: string; topic?: string }): Topic {
  if (work.topic) return Object.hasOwn(topics, work.topic) ? work.topic as Topic : "general";
  const id = /^([A-Z]+)(-?)\d+[A-Z]?(?:\.\d+[A-Z]?)*$/u.exec(work.id.trim().toUpperCase());
  const byId = id && (id[1] === "R" ? !id[2] : !!id[2])
    ? Object.values(campaigns).find(([prefix]) => prefix === id[1]) : undefined;
  if (!work.campaign) return byId?.[1] ?? "general";
  if (!Object.hasOwn(campaigns, work.campaign)) return "general";
  const [prefix, topic] = campaigns[work.campaign as keyof typeof campaigns];
  return byId && byId[0] !== prefix ? "general" : topic;
}
