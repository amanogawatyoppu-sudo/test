const test = require("node:test");
const assert = require("node:assert");
const C = require("../story/story-core.js");

const ch = [
  { id: "c1", guides: ["minarai", "shokunin"], stages: [{ id: "1-1" }, { id: "1-2" }] },
  { id: "c2", guides: ["megane"], stages: [{ id: "2-1" }, { id: "2-2" }] },
];
const fresh = () => ({ v: 1, cleared: {}, prefs: { noodle: null, spice: null }, finished: false });
const clearAll = () => { let s = C.newState(); for (const id of C.stageOrder(ch)) s = C.recordClear(s, id, 0.9, "A").state; return s; };

test("newState shape", () => assert.deepStrictEqual(C.newState(), fresh()));
test("normalize falls back to fresh state", () => {
  assert.deepStrictEqual(C.normalize("garbage"), fresh());
  assert.deepStrictEqual(C.normalize(null), fresh());
  assert.deepStrictEqual(C.normalize({ v: 1 }), fresh());
  assert.deepStrictEqual(C.normalize({ v: 1, cleared: "x", prefs: 3 }), fresh());
});
test("normalize keeps valid data", () => {
  const s = { v: 1, cleared: { "1-1": "A" }, prefs: { noodle: "thick", spice: null }, finished: true };
  assert.deepStrictEqual(C.normalize(s), s);
});
test("stageOrder flattens", () => assert.deepStrictEqual(C.stageOrder(ch), ["1-1", "1-2", "2-1", "2-2"]));
test("isUnlocked follows previous clear", () => {
  let s = C.newState();
  assert.strictEqual(C.isUnlocked(s, ch, "1-1"), true);
  assert.strictEqual(C.isUnlocked(s, ch, "1-2"), false);
  s = C.recordClear(s, "1-1", 0.6, "B").state;
  assert.strictEqual(C.isUnlocked(s, ch, "1-2"), true);
});
test("recordClear threshold and best grade", () => {
  const s0 = C.newState();
  assert.strictEqual(C.recordClear(s0, "1-1", 0.59, "C").cleared, false);
  assert.deepStrictEqual(C.recordClear(s0, "1-1", 0.59, "C").state.cleared, {});
  const r = C.recordClear(s0, "1-1", 0.6, "B");
  assert.strictEqual(r.cleared, true);
  assert.deepStrictEqual(s0.cleared, {}, "does not mutate input");
  const r2 = C.recordClear(r.state, "1-1", 0.3, "C");
  assert.strictEqual(r2.state.cleared["1-1"], "B");
  assert.strictEqual(C.recordClear(r.state, "1-1", 0.96, "S").state.cleared["1-1"], "S");
});
test("isStoryCleared needs every stage", () => {
  let s = C.newState();
  for (const id of ["1-1", "1-2", "2-1"]) s = C.recordClear(s, id, 0.9, "A").state;
  assert.strictEqual(C.isStoryCleared(s, ch), false);
  assert.strictEqual(C.isStoryCleared(clearAll(), ch), true);
});
test("setPref and tasteTypeId", () => {
  let s = C.setPref(C.newState(), "noodle", "thick");
  assert.strictEqual(C.tasteTypeId(s.prefs), null);
  s = C.setPref(s, "spice", "hot");
  assert.strictEqual(C.tasteTypeId(s.prefs), "thick_hot");
  assert.strictEqual(C.tasteTypeId({ noodle: "thin", spice: "mild" }), "thin_mild");
});
test("gachaUnlocked", () => {
  assert.strictEqual(C.gachaUnlocked(C.newState(), ch, null), false);
  assert.strictEqual(C.gachaUnlocked(C.newState(), ch, { minarai: 1 }), true);
  assert.strictEqual(C.gachaUnlocked(C.newState(), ch, { minarai: 0 }), false);
  assert.strictEqual(C.gachaUnlocked(clearAll(), ch, null), true);
});
test("metCharacters", () => {
  assert.deepStrictEqual(C.metCharacters(C.newState(), ch), ["minarai", "shokunin"]);
  const s = C.recordClear(C.newState(), "2-1", 0.9, "A").state;
  assert.deepStrictEqual(C.metCharacters(s, ch), ["minarai", "shokunin", "megane"]);
});
