import { ART, BUDGET, ZONE_BY_ID } from "./config";
import { beatZone, zoneMachine, ZONE_ART } from "./board";
import { BOARD, ZONES, type ZoneGroup } from "./config";
import type { MachineEvidence } from "./machineEvidence";
import { drawEra, OPERATOR_BOUNDS, type EraSprites, type EraPose } from "./actors/era";
import { drawBuild } from "./actors/build";
import { capsulePoint } from "./capsulePose";
import { createMotionState } from "./motion";
import { createBoardFx } from "./fx";
import { project } from "./iso";
import { buildKey } from "./zones/build";
import { leafOffset } from "./zones/explore";
import { zoneForEvent } from "./zoneModel";
import type {
  BoardFacts,
  BoardMotionFrame,
  Sprite,
  StagePalette,
  Vec2,
} from "./types";
import type { ZoneId } from "./config";
interface Assets {
  facts: BoardFacts;
  palette: StagePalette;
  glow: HTMLCanvasElement;
  ownerGlow: HTMLCanvasElement;
  smoke: HTMLCanvasElement;
  era: EraSprites;
  foreground: HTMLCanvasElement;
  parts: Partial<Record<ZoneId, Sprite>>;
  offParts?: Partial<Record<ZoneId, Sprite>>;
  dimPalette?: StagePalette;
  glows?: Partial<Record<ZoneGroup, HTMLCanvasElement>>;
  evidence?: MachineEvidence;
  build: Sprite | null;
}
export const padPoolAlpha = (seconds: number, still = false) => still ? 0.65 : 0.65 + 0.15 * Math.sin(seconds * Math.PI);

function toolContact(frame: BoardMotionFrame, event: NonNullable<BoardFacts["snapshot"]["latest"]>, still: boolean): Vec2 {
  const progress = frame.beat?.progress ?? 0;
  if (event.kind === "edit") {
    const press = zoneMachine("build");
    return { x: press.x + buildKey.x, y: press.y + buildKey.y };
  }
  const shelf = zoneMachine("explore");
  const edge = project(0, 32, 38);
  const offset = still ? { x: 0, y: 0 } : leafOffset(event.paths[0] ?? event.id, progress);
  return { x: shelf.x + edge.x + offset.x, y: shelf.y + edge.y + offset.y };
}

export function operatorPose(
  facts: BoardFacts,
  frame: BoardMotionFrame,
  movement: Pick<ReturnType<typeof createMotionState>, "workerHeading" | "workerTravelling">,
  worker: Vec2,
  state: string,
): EraPose {
  const pose: EraPose = {
    gesture: "idle",
    facing: movement.workerHeading,
    extension: 0,
    static: frame.reducedMotion || frame.settled || state === "linkdown" || state === "signallost",
    ghost: state === "signallost",
  };
  if (["quiet", "stale", "cancelled", "failed", "shipped", "reverted"].includes(state))
    return { ...pose, gesture: "park", static: true };
  if (pose.ghost || state === "linkdown") return pose;
  if (movement.workerTravelling && !pose.static)
    return { ...pose, gesture: "travel" };
  const station = zoneMachine(zoneForEvent(facts.snapshot.latest ?? null) ?? beatZone(frame, facts));
  pose.facing = station.x >= worker.x ? 1 : -1;
  const owner = facts.attention?.find(item => item.level === "act" && item.state === "open");
  if (owner || state === "yourturn") {
    const machine = zoneMachine(owner?.zone ?? facts.activeZone ?? "test");
    return { ...pose, gesture: "wait", facing: machine.x >= worker.x ? 1 : -1, extension: 0.68, static: true };
  }
  const event = pose.static ? (facts.snapshot.latest ?? frame.beat?.event) : frame.beat?.event;
  if (event?.kind !== "edit" && event?.kind !== "read") return pose;
  const work = frame.beat?.stage === "work", release = frame.beat?.stage === "deliver";
  if (!pose.static && !work && !release) return pose;
  const advance = frame.beat?.progress ?? 1;
  const extension = pose.static ? 1 : work ? Math.min(1, advance * 4) : Math.max(0, 1 - advance * 2);
  const contact = toolContact(frame, event, !!pose.static || !work);
  const target = { x: contact.x - worker.x, y: contact.y - worker.y };
  return { ...pose, gesture: event.kind === "edit" ? "edit" : "scan", facing: target.x >= 0 ? 1 : -1, extension, target };
}

