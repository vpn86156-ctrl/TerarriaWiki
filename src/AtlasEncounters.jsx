import React, { useEffect, useRef, useState } from "react";
import {
  X,
  ArrowRight,
  Eye,
  Layers,
  Minus,
  Plus,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { atlasBuildings, atlasDiscoveries } from "./atlasAdventureData";
const base = import.meta.env.BASE_URL + "assets/";
export function AtlasEncounters({ encounter, onClose, onTool, saved, error }) {
  const dialog = useRef(null),
    [mode, setMode] = useState("room"),
    [zoom, setZoom] = useState(1),
    [guides, setGuides] = useState(false),
    [detail, setDetail] = useState(0),
    [replay, setReplay] = useState(0);
  const building =
      encounter.kind === "building"
        ? atlasBuildings.find((b) => b.id === encounter.id)
        : null,
    discovery =
      encounter.kind === "discovery"
        ? atlasDiscoveries.find((d) => d.id === encounter.id)
        : null;
  useEffect(() => {
    const previous = document.body.style.overflow,
      reading = document.documentElement.dataset.reading;
    document.documentElement.dataset.reading = "on";
    document.body.style.overflow = "hidden";
    dialog.current.showModal();
    return () => {
      document.body.style.overflow = previous;
      if (reading === undefined)
        delete document.documentElement.dataset.reading;
      else document.documentElement.dataset.reading = reading;
    };
  }, []);
  const close = () => dialog.current.close();
  return (
    <dialog
      className="atlas-encounter-dialog"
      ref={dialog}
      onClose={onClose}
      aria-labelledby="atlas-encounter-title"
      onClick={(e) => {
        if (e.target === dialog.current) {
          const r = e.target.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            close();
        }
      }}
    >
      <header>
        <div>
          <span className="eyebrow">
            {building ? "АРХИТЕКТУРА МИРА" : "МАЛЕНЬКОЕ ОТКРЫТИЕ"}
          </span>
          <h2 id="atlas-encounter-title">
            {building?.name || discovery?.name}
          </h2>
        </div>
        <button
          className="atlas-encounter-close"
          onClick={close}
          aria-label="Закрыть осмотр"
        >
          <X size={21} />
        </button>
      </header>
      {building ? (
        <>
          <p>
            {building.description} Перед тобой тот же дом, что стоит на карте.
          </p>
          <div className="atlas-house-controls">
            <div role="group" aria-label="Слой постройки">
              <button
                aria-pressed={mode === "room"}
                onClick={() => setMode("room")}
              >
                <Eye size={15} />
                Обстановка
              </button>
              <button
                aria-pressed={mode === "shell"}
                onClick={() => setMode("shell")}
              >
                <Layers size={15} />
                Стены и каркас
              </button>
            </div>
            <div
              className="atlas-house-zoom"
              role="group"
              aria-label="Масштаб постройки"
            >
              <button
                aria-label="Уменьшить постройку"
                disabled={zoom === 1}
                onClick={() => setZoom((z) => z - 1)}
              >
                <Minus size={15} />
              </button>
              <output aria-live="polite">{zoom}×</output>
              <button
                aria-label="Увеличить постройку"
                disabled={zoom === 3}
                onClick={() => setZoom((z) => z + 1)}
              >
                <Plus size={15} />
              </button>
            </div>
          </div>
          <div
            className="atlas-house-viewport"
            tabIndex={0}
            aria-label="Постройка; увеличенное изображение можно прокручивать"
          >
            <div
              className="atlas-house-plane"
              style={{
                width: (building.w + 8) * 16 * zoom,
                height: (building.h + 8) * 16 * zoom,
              }}
            >
              <img
                src={`${base}atlas/house-${building.id}-${mode}.webp`}
                width={(building.w + 8) * 16 * zoom}
                height={(building.h + 8) * 16 * zoom}
                alt={`${building.name}: ${mode === "room" ? "мебель и освещение" : "фоновые стены и каркас без мебели"}`}
              />
              {guides &&
                building.details.map((d, i) => (
                  <button
                    className={`atlas-house-detail-pin ${detail === i ? "active" : ""}`}
                    key={d.title}
                    style={{ left: d.point[0] + "%", top: d.point[1] + "%" }}
                    onClick={() => setDetail(i)}
                    aria-label={`Деталь: ${d.title}`}
                    aria-pressed={detail === i}
                  >
                    {i + 1}
                  </button>
                ))}
            </div>
          </div>
          <div className="atlas-house-hint">
            <span>
              1× — блок 16 пикселей · при увеличении прокручивай сцену
            </span>
            <button aria-pressed={guides} onClick={() => setGuides((v) => !v)}>
              <Sparkles size={14} />
              {guides ? "Скрыть детали" : "Подсветить детали"}
            </button>
          </div>
          {guides && (
            <section className="atlas-house-explanation" aria-live="polite">
              <h3>
                {detail + 1}. {building.details[detail].title}
              </h3>
              <p>{building.details[detail].text}</p>
            </section>
          )}
          <footer>
            <small>
              Собрано из оригинальных игровых тайлов. Это учебная композиция, не
              скриншот и не проверка пригодности жилища движком Terraria.
            </small>
            <button
              className="secondary"
              onClick={() => {
                close();
                onTool?.("building");
              }}
            >
              Планы и материалы
              <ArrowRight size={15} />
            </button>
          </footer>
        </>
      ) : (
        <>
          <div
            className={`atlas-discovery-scene atlas-discovery-${discovery.kind}`}
            key={replay}
            aria-hidden="true"
          >
            {discovery.kind === "nymph" && (
              <img
                className="atlas-discovery-disguise"
                src={`${base}atlas/lost-girl.webp`}
                alt=""
              />
            )}
            {discovery.kind === "chest" && (
              <img
                className="atlas-discovery-chest"
                src={`${base}Gold_Chest.webp`}
                alt=""
              />
            )}
            <div className="atlas-discovery-halo" />
            <img
              className="atlas-discovery-object"
              src={`${base}${discovery.sprite}.webp`}
              alt=""
            />
            {Array.from({ length: 8 }, (_, i) => (
              <i
                key={i}
                style={{
                  "--spark-angle": `${i * 45}deg`,
                  "--spark-delay": `${i * 0.06}s`,
                }}
              />
            ))}
          </div>
          <div className="atlas-discovery-status" role="status">
            <Sparkles size={15} />
            {error
              ? "Открытие прочитано; сохранение недоступно"
              : saved
                ? "Записано в открытия этого прохождения"
                : "Полевая заметка"}
          </div>
          <p className="atlas-discovery-fact">{discovery.text}</p>
          <aside className="atlas-discovery-tip">
            <strong>На заметку путешественнику</strong>
            <p>{discovery.tip}</p>
          </aside>
          {error && <p role="alert">{error}</p>}
          <div className="atlas-discovery-actions">
            <button
              className="secondary"
              onClick={() => setReplay((v) => v + 1)}
            >
              <RotateCcw size={14} />
              Повторить сценку
            </button>
            <a
              href={`https://terraria.wiki.gg/wiki/${discovery.wiki}`}
              target="_blank"
              rel="noreferrer"
            >
              Подробнее в Wiki ↗
            </a>
          </div>
          <small className="atlas-discovery-disclaimer">
            Это интерактивная справочная сценка. Она не добавляет предметы, не
            отмечает победы и не показывает гарантированное место добычи в твоём
            мире.
          </small>
        </>
      )}
    </dialog>
  );
}
