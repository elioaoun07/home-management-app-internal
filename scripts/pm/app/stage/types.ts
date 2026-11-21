import type { LocalScene } from "../localRunScene";
import type { BeatFrame, CeremonyKind, StageTempo } from "./director";
import type { ZoneId } from "./config";
import type { StagePalette } from "./palette";
import type { MachineEvidence } from "./machineEvidence";
export type { StagePalette, StageTempo };
export interface Vec2 {
  x: number;
  y: number;
}
export interface Vec3 extends Vec2 {
  z: number;
}
export type ZoneStatus =
  | "off"
  | "active"
  | "done"
  | "skipped"
  | "needs-you"
  | "fault";
export interface BoardZoneFact {
  id: ZoneId;
  status: ZoneStatus;
  count?: number;
  done?: boolean;
}
export interface BoardAttentionFact {
  id: string;
  zone: ZoneId;
  level: "act" | "look";
  state: "open" | "done";
  kind: string;
}
export interface BoardFacts {
  snapshot: LocalScene;
  state: string;
  zones: readonly BoardZoneFact[];
  attention?: readonly BoardAttentionFact[];
  activeZone?: ZoneId | null;
  buildZone?: ZoneId;
  buildGate?: number;
  retry?: boolean;
  atMain?: boolean;
}
export interface BoardMotionFrame {
  beat: BeatFrame | null;
  beats?: readonly BeatFrame[];
  vitality: number;
  heat: number;
  elapsed: number;
  wallTime?: number;
  tempo: StageTempo;
  reducedMotion?: boolean;
  ceremony?: {
    kind: CeremonyKind;
    progress: number;
    check?: string | null;
    exit?: number | null;
  };
  combo?: number;
  streak?: number | null;
  cleanIncrement?: 1;
}
export interface Material {
  top: string;
  left: string;
  right: string;
}
export interface Sprite {
  image: HTMLCanvasElement;
  x: number;
  y: number;
  width: number;
  height: number;
  stateBaked?: boolean;
}
export interface ZoneArtContext {
  palette: StagePalette;
  zone: ZoneId;
}
export interface ZoneRenderState extends ZoneArtContext {
  facts: BoardFacts;
  frame: BoardMotionFrame;
  part?: Sprite;
  glow?: HTMLCanvasElement;
  evidence?: MachineEvidence;
}
export interface ZoneArt {
  stateOnPart?: boolean;
  bake(ctx: CanvasRenderingContext2D, art: ZoneArtContext): void;
  state(ctx: CanvasRenderingContext2D, art: ZoneRenderState): void;
  motion(ctx: CanvasRenderingContext2D, art: ZoneRenderState): void;
  bakePart?(ctx: CanvasRenderingContext2D, art: ZoneArtContext): void;
}
export interface BoardPlacement {
  id: ZoneId;
  x: number;
  y: number;
  width: number;
  height: number;
  chipX: number;
  chipY: number;
}
export interface PrimitiveOptions {
  top?: string;
  left?: string;
  right?: string;
  alpha?: number;
}
