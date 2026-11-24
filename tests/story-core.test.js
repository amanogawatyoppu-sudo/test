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

test("story data shape", () => {
  const D = require("../story/story-data.js");
  const IDS = ["minarai","oroshi_musume","kamaban","soba_hatake","shokunin","ekiin","ashigaru","tabi_shonin","megane",
    "honda","kaneko","kyoryu","kasumi","sennin","oroshi_ryu","kuzuryu_hime"];
  assert.strictEqual(D.STORY_CHAPTERS.length, 6);
  const ids = new Set(); let asks = [];
  for (const c of D.STORY_CHAPTERS) {
    assert.strictEqual(c.stages.length, 3, c.id);
    assert.deepStrictEqual(c.stages.map(s => s.kind), ["meet", "train", "taste"]);
    c.guides.forEach(g => assert.ok(IDS.includes(g), g));
    for (const s of c.stages) {
      assert.ok(!ids.has(s.id), "dup " + s.id); ids.add(s.id);
      assert.ok(["easy","normal","hard"].includes(s.diff));
      assert.ok(s.title.ja && s.title.en);
      for (const l of [...s.before, ...s.after]) {
        assert.ok(l.who === "you" || IDS.includes(l.who), s.id + " " + l.who);
        assert.ok(l.ja && l.en, s.id);
      }
      if (s.ask) asks.push([s.id, s.ask]);
    }
  }
  assert.deepStrictEqual(asks, [["2-2", "noodle"], ["4-2", "spice"]]);
  const seeds = D.STORY_CHAPTERS.flatMap(c => c.stages.map(s => s.song.seed));
  assert.strictEqual(new Set(seeds).size, 18);
  assert.deepStrictEqual(Object.keys(D.STORY_TASTE_TYPES).sort(), ["thick_hot","thick_mild","thin_hot","thin_mild"]);
  assert.strictEqual(D.STORY_SHOPS.length, 0);
  assert.ok(D.STORY_GUIDE_URL.startsWith("https://"));
});

test("kaneko stays a nameless Kyoto soba maker until the 6-2 reveal", () => {
  const D = require("../story/story-data.js");
  const order = D.STORY_CHAPTERS.flatMap(c => c.stages);
  const revealAt = order.findIndex(s => s.id === "6-2");
  const kanekoLines = (s) => [...s.before, ...s.after].filter(l => l.who === "kaneko");
  const early = order.slice(0, revealAt).flatMap(kanekoLines);
  assert.ok(early.length >= 3, "appears at least 3 times before the reveal");
  assert.ok(early.every(l => l.mask === true), "masked before the reveal");
  assert.ok(early.every(l => !l.ja.includes("金子")), "name not spoken before the reveal");
  const reveal = order[revealAt];
  assert.ok([...reveal.before, ...reveal.after].some(l => l.who === "kaneko" && !l.mask && l.ja.includes("金子権左衛門")));
});
