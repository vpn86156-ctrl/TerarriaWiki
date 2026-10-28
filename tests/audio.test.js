import test from 'node:test';
import assert from 'node:assert/strict';

// A minimal Web Audio stub: enough to prove what the game schedules, without any device.
class FakeParam {
  constructor() { this.value = 0; this.calls = []; }
  setValueAtTime(value, at) { this.calls.push(['set', value, at]); this.value = value; return this; }
  exponentialRampToValueAtTime(value, at) { this.calls.push(['ramp', value, at]); return this; }
  setTargetAtTime(value, at) { this.calls.push(['target', value, at]); this.value = value; return this; }
}
class FakeNode {
  constructor(context, type) { this.context = context; this.type = type; this.connected = []; this.started = []; this.stopped = []; }
  connect(target) { this.connected.push(target); return target; }
  disconnect() { this.connected = []; }
  start(at) { this.started.push(at); }
  stop(at) { this.stopped.push(at); }
}
class FakeAudioContext {
  constructor() {
    this.state = 'running'; this.currentTime = 0; this.sampleRate = 48000; this.destination = new FakeNode(this, 'destination');
    this.oscillators = []; this.noises = []; this.gains = [];
  }
  createGain() { const node = new FakeNode(this, 'gain'); node.gain = new FakeParam(); this.gains.push(node); return node; }
  createOscillator() { const node = new FakeNode(this, 'oscillator'); node.frequency = new FakeParam(); node.type = 'sine'; this.oscillators.push(node); return node; }
  createBiquadFilter() { const node = new FakeNode(this, 'filter'); node.frequency = new FakeParam(); node.Q = new FakeParam(); return node; }
  createBufferSource() { const node = new FakeNode(this, 'buffer'); node.buffer = null; this.noises.push(node); return node; }
  createBuffer(channels, length) { return { length, getChannelData: () => new Float32Array(length) }; }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
}
function withStubbedWindow() {
  const original = globalThis.window;
  const context = new FakeAudioContext();
  globalThis.window = { AudioContext: function AudioContextStub() { return context; } };
  return { context, restore: () => { globalThis.window = original; } };
}

test('every sound is safe when the device has no Web Audio at all', async () => {
  const { GameAudio } = await import('../src/audio.js');
  const original = globalThis.window;
  globalThis.window = undefined;
  const audio = new GameAudio(true, true);
  audio.unlock(); audio.setEnabled(true); audio.setMusicEnabled(true); audio.startMusic(); audio.setMode('boss');
  for (const name of ['shot', 'star', 'hit', 'boss-arrives', 'boss-blast', 'victory', 'ui']) audio.play(name);
  audio.suspend(); audio.stopMusic();
  globalThis.window = original;
  assert.equal(audio.context, null);
});

test('unlocking builds the mixer and the scary boss cue layers several voices', async () => {
  const { GameAudio } = await import('../src/audio.js');
  const stub = withStubbedWindow();
  try {
    const audio = new GameAudio(true, true);
    audio.unlock();
    assert.ok(audio.context, 'the context is created on unlock');
    assert.ok(audio.sfx && audio.musicBus && audio.noiseBuffer);
    audio.play('boss-arrives');
    const scheduled = audio.context.oscillators.length;
    assert.ok(scheduled >= 5, `the guardian cue stacks tones and growls, got ${scheduled}`);
    assert.ok(audio.context.noises.length >= 2, 'the cue also uses filtered noise');
    const before = audio.context.oscillators.length;
    audio.play('shot');
    audio.play('shot');
    assert.equal(audio.context.oscillators.length, before + 1, 'rapid shots are throttled');
    audio.setMode('boss');
    assert.equal(audio.mode, 'boss');
  } finally { stub.restore(); }
});

test('sound and music can be muted independently and the soundtrack schedules steps', async () => {
  const { GameAudio } = await import('../src/audio.js');
  const stub = withStubbedWindow();
  try {
    const audio = new GameAudio(true, true);
    audio.unlock();
    audio.startMusic();
    assert.ok(audio.playing);
    audio.context.currentTime = 1;
    audio.schedule();
    assert.ok(audio.context.oscillators.length > 0, 'the soundtrack schedules notes ahead of time');
    const steps = audio.step;
    assert.ok(steps > 0);
    audio.setMode('boss'); audio.context.currentTime = 2; audio.schedule();
    assert.ok(audio.step > steps, 'the boss theme keeps the pulse going');
    audio.setMusicEnabled(false);
    assert.equal(audio.playing, false, 'muting the music stops the sequencer');
    assert.ok(audio.musicBus.gain.calls.some(([kind]) => kind === 'target'));
    audio.setEnabled(false);
    assert.equal(audio.context.state, 'suspended');
    audio.stopMusic();
    assert.equal(audio.playing, false);
  } finally { stub.restore(); }
});
