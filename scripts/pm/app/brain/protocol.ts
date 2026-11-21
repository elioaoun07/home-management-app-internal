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
  kind: "read" | "edit" | "command" | "message" | "seal" | "check" | "start-check" | "handover" | "ship" | "revert" | "question" | "setup" | "failure";
  result?: "passed" | "failed" | "inconclusive";
}
export type CheckStamp = NonNullable<Signal["result"]>;
export interface RoomLighting {
  failed: boolean;
  faultZone: ZoneId | null;
  endpoint: ZoneId | "seat" | null;
  marks: Readonly<Partial<Record<ZoneId, "reached" | "skipped" | "fault">>>;
  checks: readonly (CheckStamp | null)[];
  energy: number;
  working: boolean;
  owner: boolean;
  ship: "pending" | "shipped" | "reverted" | null;
}
export interface WorldState {
  view: View;
  nativeMotion: boolean;
  finish: Finish;
  topic: Topic;
  paused: boolean;
  quiet: boolean;
  replay: boolean;
  playing: boolean;
  cursor: string | null;
  signal: Signal | null;
  lighting: RoomLighting;
  core: readonly [boolean, boolean, boolean];
}
export interface WorldApi {
  captureMouse(): void;
  update(state: WorldState): void;
  go(zone: ZoneId): void;
  inspectBreak(): void;
  reset(): void;
  enter(): void;
  exit(): void;
  play(signal: Signal): void;
  dispose(): void;
}
export interface WorldControls {
  softwareRenderer(value: boolean): void;
  presence(value: Presence): void;
  inspect(target: Target): void;
  ask(): void;
  failure(): void;
}
