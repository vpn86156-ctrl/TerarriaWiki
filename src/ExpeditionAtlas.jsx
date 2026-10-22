import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Maximize2,
  X,
  MapPin,
  Pickaxe,
  Skull,
  Gem,
  AlertTriangle,
  Compass,
  Eye,
  Sparkles,
} from "lucide-react";
import { AtlasEncounters } from "./AtlasEncounters";
import {
  atlasBuildings,
  atlasDiscoveries,
  atlasDiscoveryIds,
} from "./atlasAdventureData";
import { captureRun, mayWriteRun } from "./runKeys";
import { AtlasWorld } from "./AtlasWorld";
import {
  atlasRegions,
  atlasResources,
  atlasCreatures,
  atlasPhaseNames,
  phaseVisible,
  biomeWiki,
} from "./atlasData";
import { stageTier } from "./journal";
import { enemies } from "./expeditionData";
import { bosses } from "./data";
import { brainBoss } from "./Adventure";
import { treasures } from "./treasures";
import { ToolHeading, Pixel, Jump } from "./HubKit";
import "./expeditionAtlas.css";
import "./atlasEncounters.css";
const categories = [
  ["resources", "Руды и ресурсы", Pickaxe],
  ["creatures", "Мобы", Skull],
  ["loot", "Редкие находки", Gem],
];
export function ExpeditionAtlas(ctx) {
  const [selectedId, setSelectedId] = useState(() =>
      atlasRegions.some((b) => b.id === ctx.initialBiome)
        ? ctx.initialBiome
        : null,
    ),
    [phase, setPhase] = useState(() => Math.min(2, stageTier(ctx.routeStage))),
    [category, setCategory] = useState("resources"),
    [expanded, setExpanded] = useState(false),
    [oceanSide, setOceanSide] = useState("west"),
    [encounter, setEncounter] = useState(null),
    [saveError, setSaveError] = useState(""),
    [runToken] = useState(captureRun),
    [discoveries, setDiscoveries] = useState(() => {
      try {
        const v = JSON.parse(
          localStorage.getItem("terraria-atlas-discoveries"),
        );
        return Array.isArray(v)
          ? [...new Set(v.filter((id) => atlasDiscoveryIds.includes(id)))]
          : [];
      } catch {
        return [];
      }
    });
  function inspect(kind, id, biome) {
    if (dialog.current?.open) dialog.current.close();
    if (biome && biome !== selectedId) select(biome);
    setSaveError("");
    if (kind === "discovery" && !discoveries.includes(id)) {
      try {
        if (!mayWriteRun(runToken)) throw new Error("stale");
        const next = [...discoveries, id];
        localStorage.setItem(
          "terraria-atlas-discoveries",
          JSON.stringify(next),
        );
        setDiscoveries(next);
      } catch {
        setSaveError(
          "Не удалось сохранить открытие. Проверь свободное место браузера или обнови вкладку после смены прохождения.",
        );
      }
    }
    setEncounter({ kind, id });
  }
  function closeEncounter() {
    setEncounter(null);
    requestAnimationFrame(() => frame.current?.focus({ preventScroll: true }));
  }

  const frame = useRef(null),
    sheet = useRef(null),
    dialog = useRef(null),
    region = atlasRegions.find((b) => b.id === selectedId) || null;
  const selected =
    region?.id === "ocean" && oceanSide === "east"
      ? {
          ...region,
          box: [1135, 220, 65, 200],
          landmarks: [
            [1180, 335],
            [1145, 300],
            [1160, 390],
          ],
        }
      : region;
  const onScene = ctx.onScene;
  useEffect(() => {
    onScene?.(
      !selected
        ? "forest"
        : selected.id === "hell"
          ? "hell"
          : ["corruption", "crimson"].includes(selected.id)
            ? "blood"
            : selected.id === "sky"
              ? "lunar"
              : selected.id,
    );
  }, [selectedId, onScene]);
  useEffect(() => () => onScene?.("forest"), [onScene]);
  useEffect(() => {
    if (expanded) dialog.current?.showModal();
  }, [expanded]);
  function select(id, side = "west") {
    setSelectedId(id);
    setOceanSide(side);
    setCategory("resources");
  }
  function overview() {
    setSelectedId(null);
    setCategory("resources");
  }
  function pin(type) {
    setCategory(type);
    if (dialog.current?.open) {
      dialog.current.close();
    }
    requestAnimationFrame(() => {
      sheet.current?.scrollIntoView({ behavior: "instant", block: "start" });
      sheet.current?.focus({ preventScroll: true });
    });
  }
  const resources = selected
      ? atlasResources[selected.id].filter((i) => phaseVisible(i, phase))
      : [],
    creatures = selected
      ? atlasCreatures[selected.id].filter((i) => phaseVisible(i, phase))
      : [],
    loot = selected
      ? selected.find
          .map((id) => treasures.find((t) => t.id === id))
          .filter((t) => t && t.phase <= phase)
      : [];
  const future = selected
    ? atlasResources[selected.id].filter((i) => !phaseVisible(i, phase))
    : [];
  const boss = selected
    ? [...bosses, brainBoss].find((b) => b[0] === selected.boss)
    : null;
  const planning = selected?.id === "hallow" && phase === 0;
  const phaseSwitch = (
    <div
      className="exp-atlas-phase"
      role="group"
      aria-label="Этап мира в атласе"
    >
      {atlasPhaseNames.map((name, i) => (
        <button
          key={name}
          aria-pressed={phase === i}
          onClick={() => setPhase(i)}
        >
          {name}
        </button>
      ))}
    </div>
  );
  const world = (full = false) => (
    <div
      className={`exp-atlas-frame ${selected ? "is-focused" : ""} ${full ? "is-full" : ""}`}
      ref={full ? undefined : frame}
      tabIndex={0}
      aria-label="Камера атласа"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !dialog.current?.open) {
          e.stopPropagation();
          overview();
        }
      }}
      style={{ "--atlas-accent": selected?.color || "#b9ceb7" }}
    >
      <AtlasWorld
        selected={selected}
        phase={phase}
        loot={loot}
        category={category}
        onSelect={select}
        onPin={pin}
        onInspect={inspect}
        discoveries={discoveries}
      />
      <div className="exp-atlas-corner">
        <span>{selected ? "ВНУТРИ БИОМА" : "ТВОЙ СЛЕДУЮЩИЙ ГОРИЗОНТ"}</span>
        <strong>{selected?.name || "Мир ждёт тебя."}</strong>
        <small>
          {planning
            ? "Появится после Стены плоти"
            : selected
              ? selected.level
              : "Выбери местность на карте"}
        </small>
      </div>
      <div className="exp-atlas-scale">
        <span>{selected ? "ПРИБЛИЖЕНИЕ" : "ОБЗОР МИРА"}</span>
        <i />
        <small>
          {selected
            ? "Метки открывают досье ↓"
            : "Небо → поверхность → глубины → Ад"}
        </small>
      </div>
      {selected && (
        <button className="exp-atlas-back" onClick={overview}>
          <ArrowLeft size={15} />
          Весь мир
        </button>
      )}
      {!full && (
        <button
          className="exp-atlas-expand"
          aria-label="Развернуть карту"
          onClick={() => setExpanded(true)}
        >
          <Maximize2 size={17} />
        </button>
      )}
    </div>
  );
  return (
    <section className="expedition-atlas">
      <ToolHeading
        tag="АТЛАС ЭКСПЕДИЦИЙ · МИР, В КОТОРЫЙ МОЖНО ВОЙТИ"
        title="Целый мир. Один шаг внутрь."
        text="Выбери местность — камера перенесёт тебя в биом. Исследуй руды, существ и находки перед следующей вылазкой."
      />
      <div className="exp-atlas-toolbar">
        <div className="exp-atlas-breadcrumb">
          <Compass size={17} />
          <button onClick={overview}>Весь мир</button>
          {selected && (
            <>
              <ArrowRight size={13} />
              <span>{selected.name}</span>
            </>
          )}
        </div>
        {phaseSwitch}
      </div>
      {world()}
      <div className="exp-atlas-under">
        <span>
          <MapPin size={13} />
          {selected
            ? "Рассмотри метки или выбери другую область ниже."
            : "Нажми на биом. На телефоне карту можно развернуть."}
        </span>
        <small>Авторский разрез · не карта сохранения</small>
      </div>
      <div className="exp-world-picker world-map" aria-label="Выбор биома">
        {atlasRegions.map((r) => (
          <button
            key={r.id}
            aria-pressed={selectedId === r.id}
            onClick={() => select(r.id)}
            style={{ "--biome": r.color }}
          >
            <i />
            {r.name}
          </button>
        ))}
      </div>
      <details className="atlas-found-notes">
        <summary>
          <Sparkles size={14} />
          Маленькие открытия · {discoveries.length} / {atlasDiscoveryIds.length}
        </summary>
        {discoveries.length ? (
          <div>
            {atlasDiscoveries
              .filter((d) => discoveries.includes(d.id))
              .map((d) => (
                <button key={d.id} onClick={() => inspect("discovery", d.id)}>
                  {d.name}
                  <ArrowRight size={13} />
                </button>
              ))}
          </div>
        ) : (
          <p>
            Вглядись в необычные детали внутри биомов. Найденные заметки
            останутся в этом прохождении; предметы и победы не добавляются.
          </p>
        )}
      </details>
      {selected &&
        (atlasBuildings.some((b) => b.biome === selected.id) ||
          atlasDiscoveries.some((d) => d.biome === selected.id)) && (
          <div className="atlas-place-details" aria-label="Детали местности">
            {atlasBuildings
              .filter((b) => b.biome === selected.id)
              .map((b) => (
                <button
                  key={b.id}
                  onClick={() => inspect("building", b.id, b.biome)}
                >
                  <Eye size={15} />
                  {b.name}
                </button>
              ))}
            {atlasDiscoveries
              .filter((d) => d.biome === selected.id)
              .map((d) => (
                <button key={d.id} onClick={() => inspect("discovery", d.id)}>
                  <Sparkles size={15} />
                  {discoveries.includes(d.id) ? d.name : d.clue}
                  <small>
                    {discoveries.includes(d.id) ? "Открыто" : "Исследовать"}
                  </small>
                </button>
              ))}
          </div>
        )}
      {selected ? (
        <section
          className="biome-dossier exp-atlas-dossier"
          style={{ "--biome": selected.color }}
          ref={sheet}
          tabIndex={-1}
          aria-label={`Досье: ${selected.name}`}
          key={selected.id}
        >
          <div className="exp-atlas-dossier-head">
            <div className="biome-title">
              <Pixel id={selected.sprite} />
              <div>
                <span className="eyebrow">ЭКСПЕДИЦИЯ / {selected.level}</span>
                <h3>{selected.name}</h3>
              </div>
            </div>
            <span className="exp-atlas-phase-tag">
              {atlasPhaseNames[phase]}
            </span>
          </div>
          <p>{selected.text}</p>
          {planning && (
            <div className="exp-atlas-planning">
              <strong>Пока только планируем.</strong> Освящение появится после
              Стены плоти. Переключи этап на «Хардмод», чтобы увидеть его
              ресурсы и существ.
            </div>
          )}
          {selected.id === "dungeon" &&
            !(ctx.done || []).includes("Skeletron") && (
              <div className="exp-atlas-planning">
                Скелетрон ещё не отмечен в этом прохождении. Глубокая темница до
                победы над ним смертельно опасна.
              </div>
            )}
          <div
            className="exp-atlas-tabs"
            role="group"
            aria-label="Содержимое биома"
          >
            {categories.map(([id, name, Icon]) => (
              <button
                key={id}
                aria-pressed={category === id}
                onClick={() => setCategory(id)}
              >
                <Icon size={16} />
                {name}
                <span>
                  {id === "resources"
                    ? resources.length
                    : id === "creatures"
                      ? creatures.length
                      : loot.length}
                </span>
              </button>
            ))}
          </div>
          {category === "resources" && (
            <div className="exp-atlas-resource-grid">
              {resources.map((i) => (
                <article className="exp-atlas-resource" key={i.sprite}>
                  <Pixel id={i.sprite} alt={i.name} />
                  <div>
                    <h4>{i.name}</h4>
                    <p>{i.where}</p>
                    <a
                      href={`https://terraria.wiki.gg/wiki/${encodeURIComponent(i.sprite)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Подробнее ↗
                    </a>
                  </div>
                </article>
              ))}
              {!resources.length && (
                <p className="exp-atlas-empty">
                  На выбранном этапе ресурсы этого биома ещё недоступны. Это не
                  означает, что они уже появились в твоём мире.
                </p>
              )}
            </div>
          )}
          {category === "creatures" && (
            <div className="exp-atlas-creatures enemy-chips">
              {creatures.map((e) => (
                <article key={e.id}>
                  <Pixel id={e.id} alt={e.name} />
                  <div>
                    <h4>{e.name}</h4>
                    <p>{e.where}</p>
                    <small>{atlasPhaseNames[e.phase]} и позднее</small>
                    {enemies.some((known) => known.id === e.id) ? (
                      <button
                        onClick={() =>
                          ctx.onEnemy?.(e.biome || selected.id, e.id)
                        }
                      >
                        Открыть в бестиарии
                        <ArrowRight size={13} />
                      </button>
                    ) : (
                      <a
                        href={`https://terraria.wiki.gg/wiki/${e.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Условия и добыча в Wiki ↗
                      </a>
                    )}
                  </div>
                </article>
              ))}
              {!creatures.length && (
                <p className="exp-atlas-empty">
                  В этой выборке нет существ для выбранного этапа. Попробуй
                  хардмод.
                </p>
              )}
            </div>
          )}
          {/* Keep direct bestiary links available without making the player open another tab first. */}
          {category !== "creatures" &&
            creatures.some((e) => enemies.some((k) => k.id === e.id)) && (
              <div className="enemy-chips exp-atlas-quick-enemies">
                {creatures
                  .filter((e) => enemies.some((k) => k.id === e.id))
                  .map((e) => (
                    <button
                      key={e.id}
                      onClick={() =>
                        ctx.onEnemy?.(e.biome || selected.id, e.id)
                      }
                    >
                      <Pixel id={e.id} />
                      {e.name}
                    </button>
                  ))}
              </div>
            )}
          {category === "loot" && (
            <div className="linked-loot exp-atlas-loot">
              {loot.map((t) => (
                <button key={t.id} onClick={() => ctx.onTreasure?.(t)}>
                  <Pixel id={t.id} />
                  <span>
                    <strong>{t.name}</strong>
                    <small>{t.source}</small>
                  </span>
                  <ArrowRight size={15} />
                </button>
              ))}
              {!loot.length && (
                <p className="exp-atlas-empty">
                  Для этого этапа нет отдельной находки в архиве. Смотри ресурсы
                  и местных врагов; выборка не охватывает весь лут игры.
                </p>
              )}
            </div>
          )}
          {future.length > 0 && (
            <details className="exp-atlas-future">
              <summary>Что откроется позднее · {future.length}</summary>
              {future.map((i) => (
                <p key={i.sprite}>
                  <strong>{i.name}</strong> · {atlasPhaseNames[i.phase]}.{" "}
                  {i.where}
                </p>
              ))}
            </details>
          )}
          <div className="biome-danger">
            <AlertTriangle size={18} />
            <p>{selected.danger}</p>
          </div>
          <div className="exp-atlas-actions">
            {boss && (
              <Jump onClick={() => ctx.onBoss?.(boss)}>Тактика: {boss[1]}</Jump>
            )}
            <Jump onClick={() => ctx.onTool?.("ready")}>
              Подготовиться к вылазке
            </Jump>
            <a
              href={`https://terraria.wiki.gg/wiki/${biomeWiki[selected.id]}`}
              target="_blank"
              rel="noreferrer"
            >
              Биом в Wiki ↗
            </a>
          </div>
          <small className="exp-atlas-footnote">
            Руды обычных подземных слоёв не принадлежат исключительно одному
            биому. Источники, глубина и прогресс имеют значение; список —
            полезная выборка для Terraria 1.4.4, не полный бестиарий.
            Переключение этапа не отмечает победы.
          </small>
        </section>
      ) : (
        <div className="exp-atlas-invitation">
          <MapPin size={23} />
          <div>
            <h3>Куда отправимся?</h3>
            <p>
              Нажми на лес, пустыню или глубины. Мир приблизится к выбранному
              месту, а под картой откроется досье экспедиции.
            </p>
          </div>
          <span>13 ОБЛАСТЕЙ</span>
        </div>
      )}
      <p className="exp-atlas-reference">
        Это составной учебный мир. Искажение и Багрянец показаны вместе для
        сравнения; в обычной генерации мир обычно получает один из них.
        Положение островов, руд, сундуков и размеры областей условны.
        Оригинальные игровые тайлы, стены, мебель, деревья и фоны © Re-Logic;
        ландшафт и интерфейс созданы для атласа.
      </p>
      {encounter && (
        <AtlasEncounters
          key={encounter.kind + encounter.id}
          encounter={encounter}
          onClose={closeEncounter}
          onTool={ctx.onTool}
          saved={discoveries.includes(encounter.id)}
          error={saveError}
        />
      )}
      <dialog
        className="exp-atlas-dialog"
        ref={dialog}
        aria-label="Карта на весь экран"
        onClose={() => setExpanded(false)}
      >
        {expanded && (
          <>
            <header>
              <strong>{selected?.name || "Мир экспедиций"}</strong>
              <button
                aria-label="Закрыть карту"
                onClick={() => dialog.current.close()}
              >
                <X size={22} />
              </button>
            </header>
            {world(true)}
            <div className="exp-atlas-dialog-picker">
              {atlasRegions.map((r) => (
                <button
                  key={r.id}
                  aria-pressed={selectedId === r.id}
                  onClick={() => select(r.id)}
                >
                  {r.name}
                </button>
              ))}
            </div>
          </>
        )}
      </dialog>
    </section>
  );
}
