import type { ZoneId } from "../stage/config";
import type { Area, Finish, View } from "./layout";
import type { Topic } from "./topics";

export type Target = ZoneId | "seat" | "core" | "previous" | "present" | "next" | "exit";
export type Pose = { x: number; z: number; yaw: number; pitch: number };
export type Presence = {
  target: Target | null;
  area: Area;
  zone: ZoneId | null;
};
export interface Signal {
  id: string;
  zone: ZoneId;
  kind: "read" | "edit" | "command" | "check" | "start-check" | "handover" | "ship" | "revert" | "question" | "setup" | "failure";
  result?: "passed" | "failed" | "inconclusive";
}
export interface WorldState {
  view: View;
  finish: Finish;
  topic: Topic;
  phase: string;
  paused: boolean;
  quiet: boolean;
  signal: Signal | null;
  stamps: Readonly<Partial<Record<ZoneId, string>>>;
  core: readonly [boolean, boolean, boolean];
}
export interface WorldApi {
  update(state: WorldState): void;
  go(zone: ZoneId): void;
  reset(): void;
  enter(): void;
  exit(): void;
  play(signal: Signal): void;
  dispose(): void;
}
export interface WorldControls {
  presence(value: Presence): void;
  inspect(target: Target): void;
  ask(): void;
  failure(): void;
}
