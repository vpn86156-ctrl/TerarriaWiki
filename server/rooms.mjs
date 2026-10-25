import { WebSocketServer, WebSocket } from "ws";
import { randomBytes, randomUUID } from "node:crypto";
import { CoopLevel } from "../src/coop-engine.js";
export function attachRooms(
  server,
  {
    origins = process.env.COOP_ORIGINS?.split(",").filter(Boolean) || [],
    limit = 100,
  } = {},
) {
  const rooms = new Map(),
    wss = new WebSocketServer({ noServer: true, maxPayload: 2048 });
  server.on("upgrade", (req, socket, head) => {
    let ok = false;
    try {
      const path = new URL(req.url, "http://server").pathname,
        origin = new URL(req.headers.origin);
      ok =
        path === "/socket" &&
        (origins.includes(origin.origin) ||
          origin.host === req.headers.host ||
          (!origins.length &&
            (origin.hostname === "localhost" ||
              origin.hostname === "127.0.0.1" ||
              origin.hostname.endsWith(".e2b.app"))));
    } catch {}
    if (!ok) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) =>
      wss.emit("connection", ws, req),
    );
  });
  const send = (ws, data) => {
    if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < 100000)
      ws.send(JSON.stringify(data));
  };
  function broadcast(room) {
    room.clients.forEach((ws, index) =>
      send(ws, {
        type: "state",
        code: room.code,
        index,
        host: index === 0,
        round: room.round,
        names: room.clients.map((c) => c.name),
        state: room.game?.snapshot() || null,
      }),
    );
  }
  function leave(ws) {
    const room = ws.room;
    if (!room) return;
    ws.room = null;
    room.clients = room.clients.filter((c) => c !== ws);
    if (!room.clients.length) {
      rooms.delete(room.code);
      return;
    }
    room.game = null;
    room.round = null;
    room.updated = Date.now();
    room.clients.forEach((c) => {
      c.input = { x: 0, y: 0 };
      send(c, {
        type: "notice",
        message:
          "Друг отключился. Игра остановлена. Пригласи напарника и начни заново.",
      });
    });
    broadcast(room);
  }
  wss.on("connection", (ws) => {
    ws.isAlive = true;
    ws.created = Date.now();
    ws.rate = { time: Date.now(), n: 0 };
    ws.input = { x: 0, y: 0 };
    ws.lastInput = 0;
    ws.on("pong", () => (ws.isAlive = true));
    ws.on("message", (raw) => {
      const now = Date.now();
      if (now - ws.rate.time > 1000) ws.rate = { time: now, n: 0 };
      if (++ws.rate.n > 60) {
        ws.close(1008, "Rate limit");
        return;
      }
      let m;
      try {
        m = JSON.parse(raw.toString());
        if (!m || typeof m !== "object") return;
      } catch {
        return;
      }
      if (m.type === "create" || m.type === "join") {
        if (ws.room) {
          send(ws, { type: "error", message: "Ты уже в комнате." });
          return;
        }
        ws.name =
          typeof m.name === "string"
            ? m.name
                .replace(/[\x00-\x1f<>]/g, "")
                .trim()
                .slice(0, 20) || "Путник"
            : "Путник";
        let room;
        if (m.type === "create") {
          if (rooms.size >= limit) {
            send(ws, {
              type: "error",
              message: "Сервер занят. Попробуй позже.",
            });
            return;
          }
          let code;
          do {
            code = randomBytes(3).toString("hex").toUpperCase();
          } while (rooms.has(code));
          room = { code, clients: [], game: null, updated: now, round: null };
          rooms.set(code, room);
        } else {
          const code = typeof m.code === "string" ? m.code.toUpperCase() : "";
          room = rooms.get(code);
          if (!room) {
            send(ws, { type: "error", message: "Комната не найдена." });
            return;
          }
          if (room.clients.length >= 2 || room.game) {
            send(ws, { type: "error", message: "Комната занята." });
            return;
          }
        }
        room.clients.push(ws);
        ws.room = room;
        room.updated = now;
        broadcast(room);
        return;
      }
      const room = ws.room;
      if (!room) return;
      room.updated = now;
      if (
        m.type === "start" &&
        room.clients[0] === ws &&
        room.clients.length === 2 &&
        (!room.game || room.game.phase !== "playing")
      ) {
        const level =
          room.game?.phase === "won"
            ? (room.game.level + 1) % 2
            : room.game?.level || 0;
        room.game = new CoopLevel(level);
        room.round = randomUUID();
        for (const c of room.clients) {
          c.input = { x: 0, y: 0 };
          c.lastInput = 0;
        }
        broadcast(room);
      }
      if (m.type === "input") {
        ws.input = {
          x: Number.isFinite(m.x) ? Math.max(-1, Math.min(1, m.x)) : 0,
          y: Number.isFinite(m.y) ? Math.max(-1, Math.min(1, m.y)) : 0,
          dash: m.dash === true,
          interact: m.interact === true,
        };
        ws.lastInput = now;
      }
      if (m.type === "leave") leave(ws);
    });
    ws.on("close", () => leave(ws));
    ws.on("error", () => leave(ws));
  });
  let tick = 0;
  const timer = setInterval(() => {
    const now = Date.now();
    tick++;
    for (const room of rooms.values()) {
      if (now - room.updated > 10 * 60 * 1000) {
        for (const c of [...room.clients]) c.close(1000, "Room expired");
        rooms.delete(room.code);
        continue;
      }
      if (room.game?.phase === "playing") {
        room.game.tick(
          1 / 30,
          room.clients.map((c) => (now - c.lastInput < 350 ? c.input : {})),
        );
        room.clients.forEach((c) => {
          c.input.dash = false;
          c.input.interact = false;
        });
      }
      if (tick % 2 === 0 || !room.game) broadcast(room);
    }
  }, 1000 / 30);
  timer.unref();
  const ping = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
      if (!ws.room && Date.now() - ws.created > 60000)
        ws.close(1000, "Idle connection");
    }
  }, 20000);
  ping.unref();
  const close = () => {
    clearInterval(timer);
    clearInterval(ping);
    for (const ws of wss.clients) ws.terminate();
    wss.close();
  };
  server.on("close", close);
  return { rooms, wss, close };
}
