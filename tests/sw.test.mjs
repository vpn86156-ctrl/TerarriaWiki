import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync, existsSync } from "node:fs";
const source = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
function harness() {
  const events = {},
    deleted = [],
    added = [];
  let claimed = false,
    skipped = false;
  const self = {
    registration: { scope: "https://example.com/TerarriaWiki/" },
    location: { origin: "https://example.com" },
    clients: { claim: async () => (claimed = true) },
    skipWaiting: () => (skipped = true),
    addEventListener: (name, fn) => (events[name] = fn),
  };
  const cache = {
    addAll: async (requests) => added.push(...requests.map((r) => r.url)),
    match: async () => new Response("offline shell"),
  };
  const caches = {
    open: async () => cache,
    keys: async () => [
      "last-torch-shell-v1",
      "terraria-guide-v1-map",
      "unrelated-cache",
    ],
    delete: async (k) => deleted.push(k),
  };
  vm.runInNewContext(source, {
    self,
    caches,
    URL,
    Request,
    Response,
    fetch: async () => new Response("network"),
  });
  return {
    events,
    deleted,
    added,
    claimed: () => claimed,
    skipped: () => skipped,
  };
}
test("worker precaches complete shell within Pages subpath, all assets exist", async () => {
  const h = harness();
  let promise;
  h.events.install({ waitUntil: (p) => (promise = p) });
  await promise;
  assert.ok(
    h.added.includes("https://example.com/TerarriaWiki/src/features.js"),
  );
  assert.ok(
    h.added.includes("https://example.com/TerarriaWiki/icons/icon-512.png"),
  );
  for (const path of h.added) {
    assert.ok(path.startsWith("https://example.com/TerarriaWiki/"));
    const relative = path.split("/TerarriaWiki/")[1] || "index.html";
    assert.ok(existsSync(new URL("../" + relative, import.meta.url)), relative);
  }
});
test("activation clears only owned/retired cache prefixes and waits for explicit update", async () => {
  const h = harness();
  let promise;
  h.events.activate({ waitUntil: (p) => (promise = p) });
  await promise;
  assert.ok(h.claimed());
  assert.deepEqual(h.deleted, ["last-torch-shell-v1", "terraria-guide-v1-map"]);
  assert.equal(h.skipped(), false);
  h.events.message({ data: { type: "SKIP_WAITING" } });
  assert.equal(h.skipped(), true);
});
test("navigation serves coherent cached shell; third-party and unrelated requests untouched", async () => {
  const h = harness();
  let response;
  h.events.fetch({
    request: {
      method: "GET",
      url: "https://example.com/TerarriaWiki/?room=ABC123",
      mode: "navigate",
    },
    respondWith: (p) => (response = p),
  });
  assert.equal(await (await response).text(), "offline shell");
  for (const url of [
    "https://other.com/index.html",
    "https://example.com/other-site/index.html",
    "https://example.com/TerarriaWiki/health",
  ]) {
    let handled = false;
    h.events.fetch({
      request: { method: "GET", url, mode: "cors" },
      respondWith: () => (handled = true),
    });
    assert.equal(handled, false);
  }
});
