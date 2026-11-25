const test = require("node:test");
const assert = require("node:assert");
const G = require("../gacha/gacha-core.js");

test("bestRarity picks the highest", () => {
  assert.strictEqual(G.bestRarity([{ rarity: "N" }, { rarity: "SR" }, { rarity: "R" }]), "SR");
  assert.strictEqual(G.bestRarity([]), "N");
});
test("chargePlan upgrades SSR sometimes", () => {
  assert.deepStrictEqual(G.chargePlan("SSR", () => 0.1), { from: "R", to: "SSR" });
  assert.deepStrictEqual(G.chargePlan("SSR", () => 0.9), { from: "SSR", to: "SSR" });
});
test("chargePlan upgrades SR sometimes", () => {
  assert.deepStrictEqual(G.chargePlan("SR", () => 0.1), { from: "R", to: "SR" });
  assert.deepStrictEqual(G.chargePlan("SR", () => 0.9), { from: "SR", to: "SR" });
});
test("chargePlan treats N and R alike", () => {
  assert.deepStrictEqual(G.chargePlan("N", () => 0), { from: "R", to: "R" });
  assert.deepStrictEqual(G.chargePlan("R", () => 0), { from: "R", to: "R" });
});
test("revealSteps keeps order and marks first-time", () => {
  assert.deepStrictEqual(G.revealSteps([{ id: "a", rarity: "N", dup: true }, { id: "b", rarity: "SSR", dup: false }]), [
    { index: 0, id: "a", rarity: "N", isNew: false, special: false },
    { index: 1, id: "b", rarity: "SSR", isNew: true, special: true },
  ]);
});
