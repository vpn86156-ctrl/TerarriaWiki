import React from "react";
import {
  Volume2,
  VolumeX,
  Sparkles,
  SlidersHorizontal,
  Info,
} from "lucide-react";
import { useSettings } from "../state/Settings.jsx";
import { useStore } from "../state/Store.jsx";
function Toggle({ label, description, checked, onClick, disabled = false }) {
  return (
    <div className="preference-row">
      <div>
        <b>{label}</b>
        <p>{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-label={label}
        aria-checked={checked}
        disabled={disabled}
        onClick={onClick}
      >
        <span />
      </button>
    </div>
  );
}
export default function Settings() {
  const {
      settings: s,
      updateSettings: update,
      settingsWarning,
    } = useSettings(),
    { open } = useStore();
  return (
    <>
      <p className="eyebrow">ТВОЙ РИТМ ПУТЕШЕСТВИЯ</p>
      <h2 id="modal-title" tabIndex={-1}>
        Настройки
      </h2>
      <p>
        Звук, движение и атмосфера — как удобно тебе. Выбор сохраняется на
        устройстве.
      </p>
      {settingsWarning && <p role="alert">{settingsWarning}</p>}
      <section className="preferences panel">
        <h3>
          <Volume2 size={19} />
          Звук
        </h3>
        <Toggle
          label="Звуковые эффекты"
          description="Тихий отклик на нажатия. По умолчанию выключен."
          checked={s.sound}
          onClick={() => update({ sound: !s.sound })}
        />
        <Toggle
          label="Фоновая атмосфера"
          description="Негромкие синтезированные созвучия для текущей главы. Это не музыка Terraria."
          checked={s.ambient}
          disabled={!s.sound}
          onClick={() => update({ ambient: !s.ambient })}
        />
        <label className="volume-control">
          Громкость <b>{s.volume}%</b>
          <input
            type="range"
            min="0"
            max="100"
            value={s.volume}
            aria-label="Громкость"
            disabled={!s.sound}
            onChange={(e) => update({ volume: Number(e.target.value) })}
          />
        </label>
        <button className="button" disabled={!s.sound || s.volume === 0}>
          Проверить звук{" "}
          {s.sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
        </button>
        <p className="data-note">
          Звук появляется только после нажатия. При сворачивании приложения он
          останавливается; системная громкость устройства тоже влияет на него.
        </p>
      </section>
      <section className="preferences panel">
        <h3>
          <Sparkles size={19} />
          Движение
        </h3>
        <Toggle
          label="Анимации"
          description="Появление карточек, покачивание босса и переходы. Системное уменьшение движения всегда имеет приоритет."
          checked={s.animations}
          onClick={() => update({ animations: !s.animations })}
        />
        <Toggle
          label="Декоративные частицы"
          description="Искры, снег и светлячки на фонах. Можно убрать для спокойного вида."
          checked={s.particles}
          onClick={() => update({ particles: !s.particles })}
        />
      </section>
      <div className="modal-actions">
        <button className="button" onClick={() => open("app-info")}>
          <Info size={17} />О приложении
        </button>
        <button
          className="button"
          onClick={() => window.dispatchEvent(new Event("terra:replay-intro"))}
        >
          Повторить вступление
        </button>
      </div>
    </>
  );
}
