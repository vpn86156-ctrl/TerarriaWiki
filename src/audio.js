// Short synthesized effects and a small procedural soundtrack: no audio files, network, ads or external samples.
const CALM_STEPS = 0.46;
const BOSS_STEPS = 0.28;

export class GameAudio {
  constructor(enabled = true, music = true) {
    this.enabled = enabled;
    this.musicEnabled = music;
    this.context = null; this.master = null; this.sfx = null; this.musicBus = null;
    this.noiseBuffer = null; this.last = new Map(); this.lastBreak = 0;
    this.mode = 'calm'; this.timer = null; this.step = 0; this.nextStep = 0; this.playing = false;
  }
  unlock() {
    if (!this.enabled && !this.musicEnabled) return;
    const Context = globalThis.window?.AudioContext || globalThis.window?.webkitAudioContext;
    if (!Context) return;
    try {
      if (!this.context) {
        this.context = new Context();
        this.master = this.context.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.context.destination);
        this.sfx = this.context.createGain();
        this.sfx.gain.value = 0.3;
        this.sfx.connect(this.master);
        this.musicBus = this.context.createGain();
        this.musicBus.gain.value = this.musicEnabled ? 0.5 : 0.0001;
        this.musicBus.connect(this.master);
        const length = Math.floor(this.context.sampleRate * 1.6);
        this.noiseBuffer = this.context.createBuffer(1, length, this.context.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      }
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
    } catch { /* Sound is optional on devices without Web Audio. */ }
  }
  setEnabled(value) {
    this.enabled = value;
    if (!value) { this.suspend(); return; }
    this.unlock();
    if (this.context) this.sfx.gain.value = value ? 0.3 : 0.0001;
  }
  setMusicEnabled(value) {
    this.musicEnabled = value;
    if (this.context) this.musicBus.gain.setTargetAtTime(value ? 0.5 : 0.0001, this.context.currentTime, 0.1);
    if (!value) this.stopMusic();
  }
  suspend() {
    if (this.context?.state === 'running') this.context.suspend().catch(() => {});
    this.stopMusic();
  }
  /* ---------- primitives ---------- */
  tone(frequency, endFrequency, at, duration, type = 'sine', gain = .5, bus = null) {
    if (!this.context || this.context.state !== 'running') return;
    const ctx = this.context;
    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(15, endFrequency), at + duration);
    envelope.gain.setValueAtTime(.0001, at);
    envelope.gain.exponentialRampToValueAtTime(Math.max(.0002, gain), at + Math.min(.03, duration * .3));
    envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
    oscillator.connect(envelope); envelope.connect(bus || this.sfx);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
    oscillator.start(at); oscillator.stop(at + duration + .02);
  }
  noise(at, duration, gain = .4, frequency = 1200, type = 'lowpass', q = 1) {
    if (!this.context || this.context.state !== 'running' || !this.noiseBuffer) return;
    const ctx = this.context;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type; filter.frequency.setValueAtTime(frequency, at); filter.Q.value = q;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(.0001, at);
    envelope.gain.exponentialRampToValueAtTime(gain, at + .012);
    envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
    source.connect(filter); filter.connect(envelope); envelope.connect(this.sfx);
    source.onended = () => { source.disconnect(); filter.disconnect(); envelope.disconnect(); };
    source.start(at); source.stop(at + duration + .02);
  }
  sweep(at, from, to, duration, gain = .5, type = 'sawtooth') {
    if (!this.context || this.context.state !== 'running') return;
    const ctx = this.context;
    const oscillator = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.max(200, from * 4), at);
    filter.frequency.exponentialRampToValueAtTime(Math.max(120, to * 4), at + duration);
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(.0001, at);
    envelope.gain.exponentialRampToValueAtTime(gain, at + duration * .2);
    envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, at);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(18, to), at + duration);
    oscillator.connect(filter); filter.connect(envelope); envelope.connect(this.sfx);
    oscillator.onended = () => { oscillator.disconnect(); filter.disconnect(); envelope.disconnect(); };
    oscillator.start(at); oscillator.stop(at + duration + .02);
  }
  /* ---------- effects ---------- */
  play(name) {
    if (!this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    const throttled = (key, ms) => {
      const last = this.last.get(key);
      if (last !== undefined && now - last < ms / 1000) return false;
      this.last.set(key, now); return true;
    };
    switch (name) {
      case 'shot':
        if (throttled('shot', 70)) { this.tone(880, 520, now, .07, 'square', .07); this.noise(now, .05, .05, 2600, 'highpass'); }
        break;
      case 'star':
        this.tone(660, 780, now, .12, 'sine', .5); this.tone(990, 1180, now + .08, .18, 'sine', .38);
        this.tone(1560, 1720, now + .14, .12, 'sine', .16);
        break;
      case 'credit':
        this.tone(1046, 1046, now, .08, 'square', .2); this.tone(1568, 1568, now + .06, .12, 'square', .16);
        break;
      case 'part':
        this.tone(1320, 1760, now, .12, 'triangle', .22); this.noise(now, .06, .06, 3200, 'highpass');
        break;
      case 'repair':
        this.tone(480, 590, now, .16); this.tone(720, 950, now + .1, .22, 'sine', .35);
        break;
      case 'hit':
        this.tone(190, 55, now, .3, 'triangle', .6); this.noise(now, .22, .3, 900);
        break;
      case 'wave':
        this.tone(380, 80, now, .42, 'sine', .7); this.tone(650, 170, now + .26, .26, 'triangle', .18);
        this.noise(now, .4, .18, 1800, 'bandpass', .8);
        break;
      case 'break':
        if (now - this.lastBreak > .12) {
          this.lastBreak = now;
          this.tone(260, 100, now, .1, 'triangle', .2); this.noise(now, .14, .16, 1400);
        }
        break;
      case 'drone-break':
        this.tone(520, 140, now, .26, 'square', .22); this.noise(now, .2, .18, 1800, 'bandpass', 1.2);
        break;
      case 'gameover':
        [420, 330, 250, 160].forEach((frequency, index) => this.tone(frequency, frequency * .82, now + index * .16, .42, 'triangle', .3));
        this.noise(now, 1.1, .16, 700);
        break;
      case 'boss-warning':
        // A rising siren over a low rumble: the sector guardian is on its way.
        for (let i = 0; i < 3; i += 1) this.tone(300 + i * 40, 760 + i * 40, now + i * .34, .34, 'sawtooth', .16);
        this.tone(58, 44, now, 2.2, 'sine', .5);
        this.noise(now, 2.2, .1, 420, 'bandpass', .7);
        break;
      case 'boss-arrives': {
        // Deep dive, dissonant tritone cluster and a beast-like growl.
        this.sweep(now, 90, 26, 1.6, .6, 'sawtooth');
        this.tone(58, 40, now, 2.4, 'sine', .55);
        for (const frequency of [104, 147, 208]) this.tone(frequency, frequency * .96, now + .35, 1.9, 'sawtooth', .1);
        this.tone(73, 110, now + .5, 1.5, 'square', .08);
        this.noise(now, 1.8, .3, 300, 'lowpass');
        this.noise(now + .2, 1.4, .12, 2400, 'bandpass', .6);
        break;
      }
      case 'boss-rage':
        this.sweep(now, 220, 60, .9, .45, 'sawtooth');
        this.tone(82, 150, now, 1.1, 'square', .18);
        this.noise(now, 1, .34, 900);
        break;
      case 'boss-blast':
        this.noise(now, .5, .5, 700);
        this.tone(150, 40, now, .5, 'sine', .5);
        this.tone(320, 90, now + .05, .35, 'triangle', .22);
        break;
      case 'boss-defeated':
        this.noise(now, 1.4, .6, 500);
        this.tone(180, 30, now, 1.3, 'sine', .6);
        this.tone(90, 24, now + .2, 1.6, 'triangle', .4);
        this.noise(now + .5, 1.2, .3, 220, 'lowpass');
        break;
      case 'victory':
        [523, 659, 784, 1047, 1319].forEach((frequency, index) => {
          this.tone(frequency, frequency * 1.01, now + index * .13, .55, 'sine', .3);
          this.tone(frequency / 2, frequency / 2, now + index * .13, .5, 'triangle', .12);
        });
        break;
      case 'sector-change':
        [392, 494, 587, 740].forEach((frequency, index) => this.tone(frequency, frequency * 1.5, now + index * .08, .3, 'sine', .22));
        break;
      case 'ui':
        this.tone(720, 900, now, .07, 'triangle', .18);
        break;
      case 'buy':
        this.tone(560, 720, now, .1, 'triangle', .25); this.tone(840, 1080, now + .08, .16, 'sine', .2);
        break;
      case 'case':
        this.noise(now, .5, .2, 1800, 'bandpass', .8);
        [660, 880, 1180].forEach((frequency, index) => this.tone(frequency, frequency * 1.2, now + .3 + index * .1, .3, 'sine', .22));
        break;
      default: break;
    }
  }
  /* ---------- procedural soundtrack ---------- */
  setMode(mode) { this.mode = mode === 'boss' ? 'boss' : 'calm'; }
  startMusic() {
    if (!this.context || this.context.state !== 'running') return;
    if (this.playing) return;
    this.playing = true;
    this.nextStep = this.context.currentTime + .1;
    this.timer = setInterval(() => this.schedule(), 120);
    this.schedule();
  }
  stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null; this.playing = false;
  }
  schedule() {
    if (!this.context || this.context.state !== 'running' || !this.playing) { this.stopMusic(); return; }
    const step = this.mode === 'boss' ? BOSS_STEPS : CALM_STEPS;
    const horizon = this.context.currentTime + .5;
    let guard = 0;
    while (this.nextStep < horizon && guard < 24) {
      this.playStep(this.step, this.nextStep, step);
      this.step += 1;
      this.nextStep += step;
      guard += 1;
    }
  }
  playStep(index, at, step) {
    const bus = this.musicBus;
    const bar = Math.floor(index / 8) % 4;
    if (this.mode === 'boss') {
      // Relentless pulse: pounding bass, dissonant stabs and a ticking hat.
      const beat = index % 8;
      if (beat % 2 === 0) this.tone(55, 38, at, step * 1.6, 'sine', .5, bus);
      if (beat === 0 || beat === 3 || beat === 6) this.tone(41, 30, at, step * 2, 'triangle', .35, bus);
      if (beat === 0) {
        for (const frequency of [116, 164, 173]) this.tone(frequency, frequency * .98, at, step * 3, 'sawtooth', .055, bus);
      }
      const line = [523, 0, 466, 0, 415, 0, 466, 554][beat];
      if (line) this.tone(line, line * .99, at, step * .9, 'sine', .07, bus);
      if (beat % 2 === 1) this.noise(at, .06, .04, 7000, 'highpass');
      return;
    }
    // Calm: a slow chord pad with a sparse arpeggio above it.
    const chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 207.7, 246.9]];
    const chord = chords[bar];
    if (index % 8 === 0) for (const frequency of chord) this.tone(frequency, frequency, at, step * 8.4, 'triangle', .05, bus);
    if (index % 8 === 0) this.tone(chord[0] / 2, chord[0] / 2, at, step * 8.4, 'sine', .09, bus);
    const arpeggio = [chord[2] * 2, 0, chord[1] * 2, 0, chord[0] * 2, 0, chord[1] * 2, chord[2] * 2.5];
    const note = arpeggio[index % 8];
    if (note) this.tone(note, note, at, step * 1.6, 'sine', .045, bus);
    if (index % 8 === 4) this.noise(at, step * 2, .012, 5200, 'bandpass', .6);
  }
}
