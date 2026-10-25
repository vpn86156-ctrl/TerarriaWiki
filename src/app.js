import { Dungeon, formatTime } from "./engine.js";
import { Renderer } from "./render.js";
const $ = (id) => document.getElementById(id),
  canvas = $("game"),
  overlay = $("game-overlay");
const setText = (id, text) => {
  if ($(id).textContent !== String(text)) $(id).textContent = text;
};
const readJSON = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const save = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Private browsing can disallow persistence. The game still works. */
  }
};
const saved = readJSON("last-torch:best", null);
let best =
  typeof saved === "number" && Number.isFinite(saved) && saved > 0
    ? saved
    : null;
let soundEnabled = readJSON("last-torch:sound", false) === true,
  audio;
function sound(type) {
  if (!soundEnabled) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
    const notes = {
      key: [587, 880],
      secret: [440, 659, 880],
      heal: [523, 659],
      dash: [160, 95],
      hurt: [110, 75],
      win: [392, 523, 659, 784],
      level: [392, 587],
      notice: [220],
    }[type] || [330];
    notes.forEach((frequency, i) => {
      const o = audio.createOscillator(),
        gain = audio.createGain(),
        time = audio.currentTime + i * 0.085;
      o.type = type === "hurt" ? "triangle" : "sine";
      o.frequency.setValueAtTime(frequency, time);
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.055, time + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);
      o.connect(gain);
      gain.connect(audio.destination);
      o.start(time);
      o.stop(time + 0.18);
    });
  } catch {
    /* Audio is optional. */
  }
}
function updateSound() {
  setText("sound-label", soundEnabled ? "Звук вкл." : "Звук выкл.");
  $("sound-button").setAttribute(
    "aria-label",
    soundEnabled ? "Выключить звук" : "Включить звук",
  );
  $("sound-button").setAttribute("aria-pressed", String(soundEnabled));
}
function updateBest() {
  setText("best-time", best === null ? "Ещё впереди" : formatTime(best));
}
const keys = new Set(),
  touches = new Map();
let game,
  renderer,
  lastPhase = "",
  confirmRestart = false,
  lastHp = -1,
  newRecord = false;
