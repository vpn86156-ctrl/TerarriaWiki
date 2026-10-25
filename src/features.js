import { profile, ITEMS, RARITIES, CASE_PRICE } from "./profile.js";
import { initCoop } from "./coop.js";
const rarity = (id) => RARITIES.find((r) => r.id === id);
export function itemArt(item) {
  return item.slot === "skin"
    ? `<svg viewBox="0 0 64 64" aria-hidden="true" class="item-art" shape-rendering="crispEdges"><ellipse cx="32" cy="55" rx="17" ry="4" fill="#071819"/><path d="M20 24h24l5 29H15z" fill="${item.color}" opacity=".7"/><path d="M21 42h8v14h-8zm14 0h8v14h-8z" fill="#645e4b"/><path d="M20 24h24v22H20zM23 10h18v6H23zM18 16h28v15H18z" fill="${item.color}"/><path d="M23 21h18v10H23z" fill="#14282c"/><path d="M26 24h3v3h-3zm9 0h3v3h-3z" fill="#f6e7ba"/><path d="M45 27h4v22h-4z" fill="#a48b61"/><path d="M43 17h8v12h-8z" fill="#f5c36b"/><path d="M46 13h3v10h-3z" fill="#fff0bd"/></svg>`
    : `<svg viewBox="0 0 64 64" class="item-art" aria-hidden="true" shape-rendering="crispEdges"><ellipse cx="32" cy="55" rx="23" ry="4" fill="#071819"/><path d="M10 18h16v23h9v13H7V40h3zm30-6h14v23h7v12H36V33h4z" fill="${item.color}"/><path d="M10 18h16v5H10zm30-6h14v5H40z" fill="#eee1b5"/><path d="M7 50h28v5H7zm29-7h25v5H36z" fill="#3b4640"/><path d="M17 28h6v3h-6zm0 6h6v3h-6zm28-12h6v3h-6zm0 6h6v3h-6z" fill="#f7e2b2"/></svg>`;
}
export function initFeatures({
  game,
  renderer,
  clearInput,
  focusGame,
  input,
  sound,
}) {
  const bar = document.createElement("div");
  bar.className = "feature-bar";
  bar.innerHTML = `<div class="wallet" title="Монеты за завершённые этажи"><span>◉</span> <strong id="wallet-coins">0</strong><small>МОНЕТЫ</small></div><div class="feature-actions"><button id="collection-button">◈ <span>Коллекция</span></button><button id="coop-button">♟ <span>Вдвоём</span></button><button id="install-button">↓ <span>Установить</span></button></div>`;
  document.querySelector(".intro-heading").after(bar);
  const fullscreen = document.createElement("button");
  fullscreen.id = "fullscreen-button";
  fullscreen.className = "square-button";
  fullscreen.innerHTML = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg>`;
  fullscreen.setAttribute("aria-label", "Полный экран");
  document.querySelector(".game-vitals").append(fullscreen);
  fullscreen.onclick = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      await document.querySelector(".game-shell").requestFullscreen();
      try {
        await screen.orientation?.lock?.("landscape");
      } catch {}
    } catch {
      showInstall(
        "Поверни телефон горизонтально. Если браузер не поддерживает полный экран, игра всё равно подстроится под положение устройства.",
      );
    }
  };
  const collection = document.createElement("dialog");
  collection.className = "collection-dialog";
  collection.id = "collection-dialog";
  collection.setAttribute("aria-labelledby", "collection-title");
  document.body.append(collection);
  let tab = "skin",
    opening = false,
    lastDrop = null;
  function balance() {
    document.getElementById("wallet-coins").textContent = profile.coins;
    document
      .querySelectorAll("[data-wallet]")
      .forEach((e) => (e.textContent = profile.coins));
  }
  balance();
  window.addEventListener("profile-change", balance);
  function openDialog(dialog) {
    const resume = game.phase === "playing";
    if (resume) game.pause();
    clearInput();
    dialog.showModal();
    dialog.addEventListener(
      "close",
      () => {
        clearInput();
        if (resume && game.phase === "paused") game.resume();
      },
      { once: true },
    );
  }
  function renderCollection() {
    collection.innerHTML = `<header class="collection-header"><div><span class="eyebrow">СНАРЯЖЕНИЕ ПУТЕШЕСТВЕННИКА</span><h2 id="collection-title">Твой свет. Твой стиль.</h2></div><button class="close-dialog" data-close aria-label="Закрыть коллекцию">×</button></header><div class="collection-meta"><span>◉ <b data-wallet>${profile.coins}</b> монет</span><small>${profile.owned.size} / ${ITEMS.length} предметов</small></div><nav class="collection-tabs" aria-label="Категории коллекции">${[
      ["skin", "Скины"],
      ["boots", "Ботинки"],
      ["cases", "Кейсы"],
    ]
      .map(
        ([id, name]) =>
          `<button data-tab="${id}" aria-pressed="${id === tab}">${name}</button>`,
      )
      .join("")}</nav><div id="collection-content">${
      tab === "cases"
        ? caseMarkup()
        : `<p class="collection-note">Эффекты применятся с начала следующего этажа или попытки. Надеть можно один скин и одни ботинки.</p><div class="item-grid">${ITEMS.filter(
            (i) => i.slot === tab,
          )
            .map((item) => {
              const r = rarity(item.rarity),
                owned = profile.owned.has(item.id),
                equipped = profile.equipped[tab] === item.id;
              return `<article class="item-card ${owned ? "" : "locked"}" style="--rarity:${r.color}"><span class="rarity-label">${r.name}</span>${itemArt(item)}<h3>${item.name}</h3><p>${item.effect}</p><button data-equip="${item.id}" ${!owned || equipped ? "disabled" : ""}>${equipped ? "✓ Надето" : owned ? "Надеть" : "Из кейса"}</button></article>`;
            })
            .join("")}</div>`
    }</div><p class="storage-note">${profile.persistent ? "Коллекция хранится только в этом браузере. Очистка данных удалит её." : "Браузер запретил сохранение. Коллекция доступна только до закрытия страницы."} Покупок за реальные деньги нет.</p>`;
  }
  function caseMarkup() {
    return `<div class="case-layout"><div class="case-hero ${opening ? "opening" : ""}"><div class="case-box"><span>✦</span></div><span class="eyebrow">СУНДУК ЗАБЫТЫХ ИСТОРИЙ</span><h3>Новая находка ждёт.</h3><p>Один скин или пара ботинок.<br>Все четыре редкости — в одном кейсе.</p><button class="primary-button" data-open-case ${opening || profile.coins < CASE_PRICE ? "disabled" : ""}>${opening ? "Открываем…" : `Открыть за ${CASE_PRICE} ◉`}</button><small>${profile.coins < CASE_PRICE ? "Проходи этажи, чтобы заработать монеты." : "Награда сохраняется сразу, даже если закрыть окно."}</small></div><div class="case-info"><h3>Честные шансы</h3>${RARITIES.map((r) => `<div class="odds-row" style="--rarity:${r.color}"><span>${r.name}</span><b>${r.chance}%</b></div>`).join("")}<p>Внутри редкости предметы равновероятны. Дубликаты возвращают 15 / 30 / 60 / 100 монет соответственно.</p><h3>Как заработать</h3><p>Этаж: <b>60 ◉</b><br>Без ранений: <b>+20 ◉</b><br>Каждая искра: <b>+5 ◉</b><br>Тайник этажа: <b>+25 ◉</b><br>Полный побег: <b>+100 ◉</b></p></div></div><div class="case-result" id="case-result" role="status" aria-live="polite">${lastDrop ? dropMarkup(lastDrop) : ""}</div>`;
  }
  function dropMarkup(drop) {
    return `<div class="drop-reveal" style="--rarity:${drop.rarity.color}">${itemArt(drop.item)}<div><span class="rarity-label">${drop.rarity.name} · ${drop.item.slot === "skin" ? "Скин" : "Ботинки"}</span><h3>${drop.item.name}</h3><p>${drop.item.effect}</p><small>${drop.duplicate ? `Дубликат · возвращено ${drop.refund} ◉` : "Новый предмет в коллекции"}</small></div></div>`;
  }
  document.getElementById("collection-button").onclick = () => {
    renderCollection();
    openDialog(collection);
  };
  collection.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) collection.close();
    const next = e.target.closest("[data-tab]")?.dataset.tab;
    if (next) {
      tab = next;
      renderCollection();
    }
    const id = e.target.closest("[data-equip]")?.dataset.equip;
    if (id && profile.equip(id)) {
      sound("heal");
      renderCollection();
    }
    if (e.target.closest("[data-open-case]") && !opening) {
      const drop = profile.openCase();
      if (!drop) return;
      opening = true;
      lastDrop = null;
      balance();
      renderCollection();
      sound("secret");
      setTimeout(
        () => {
          opening = false;
          lastDrop = drop;
          if (tab === "cases") renderCollection();
          sound("win");
        },
        matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1600,
      );
    }
  });
  const install = document.createElement("dialog");
  install.className = "help-dialog";
  install.id = "install-dialog";
  document.body.append(install);
  let promptEvent;
  function showInstall(message) {
    install.innerHTML = `<button class="close-dialog" aria-label="Закрыть">×</button><span class="eyebrow">ИГРА ВСЕГДА ПОД РУКОЙ</span><h2>Установи свой факел.</h2><p>${message || "Android / Chrome: открой меню браузера → «Установить приложение» или «Добавить на главный экран».<br><br>iPhone / iPad: открой сайт в Safari → «Поделиться» → «На экран Домой».<br><br>На компьютере: значок установки в адресной строке Chrome / Edge или пункт установки в меню."}</p><p class="help-footnote">После первого открытия с интернетом одиночная игра работает офлайн. Для кооператива нужен интернет и доступный сервер. Установка может быть недоступна внутри встроенного браузера мессенджера — открой сайт в обычном браузере.</p><button class="primary-button">Понятно</button>`;
    install
      .querySelectorAll("button")
      .forEach((b) => (b.onclick = () => install.close()));
    openDialog(install);
  }
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    promptEvent = e;
    document.getElementById("install-button").classList.add("install-ready");
  });
  document.getElementById("install-button").onclick = async () => {
    if (promptEvent) {
      const p = promptEvent;
      promptEvent = null;
      await p.prompt();
      await p.userChoice;
    } else showInstall();
  };
  window.addEventListener("appinstalled", () => {
    promptEvent = null;
    document.querySelector("#install-button span").textContent = "Установлено";
  });
  if ("serviceWorker" in navigator) {
    let reloading = false;
    navigator.serviceWorker
      .register(new URL("../sw.js", import.meta.url), {
        scope: new URL("../", import.meta.url).pathname,
      })
      .then((registration) => {
        function offer() {
          if (!registration.waiting || !navigator.serviceWorker.controller)
            return;
          let button = document.getElementById("update-app");
          if (button) return;
          button = document.createElement("button");
          button.id = "update-app";
          button.className = "update-app";
          button.textContent = "Обновить игру (забег прервётся)";
          bar.append(button);
          button.onclick = () => {
            clearInput();
            game.pause();
            reloading = true;
            registration.waiting.postMessage({ type: "SKIP_WAITING" });
          };
        }
        offer();
        registration.addEventListener("updatefound", () =>
          registration.installing?.addEventListener("statechange", offer),
        );
      })
      .catch(() => {});
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) location.reload();
    });
  }
  for (const event of ["contextmenu", "selectstart", "dragstart"])
    document
      .querySelector(".adventure-layout")
      .addEventListener(event, (e) => e.preventDefault());
  const status = document.createElement("span");
  status.className = "power-status";
  document.querySelector(".game-bottom").append(status);
  setInterval(() => {
    status.textContent =
      game.shield > 0
        ? "☀ Щит"
        : game.hasteTime > 0
          ? `✦ Ускорение ${Math.ceil(game.hasteTime)} с`
          : game.beaconTime > 0
            ? `♧ Маяк ${Math.ceil(game.beaconTime)} с`
            : "";
  }, 250);
  initCoop({
    button: document.getElementById("coop-button"),
    game,
    openDialog,
    profile,
    clearInput,
    sound,
  });
}
