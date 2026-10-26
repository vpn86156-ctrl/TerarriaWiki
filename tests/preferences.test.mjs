import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { writeFileSync, unlinkSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { chapters } from "../src/data/chapters.js";
import { acquisitionNotes } from "../src/data/acquisition-notes.js";
const output = "/tmp/terra-preferences-" + process.pid + ".mjs";
const b = await build({
  entryPoints: ["src/state/Settings.jsx"],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
writeFileSync(output, b.outputFiles[0].contents);
const { normalizeSettings } = await import(pathToFileURL(output));
unlinkSync(output);
test("Existing users have no autoplay: audio and ambient default to off", () => {
  for (const old of [null, {}, [], false]) {
    const s = normalizeSettings(old);
    assert.equal(s.sound, false);
    assert.equal(s.ambient, false);
    assert.equal(s.animations, true);
  }
});
test("Preferences validate booleans and bound volume without touching world saves", () => {
  const s = normalizeSettings({ sound: true, volume: 999, particles: false });
  assert.equal(s.volume, 100);
  assert.equal(s.sound, true);
  assert.equal(s.particles, false);
  assert.equal(normalizeSettings({ volume: -3 }).volume, 0);
  assert.equal(
    normalizeSettings({ volume: "80", animations: "false" }).volume,
    35,
  );
  assert.equal(normalizeSettings({ animations: "false" }).animations, true);
});
test("Every chapter has a unique bundled biome background", () => {
  const hashes = chapters.map((c) =>
    createHash("sha256")
      .update(readFileSync(`public/images/biomes/${c.scene}.webp`))
      .digest("hex"),
  );
  assert.equal(new Set(hashes).size, 11);
});
test("Enchanted Sword supplements crate tables with environmental acquisition and distinguishes the enemy", () => {
  const note = acquisitionNotes.EnchantedSword;
  assert.match(note.text, /меч в камне/);
  assert.match(note.clarification, /противником/);
  assert.match(note.chance, /1.4.5/);
  assert.match(note.url, /wiki.gg/);
  assert.match(note.enemyUrl, /\(NPC\)/);
});
