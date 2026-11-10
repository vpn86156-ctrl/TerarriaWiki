/* Звук синтезируется на WebAudio — ни одного внешнего файла.
   Звук не включается сам: первый запуск происходит по действию пользователя. */
let ctx = null, master = null, ambGain = null, ambNodes = [];
let enabled = true, ambienceOn = false, unlocked = false;

function ensure(){
  if(ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if(!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  return ctx;
}

export function unlock(){
  if(unlocked) return;
  const c = ensure();
  if(!c) return;
  if(c.state === 'suspended') c.resume();
  unlocked = true;
}
export function setEnabled(v){
  enabled = !!v;
  if(master) master.gain.value = enabled ? 0.5 : 0;
  if(!enabled) stopAmbience();
}
export function isEnabled(){ return enabled; }

function noiseBuffer(sec = 0.4){
  const c = ensure(); if(!c) return null;
  const len = Math.floor(c.sampleRate * sec);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for(let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  return buf;
}

function tone({ freq = 440, to = null, dur = 0.18, type = 'sine', gain = 0.2, delay = 0 }){
  const c = ensure(); if(!c || !enabled) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if(to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function burst({ dur = 0.16, freq = 900, q = 1.2, gain = 0.22, type = 'lowpass', delay = 0 }){
  const c = ensure(); if(!c || !enabled) return;
  const buf = noiseBuffer(dur);
  if(!buf) return;
  const t = c.currentTime + delay;
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t); src.stop(t + dur + 0.02);
}

export const sfx = {
  hit(){
    burst({ dur:0.13, freq:1500, q:0.9, gain:0.20, type:'bandpass' });
    tone({ freq:150, to:70, dur:0.12, type:'triangle', gain:0.16 });
  },
  crit(){
    burst({ dur:0.2, freq:2600, q:0.7, gain:0.24, type:'bandpass' });
    tone({ freq:820, to:280, dur:0.22, type:'sawtooth', gain:0.15 });
    tone({ freq:1240, to:420, dur:0.26, type:'sine', gain:0.12, delay:0.02 });
  },
  hurt(){ tone({ freq:220, to:90, dur:0.16, type:'square', gain:0.08 }); },
  bossDeath(){
    tone({ freq:120, to:34, dur:0.9, type:'sawtooth', gain:0.22 });
    burst({ dur:0.9, freq:420, q:0.5, gain:0.2, type:'lowpass' });
    tone({ freq:300, to:80, dur:0.6, type:'triangle', gain:0.14, delay:0.06 });
  },
  coin(){ tone({ freq:1180, to:1580, dur:0.09, type:'sine', gain:0.1 });
          tone({ freq:1760, dur:0.08, type:'sine', gain:0.06, delay:0.05 }); },
  loot(){ tone({ freq:640, to:960, dur:0.2, type:'triangle', gain:0.13 }); },
  legendary(){
    [523,659,784,1047].forEach((f,i) => tone({ freq:f, dur:0.5, type:'sine', gain:0.12, delay:i*0.08 }));
    tone({ freq:2093, dur:0.9, type:'sine', gain:0.05, delay:0.3 });
  },
  levelUp(){
    [392,523,659,880].forEach((f,i) => tone({ freq:f, dur:0.34, type:'triangle', gain:0.13, delay:i*0.075 }));
  },
  buy(){ tone({ freq:520, to:760, dur:0.11, type:'square', gain:0.08 }); },
  click(){ tone({ freq:340, dur:0.05, type:'square', gain:0.05 }); },
  ui(){ tone({ freq:440, to:560, dur:0.09, type:'sine', gain:0.07 }); },
  error(){ tone({ freq:180, to:120, dur:0.16, type:'square', gain:0.09 }); },
};

/* Атмосферный фон: низкий дрон +Filtered noise. Выключен по умолчанию. */
export function startAmbience(){
  const c = ensure(); if(!c || !enabled || ambienceOn) return;
  ambGain = c.createGain(); ambGain.gain.value = 0; ambGain.connect(master);
  ambGain.gain.linearRampToValueAtTime(0.06, c.currentTime + 3);

  const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = 55;
  const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = 82.5;
  const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.07;
  const lfoGain = c.createGain(); lfoGain.gain.value = 6;
  lfo.connect(lfoGain); lfoGain.connect(o.frequency);

  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
  o.connect(f); o2.connect(f); f.connect(ambGain);

  o.start(); o2.start(); lfo.start();
  ambNodes = [o, o2, lfo];
  ambienceOn = true;
}
export function stopAmbience(){
  if(!ambienceOn || !ctx) return;
  const t = ctx.currentTime;
  if(ambGain) ambGain.gain.linearRampToValueAtTime(0, t + 0.6);
  ambNodes.forEach(n => { try{ n.stop(t + 0.7); }catch(e){} });
  ambNodes = []; ambienceOn = false;
}
export function isAmbience(){ return ambienceOn; }
