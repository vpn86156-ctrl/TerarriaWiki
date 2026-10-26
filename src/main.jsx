import React from "react";
import { createRoot } from "react-dom/client";
import { Store } from "./state/Store.jsx";
import App from "./App.jsx";
import "./tokens.css";
import "./layout.css";
import "./pages.css";
import "./modals.css";
class ErrorBoundary extends React.Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main style={{ margin: 0, padding: 40 }}>
        <h1>Не удалось открыть страницу</h1>
        <p>Локальные записи не удалены. Попробуй перезагрузить страницу.</p>
        <button className="button primary" onClick={() => location.reload()}>
          Перезагрузить
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <Store>
      <App />
    </Store>
  </ErrorBoundary>,
);
