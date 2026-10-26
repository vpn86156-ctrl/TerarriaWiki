import React from "react";
import {
  Star,
  ChevronLeft,
  ChevronRight,
  Search,
  ArrowRight,
  PackageOpen,
} from "lucide-react";
import { useStore } from "../state/Store.jsx";
export function StarButton({ id }) {
  const { state, favorite } = useStore();
  const active = state.favorites.includes(id);
  return (
    <button
      className={"icon-button favorite " + (active ? "is-favorite" : "")}
      aria-label={active ? "Убрать из избранного" : "В избранное"}
      aria-pressed={active}
      onClick={(e) => {
        e.stopPropagation();
        favorite(id);
      }}
    >
      <Star size={17} fill={active ? "currentColor" : "none"} />
    </button>
  );
}
export function Eyebrow({ children }) {
  return <p className="eyebrow">{children}</p>;
}
export function PageTitle({ eyebrow, title, description, children }) {
  return (
    <header className="page-heading">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </header>
  );
}
export function SearchInput({ value, onChange, label = "Поиск", placeholder }) {
  return (
    <label className="search-field">
      <Search size={18} />
      <span className="sr-only">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || label}
        type="search"
      />
    </label>
  );
}
export function Select({ label, value, onChange, options }) {
  return (
    <label className="select-field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Все</option>
        {options.map(([key, title]) => (
          <option key={key} value={key}>
            {title}
          </option>
        ))}
      </select>
    </label>
  );
}
export function Empty({
  title = "Пока ничего не найдено",
  text = "Попробуй другой запрос или сбрось фильтры.",
  reset,
  innerRef,
  children,
}) {
  return (
    <section ref={innerRef} className="empty-state">
      <PackageOpen size={36} />
      <h2>{title}</h2>
      <p>{text}</p>
      {children}
      {reset && (
        <button
          className={"button " + (children ? "" : "primary")}
          onClick={reset}
        >
          Сбросить поиск
        </button>
      )}
    </section>
  );
}
export function Pagination({ page, total, onChange, size = 48 }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Страницы каталога">
      <button
        className="button"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        aria-label="Предыдущая страница"
      >
        <ChevronLeft size={18} />
      </button>
      <span>
        Страница <b>{page}</b> из {pages}
      </span>
      <button
        className="button"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
        aria-label="Следующая страница"
      >
        <ChevronRight size={18} />
      </button>
    </nav>
  );
}
export function LinkButton({ to, children, className = "" }) {
  return (
    <a href={"#/" + to} className={"button " + className}>
      {children}
      <ArrowRight size={16} />
    </a>
  );
}
