import { useReducedMotion } from "./state/useReducedMotion.js";
import React, { useState, useEffect, useRef } from "react";
import {
  LayoutGroup,
  MotionConfig,
  motion,
  AnimatePresence,
} from "framer-motion";
import {
  Home as HomeIcon,
  Map,
  Package,
  Anvil,
  Search,
  Users,
  BookOpen,
  NotebookPen,
  Menu,
  X,
  Smartphone,
  Eye,
  EyeOff,
  ArrowRight,
  WifiOff,
  Check,
} from "lucide-react";
import { useStore } from "./state/Store.jsx";
import { chapters } from "./data/chapters.js";
import { data } from "./data/index.js";
import { Scenery } from "./components/Scenery.jsx";
import { Sprite } from "./components/Sprite.jsx";
import Home from "./pages/Home.jsx";
import { Catalog } from "./pages/Catalogs.jsx";
import Inventory from "./pages/Inventory.jsx";
import NPCs from "./pages/NPCs.jsx";
import { Path, Stories, Diary } from "./pages/World.jsx";
import Manager from "./modals/Manager.jsx";
import Intro from "./components/Intro.jsx";
const nav = [
  ["home", "Главная", HomeIcon],
  ["path", "Путь мира", Map],
  ["inventory", "Из моих ресурсов", Package],
  ["crafts", "Все крафты", Anvil],
  ["obtain", "Как получить", Search],
  ["npcs", "Все NPC", Users],
  ["stories", "Сюжет Terraria", BookOpen],
  ["diary", "Мой дневник", NotebookPen],
];
const getRoute = () => {
  const route = location.hash.replace(/^#\/?/, "").split("?")[0];
  return nav.some((n) => n[0] === route) ? route : "home";
};
function Brand() {
  return (
    <a className="brand" href="#/home" aria-label="TERRA Wiki — главная">
      <img src="./icons/icon-192.png" alt="" />
      <span>
        TERRA<small>W I K I</small>
      </span>
    </a>
  );
}
function Navigation({ route, onNavigate }) {
  return (
    <nav aria-label="Основные разделы">
      {nav.map(([id, title, Icon]) => (
        <a
          className={route === id ? "active" : ""}
          href={"#/" + id}
          key={id}
          onClick={onNavigate}
          aria-current={route === id ? "page" : undefined}
        >
          <Icon size={19} />
          <span>{title}</span>
          {id === route && (
            <motion.i
              layoutId={onNavigate ? "drawer-nav-dot" : "sidebar-nav-dot"}
              transition={{ type: "spring", stiffness: 420, damping: 36 }}
            />
          )}
        </a>
      ))}
    </nav>
  );
}
export default function App() {
  const { state, update, open, back, close, modals, storageWarning, toast } =
      useStore(),
    [route, setRoute] = useState(getRoute),
    [intro, setIntro] = useState(() => {
      try {
        return !sessionStorage.getItem("terra:intro:v1");
      } catch {
        return true;
      }
    }),
    [drawer, setDrawer] = useState(false),
    [online, setOnline] = useState(navigator.onLine),
    drawerRef = useRef(),
    burger = useRef(),
    reduced = useReducedMotion();
  useEffect(() => {
    const replay = () => {
      close();
      setDrawer(false);
      setIntro(true);
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("terra:replay-intro", replay);
    return () => window.removeEventListener("terra:replay-intro", replay);
  }, [close]);
  const current = Math.min(state.completed, 10),
    chapter = chapters[current],
    name = nav.find((n) => n[0] === route)[1];
  useEffect(() => {
    const change = () => {
      window.scrollTo({ top: 0, behavior: "instant" });
      setRoute(getRoute());
    };
    const key = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (!intro) open("search");
      }
    };
    window.addEventListener("hashchange", change);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("hashchange", change);
      window.removeEventListener("keydown", key);
    };
  }, [intro, open]);
  useEffect(() => {
    document.title = `${name} — TERRA Wiki`;
    document.documentElement.dataset.scenery = chapter.scene;
    document.documentElement.dataset.weather = chapter.weather;
    document.documentElement.style.setProperty(
      "--chapter-color",
      chapter.color,
    );
  }, [name, chapter]);
  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, []);
  useEffect(() => {
    if (drawer && !drawerRef.current.open) drawerRef.current.showModal();
    else if (!drawer && drawerRef.current.open) {
      drawerRef.current.close();
      burger.current?.focus();
    }
  }, [drawer]);
  useEffect(() => {
    window.__terraAndroidBack = () => {
      if (modals.length) {
        back();
        return true;
      }
      if (drawer) {
        setDrawer(false);
        return true;
      }
      if (intro) {
        setIntro(false);
        return true;
      }
      if (route !== "home") {
        location.hash = "/home";
        return true;
      }
      return false;
    };
    return () => delete window.__terraAndroidBack;
  }, [modals.length, drawer, intro, route, back]);
  const enter = () => {
    try {
      sessionStorage.setItem("terra:intro:v1", "1");
    } catch {}
    setIntro(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  let page =
    route === "home" ? (
      <Home />
    ) : route === "crafts" ? (
      <Catalog key="craft" type="craft" />
    ) : route === "obtain" ? (
      <Catalog key="item" type="item" />
    ) : route === "inventory" ? (
      <Inventory />
    ) : route === "npcs" ? (
      <NPCs />
    ) : route === "path" ? (
      <Path />
    ) : route === "stories" ? (
      <Stories />
    ) : (
      <Diary />
    );
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ type: "spring", stiffness: 420, damping: 36, mass: 0.75 }}
    >
      <LayoutGroup id="terra">
        <Scenery index={current} />
        <div className="app-shell" inert={intro ? true : undefined}>
          <a
            className="skip-link"
            href="#main-content"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("main-content").focus();
            }}
          >
            К содержимому
          </a>
          <aside className="sidebar">
            <Brand />
            <div className="sidebar-caption">ТВОЙ СПУТНИК В ТЕРРАРИИ</div>
            <Navigation route={route} />
            <div className="sidebar-bottom">
              <button
                className="sidebar-guide"
                onClick={() => open("story", current)}
              >
                <Sprite
                  icon="https://terraria.wiki.gg/images/Guide.png"
                  name="Гид"
                  size={36}
                />
                <span>
                  «Путь становится историей,
                  <br />
                  когда ты делаешь шаг.»
                  <small>
                    Гид ждёт у костра <ArrowRight size={12} />
                  </small>
                </span>
              </button>
              <div className="sidebar-progress">
                <span>
                  Твоя летопись
                  <b>{Math.round((state.completed / 11) * 100)}%</b>
                </span>
                <div className="progress-line">
                  <span style={{ width: (state.completed / 11) * 100 + "%" }} />
                </div>
                <small>{state.completed} из 11 глав пройдено</small>
              </div>
              <span className="local-mark">
                <i />
                Мир сохраняется на устройстве
              </span>
            </div>
          </aside>
          <header className="topbar">
            <button
              className="icon-button burger"
              ref={burger}
              onClick={() => setDrawer(true)}
              aria-label="Открыть меню"
            >
              <Menu size={23} />
            </button>
            <div className="breadcrumb">
              Летопись мира <span>/</span>
              <b>{name}</b>
            </div>
            <button
              className="global-search"
              onClick={() => open("search")}
              aria-label="Открыть глобальный поиск"
            >
              <Search size={17} />
              <span>Найти в мире…</span>
              <kbd>Ctrl K</kbd>
            </button>
            <button
              className={"spoiler-switch " + (state.spoilers ? "enabled" : "")}
              role="switch"
              aria-checked={state.spoilers}
              onClick={() => update({ spoilers: !state.spoilers })}
              aria-label="Без спойлеров"
            >
              {state.spoilers ? <EyeOff size={17} /> : <Eye size={17} />}
              <span>Без спойлеров</span>
              <i />
            </button>
            <button
              className="download-link"
              aria-label="О приложении"
              onClick={() => open("app-info")}
            >
              <Smartphone size={18} />
              <span>Android</span>
            </button>
          </header>
          <main id="main-content" tabIndex={-1}>
            {storageWarning && (
              <div className="storage-warning" role="alert">
                {storageWarning}
              </div>
            )}
            {!state.progressReviewed && (
              <section
                className="progress-review panel"
                aria-labelledby="progress-review-title"
              >
                <h2 id="progress-review-title">
                  Начать историю с чистого листа?
                </h2>
                <p>
                  В старой версии первые два этапа были отмечены заранее.
                  Выбери: оставить сохранённый прогресс или начать с первой
                  главы. Дневник и ресурсы не удалятся.
                </p>
                <div className="modal-actions">
                  <button
                    className="button primary"
                    onClick={() => open("reset-progress")}
                  >
                    Начать с первой главы
                  </button>
                  <button
                    className="button"
                    onClick={() => update({ progressReviewed: true })}
                  >
                    Оставить мой прогресс
                  </button>
                </div>
              </section>
            )}
            {!online && (
              <div className="offline-banner">
                <WifiOff size={15} />
                Полностью автономный режим. Все данные приложения доступны.
              </div>
            )}
            <motion.div
              className="page"
              key={route + (intro ? ":intro" : ":world")}
              initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24 }}
            >
              {page}
            </motion.div>
            <footer className="site-footer">
              <span>
                <b>TERRA</b> Wiki <i>·</i> Создавай. Исследуй. Помни.
              </span>
              <p>
                Неофициальное некоммерческое Android-приложение. Terraria и
                игровая графика © Re-Logic. Не связан с Re-Logic.
              </p>
              <div>
                <button
                  className="footer-credits"
                  onClick={() => open("credits")}
                >
                  Источники и права
                </button>
                <span>
                  Данные {data.meta.gameVersion} · {data.meta.dataVersion}
                </span>
              </div>
            </footer>
          </main>
          <dialog
            className="drawer"
            ref={drawerRef}
            aria-label="Меню разделов"
            onCancel={(e) => {
              e.preventDefault();
              setDrawer(false);
            }}
          >
            <div className="drawer-head">
              <Brand />
              <button
                className="icon-button"
                onClick={() => setDrawer(false)}
                aria-label="Закрыть меню"
              >
                <X size={23} />
              </button>
            </div>
            <Navigation route={route} onNavigate={() => setDrawer(false)} />
            <p className="data-note">
              Прогресс, ресурсы и записи сохраняются на этом устройстве.
            </p>
          </dialog>
          <Manager />
          <AnimatePresence>
            {toast && (
              <motion.div
                className="toast"
                role="status"
                initial={{ opacity: 0, y: reduced ? 0 : 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <Check size={17} />
                {toast}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <AnimatePresence>{intro && <Intro onEnter={enter} />}</AnimatePresence>
      </LayoutGroup>
    </MotionConfig>
  );
}
