// Short synthesized effects: no audio files, network, ads, or background music.
export class GameAudio {
  constructor(enabled = true) { this.enabled = enabled; this.context = null; this.master = null; this.lastBreak = 0; }
  unlock() {
    if (!this.enabled) return;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    try {
      if (!this.context) {
        this.context = new Context();
        this.master = this.context.createGain();
        this.master.gain.value = 0.14;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
    } catch { /* Sound is optional on devices without Web Audio. */ }
  }
  setEnabled(value) {
    this.enabled = value;
    if (value) this.unlock(); else this.suspend();
  }
  suspend() { if (this.context?.state === 'running') this.context.suspend().catch(() => {}); }
  tone(frequency, endFrequency, at, duration, type = 'sine', gain = .5) {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const ctx = this.context;
    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), at + duration);
    envelope.gain.setValueAtTime(.0001, at);
    envelope.gain.exponentialRampToValueAtTime(gain, at + .015);
    envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
    oscillator.connect(envelope); envelope.connect(this.master);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
    oscillator.start(at); oscillator.stop(at + duration + .01);
  }
  play(name) {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    if (name === 'star') {
      this.tone(660, 780, now, .12, 'sine', .55);
      this.tone(990, 1180, now + .08, .18, 'sine', .42);
    } else if (name === 'repair') {
      this.tone(480, 590, now, .15); this.tone(720, 950, now + .1, .2, 'sine', .4);
    } else if (name === 'hit') {
      this.tone(190, 55, now, .28, 'triangle', .6);
    } else if (name === 'wave') {
      this.tone(380, 80, now, .42, 'sine', .7);
      this.tone(650, 170, now, .26, 'triangle', .2);
    } else if (name === 'break' && now - this.lastBreak > .22) {
      this.lastBreak = now; this.tone(260, 100, now, .09, 'triangle', .18);
    }
  }
}
