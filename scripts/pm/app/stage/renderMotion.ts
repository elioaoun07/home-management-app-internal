import { ART, BUDGET, ZONE_BY_ID } from "./config";
import { beatZone, zoneMachine, ZONE_ART } from "./board";
import { BOARD, type ZoneGroup } from "./config";
import type { MachineEvidence } from "./machineEvidence";
import { drawEra, type EraSprites, type EraSpritePose } from "./actors/era";
import { drawBuild } from "./actors/build";
import { capsulePoint } from "./capsulePose";
import { createMotionState } from "./motion";
import { createBoardFx } from "./fx";
import { project } from "./iso";
import type {
  BoardFacts,
  BoardMotionFrame,
  Sprite,
  StagePalette,
} from "./types";
import type { ZoneId } from "./config";
interface Assets {
  facts: BoardFacts;
  palette: StagePalette;
  glow: HTMLCanvasElement;
  ownerGlow: HTMLCanvasElement;
  smoke: HTMLCanvasElement;
  era: EraSprites;
  parts: Partial<Record<ZoneId, Sprite>>;
  offParts?: Partial<Record<ZoneId, Sprite>>;
  dimPalette?: StagePalette;
  glows?: Partial<Record<ZoneGroup, HTMLCanvasElement>>;
  evidence?: MachineEvidence;
  build: Sprite | null;
}
export const padPoolAlpha = (seconds: number, still = false) => still ? 0.65 : 0.65 + 0.15 * Math.sin(seconds * Math.PI);
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
      const active = beatZone(frame, facts),
        machine = zoneMachine(active);
      const reached = assets.evidence?.reached[active] ?? true;
      const movingPart = (reached ? parts[active] : assets.offParts?.[active]) ?? parts[active];
      const groupGlow = assets.glows?.[ZONE_BY_ID[active].group] ?? glow;
      const staticFrame = frame.reducedMotion || unavailable,
        step = staticFrame ? 0 : dt;
      const worker = movement.worker(
        facts,
        frame,
        frame.reducedMotion || (!composed && unavailable) ? 10 : step,
      );
      const carrier = movement.build(
        facts,
        frame,
        frame.reducedMotion ? 10 : step,
      );
      const capsule = capsulePoint(facts, frame, carrier.point);
      composed = true;
      if (!unavailable && !["failed", "cancelled", "shipped", "reverted"].includes(facts.snapshot.phase) &&
        (facts.activeZone || frame.beat || frame.ceremony)) {
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
      const pose: EraSpritePose =
        state === "stale"
          ? "seated"
          : state === "cancelled"
            ? "down"
            : frame.beat?.stage === "travel"
              ? "right"
              : "upright";
      drawEra(motion, era, palette, worker.x, worker.y, frame.elapsed, pose, {
        static: staticFrame,
        ghost: state === "signallost",
        point: !!facts.attention?.some(
          (i) => i.level === "act" && i.state === "open",
        ),
      });
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
        for (let i = 0; i < BUDGET.dust; i++) {
          const x =
              ((i * 137 + frame.elapsed * ((i % 3) + 1) * 2) %
                ART.dust.rangeX) -
              260,
            y = ((i * 83) % ART.dust.rangeY) + 20;
          motion.globalAlpha = 0.15;
          motion.drawImage(glow, x, y, 7, 7);
        }
        motion.globalAlpha = 1;
        particles += BUDGET.dust;
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
        const sparkKey =
          frame.beat?.stage === "work" && frame.beat.action === "edit"
            ? `${frame.beat.id}:${Math.floor(frame.beat.progress * 8)}`
            : "";
        if (sparkKey && sparkKey !== lastSpark) {
          lastSpark = sparkKey;
          fx.emit(
            machine.x,
            machine.y - 35,
            5,
            Math.min(80, movement.cap - particles),
          );
        }
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

      return particles;
    },
  };
}
