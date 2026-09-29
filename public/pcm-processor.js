// AudioWorklet: mic Float32 at the device rate → 16-bit PCM at 24 kHz mono for the
// Voice Agent API. The AudioContext runs at the device's native rate (phones and
// Firefox reject a mic source on a context with a different rate), so we resample here
// and post ~50 ms chunks instead of one message per 128-frame render quantum.

const TARGET_RATE = 24000;
const CHUNK_SAMPLES = 1200; // 50 ms at 24 kHz

class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / TARGET_RATE; // input samples per output sample
    this.pos = 0; // fractional read position into the current input block
    this.prev = 0; // last sample of the previous block (for interpolation)
    this.out = new Int16Array(CHUNK_SAMPLES);
    this.outLen = 0;
  }

  push(s) {
    s = Math.max(-1, Math.min(1, s));
    this.out[this.outLen++] = s < 0 ? s * 0x8000 : s * 0x7fff;
    if (this.outLen === CHUNK_SAMPLES) {
      const buf = this.out.buffer;
      this.port.postMessage(buf, [buf]);
      this.out = new Int16Array(CHUNK_SAMPLES);
      this.outLen = 0;
    }
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0 || !input[0]) return true;
    const ch = input[0];

    if (this.ratio === 1) {
      for (let i = 0; i < ch.length; i++) this.push(ch[i]);
      return true;
    }

    // Linear interpolation; index -1 refers to the previous block's last sample.
    while (this.pos < ch.length) {
      const i = Math.floor(this.pos);
      const frac = this.pos - i;
      const a = i === 0 ? this.prev : ch[i - 1];
      const b = ch[i];
      this.push(a + (b - a) * frac);
      this.pos += this.ratio;
    }
    this.pos -= ch.length;
    this.prev = ch[ch.length - 1];
    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
