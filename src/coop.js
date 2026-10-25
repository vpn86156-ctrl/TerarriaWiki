import { COOP_SERVER } from "./coop-config.js";
export function initCoop({
  button,
  game,
  openDialog,
  profile,
  clearInput,
  sound,
}) {
  const dialog = document.createElement("dialog");
  dialog.id = "coop-dialog";
  dialog.className = "coop-dialog";
  dialog.setAttribute("aria-labelledby", "coop-title");
  document.body.append(dialog);
  const put = (node, text) => {
    if (node.textContent !== text) node.textContent = text;
  };
  const awarded = new Set();
  let noticeUntil = 0,
    smoothed = [],
    visualRound;
  let socket,
    state,
    index = 0,
    host = false,
    code = "",
    round = "",
    frame = 0,
    lastSend = 0,
    notice = "",
    closing = false;
  const pressed = new Set(),
    pointers = new Map();
  let dash = false,
    interact = false;
  const stopInput = () => {
    pressed.clear();
    pointers.clear();
    dash = false;
    interact = false;
    if (socket?.readyState === 1)
      socket.send(JSON.stringify({ type: "input", x: 0, y: 0 }));
  };
  function endpoint() {
    const invitedServer = new URL(location.href).searchParams.get("server");
    if (invitedServer) return invitedServer;
    if (COOP_SERVER) return COOP_SERVER;
    try {
      const saved = localStorage.getItem("last-torch:coop-server");
      if (saved) return saved;
    } catch {}
    return location.hostname.endsWith("github.io")
      ? ""
      : `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/socket`;
  }
  function lobby() {
    const invited =
      new URL(location.href).searchParams
        .get("room")
        ?.replace(/[^a-fA-F0-9]/g, "")
        .slice(0, 6) || "";
    dialog.innerHTML = `<button class="close-dialog" data-leave aria-label="Закрыть кооператив">×</button><span class="eyebrow">ДВА ПУТНИКА. ОДИН ВЫХОД.</span><h2 id="coop-title">Не гаси второй огонь.</h2><p>Два отдельных испытания для двоих: одновременно активируйте плиты, соберите ключи и выйдите вместе. Упавшего друга можно поднять кнопкой действия.</p><div class="coop-form"><label>Имя путника<input id="coop-name" maxlength="20" value="Путник" autocomplete="nickname"></label><label>Сервер комнат<input id="coop-server" placeholder="wss://ваш-сервер/socket" type="url"></label><small>На GitHub Pages нужен отдельный сервер. Если адрес ещё не настроен, онлайн-режим недоступен. Одиночная игра работает независимо.</small><div class="coop-join"><label>Код комнаты<input id="coop-code" maxlength="6" placeholder="A1B2C3" autocapitalize="characters" spellcheck="false"></label><button class="primary-button" data-join>Присоединиться</button></div><button class="primary-button" data-create>Создать комнату</button></div><p id="coop-status" role="status"></p>`;
    dialog.querySelector("#coop-server").value = endpoint();
    dialog.querySelector("#coop-code").value = invited;
  }
  function status(text) {
    notice = text;
    noticeUntil = Date.now() + 3500;
    const el = dialog.querySelector("#coop-status");
    if (el) el.textContent = text;
  }
  function send(data) {
    if (socket?.readyState === 1) socket.send(JSON.stringify(data));
  }
  function connect(type) {
    if (socket && [0, 1].includes(socket.readyState)) return;
    let url;
    try {
      url = new URL(dialog.querySelector("#coop-server").value);
      if (
        !["ws:", "wss:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw 0;
      if (location.protocol === "https:" && url.protocol !== "wss:") throw 0;
    } catch {
      status(
        "Укажи адрес сервера wss://…/socket. Сервер нужно сначала разместить отдельно.",
      );
      return;
    }
    const name = dialog.querySelector("#coop-name").value.trim() || "Путник",
      joinCode = dialog.querySelector("#coop-code").value.toUpperCase().trim();
    if (type === "join" && !/^[A-F0-9]{6}$/.test(joinCode)) {
      status("Введи шестизначный код комнаты.");
      return;
    }
    try {
      localStorage.setItem("last-torch:coop-server", url.href);
    } catch {}
    closing = false;
    status("Соединяемся с сервером…");
    socket = new WebSocket(url.href);
    const active = socket;
    const timeout = setTimeout(() => {
      if (active.readyState === 0) {
        active.close();
        status("Сервер не отвечает. Проверь адрес и подключение.");
      }
    }, 8000);
    socket.onopen = () => {
      if (socket !== active) {
        active.close();
        return;
      }
      clearTimeout(timeout);
      send({ type, name, code: joinCode });
    };
    socket.onerror = () =>
      socket === active &&
      status(
        "Не удалось подключиться. Нужен работающий WebSocket-сервер с HTTPS.",
      );
    socket.onclose = () => {
      clearTimeout(timeout);
      if (socket !== active) return;
      stopInput();
      if (!closing)
        status("Соединение закрыто. Закрой окно и подключись снова.");
      cancelAnimationFrame(frame);
    };
    socket.onmessage = (e) => {
      if (socket !== active || !dialog.open) return;
      let m;
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      if (m.type === "error") {
        status(m.message);
        closing = true;
        socket.close();
        return;
      }
      if (m.type === "notice") {
        status(m.message);
        return;
      }
      if (m.type !== "state") return;
      const first = !dialog.querySelector("#coop-world");
      const oldPhase = state?.phase;
      state = m.state;
      index = m.index;
      host = m.host;
      code = m.code;
      round = m.round;
      if (first) {
        roomUI();
        noticeUntil = 0;
      }
      if (state?.phase === "playing" && oldPhase !== "playing")
        dialog.querySelector("#coop-canvas").focus({ preventScroll: true });
      const info = dialog.querySelector("#coop-room-info");
      put(
        info,
        `Комната ${code} · ${m.names.join(" + ")} · ${m.names.length}/2`,
      );
      dialog.querySelector("[data-start]").hidden =
        !host || m.names.length < 2 || state?.phase === "playing";
      put(
        dialog.querySelector("[data-start]"),
        state?.phase === "won"
          ? "Следующее испытание"
          : state?.phase === "dead"
            ? "Попробовать снова"
            : "Начать вдвоём",
      );
      if (Date.now() >= noticeUntil)
        put(
          dialog.querySelector("#coop-status"),
          !state
            ? m.names.length === 1
              ? "Ждём друга. Отправь ему ссылку или код комнаты."
              : "Оба на месте. Хозяин комнаты может начать."
            : state.phase === "won"
              ? "Вы прошли испытание! +120 монет каждому."
              : state.phase === "dead"
                ? "Оба факела погасли. Начните испытание заново."
                : !state.gateOpen
                  ? "Встаньте на две плиты одновременно на одну секунду."
                  : state.keys.some((k) => !k.taken)
                    ? "Ворота открыты. Соберите оба ключа."
                    : "Подойдите к выходу вместе. Один из вас должен нажать действие.",
        );
      if (state?.phase === "won" && !awarded.has(round)) {
        awarded.add(round);
        profile.earn(120);
        window.dispatchEvent(new Event("profile-change"));
        sound("win");
      }
      if (state)
        put(
          dialog.querySelector("#coop-hud"),
          `${state.name} · Ты: ${index + 1} · Здоровье ${state.players[index].hp}/3 · Ключи ${state.keys.filter((k) => k.taken).length}/2`,
        );
      if (!frame) frame = requestAnimationFrame(loop);
    };
  }
  function roomUI() {
    stopInput();
    dialog.innerHTML = `<button class="close-dialog" data-leave aria-label="Выйти из комнаты">×</button><span class="eyebrow">ОНЛАЙН-КООПЕРАТИВ</span><h2 id="coop-title">Два огня</h2><div class="coop-room-row"><span id="coop-room-info"></span><button data-invite>Скопировать приглашение</button></div><div id="coop-hud">Ждём напарника</div><div class="coop-world" id="coop-world"><canvas id="coop-canvas" tabindex="0" aria-label="Кооперативное подземелье. WASD или стрелки, пробел — рывок, E — поднять друга или открыть выход."></canvas></div><div class="coop-controls"><div class="coop-dpad">${[
      ["0,-1", "↑"],
      ["-1,0", "←"],
      ["0,1", "↓"],
      ["1,0", "→"],
    ]
      .map(
        ([dir, label]) =>
          `<button data-coop-dir="${dir}" aria-label="${{ "↑": "Вверх", "←": "Влево", "↓": "Вниз", "→": "Вправо" }[label]}">${label}</button>`,
      )
      .join(
        "",
      )}</div><button data-coop-dash>Рывок</button><button data-coop-action>Действие</button><button class="primary-button" data-start>Начать вдвоём</button></div><p id="coop-status" role="status"></p><small>WASD / стрелки · Пробел — рывок · E — действие. Паузы в сети нет. Чтобы поднять друга, подойди к нему и нажми действие.</small>`;
    dialog.querySelectorAll("[data-coop-dir]").forEach((b) => {
      b.onpointerdown = (e) => {
        e.preventDefault();
        b.setPointerCapture(e.pointerId);
        pointers.set(e.pointerId, b.dataset.coopDir.split(",").map(Number));
      };
      const up = (e) => pointers.delete(e.pointerId);
      b.onpointerup = up;
      b.onpointercancel = up;
      b.onlostpointercapture = up;
    });
    dialog.querySelector("#coop-canvas").focus({ preventScroll: true });
  }
  async function invite() {
    const url = new URL(location.href);
    url.searchParams.set("room", code);
    if (socket?.url) url.searchParams.set("server", socket.url);
    const target = dialog.querySelector("#coop-status");
    try {
      await navigator.clipboard.writeText(url.href);
      status("Ссылка скопирована: в ней уже есть код и адрес сервера.");
    } catch {
      status(`Код комнаты: ${code}. Отправь его другу и сообщи адрес сервера.`);
    }
  }
  dialog.addEventListener("click", (e) => {
    if (e.target.closest("[data-leave]")) dialog.close();
    if (e.target.closest("[data-create]")) connect("create");
    if (e.target.closest("[data-join]")) connect("join");
    if (e.target.closest("[data-start]")) send({ type: "start" });
    if (e.target.closest("[data-invite]")) invite();
    if (e.target.closest("[data-coop-dash]")) dash = true;
    if (e.target.closest("[data-coop-action]")) interact = true;
  });
  dialog.addEventListener("keydown", (e) => {
    if (
      e.target.matches("input") ||
      (e.code === "Space" && e.target.closest("button"))
    )
      return;
    if (
      [
        "KeyW",
        "KeyA",
        "KeyS",
        "KeyD",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Space",
        "KeyE",
      ].includes(e.code)
    ) {
      e.preventDefault();
      pressed.add(e.code);
      if (!e.repeat && e.code === "Space") dash = true;
      if (!e.repeat && e.code === "KeyE") interact = true;
    }
  });
  window.addEventListener("keyup", (e) => pressed.delete(e.code));
  window.addEventListener("blur", stopInput);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopInput();
  });
  for (const type of ["contextmenu", "selectstart", "dragstart"])
    dialog.addEventListener(type, (e) => {
      if (!e.target.matches("input")) e.preventDefault();
    });
  dialog.addEventListener("close", () => {
    closing = true;
    stopInput();
    socket?.close();
    socket = null;
    cancelAnimationFrame(frame);
    frame = 0;
    state = null;
    clearInput();
  });
  button.onclick = () => {
    lobby();
    openDialog(dialog);
  };
  if (
    /^[a-fA-F0-9]{6}$/.test(
      new URL(location.href).searchParams.get("room") || "",
    )
  ) {
    lobby();
    openDialog(dialog);
  }
  function loop(now) {
    if (!dialog.open) return;
    frame = requestAnimationFrame(loop);
    if (now - lastSend > 50) {
      lastSend = now;
      let x =
          Number(pressed.has("KeyD") || pressed.has("ArrowRight")) -
          Number(pressed.has("KeyA") || pressed.has("ArrowLeft")),
        y =
          Number(pressed.has("KeyS") || pressed.has("ArrowDown")) -
          Number(pressed.has("KeyW") || pressed.has("ArrowUp"));
      for (const [dx, dy] of pointers.values()) {
        x += dx;
        y += dy;
      }
      send({ type: "input", x, y, dash, interact });
      dash = false;
      interact = false;
    }
    draw(now / 1000);
  }
  function draw(t) {
    const canvas = dialog.querySelector("#coop-canvas");
    if (!canvas) return;
    const c = canvas.getContext("2d"),
      w = canvas.clientWidth,
      h = canvas.clientHeight;
    if (!w || !h) return;
    if (
      canvas.width !== Math.round(w * devicePixelRatio) ||
      canvas.height !== Math.round(h * devicePixelRatio)
    ) {
      canvas.width = Math.round(w * devicePixelRatio);
      canvas.height = Math.round(h * devicePixelRatio);
    }
    c.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    c.fillStyle = "#091719";
    c.fillRect(0, 0, w, h);
    if (!state) {
      c.fillStyle = "#9cbcac";
      c.font = "14px Arial";
      c.textAlign = "center";
      c.fillText("Здесь появится ваше испытание", w / 2, h / 2);
      return;
    }
    const z = Math.min(w / (23 * 32), h / (15 * 32));
    c.save();
    c.translate((w - 23 * 32 * z) / 2, (h - 15 * 32 * z) / 2);
    c.scale(z, z);
    c.imageSmoothingEnabled = false;
    for (let y = 0; y < 15; y++)
      for (let x = 0; x < 23; x++) {
        const tile = state.map[y][x];
        c.fillStyle =
          tile === "."
            ? (x + y) % 2
              ? "#1c3435"
              : "#203839"
            : tile === "G"
              ? "#c4aa71"
              : "#3c5450";
        c.fillRect(x * 32 + 1, y * 32 + 1, 30, 30);
        if (tile === "#") {
          c.fillStyle = "#658074";
          c.fillRect(x * 32 + 2, y * 32 + 2, 28, 3);
        }
      }
    for (const s of state.spikes) {
      c.fillStyle =
        s.state === "active"
          ? "#df9d82"
          : s.state === "warning"
            ? "#e5c078"
            : "#526d66";
      for (let x = -9; x < 12; x += 6)
        c.fillRect(
          s.x + x,
          s.y - (s.state === "active" ? 10 : 1),
          3,
          s.state === "active" ? 20 : 3,
        );
    }
    for (const p of state.plates) {
      c.fillStyle = p.active ? "#a8e4bc" : "#8b754c";
      c.fillRect(p.x - 13, p.y - 13, 26, 26);
      c.fillStyle = "#24453c";
      c.fillRect(p.x - 9, p.y - 9, 18, 18);
      c.fillStyle = p.active ? "#a8e4bc" : "#c4a770";
      c.fillRect(p.x - 4, p.y - 4, 8, 8);
    }
    c.fillStyle = state.gateOpen ? "#c0eab6" : "#836f4c";
    c.fillRect(state.exit.x - 13, state.exit.y - 13, 26, 26);
    for (const k of state.keys)
      if (!k.taken) {
        c.strokeStyle = "#f0d397";
        c.lineWidth = 3;
        c.beginPath();
        c.arc(k.x - 3, k.y - 3, 5, 0, Math.PI * 2);
        c.moveTo(k.x, k.y);
        c.lineTo(k.x + 9, k.y + 9);
        c.stroke();
      }
    if (visualRound !== round) {
      visualRound = round;
      smoothed = [];
    }
    state.players.forEach((p, i) => {
      const v = (smoothed[i] ||= { x: p.x, y: p.y });
      const jump = Math.hypot(v.x - p.x, v.y - p.y) > 100;
      if (jump) {
        v.x = p.x;
        v.y = p.y;
      } else {
        v.x += (p.x - v.x) * 0.35;
        v.y += (p.y - v.y) * 0.35;
      }
      c.save();
      c.translate(v.x, v.y);
      c.fillStyle = "#07191b";
      c.fillRect(-11, 8, 22, 5);
      c.globalAlpha = p.hp <= 0 ? 0.35 : p.inv > 0 ? 0.65 : 1;
      c.fillStyle = i === 0 ? "#72b8a3" : "#c398d7";
      c.fillRect(-9, -11, 18, 20);
      c.fillStyle = "#12282b";
      c.fillRect(-5, -6, 10, 5);
      c.fillStyle = "#fff2bd";
      c.fillRect(-3, -5, 2, 2);
      c.fillRect(2, -5, 2, 2);
      c.fillStyle = "#c3a477";
      c.fillRect(-6, 9, 4, 5);
      c.fillRect(2, 9, 4, 5);
      c.font = "11px Arial";
      c.textAlign = "center";
      c.fillStyle = "#e8dcb3";
      c.fillText(p.hp <= 0 ? "E ↑" : String(i + 1), 0, -18);
      c.restore();
    });
    c.restore();
  }
}
