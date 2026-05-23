/**
 * AudioWorklet processor for low-latency PCM playback.
 * Accepts 24 kHz Int16 PCM chunks from the main thread and plays them
 * at the AudioContext's native sample rate via linear interpolation.
 *
 * Messages in:
 *   { type: 'pcm', buffer: ArrayBuffer }  — Int16 PCM chunk (transferred)
 *   { type: 'end' }                        — no more chunks; drain and stop
 *   { type: 'stop' }                       — abort immediately, silence output
 *
 * Messages out:
 *   { type: 'done' }  — buffer fully drained after 'end'
 */
const SRC_RATE = 24000;
const RING_SECONDS = 8;

class PCMPlayerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._ring = new Float32Array(SRC_RATE * RING_SECONDS);
    this._head = 0;     // write index (in source samples)
    this._tail = 0;     // read index (in source samples)
    this._count = 0;    // source samples available
    this._frac = 0;     // fractional read position for interpolation
    this._ended = false;
    this._stopped = false;
    this._doneFired = false;

    this.port.onmessage = ({ data }) => {
      if (data.type === "pcm") {
        const i16 = new Int16Array(data.buffer);
        const size = this._ring.length;
        for (let i = 0; i < i16.length; i++) {
          this._ring[this._head % size] = i16[i] / 32768.0;
          this._head++;
          if (this._count < size) this._count++;
        }
      } else if (data.type === "end") {
        this._ended = true;
      } else if (data.type === "stop") {
        this._stopped = true;
        this._ended = true;
        this._count = 0;
      }
    };
  }

  process(_inputs, outputs) {
    const out = outputs[0]?.[0];
    if (!out) return !this._ended;

    if (this._stopped) {
      out.fill(0);
      if (!this._doneFired) {
        this._doneFired = true;
        this.port.postMessage({ type: "done" });
      }
      return false;
    }

    const ratio = sampleRate / SRC_RATE; // e.g. 2.0 for 48000 → 24000
    const size = this._ring.length;

    for (let i = 0; i < out.length; i++) {
      if (this._count < 2) {
        out[i] = 0;
        continue;
      }

      const floorIdx = this._tail % size;
      const ceilIdx = (this._tail + 1) % size;
      out[i] = this._ring[floorIdx] + this._frac * (this._ring[ceilIdx] - this._ring[floorIdx]);

      this._frac += 1.0 / ratio;
      while (this._frac >= 1.0) {
        this._frac -= 1.0;
        this._tail++;
        this._count--;
      }
    }

    if (this._ended && this._count <= 1 && !this._doneFired) {
      this._doneFired = true;
      this.port.postMessage({ type: "done" });
      return false;
    }

    return true;
  }
}

registerProcessor("era-pcm-player", PCMPlayerProcessor);