function clearInput() {
  keys.clear();
  touches.clear();
  document
    .querySelectorAll("[data-dir]")
    .forEach((b) => b.classList.remove("pressed"));
}
function focusGame() {
  canvas.focus({ preventScroll: true });
}
function icon(name, stroke = false) {
  return `<svg class="icon${stroke ? " stroke-icon" : ""}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
}
function renderOverlay(s) {
  if (s.phase === "playing") {
    overlay.hidden = true;
    return;
  }
  overlay.hidden = false;
  let title,
    eyebrow,
    copy,
    action,
    label,
    caption = "",
    emblem = "torch",
    stroke = false,
    secondary = "",
    stats = "";
  if (s.phase === "intro") {
    eyebrow = "ТРИ ЭТАЖА. ОДИН ПУТЬ НАВЕРХ.";
    title = "Зажги свой факел.";
    copy =
      "Там, внизу, тебя ждут ключи, тайники и те, кто не хочет отпускать. Сумеешь найти выход?";
    action = "start";
    label = "Начать побег";
    caption = "WASD / стрелки · Пробел · E";
  }
  if (s.phase === "paused") {
    if (confirmRestart) {
      eyebrow = "НАЧАТЬ С ЧИСТОГО ЛИСТА";
      title = "Вернуться к началу?";
      copy = "Прогресс этого забега будет потерян. Личный рекорд останется.";
      action = "reset";
      label = "Да, новый побег";
      secondary =
        '<button class="secondary-button" data-action="cancel-reset">Нет, продолжить</button>';
    } else {
      eyebrow = "МОЖНО ПЕРЕВЕСТИ ДУХ";
      title = "Факел подождёт.";
      copy = "Подземелье никуда не денется. Продолжим с того же места.";
      action = "resume";
      label = "Продолжить";
      secondary =
        '<button class="secondary-button" data-action="confirm-reset">Начать новый побег</button>';
      caption = "Esc — вернуться в игру";
    }
  }
  if (s.phase === "dead") {
    eyebrow = "ЭТО ЕЩЁ НЕ КОНЕЦ";
    title = "Факел погас.";
    copy =
      "Теперь ты знаешь этот путь чуть лучше. Попробуй ещё раз — с начала текущего этажа.";
    action = "retry";
    label = "Зажечь снова";
    caption = `Попыток: ${s.deaths + 1} · Время забега продолжается`;
  }
  if (s.phase === "floor-clear") {
    eyebrow = `ЭТАЖ ${s.floor + 1} ПРОЙДЕН`;
    title = "На шаг ближе.";
    copy =
      s.floor === 0
        ? "Архив остался позади. Впереди — затопленный склеп. Сердца восстановлены на новом этаже."
        : "Ты почти у цели. Осталось сердце подземелья — и последняя дверь.";
    action = "next";
    label = "Следующий этаж";
    emblem = "key";
    stroke = true;
    caption = `Время забега: ${formatTime(s.elapsed)}`;
  }
  if (s.phase === "won") {
    eyebrow = newRecord ? "НОВЫЙ ЛИЧНЫЙ РЕКОРД" : "СВЕТ ПО ТУ СТОРОНУ";
    title = "Ты нашёл выход.";
    copy =
      "Три этажа позади. Факел всё ещё горит, а у этой истории теперь счастливый конец.";
    action = "reset";
    label = "Ещё одно приключение";
    caption = "Спасибо, что не сдался.";
    emblem = "gem";
    stroke = true;
    stats = `<div class="overlay-stats"><div><strong>${formatTime(s.elapsed)}</strong><span>время</span></div><div><strong>${s.secrets} / 3</strong><span>тайника</span></div><div><strong>${s.deaths + 1}</strong><span>попыток</span></div></div>`;
  }
  overlay.innerHTML = `<div class="overlay-card" role="group" aria-labelledby="overlay-title"><div class="overlay-emblem">${icon(emblem, stroke)}</div><span class="eyebrow">${eyebrow}</span><h2 id="overlay-title">${title}</h2><p>${copy}</p>${stats}<button class="primary-button" data-action="${action}">${label}${icon("arrow", true)}</button>${secondary}<span class="overlay-caption">${caption}</span></div>`;
  // Never steal initial page focus; put the next step within keyboard reach after play.
  if (s.phase !== "intro" && !$("help-dialog").open)
    overlay.querySelector(".primary-button").focus({ preventScroll: true });
}
function updateUI(s) {
  if (!game) return;
  const playing = s.phase === "playing",
    phaseChanged = lastPhase !== s.phase;
  if (!playing) clearInput();
  if (s.phase === "won" && phaseChanged) {
    newRecord = best === null || s.elapsed < best;
    if (newRecord) {
      best = s.elapsed;
      save("last-torch:best", best);
      updateBest();
    }
  }
  setText("floor-number", `${String(s.floor + 1).padStart(2, "0")} / 03`);
  setText("floor-name", s.name);
  setText("timer", formatTime(s.elapsed));
  setText("key-count", `${s.keys} / ${s.needed}`);
  setText("secret-count", `${s.secrets} / 3`);
  setText("mission-keys", `${s.keys} из ${s.needed}`);
  $("key-fill").style.width = `${(s.keys / s.needed) * 100}%`;
  if (s.hp !== lastHp) {
    $("health").innerHTML = Array.from(
      { length: 3 },
      (_, i) =>
        `<svg class="icon${i >= s.hp ? " empty" : ""}" aria-hidden="true"><use href="#i-heart"/></svg>`,
    ).join("");
    $("health").setAttribute("aria-label", `Здоровье: ${s.hp} из 3`);
    lastHp = s.hp;
  }
  setText(
    "game-message",
    s.message ||
      (s.keys === s.needed
        ? "Ключи собраны. Найди выход и нажми E."
        : "Исследуй комнаты. Ключи где-то рядом."),
  );
  setText("interact-label", s.context || "Действие");
  $("interact-button").classList.toggle("has-context", !!s.context);
  $("dash-button").disabled = !playing;
  $("interact-button").disabled = !playing;
  $("pause-button").disabled = !["playing", "paused"].includes(s.phase);
  $("pause-button").setAttribute(
    "aria-label",
    s.phase === "paused" ? "Продолжить игру" : "Пауза",
  );
  document
    .querySelectorAll("[data-dir]")
    .forEach((b) => (b.disabled = !playing));
  const descriptions = [
    "Исследуй архив, найди два ключа и доберись до запертого выхода.",
    "Найди два ключа в склепе. Следи за шипами и не подпускай стражей близко.",
    "Три ключа откроют последнюю дверь. Поверхность совсем рядом.",
  ];
  $("mission-title").innerHTML =
    s.keys === s.needed
      ? "Пора увидеть<br>дневной свет."
      : "У каждой двери<br>есть свой ключ.";
  setText(
    "mission-copy",
    s.keys === s.needed
      ? "Все ключи у тебя. Найди ворота, подойди ближе и нажми «Действие»."
      : descriptions[s.floor],
  );
  document.querySelector(".mission-symbol>span").textContent = String(
    s.floor + 1,
  ).padStart(2, "0");
  document.querySelectorAll("[data-floor]").forEach((li) => {
    const n = Number(li.dataset.floor);
    li.classList.toggle("current", n === s.floor);
    li.classList.toggle("completed", n < s.floor || s.phase === "won");
    if (n === s.floor) li.setAttribute("aria-current", "step");
    else li.removeAttribute("aria-current");
  });
  setText(
    "field-note-text",
    [
      "Не всё, что выглядит стеной, ею является. Приглядись к трещинам.",
      "Шипы сначала светятся золотом. Пережди вспышку и двигайся, когда плиты потемнеют.",
      "Сердца дороже спешки. Источник с водой поможет, если здоровье на исходе.",
    ][s.floor],
  );
  if (phaseChanged) {
    confirmRestart = false;
    renderOverlay(s);
    if (playing) {
      focusGame();
      if (renderer) renderer.snap = true;
    }
  }
  lastPhase = s.phase;
}
game = new Dungeon({ onChange: updateUI, onEvent: sound });
renderer = new Renderer(canvas, game);
updateUI(game.snapshot());
updateSound();
updateBest();
overlay.addEventListener("click", (e) => {
  const action = e.target.closest("[data-action]")?.dataset.action;
  if (!action) return;
  clearInput();
  if (action === "confirm-reset") {
    confirmRestart = true;
    renderOverlay(game.snapshot());
  } else if (action === "cancel-reset") {
    confirmRestart = false;
    renderOverlay(game.snapshot());
  } else if (action === "reset") {
    game.reset();
  } else if (["start", "resume", "retry", "next"].includes(action)) {
    sound("notice");
    game[action]();
  }
});
$("pause-button").addEventListener("click", () =>
  game.phase === "paused" ? game.resume() : game.pause(),
);
$("dash-button").addEventListener("click", () => {
  game.dash();
  focusGame();
});
$("interact-button").addEventListener("click", () => {
  game.interact();
  if (game.phase === "playing") focusGame();
});
$("sound-button").addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  save("last-torch:sound", soundEnabled);
  updateSound();
  if (soundEnabled) sound("key");
  if (game.phase === "playing") focusGame();
});
let resumeAfterHelp = false;
function showHelp() {
  resumeAfterHelp = game.phase === "playing";
  if (resumeAfterHelp) game.pause();
  clearInput();
  $("help-dialog").showModal();
}
$("help-button").addEventListener("click", showHelp);
$("help-bottom").addEventListener("click", showHelp);
$("close-help").addEventListener("click", () => $("help-dialog").close());
$("help-play").addEventListener("click", () => $("help-dialog").close());
$("help-dialog").addEventListener("click", (e) => {
  if (e.target === $("help-dialog")) {
    const r = e.target.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      e.target.close();
  }
});
$("help-dialog").addEventListener("close", () => {
  if (resumeAfterHelp) {
    resumeAfterHelp = false;
    game.resume();
  } else if (game.phase === "playing") focusGame();
});
const movementCodes = [
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowLeft",
  "ArrowDown",
  "ArrowRight",
];
window.addEventListener("keydown", (e) => {
  if ($("help-dialog").open) return;
  if (e.code === "Escape") {
    if (["playing", "paused"].includes(game.phase)) {
      e.preventDefault();
      clearInput();
      game.phase === "playing" ? game.pause() : game.resume();
    }
    return;
  }
  if (
    game.phase !== "playing" ||
    e.target.closest("button,a,input,textarea,select")
  )
    return;
  if (movementCodes.includes(e.code)) {
    e.preventDefault();
    keys.add(e.code);
  }
  if (e.code === "Space") {
    e.preventDefault();
    if (!e.repeat) game.dash();
  }
  if (e.code === "KeyE") {
    e.preventDefault();
    if (!e.repeat) game.interact();
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => {
  clearInput();
  game.pause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clearInput();
    game.pause();
  }
});
canvas.addEventListener("pointerdown", () => {
  if (game.phase === "playing") focusGame();
});
document.querySelectorAll("[data-dir]").forEach((button) => {
  button.addEventListener("pointerdown", (e) => {
    if (game.phase !== "playing") return;
    e.preventDefault();
    button.setPointerCapture(e.pointerId);
    touches.set(e.pointerId, button.dataset.dir.split(",").map(Number));
    button.classList.add("pressed");
  });
  const release = (e) => {
    touches.delete(e.pointerId);
    button.classList.remove("pressed");
  };
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
});
function input() {
  let x =
      Number(keys.has("KeyD") || keys.has("ArrowRight")) -
      Number(keys.has("KeyA") || keys.has("ArrowLeft")),
    y =
      Number(keys.has("KeyS") || keys.has("ArrowDown")) -
      Number(keys.has("KeyW") || keys.has("ArrowUp"));
  for (const [dx, dy] of touches.values()) {
    x += dx;
    y += dy;
  }
  return { x, y };
}
let last = performance.now();
function frame(now) {
  game.tick((now - last) / 1000, input());
  last = now;
  const ready = game.dashCooldown <= 0;
  $("dash-fill").style.transform =
    `scaleX(${Math.max(0, 1 - game.dashCooldown / 1.8)})`;
  setText("dash-state", ready ? "Готов" : `${game.dashCooldown.toFixed(1)} с`);
  $("dash-button").setAttribute(
    "aria-label",
    ready ? "Рывок — готов" : `Рывок перезаряжается`,
  );
  renderer.render(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// Retire the old wiki's worker without registering a cache for the new game.
if ("serviceWorker" in navigator)
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      for (const registration of registrations) {
        const url = registration.active?.scriptURL;
        if (
          url &&
          new URL(url).origin === location.origin &&
          new URL(url).pathname === new URL("./sw.js", location.href).pathname
        )
          registration.update().catch(() => {});
      }
    })
    .catch(() => {});
