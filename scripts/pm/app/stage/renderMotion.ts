import { ART, BUDGET, ZONE_BY_ID } from "./config";
import { beatZone, zoneMachine, ZONE_ART } from "./board";
import { BOARD, type ZoneGroup } from "./config";
import { blit, paintByDepth, type ScenePiece } from "./boardScene";
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
  scenery: readonly ScenePiece[];
  padLights: Record<ZoneId, Sprite>;
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
      const { facts, palette, glow, ownerGlow, smoke, era, build } =
        assets;
      const state = facts.state.toLowerCase().replace(/[\s-]/gu, "");
      const unavailable = state === "linkdown" || state === "signallost";
      const terminal = ["failed", "cancelled", "shipped", "reverted"].includes(facts.snapshot.phase);
      const settled = frame.settled || frame.reducedMotion;
      const selectedZone = (settled || !frame.beat) && facts.snapshot.phase === "building"
        ? zoneForEvent(facts.snapshot.latest ?? null) : null;
      const active = selectedZone ?? beatZone(frame, facts);
      const staticFrame = !!settled || unavailable;
      const step = staticFrame ? 0 : dt;
      const worker = movement.worker(facts, !composed && !frame.beat ? { ...frame, settled: true } : frame, step);
      const carrier = movement.build(facts, frame, settled ? 10 : step);
      const capsule = capsulePoint(facts, frame, carrier.point);
      const pose = operatorPose(facts, frame, movement, worker, state);
      composed = true;
      let particles = 0;
      const occupied: Omit<Sprite, "image">[] = [];
      function cover(x: number, y: number, width: number, height: number) {
        occupied.push({ x, y, width, height });
      }
      const currentZone = facts.currentZone === undefined ? facts.activeZone : facts.currentZone;
      if (!unavailable && !terminal && currentZone) {
        motion.globalAlpha = padPoolAlpha(frame.elapsed, staticFrame);
        blit(motion, assets.padLights[currentZone]);
        occupied.push(assets.padLights[currentZone]);
        motion.globalAlpha = 1;
      }
      const moving: { depth: number; paint: () => void }[] = [{
        depth: movement.footing.x + movement.footing.y,
        paint: () => {
          drawEra(motion, era, worker.x, worker.y, frame.elapsed, pose, movement.feet);
          const b = OPERATOR_BOUNDS;
          cover(worker.x + b.x, worker.y + b.y, b.width, b.height);
        },
      }];
      if (build) moving.push({ depth: carrier.ground.x + carrier.ground.y, paint: () => {
        drawBuild(motion, build, capsule.x, capsule.y);
        cover(capsule.x + build.x, capsule.y + build.y, build.width, build.height);
        if (!unavailable && frame.beat?.action === "edit" && ["deliver", "remember"].includes(frame.beat.stage)) {
          motion.globalAlpha = (1 - frame.beat.progress) * .25;
          motion.drawImage(glow, capsule.x - 25, capsule.y - 38, 50, 50);
        }
        if (!staticFrame && (carrier.moving || capsule.y !== carrier.point.y)) {
          particles++;
          motion.globalAlpha = .55;
          motion.drawImage(glow, capsule.x - 15, capsule.y - 6, 30, 12);
        }
        motion.globalAlpha = 1;
      } });
      const beat = frame.beat;
      const pulseZones = new Set<ZoneId>();
      if (!staticFrame) {
        for (const pulse of frame.beats ?? [])
          if (pulse.id !== beat?.id) pulseZones.add(beatZone({ ...frame, beat: pulse }, facts));
        let transfer: Vec2 | undefined;
        if (beat?.stage === "think") {
          const from = { x: ZONE_BY_ID.think.machine.x, y: 96 };
          transfer = { x: from.x + (movement.footing.x - from.x) * beat.progress,
            y: from.y + (movement.footing.y - from.y) * beat.progress };
        } else if (beat?.action === "read" && beat.stage === "deliver")
          transfer = { x: ZONE_BY_ID.explore.machine.x + BOARD.column * beat.progress, y: 96 };
        if (transfer) {
          const point = project(transfer.x, transfer.y, 2);
          moving.push({ depth: transfer.x + transfer.y, paint: () => {
            particles++;
            motion.drawImage(glow, point.x - 4, point.y - 4, 8, 8);
            cover(point.x - 4, point.y - 4, 8, 8);
          } });
        }
      } else fx.clear();
      const sparkKey = !staticFrame && beat?.stage === "work" && pose.gesture === "edit" && pose.extension === 1
        ? beat.id : "";
      if (sparkKey && sparkKey !== lastSpark && pose.target)
        fx.emit(worker.x + pose.target.x, worker.y + pose.target.y, 24, Math.min(80, movement.cap));
      lastSpark = sparkKey;

      function paintPiece(piece: ScenePiece) {
        if (piece.kind !== "part") {
          // Its full-resolution colour is already on the state canvas. Remove
          // only the pixels it covers from actors and moving parts behind it.
          const mask = piece.sprite;
          if (occupied.some(r => r.x < mask.x + mask.width && r.x + r.width > mask.x &&
            r.y < mask.y + mask.height && r.y + r.height > mask.y)) {
            motion.globalCompositeOperation = "destination-out";
            blit(motion, mask);
            motion.globalCompositeOperation = "source-over";
          }
          if (piece.kind === "lamp" && !staticFrame) {
            const zone = ZONE_BY_ID[piece.zone];
            const status = facts.zones.find(fact => fact.id === zone.id)?.status;
            if (status === "active" || status === "needs-you") {
              const lamp = ART.lamp, at = project(zone.machine.x + lamp.x, zone.machine.y + lamp.y, 6 + lamp.post);
              motion.globalAlpha = .25 + Math.sin(frame.elapsed * 3) * .1;
              motion.drawImage(status === "needs-you" ? ownerGlow : (assets.glows?.[zone.group] ?? glow),
                at.x - 12, at.y - 12, 24, 24);
              cover(at.x - 12, at.y - 12, 24, 24);
              motion.globalAlpha = 1;
            }
          }
          return;
        }
        const { zone, point, sprite } = piece;
        if (sprite) cover(point.x + sprite.x, point.y + sprite.y, sprite.width, sprite.height);
        if (zone === active || (zone === "verify" && assets.evidence?.runningCheck != null)) {
          motion.save();
          motion.translate(point.x, point.y);
          const reached = assets.evidence?.reached[zone] ?? true;
          const art = { palette: !reached && assets.dimPalette ? assets.dimPalette : palette, zone,
            facts, frame, part: sprite, glow: assets.glows?.[ZONE_BY_ID[zone].group] ?? glow, evidence: assets.evidence };
          if (zone === active && !staticFrame && state === "failed" && sprite) {
            motion.translate(5, 8);
            motion.rotate(.12);
            blit(motion, sprite);
          } else if (zone === active && !staticFrame && (facts.activeZone || beat || frame.ceremony)) {
            ZONE_ART[zone].motion(motion, art);
          } else if (zone === "verify" && assets.evidence?.runningCheck != null) {
            ZONE_ART.verify.motion(motion, { ...art, frame: { ...frame, reducedMotion: true } });
          } else if (sprite) blit(motion, sprite);
          motion.restore();
          // Animated heads, scanning beams and the active check can leave their
          // resting envelope. Include the full travel of this assembly.
          if ((!staticFrame && (beat || frame.ceremony || zone === "test" || state === "failed")) ||
            (zone === "verify" && assets.evidence?.runningCheck != null))
            cover(point.x - 160, point.y - 180, 410, 300);
        } else if (sprite) {
          motion.drawImage(sprite.image, point.x + sprite.x, point.y + sprite.y, sprite.width, sprite.height);
        }
        if (pulseZones.has(zone)) {
          motion.globalAlpha = .4;
          motion.drawImage(glow, point.x - 10, point.y - 45, 20, 20);
          cover(point.x - 10, point.y - 45, 20, 20);
          motion.globalAlpha = 1;
          particles++;
        }
        if (!staticFrame && zone === "build") {
          const sparks = fx.draw(motion, glow, step, Math.min(80, movement.cap - particles));
          if (sparks) cover(point.x - 90, point.y - 110, 180, 160);
          particles += sparks;
        }
        if (!staticFrame && zone === active && state === "failed") {
          for (let i = 0; i < BUDGET.smoke; i++) {
            const age = (frame.elapsed + i * .17) % ART.smoke.life;
            motion.globalAlpha = (1 - age / ART.smoke.life) * .22;
            motion.drawImage(smoke, point.x + (i % 3) * 6, point.y - 24 - age * ART.smoke.speed,
              14 + age * 6, 14 + age * 6);
          }
          motion.globalAlpha = 1;
          particles += BUDGET.smoke;
        }
      }
      paintByDepth(assets.scenery, moving, paintPiece, piece => piece.paint());
      if (!staticFrame) {
        for (let i = 0; i < BUDGET.dust / 2; i++) {
          const x = (i * 137 + frame.elapsed * ((i % 3) + 1) * 2) % ART.dust.rangeX - 260;
          motion.globalAlpha = .085;
          motion.drawImage(glow, x, (i * 83) % ART.dust.rangeY + 20, 7, 7);
        }
        motion.globalAlpha = 1;
        particles += BUDGET.dust / 2;
      }

      return particles;
    },
  };
}
