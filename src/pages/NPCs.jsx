import { Reveal } from "../components/Reveal.jsx";
import { useReducedMotion } from "../state/useReducedMotion.js";
import React, { useState, useRef, useEffect } from "react";
import { Heart, Star, MapPin } from "lucide-react";
import { data, filterNPCs, npcName, biomes } from "../data/index.js";
import { useStore } from "../state/Store.jsx";
import { Sprite } from "../components/Sprite.jsx";
import {
  PageTitle,
  SearchInput,
  Empty,
  StarButton,
} from "../components/UI.jsx";
import "framer-motion";
const roles = {
  Guide: "Подсказывает рецепты из выбранного материала.",
  Merchant: "Продаёт базовые инструменты и припасы.",
  Nurse: "Восстанавливает здоровье и снимает некоторые эффекты.",
  Demolitionist: "Торговец взрывчаткой и инструментами для раскопок.",
  Angler: "Выдаёт ежедневные задания на рыбалку.",
  Dryad: "Продаёт семена и сообщает о заражении мира.",
  ArmsDealer: "Продаёт огнестрельное оружие и боеприпасы.",
  DyeTrader: "Продаёт красители и обменивает странные растения.",
  Painter: "Продаёт краски, инструменты и картины.",
  Stylist: "Меняет причёску и цвет волос.",
  BestiaryGirl: "Открывает товары по мере заполнения бестиария.",
  DD2Bartender: "Продаёт снаряжение для Армии Древних.",
  Golfer: "Продаёт предметы для гольфа.",
  GoblinTinkerer: "Перековывает предметы и продаёт мастерскую.",
  WitchDoctor: "Продаёт магические и призывные принадлежности.",
  Mechanic: "Продаёт провода и механизмы.",
  Clothier: "Продаёт одежду и костюмы.",
  Wizard: "Продаёт магические принадлежности.",
  Steampunker: "Продаёт продвинутые инструменты и станции.",
  Pirate: "Продаёт пиратское снаряжение.",
  Truffle: "Торговец грибного биома; продаёт автомолот.",
  TaxCollector: "Собирает налоги с жителей.",
  Cyborg: "Продаёт ракеты и технологические товары.",
  PartyGirl: "Продаёт праздничные предметы.",
  Princess: "Продаёт королевский декор.",
  SantaClaus: "Сезонный продавец зимних украшений.",
};
export default function NPCs() {
  const { state } = useStore(),
    [query, setQuery] = useState(
      () => new URLSearchParams(location.hash.split("?")[1]).get("q") || "",
    ),
    [biome, setBiome] = useState(""),
    [favorite, setFavorite] = useState(false),
    empty = useRef(),
    reduced = useReducedMotion();
  const result = filterNPCs(query, biome, favorite, state);
  useEffect(() => {
    if (!result.length)
      empty.current?.scrollIntoView({
        block: "center",
        behavior: reduced ? "instant" : "smooth",
      });
  }, [query, biome, favorite, result.length, reduced]);
  const reset = () => {
    setQuery("");
    setBiome("");
    setFavorite(false);
  };
  return (
    <>
      <PageTitle
        eyebrow="ЛЮДИ, КОТОРЫЕ ДЕЛАЮТ МИР ДОМОМ"
        title="Все NPC"
        description="26 городских жителей. Их привычки, любимые места и хорошие соседи."
      />
      <section className="filter-panel" data-sticky="npc">
        <div className="filter-main">
          <SearchInput
            value={query}
            onChange={setQuery}
            label="Поиск NPC"
            placeholder="Имя жителя или любимого соседа…"
          />
          <button
            className={"button " + (favorite ? "active" : "")}
            onClick={() => setFavorite(!favorite)}
            aria-pressed={favorite}
          >
            <Star size={16} />
            Избранное
          </button>
        </div>
        <div className="filter-chips">
          <button
            className={!biome ? "active" : ""}
            onClick={() => setBiome("")}
          >
            Все биомы
          </button>
          {[
            "forest",
            "desert",
            "snow",
            "jungle",
            "ocean",
            "underground",
            "hallow",
            "mushroom",
          ].map((b) => (
            <button
              key={b}
              onClick={() => setBiome(b)}
              className={biome === b ? "active" : ""}
            >
              {biomes[b]}
            </button>
          ))}
        </div>
      </section>
      <div className="results-meta">
        <span>
          Жителей: <b data-testid="npc-count">{result.length}</b> / 26
        </span>
        <span>Показываем предпочтение биома</span>
      </div>
      {result.length ? (
        <div className="npc-grid">
          {result.map((n, cardIndex) => {
            const p = n.preferences,
              good = p.neighbors.loved.length ? "loved" : "liked",
              discount = Math.max(
                0.75,
                0.95 * 0.95 * (good === "loved" ? 0.9 : 0.95),
              );
            return (
              <Reveal
                className="npc-card"
                key={n.id}
                as="article"
                order={cardIndex}
              >
                <StarButton id={"npc:" + n.id} />
                <div className="npc-head">
                  <div className="npc-portrait">
                    <Sprite icon={n.icon} name={n.ru} size={62} />
                  </div>
                  <div>
                    <h2>{n.ru}</h2>
                    <span className="english">{n.name}</span>
                  </div>
                </div>
                <p className="npc-role">{roles[n.id]}</p>
                <div className="npc-biomes">
                  <span>
                    <MapPin size={14} />
                    Любит:{" "}
                    <b>
                      {biomes[p.biome?.loved || p.biome?.liked] ||
                        "Разные биомы"}
                    </b>
                  </span>
                  <span>
                    Не любит:{" "}
                    {biomes[p.biome?.disliked] || "Нет обычного предпочтения"}
                  </span>
                </div>
                <div className="neighbors">
                  {[
                    ["loved", "Любит"],
                    ["liked", "Нравится"],
                    ["disliked", "Не нравится"],
                    ["hated", "Ненавидит"],
                  ].map(([k, label]) => (
                    <p key={k}>
                      <span className={"relation " + k}>{label}</span>
                      <span>
                        {p.neighbors[k]?.map(npcName).join(", ") || "—"}
                      </span>
                    </p>
                  ))}
                </div>
                <div className="npc-price">
                  <Heart size={15} />
                  <span>
                    Пример цены: ≈{Math.round(discount * 100)}%
                    <small>Биом + хороший сосед + уединение</small>
                  </span>
                </div>
                <a className="source-link" href={n.url} rel="noreferrer">
                  Условия заселения на wiki ↗
                </a>
              </Reveal>
            );
          })}
        </div>
      ) : (
        <Empty
          title="Здесь пока тихо"
          text="Ни один житель не подходит под эти условия."
          reset={reset}
          innerRef={empty}
        />
      )}
      <p className="data-note">
        Пример цен — ориентир, не симулятор размещения. Множители: любимый сосед
        ×0,90; приятный ×0,95; любимый биом ×0,95; уединение ×0,95, с нижней
        границей ×0,75. У Принцессы особые правила одиночества, у Рыбака
        меняются награды, у Гида нет магазина.
      </p>
      {!query && !biome && !favorite && (
        <>
          <div className="section-heading">
            <div>
              <p className="eyebrow">ПОПУТЧИКИ И МАЛЕНЬКИЕ СОСЕДИ</p>
              <h2>Ещё немного жизни</h2>
            </div>
            <span>14 существ</span>
          </div>
          <div className="extras-grid">
            {data.npcs
              .filter((n) => !n.main)
              .map((n, cardIndex) => (
                <article key={n.id}>
                  <Sprite icon={n.icon} name={n.ru} size={48} />
                  <div>
                    <h3>{n.ru}</h3>
                    <span className="english">{n.name}</span>
                  </div>
                  <a
                    className="icon-button"
                    href={n.url}
                    rel="noreferrer"
                    aria-label={"О " + n.ru + " на wiki"}
                  >
                    ↗
                  </a>
                </article>
              ))}
          </div>
        </>
      )}
    </>
  );
}
