// Fully synthesized sound effects (no external files)
export class Audio {
  constructor() { this.ctx = null; this.volume = 0.6; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = this.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6;
    this.master.connect(comp); comp.connect(ctx.destination);
    // noise buffer
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // reverb
    this.verb = ctx.createConvolver();
    const ir = ctx.createBuffer(2, ctx.sampleRate * 1.8, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = ir.getChannelData(c);
      for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 3.2);
    }
    this.verb.buffer = ir;
    this.verbGain = ctx.createGain(); this.verbGain.gain.value = 0.25;
    this.verb.connect(this.verbGain); this.verbGain.connect(this.master);
  }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }

  listener(pos, fwd) {
    if (!this.ctx) return;
    const l = this.ctx.listener, t = this.ctx.currentTime;
    if (l.positionX) {
      l.positionX.setValueAtTime(pos.x, t); l.positionY.setValueAtTime(pos.y, t); l.positionZ.setValueAtTime(pos.z, t);
      l.forwardX.setValueAtTime(fwd.x, t); l.forwardY.setValueAtTime(fwd.y, t); l.forwardZ.setValueAtTime(fwd.z, t);
      l.upX.setValueAtTime(0, t); l.upY.setValueAtTime(1, t); l.upZ.setValueAtTime(0, t);
    } else {
      l.setPosition(pos.x, pos.y, pos.z); l.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0);
    }
  }

  out(pos) {
    if (!pos) return this.master;
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF'; p.distanceModel = 'inverse';
    p.refDistance = 4; p.rolloffFactor = 1.1; p.maxDistance = 400;
    p.positionX ? (p.positionX.value = pos.x, p.positionY.value = pos.y, p.positionZ.value = pos.z) : p.setPosition(pos.x, pos.y, pos.z);
    p.connect(this.master);
    return p;
  }

  noiseBurst(dest, { dur = 0.2, type = 'lowpass', freq = 3000, q = 0.7, gain = 1, attack = 0.002, decay = 4, sweepTo = null, verb = 0 }) {
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.setTargetAtTime(0.0001, t + attack, dur / decay);
    src.connect(f); f.connect(g); g.connect(dest);
    if (verb) { const vg = ctx.createGain(); vg.gain.value = verb; g.connect(vg); vg.connect(this.verb); }
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.6);
  }
  tone(dest, { f0 = 150, f1 = 50, dur = 0.1, gain = 0.8, type = 'sine', delay = 0 }) {
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }

  shot(kind, pos = null) {
    if (!this.ctx) return;
    const dest = this.out(pos);
    const far = pos ? 1 : 1;
    switch (kind) {
      case 'rifle':
        this.noiseBurst(dest, { dur: 0.22, freq: 3800, gain: 0.9 * far, verb: 0.5 });
        this.noiseBurst(dest, { dur: 0.08, type: 'highpass', freq: 5000, gain: 0.4 });
        this.tone(dest, { f0: 140, f1: 45, dur: 0.12, gain: 0.9 });
        break;
      case 'rifle2':
        this.noiseBurst(dest, { dur: 0.18, freq: 4400, gain: 0.8, verb: 0.45 });
        this.noiseBurst(dest, { dur: 0.06, type: 'highpass', freq: 6000, gain: 0.35 });
        this.tone(dest, { f0: 170, f1: 55, dur: 0.1, gain: 0.8 });
        break;
      case 'smg':
        this.noiseBurst(dest, { dur: 0.12, freq: 4500, gain: 0.65, verb: 0.3 });
        this.tone(dest, { f0: 200, f1: 70, dur: 0.07, gain: 0.6 });
        break;
      case 'sniper':
        this.noiseBurst(dest, { dur: 0.55, freq: 2600, gain: 1.0, verb: 1.0, decay: 3 });
        this.noiseBurst(dest, { dur: 0.1, type: 'highpass', freq: 4000, gain: 0.6 });
        this.tone(dest, { f0: 110, f1: 30, dur: 0.3, gain: 1.0 });
        break;
      case 'pistol':
        this.noiseBurst(dest, { dur: 0.12, freq: 5200, gain: 0.6, verb: 0.3 });
        this.tone(dest, { f0: 240, f1: 80, dur: 0.06, gain: 0.5 });
        break;
      case 'deagle':
        this.noiseBurst(dest, { dur: 0.28, freq: 3200, gain: 0.95, verb: 0.7 });
        this.tone(dest, { f0: 130, f1: 40, dur: 0.16, gain: 0.9 });
        break;
      case 'knife':
        this.noiseBurst(dest, { dur: 0.18, type: 'bandpass', freq: 1500, sweepTo: 5000, q: 1.5, gain: 0.35, attack: 0.05 });
        break;
    }
  }
  step(pos = null, loud = 0.25) {
    if (!this.ctx) return;
    const dest = this.out(pos);
    this.noiseBurst(dest, { dur: 0.07, type: 'bandpass', freq: 500 + Math.random() * 500, q: 1.2, gain: loud, attack: 0.004 });
    this.tone(dest, { f0: 90, f1: 50, dur: 0.05, gain: loud * 0.6 });
  }
  reload() {
    if (!this.ctx) return;
    const m = this.master;
    [0.15, 0.7, 1.4].forEach((d, i) => setTimeout(() => {
      this.noiseBurst(m, { dur: 0.05, type: 'highpass', freq: 2500 + i * 500, gain: 0.35, attack: 0.001 });
      this.tone(m, { f0: 900 - i * 200, f1: 400, dur: 0.04, gain: 0.15, type: 'square' });
    }, d * 1000));
  }
  bolt() {
    if (!this.ctx) return;
    const m = this.master;
    [0.25, 0.55].forEach(d => setTimeout(() => this.noiseBurst(m, { dur: 0.06, type: 'bandpass', freq: 1800, q: 3, gain: 0.4 }), d * 1000));
  }
  empty() { if (this.ctx) this.tone(this.master, { f0: 1500, f1: 900, dur: 0.03, gain: 0.2, type: 'square' }); }
  hit(head) {
    if (!this.ctx) return;
    if (head) {
      this.tone(this.master, { f0: 2600, f1: 2400, dur: 0.18, gain: 0.25 });
      this.tone(this.master, { f0: 3900, f1: 3600, dur: 0.12, gain: 0.15 });
    } else this.tone(this.master, { f0: 1700, f1: 1500, dur: 0.04, gain: 0.18, type: 'triangle' });
  }
  hurt() { if (this.ctx) this.noiseBurst(this.master, { dur: 0.15, freq: 600, gain: 0.5 }); }
  impact(pos) { if (this.ctx) this.noiseBurst(this.out(pos), { dur: 0.05, type: 'bandpass', freq: 2500, q: 2, gain: 0.25 }); }
  beep(f = 880, d = 0.12, g = 0.25) { if (this.ctx) this.tone(this.master, { f0: f, f1: f, dur: d, gain: g, type: 'square' }); }
  win(good) {
    if (!this.ctx) return;
    const notes = good ? [523, 659, 784, 1046] : [392, 349, 311, 262];
    notes.forEach((n, i) => this.tone(this.master, { f0: n, f1: n, dur: 0.35, gain: 0.18, type: 'triangle', delay: i * 0.12 }));
  }

  explosion(pos, size = 1) {
    if (!this.ctx) return;
    const d = this.out(pos);
    this.noiseBurst(d, { dur: 1.4 * size, freq: 900, gain: 1.0, verb: 1.2, decay: 2.5 });
    this.noiseBurst(d, { dur: 0.25, freq: 4000, gain: 0.8 });
    this.tone(d, { f0: 80, f1: 25, dur: 0.8 * size, gain: 1.0 });
  }
  flashBang(pos) {
    if (!this.ctx) return;
    const d = this.out(pos);
    this.noiseBurst(d, { dur: 0.35, freq: 6000, gain: 0.9, verb: 0.8 });
    this.tone(d, { f0: 200, f1: 60, dur: 0.15, gain: 0.7 });
  }
  ring(amt) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.value = 3400; g.gain.setValueAtTime(0.12 * amt, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 3 * amt + 0.3);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 3.5);
  }
  smoke(pos) {
    if (!this.ctx) return;
    this.noiseBurst(this.out(pos), { dur: 2.2, type: 'bandpass', freq: 2500, q: 0.6, gain: 0.35, attack: 0.05, decay: 2 });
  }
  throwNade(pos) { if (this.ctx) this.noiseBurst(this.out(pos), { dur: 0.15, type: 'bandpass', freq: 1200, sweepTo: 3000, q: 1, gain: 0.25, attack: 0.03 }); }
  bounce(pos) { if (this.ctx) this.tone(this.out(pos), { f0: 1400, f1: 900, dur: 0.05, gain: 0.25, type: 'triangle' }); }
  bombBeep(pos, fast) { if (this.ctx) this.tone(this.out(pos), { f0: fast ? 1900 : 1700, f1: fast ? 1900 : 1700, dur: 0.07, gain: 0.45, type: 'square' }); }
  planted() { if (!this.ctx) return; [0, 0.15, 0.3].forEach(d => this.tone(this.master, { f0: 900, f1: 900, dur: 0.1, gain: 0.2, type: 'square', delay: d })); }
  defused() { if (!this.ctx) return; this.noiseBurst(this.master, { dur: 0.08, type: 'bandpass', freq: 2000, q: 3, gain: 0.4 }); this.tone(this.master, { f0: 600, f1: 300, dur: 0.3, gain: 0.2, type: 'triangle', delay: 0.1 }); }
  buy() { if (this.ctx) { this.tone(this.master, { f0: 1300, f1: 1300, dur: 0.05, gain: 0.15, type: 'triangle' }); this.tone(this.master, { f0: 1800, f1: 1800, dur: 0.07, gain: 0.15, type: 'triangle', delay: 0.06 }); } }
  tick() { if (this.ctx) this.tone(this.master, { f0: 2400, f1: 1800, dur: 0.025, gain: 0.12, type: 'square' }); }
  reveal(level) {
    if (!this.ctx) return;
    const base = [440, 523, 587, 659, 784][level] || 440;
    [0, 4, 7, 12].forEach((st, i) => this.tone(this.master, { f0: base * Math.pow(2, st / 12), f1: base * Math.pow(2, st / 12), dur: 0.4, gain: 0.15, type: 'triangle', delay: i * 0.08 }));
  }
}