export function createMotionPainter(
  movement: ReturnType<typeof createMotionState>,
  fx: ReturnType<typeof createBoardFx>,
) {
  let lastSpark = "";
  let composed = false;
  return {
    draw(
      motion: CanvasRenderingContext2D,
      assets: Assets,
      frame: BoardMotionFrame,
      dt: number,
    ) {
      const { facts, palette, glow, ownerGlow, smoke, era, parts, build } =
        assets;
      const state = facts.state.toLowerCase().replace(/[\s-]/gu, "");
      const unavailable = state === "linkdown" || state === "signallost";
      const terminal = ["failed", "cancelled", "shipped", "reverted"].includes(facts.snapshot.phase);
      const settled = frame.settled || frame.reducedMotion;
      const selectedZone = (settled || !frame.beat) && facts.snapshot.phase === "building"
        ? zoneForEvent(facts.snapshot.latest ?? null) : null;
      const active = selectedZone ?? beatZone(frame, facts),
        machine = zoneMachine(active);
      const reached = assets.evidence?.reached[active] ?? true;
      const movingPart = (reached ? parts[active] : assets.offParts?.[active]) ?? parts[active];
      const groupGlow = assets.glows?.[ZONE_BY_ID[active].group] ?? glow;
      const staticFrame = settled || unavailable,
        step = staticFrame ? 0 : dt;
      const worker = movement.worker(
        facts,
        !composed && !frame.beat ? { ...frame, settled: true } : frame,
        step,
      );
      const carrier = movement.build(
        facts,
        frame,
        settled ? 10 : step,
      );
      const capsule = capsulePoint(facts, frame, carrier.point);
      composed = true;
      if (!unavailable && !terminal &&
        (selectedZone || facts.activeZone || frame.beat || frame.ceremony)) {
        const pad = ZONE_BY_ID[active].pad, width = pad.width + pad.depth;
        const point = project(pad.x + pad.width / 2, pad.y + pad.depth / 2, BOARD.pad.raise);
        motion.globalAlpha = padPoolAlpha(frame.elapsed, !!staticFrame);
        motion.drawImage(groupGlow, point.x - width / 2, point.y - width / 4, width, width / 2);
        motion.globalAlpha = 1;
      }
      if (build && !unavailable)
        drawBuild(motion, build, capsule.x, capsule.y);
      if (
        frame.beat?.action === "edit" &&
        ["deliver", "remember"].includes(frame.beat.stage)
      ) {
        motion.globalAlpha = (1 - frame.beat.progress) * 0.25;
        motion.drawImage(
          glow,
          capsule.x - 25,
          capsule.y - 38,
          50,
          50,
        );
        motion.globalAlpha = 1;
      }
      const pose = operatorPose(facts, frame, movement, worker, state);
      const frontStation = ZONE_BY_ID[active].pad.y >= BOARD.front[0];
      const drawWorker = () => drawEra(motion, era, worker.x, worker.y, frame.elapsed, pose, movement.feet, c => {
        const b = OPERATOR_BOUNDS, x = worker.x + b.x, y = worker.y + b.y;
        const dpr = assets.foreground.width / BOARD.bounds.width;
        c.drawImage(assets.foreground, (x - BOARD.bounds.x) * dpr, (y - BOARD.bounds.y) * dpr,
          b.width * dpr, b.height * dpr, x, y, b.width, b.height);
        for (const zone of ZONES) {
          if (zone.pad.y < BOARD.front[0] || (zone.id === active && !unavailable)) continue;
          const part = (assets.evidence?.reached[zone.id] ? parts : assets.offParts)?.[zone.id];
          const pos = zoneMachine(zone.id);
          if (part && Math.abs(pos.x - worker.x) < 185)
            c.drawImage(part.image, pos.x + part.x, pos.y + part.y, part.width, part.height);
        }
        if (build && carrier.ground.y > movement.footing.y && Math.abs(capsule.x - worker.x) < 80)
          drawBuild(c, build, capsule.x, capsule.y);
      });
      if (frontStation) drawWorker();
      let particles = 0;
      if (!staticFrame) {
        const art = {
          palette: !reached && assets.dimPalette ? assets.dimPalette : palette,
          zone: active,
          facts,
          frame,
          part: movingPart,
          glow: groupGlow,
          evidence: assets.evidence,
        };
        motion.save();
        motion.translate(machine.x, machine.y);
        if (state === "failed" && movingPart) {
          const p = movingPart;
          motion.translate(5, 8);
          motion.rotate(0.12);
          motion.drawImage(p.image, p.x, p.y, p.width, p.height);
        } else if (facts.activeZone || frame.beat || frame.ceremony)
          ZONE_ART[active].motion(motion, art);
        else if (movingPart) {
          const p = movingPart;
          motion.drawImage(p.image, p.x, p.y, p.width, p.height);
        }
        motion.restore();
        const pulseZones = new Set<ZoneId>();
        for (const pulse of frame.beats ?? [])
          if (pulse.id !== frame.beat?.id)
            pulseZones.add(beatZone({ ...frame, beat: pulse }, facts));
        for (const zone of pulseZones) {
          const point = zoneMachine(zone);
          motion.globalAlpha = 0.4;
          motion.drawImage(glow, point.x - 10, point.y - 45, 20, 20);
        }
        particles += pulseZones.size;
        motion.globalAlpha = 1;
        const beat = frame.beat;
        if (beat?.stage === "think") {
          particles++;
          const origin = project(ZONE_BY_ID.think.machine.x, 96, 2);
          const q = beat.progress;
          motion.drawImage(
            glow,
            origin.x + (worker.x - origin.x) * q - 4,
            origin.y + (worker.y - origin.y) * q - 4,
            8,
            8,
          );
        } else if (beat?.action === "read" && beat.stage === "deliver") {
          particles++;
          const chip = project(320 + 128 * beat.progress, 96, 2);
          motion.drawImage(glow, chip.x - 4, chip.y - 4, 8, 8);
        }
        for (const zone of facts.zones) {
          if (zone.status !== "active" && zone.status !== "needs-you") continue;
          const m = ZONE_BY_ID[zone.id].machine,
            l = project(m.x + ART.lamp.x, m.y + ART.lamp.y, 6 + ART.lamp.post);
          motion.globalAlpha = 0.25 + Math.sin(frame.elapsed * 3) * 0.1;
          motion.drawImage(
            zone.status === "needs-you" ? ownerGlow : (assets.glows?.[ZONE_BY_ID[zone.id].group] ?? glow),
            l.x - 12,
            l.y - 12,
            24,
            24,
          );
        }
        motion.globalAlpha = 1;
        for (let i = 0; i < BUDGET.dust / 2; i++) {
          const x =
              ((i * 137 + frame.elapsed * ((i % 3) + 1) * 2) %
                ART.dust.rangeX) -
              260,
            y = ((i * 83) % ART.dust.rangeY) + 20;
          motion.globalAlpha = 0.085;
          motion.drawImage(glow, x, y, 7, 7);
        }
        motion.globalAlpha = 1;
        particles += BUDGET.dust / 2;
        if (state === "failed") {
          for (let i = 0; i < BUDGET.smoke; i++) {
            const age = (frame.elapsed + i * 0.17) % ART.smoke.life;
            motion.globalAlpha = (1 - age / ART.smoke.life) * 0.22;
            motion.drawImage(
              smoke,
              machine.x + (i % 3) * 6,
              machine.y - 24 - age * ART.smoke.speed,
              14 + age * 6,
              14 + age * 6,
            );
          }
          motion.globalAlpha = 1;
          particles += BUDGET.smoke;
        }
        const sparkKey = frame.beat?.stage === "work" && pose.gesture === "edit" && pose.extension === 1
          ? frame.beat.id : "";
        if (sparkKey && sparkKey !== lastSpark && pose.target) {
          fx.emit(
            worker.x + pose.target.x,
            worker.y + pose.target.y,
            24,
            Math.min(80, movement.cap - particles),
          );
        }
        lastSpark = sparkKey;
        particles += fx.draw(
          motion,
          glow,
          step,
          Math.min(80, movement.cap - particles),
        );
        if (carrier.moving || capsule.y !== carrier.point.y) {
          particles++;
          motion.globalAlpha = 0.55;
          motion.drawImage(
            glow,
            capsule.x - 15,
            capsule.y - 6,
            30,
            12,
          );
          motion.globalAlpha = 1;
        }
      } else {
        fx.clear();
        const part = movingPart;
        if (part && !unavailable)
          motion.drawImage(
            part.image,
            machine.x + part.x,
            machine.y + part.y,
            part.width,
            part.height,
          );
      }
      if (!frontStation) drawWorker();

      return particles;
    },
  };
}
