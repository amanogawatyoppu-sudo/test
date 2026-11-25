// GAS（gas/Code.gs）の自動ログイン（キー）まわりのテスト。スプレッドシートはメモリ上のにせものを使う。
// 実行: node --test tests/
const test = require("node:test");
const assert = require("node:assert");
const { makeSheet, makeGas } = require("./gas-mock.cjs");

const KEY_A = "sk_" + "a".repeat(32);
const KEY_B = "sk_" + "b".repeat(32);

function oldWorld() {
  return makeGas({
    players: makeSheet([["名前", "パスワード", "累計極上", "UUID", "最終更新"], ["たろう", "pass1234", 5, "", ""]]),
    profiles: makeSheet([["名前", "データ", "更新日時"], ["たろう", JSON.stringify({ coins: 1234, chars: { sennin: 1 }, selected: "sennin" }), ""]]),
  });
}

test("register: 名前だけで新しい職人ができ、キーでガチャ情報が読める", () => {
  const g = makeGas({});
  const r = g.post({ action: "register", name: "はなこ", key: KEY_A });
  assert.strictEqual(r.status, "ok");
  assert.strictEqual(r.name, "はなこ");
  assert.strictEqual(r.profile.coins, 300);
  const p = g.post({ action: "profile", key: KEY_A });
  assert.strictEqual(p.status, "ok");
  assert.strictEqual(p.name, "はなこ");
});

test("register: 同じキーで送り直しても職人は1人のまま", () => {
  const g = makeGas({});
  g.post({ action: "register", name: "はなこ", key: KEY_A });
  const again = g.post({ action: "register", name: "はなこ", key: KEY_A });
  assert.strictEqual(again.status, "ok");
  assert.strictEqual(g.sheets.players.data.length, 2);
});

test("register: 使われている名前・変な名前・変なキーは断る", () => {
  const g = oldWorld();
  assert.strictEqual(g.post({ action: "register", name: "たろう", key: KEY_A }).status, "name_taken");
  assert.strictEqual(g.post({ action: "register", name: "しね", key: KEY_A }).status, "bad_name");
  assert.strictEqual(g.post({ action: "register", name: "じろう", key: "1234" }).status, "bad_key");
});

test("キーだけの職人には、パスワード（空でも）では入れない", () => {
  const g = makeGas({});
  g.post({ action: "register", name: "はなこ", key: KEY_A });
  assert.strictEqual(g.post({ action: "profile", name: "はなこ", pass: "" }).status, "wrong_pass");
  assert.strictEqual(g.post({ action: "gacha", name: "はなこ", pass: "" , count: 1 }).status, "wrong_pass");
  assert.strictEqual(g.post({ action: "auth", name: "はなこ", pass: "" }).status, "wrong_pass");
  assert.strictEqual(g.post({ action: "auth", name: "はなこ", pass: "abcd" }).status, "wrong_pass");
});

test("link_key: 前の名前＋パスワードの職人を、そば粉・職人そのままで引き継げる", () => {
  const g = oldWorld();
  assert.strictEqual(g.post({ action: "link_key", name: "たろう", pass: "nope", key: KEY_A }).status, "wrong_pass");
  const r = g.post({ action: "link_key", name: "たろう", pass: "pass1234", key: KEY_A });
  assert.strictEqual(r.status, "ok");
  assert.strictEqual(r.key, KEY_A);
  assert.strictEqual(r.profile.coins, 1234);
  assert.deepStrictEqual(r.profile.chars, { sennin: 1 });
  assert.strictEqual(r.stats.perfect, 5);
  // キーで入れる。前のパスワードもそのまま使える
  assert.strictEqual(g.post({ action: "profile", key: KEY_A }).profile.coins, 1234);
  assert.strictEqual(g.post({ action: "profile", name: "たろう", pass: "pass1234" }).status, "ok");
});

test("link_key: 2台目で引き継いでも、1台目と同じキーが返る（1台目が締め出されない）", () => {
  const g = oldWorld();
  g.post({ action: "link_key", name: "たろう", pass: "pass1234", key: KEY_A });
  const r2 = g.post({ action: "link_key", name: "たろう", pass: "pass1234", key: KEY_B });
  assert.strictEqual(r2.key, KEY_A);
  assert.strictEqual(g.post({ action: "profile", key: KEY_A }).status, "ok");
  assert.strictEqual(g.post({ action: "profile", key: KEY_B }).status, "no_user");
});

test("キーでガチャ・そば粉が動く", () => {
  const g = oldWorld();
  g.post({ action: "link_key", name: "たろう", pass: "pass1234", key: KEY_A });
  const r = g.post({ action: "gacha", key: KEY_A, count: 1 });
  assert.strictEqual(r.status, "ok");
  assert.strictEqual(r.results.length, 1);
  const saved = JSON.parse(g.sheets.profiles.data[1][1]);
  assert.ok(saved.coins <= 1234 - 100 + 200);
});

test("知らないキーは no_user", () => {
  const g = oldWorld();
  assert.strictEqual(g.post({ action: "profile", key: KEY_B }).status, "no_user");
  assert.strictEqual(g.post({ action: "profile", key: "bad" }).status, "no_user");
});
