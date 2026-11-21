import type { Pose } from "./protocol";

// A heel strike, damped deck resonance and softer toe contact in one short
// buffer. Synthesize the two soles once, only after the Game sound opt-in.
function boot(context: BaseAudioContext, seed: number) {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * .21), context.sampleRate);
  const samples = buffer.getChannelData(0);
  let random = seed, noise = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / context.sampleRate;
    random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
    noise = noise * .68 + (random / 2147483648 - 1) * .32;
    const heel = Math.sin(2 * Math.PI * (56 * t + .95 * (1 - Math.exp(-35 * t)))) * Math.exp(-31 * t);
    const plate = Math.sin(t * (seed === 1 ? 2240 : 2310)) + .44 * Math.sin(t * 3940);
    const toe = Math.max(0, t - .061);
    samples[i] = Math.min(1, t * 700) * (
      heel * .43 + plate * .068 * Math.exp(-56 * t) + noise * .52 * Math.exp(-40 * t) +
      noise * .29 * Math.min(1, toe * 170) * Math.exp(-43 * toe)
    );
  }
  return buffer;
}

function roomMix(destination: AudioDestinationNode) {
  const context = destination.context;
  const output = context.createGain();
  output.gain.value = 0;
  output.connect(destination);
  const hum = context.createGain(), pan = context.createStereoPanner();
  hum.gain.value = 0;
  hum.connect(pan); pan.connect(output);
  const field = context.createOscillator(), filament = context.createOscillator();
  field.type = "sine"; field.frequency.value = 58;
  filament.type = "triangle"; filament.frequency.value = 116.65;
  const overtone = context.createGain(); overtone.gain.value = .16;
  field.connect(hum); filament.connect(overtone); overtone.connect(hum);
  field.start(); filament.start();
  const soles = [boot(context, 1), boot(context, 2)];
  const feet = [-.21, .21].map(side => {
    const foot = context.createStereoPanner(); foot.pan.value = side; foot.connect(output);
    return foot;
  });
  let distanceToStep = .48, foot = 0, active = false;
  let lastGain = -1, lastPan = -2;
  const strikes = new Set<AudioBufferSourceNode>();
  function silence() {
    if (!active) return;
    active = false; distanceToStep = .48; lastGain = -1; lastPan = -2;
    output.gain.cancelScheduledValues(context.currentTime);
    output.gain.setValueAtTime(0, context.currentTime);
    for (const source of strikes) source.stop();
    strikes.clear();
  }
  return {
    silence,
    position(pose: Pose, energy: number, working: boolean, allowed: boolean) {
      if (!allowed) { silence(); return; }
      const time = context.currentTime;
      if (!active) {
        active = true;
        output.gain.setTargetAtTime(.16, time, .018);
      }
      // Horizontal direction is relative to the listener's right ear. Both
      // rooms share the central emitter at the origin.
      const radius = Math.hypot(pose.x, pose.z);
      const bearing = radius ? (-pose.x * Math.cos(pose.yaw) + pose.z * Math.sin(pose.yaw)) / radius : 0;
      const amount = working ? (.055 + .095 * energy) / (1 + .095 * radius * radius) : 0;
      if (Math.abs(lastGain - amount) > .00045 || !amount && lastGain !== 0) {
        hum.gain.setTargetAtTime(amount, time, .11); lastGain = amount;
      }
      if (Math.abs(lastPan - bearing) > .018) {
        pan.pan.setTargetAtTime(.83 * bearing, time, .045); lastPan = bearing;
      }
    },
    travel(distance: number, dt: number) {
      if (!active || distance <= 0 || dt <= 0 || context.state !== "running") return;
      distanceToStep -= distance;
      if (distanceToStep > 0) return;
      const pace = Math.max(0, Math.min(1, (distance / dt - 2.4) / 1.75));
      distanceToStep += .91 + .23 * pace;
      const strike = context.createBufferSource();
      strike.buffer = soles[foot];
      strike.playbackRate.value = .95 + .11 * pace;
      strike.connect(feet[foot]); foot = 1 - foot;
      strikes.add(strike);
      strike.onended = () => { strike.disconnect(); strikes.delete(strike); };
      strike.start();
    },
    dispose() {
      silence();
      field.stop(); filament.stop();
      for (const node of [field, filament, overtone, hum, pan, ...feet, output]) node.disconnect();
    },
  };
}

export function createRoomSound(host: HTMLElement, signal: AbortSignal) {
  let destination: AudioDestinationNode | null = null, mix: ReturnType<typeof roomMix> | null = null;
  const connect = (output: AudioDestinationNode | null) => {
    if (output === destination || signal.aborted) return;
    mix?.dispose();
    destination = output;
    mix = output && typeof output.context.createStereoPanner === "function" ? roomMix(output) : null;
  };
  function request(activate: boolean) {
    if (!destination) host.dispatchEvent(new CustomEvent("pm-room-audio", { bubbles: true, detail: { connect, activate, signal } }));
  }
  request(false);
  signal.addEventListener("abort", () => { mix?.dispose(); mix = null; destination = null; }, { once: true });
  return {
    activate: () => request(true),
    silence: () => mix?.silence(),
    position: (pose: Pose, energy: number, working: boolean, allowed: boolean) => mix?.position(pose, energy, working, allowed),
    travel: (distance: number, dt: number) => mix?.travel(distance, dt),
  };
}
