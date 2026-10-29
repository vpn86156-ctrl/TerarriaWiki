/* Звук «Заброшки»: скачанные CC0-сэмплы для ударов, выстрелов, шагов и стонов,
   плюс синтезированные звуки на тот случай, если файлы ещё не загрузились. */

const GROUPS = ['swing', 'hit', 'gun', 'boom', 'step', 'door', 'pickup', 'growl', 'hurt', 'click', 'ambient', 'reload'];

export class AudioEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.buffers = new Map();
    this.manifest = null;
    this.settings = { sound: true, music: true, volume: .8 };
    this.musicRole = null;
    this.musicSource = null;
    this.queue = [];
    this.stepTimer = 0;
    this.lastPlayed = new Map();
  }

  unlock() {
    if (!this.context) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.context = new Ctx();
      this.master = this.context.createGain();
      this.musicGain = this.context.createGain();
      this.sfxGain = this.context.createGain();
      this.musicGain.connect(this.master);
      this.sfxGain.connect(this.master);
      this.master.connect(this.context.destination);
      this.applyVolumes();
      this.loadManifest();
    }
    if (this.context.state === 'suspended') this.context.resume();
  }

  configure(settings) {
    this.settings = { ...this.settings, ...settings };
    this.applyVolumes();
    if (!this.settings.music) this.stopMusic();
  }
  applyVolumes() {
    if (!this.context) return;
    this.master.gain.value = this.settings.sound || this.settings.music ? this.settings.volume : 0;
    this.musicGain.gain.value = this.settings.music ? .55 : 0;
    this.sfxGain.gain.value = this.settings.sound ? .9 : 0;
  }
  suspend() { if (this.context?.state === 'running') this.context.suspend(); }
  resume() { if (this.context?.state === 'suspended') this.context.resume(); }

  async loadManifest() {
    if (this.manifest) return this.manifest;
    try {
      const response = await fetch('./audio/manifest.json');
      const data = await response.json();
      this.manifest = {};
      for (const entry of data.sfx || []) {
        if (!this.manifest[entry.group]) this.manifest[entry.group] = [];
        this.manifest[entry.group].push(entry);
      }
      this.musicList = data.music || [];
    } catch {
      this.manifest = {};
      this.musicList = [];
    }
    return this.manifest;
  }

  async bufferFor(url) {
    if (this.buffers.has(url)) return this.buffers.get(url);
    try {
      const response = await fetch(url);
      const data = await response.arrayBuffer();
      const buffer = await this.context.decodeAudioData(data);
      this.buffers.set(url, buffer);
      return buffer;
    } catch {
      this.buffers.set(url, null);
      return null;
    }
  }

  /* ---------- effects ---------- */
  play(group, { volume = 1, rate = 1, throttle = 0 } = {}) {
    if (!this.context || !this.settings.sound) return;
    if (throttle) {
      const now = this.context.currentTime;
      if (now - (this.lastPlayed.get(group) || -9) < throttle) return;
      this.lastPlayed.set(group, now);
    }
    const entries = this.manifest?.[group];
    if (entries && entries.length) {
      const entry = entries[Math.floor(Math.random() * entries.length)];
      this.bufferFor(`./audio/sfx/${entry.file}`).then((buffer) => {
        if (!buffer || !this.context) return;
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = rate * (.92 + Math.random() * .16);
        const gain = this.context.createGain();
        gain.gain.value = volume;
        source.connect(gain).connect(this.sfxGain);
        source.start();
      });
      return;
    }
    this.synth(group, volume, rate);
  }

  // Синтезированный резерв: если файлы не загрузились, игра не остаётся без звука.
  synth(group, volume, rate) {
    const ctx = this.context;
    if (!ctx) return;
    const now = ctx.currentTime;
    const tone = (from, to, duration, type, gain, delay = 0) => {
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from, now + delay);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), now + delay + duration);
      amp.gain.setValueAtTime(0, now + delay);
      amp.gain.linearRampToValueAtTime(gain * volume, now + delay + .01);
      amp.gain.exponentialRampToValueAtTime(.0001, now + delay + duration);
      osc.connect(amp).connect(this.sfxGain);
      osc.start(now + delay);
      osc.stop(now + delay + duration + .02);
    };
    const noise = (duration, gain, filter, delay = 0) => {
      const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const band = ctx.createBiquadFilter();
      band.type = filter.type;
      band.frequency.value = filter.frequency;
      const amp = ctx.createGain();
      amp.gain.value = gain * volume;
      source.connect(band).connect(amp).connect(this.sfxGain);
      source.start(now + delay);
    };
    if (group === 'swing') noise(.16, .35, { type: 'bandpass', frequency: 1800 });
    else if (group === 'hit') { noise(.14, .5, { type: 'lowpass', frequency: 900 }); tone(180, 60, .12, 'square', .18); }
    else if (group === 'gun') { noise(.12, .6, { type: 'highpass', frequency: 1200 }); tone(420, 90, .1, 'square', .25); }
    else if (group === 'boom') { noise(.7, .7, { type: 'lowpass', frequency: 500 }); tone(120, 30, .6, 'sine', .4); }
    else if (group === 'step') noise(.07, .18, { type: 'lowpass', frequency: 700 });
    else if (group === 'door') { tone(220, 90, .5, 'sawtooth', .12); noise(.5, .2, { type: 'bandpass', frequency: 600 }); }
    else if (group === 'pickup') { tone(880, 1320, .1, 'square', .18); tone(1320, 1760, .12, 'square', .14, .07); }
    else if (group === 'growl') { tone(120, 70, .7, 'sawtooth', .2); noise(.6, .18, { type: 'lowpass', frequency: 400 }); }
    else if (group === 'hurt') { tone(300, 120, .3, 'triangle', .3); noise(.25, .3, { type: 'lowpass', frequency: 800 }); }
    else if (group === 'click') tone(1200, 900, .05, 'square', .12);
    else if (group === 'reload') { tone(600, 300, .06, 'square', .14); tone(420, 260, .07, 'square', .12, .12); }
    else if (group === 'ambient') { tone(90, 60, 1.4, 'sine', .12); noise(1.2, .1, { type: 'lowpass', frequency: 500 }); }
  }

  // Шаги идут в ритме ходьбы героя.
  footsteps(dt, moving) {
    if (!moving) { this.stepTimer = 0; return; }
    this.stepTimer -= dt;
    if (this.stepTimer <= 0) {
      this.stepTimer = .38;
      this.play('step', { volume: .5, rate: .9 + Math.random() * .3 });
    }
  }

  /* ---------- music ---------- */
  async playRole(role) {
    if (!this.context || !this.settings.music) return;
    if (this.musicRole === role && this.musicSource) return;
    this.musicRole = role;
    if (!this.musicList) await this.loadManifest();
    const tracks = (this.musicList || []).filter((track) => track.role === role);
    if (!tracks.length) return;
    this.queue = [...tracks].sort(() => Math.random() - .5);
    this.nextTrack(true);
  }
  async nextTrack(immediate = false) {
    if (!this.context || !this.settings.music) return;
    const track = this.queue.shift();
    if (!track) { this.musicRole = null; return; }
    this.queue.push(track);
    const buffer = await this.bufferFor(`./audio/music/${track.file}`);
    if (!buffer || this.musicRole !== track.role) return;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const gain = this.context.createGain();
    gain.gain.value = 0;
    source.connect(gain).connect(this.musicGain);
    const now = this.context.currentTime;
    const fade = immediate ? 1.2 : .5;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(.7, now + fade);
    gain.gain.setValueAtTime(.7, now + Math.max(fade, buffer.duration - 1.5));
    gain.gain.linearRampToValueAtTime(0, now + buffer.duration);
    source.start(now);
    if (this.musicSource) {
      try { this.musicSource.stop(now + .3); } catch { /* already stopped */ }
    }
    this.musicSource = source;
    source.onended = () => {
      if (this.musicSource === source && this.settings.music && this.musicRole === track.role) this.nextTrack();
    };
  }
  stopMusic() {
    this.musicRole = null;
    if (this.musicSource) {
      try { this.musicSource.stop(); } catch { /* already stopped */ }
      this.musicSource = null;
    }
  }
}

export const SFX_GROUPS = GROUPS;
