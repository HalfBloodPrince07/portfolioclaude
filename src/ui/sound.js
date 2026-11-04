// Tiny generative soundscape: a filtered drone + UI blips + whooshes on layer changes.
// Everything is synthesized with Web Audio — no audio files to download.

export class Sound {
  constructor() {
    this.enabled = false;
    this.ctx = null;
  }

  _boot() {
    if (this.ctx) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 380;
    filter.Q.value = 6;
    filter.connect(this.master);
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 220;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
    this.filter = filter;

    [55, 82.41, 110.3, 164.8].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i % 2 ? 'triangle' : 'sawtooth';
      o.frequency.value = f;
      o.detune.value = (i - 1.5) * 6;
      const g = ctx.createGain();
      g.gain.value = [0.2, 0.12, 0.06, 0.03][i];
      o.connect(g).connect(filter);
      o.start();
    });

    // noise buffer for whooshes
    const len = ctx.sampleRate * 1.2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  toggle(on = !this.enabled) {
    this.enabled = on;
    if (on) this._boot();
    if (!this.ctx) return on;
    if (on) this.ctx.resume();
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(on ? 0.1 : 0, now, 0.6);
    return on;
  }

  blip(freq = 1400) {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, now);
    o.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 0.08);
    g.gain.setValueAtTime(0.018, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    o.connect(g).connect(ctx.destination);
    o.start(now); o.stop(now + 0.12);
  }

  whoosh() {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(300, now);
    bp.frequency.exponentialRampToValueAtTime(2400, now + 0.5);
    bp.frequency.exponentialRampToValueAtTime(400, now + 1.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.09, now + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.15);
    src.connect(bp).connect(g).connect(ctx.destination);
    src.start(now);
    this.filter.frequency.setTargetAtTime(900, now, 0.2);
    this.filter.frequency.setTargetAtTime(380, now + 0.6, 0.6);
  }
}
