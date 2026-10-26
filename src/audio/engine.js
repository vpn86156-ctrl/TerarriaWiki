// Original, quiet synthesized UI tones and ambience. No game music, downloads or autoplay.
export class AudioEngine {
  constructor() {
    this.options = { sound: false, ambient: false, volume: 35 };
    this.effects = new Set();
    this.pad = [];
    this.scene = 0;
  }
  configure(options, scene = 0) {
    this.options = options;
    const changed = this.scene !== scene;
    this.scene = scene;
    if (!options.sound || options.volume === 0 || document.hidden) {
      this.stop();
      this.context?.suspend()?.catch(() => {});
      return;
    }
    if (this.master)
      this.master.gain.setTargetAtTime(
        (options.volume / 100) * 0.22,
        this.context.currentTime,
        0.03,
      );
    if (changed) this.stopPad();
    this.ambience();
  }
  unlock() {
    if (!this.options.sound || !this.options.volume || document.hidden)
      return false;
    try {
      if (!this.context) {
        const C = window.AudioContext || window.webkitAudioContext;
        if (!C) return false;
        this.context = new C();
        this.master = this.context.createGain();
        this.master.gain.value = (this.options.volume / 100) * 0.22;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === "suspended")
        this.context
          .resume()
          .then(() => this.ambience())
          .catch(() => {});
      return true;
    } catch {
      return false;
    }
  }
  feedback() {
    if (!this.unlock()) return;
    const t = this.context.currentTime;
    [440, 660].forEach((f, i) => {
      const osc = this.context.createOscillator(),
        g = this.context.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.13, t + 0.008 + i * 0.025);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.11 + i * 0.025);
      osc.connect(g);
      g.connect(this.master);
      this.effects.add(osc);
      osc.onended = () => {
        osc.disconnect();
        g.disconnect();
        this.effects.delete(osc);
      };
      osc.start(t);
      osc.stop(t + 0.16);
    });
    this.ambience();
  }
  ambience() {
    if (
      !this.context ||
      this.context.state !== "running" ||
      !this.options.sound ||
      !this.options.ambient ||
      !this.options.volume ||
      document.hidden
    ) {
      this.stopPad();
      return;
    }
    if (this.pad.length) return;
    const notes = [
      130.81, 146.83, 110, 98, 164.81, 87.31, 65.41, 174.61, 123.47, 82.41, 196,
    ];
    [1, 1.5].forEach((ratio) => {
      const osc = this.context.createOscillator(),
        g = this.context.createGain();
      osc.frequency.value = notes[this.scene % notes.length] * ratio;
      osc.type = "sine";
      g.gain.setValueAtTime(0, this.context.currentTime);
      g.gain.linearRampToValueAtTime(0.035, this.context.currentTime + 0.8);
      osc.connect(g);
      g.connect(this.master);
      osc.start();
      this.pad.push({ osc, g });
    });
  }
  stopPad() {
    for (const { osc, g } of this.pad) {
      try {
        osc.stop();
      } catch {}
      osc.disconnect();
      g.disconnect();
    }
    this.pad = [];
  }
  stop() {
    this.stopPad();
    for (const osc of this.effects) {
      try {
        osc.stop();
      } catch {}
    }
    this.effects.clear();
  }
  suspend() {
    this.stop();
    this.context?.suspend()?.catch(() => {});
  }
  destroy() {
    this.stop();
    this.context?.close()?.catch(() => {});
  }
}
