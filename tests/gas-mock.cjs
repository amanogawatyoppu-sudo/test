// GAS（gas/Code.gs）をメモリ上のにせのスプレッドシートで動かすための道具（テスト用）
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const code = fs.readFileSync(path.join(__dirname, "..", "gas", "Code.gs"), "utf8");
// --- メモリ上のスプレッドシート ---
function makeSheet(rows) {
  const data = rows.map(r => r.slice());
  const width = () => data.reduce((m, r) => Math.max(m, r.length), 0);
  const cell = (r, c) => (data[r] && data[r][c] !== undefined ? data[r][c] : "");
  const put = (r, c, v) => { while (data.length <= r) data.push([]); while (data[r].length <= c) data[r].push(""); data[r][c] = v; };
  const range = (r, c, nr = 1, nc = 1) => ({
    getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => cell(r - 1 + i, c - 1 + j))),
    getValue: () => cell(r - 1, c - 1),
    setValue: v => put(r - 1, c - 1, v),
    setValues: vs => vs.forEach((row, i) => row.forEach((v, j) => put(r - 1 + i, c - 1 + j, v))),
    setNumberFormat: () => {},
  });
  return {
    data,
    getLastRow: () => data.length,
    getLastColumn: () => width(),
    getMaxRows: () => Math.max(1000, data.length),
    getRange: (a, b, c, d) => (typeof a === "string" ? range(1, 1) : range(a, b, c, d)),
    getDataRange: () => range(1, 1, data.length, width()),
    appendRow: row => { data.push(row.slice()); },
  };
}

function makeGas(sheets) {
  const ss = {
    getSheetByName: n => sheets[n] || null,
    insertSheet: n => (sheets[n] = makeSheet([])),
  };
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    ContentService: { createTextOutput: s => ({ text: s, setMimeType() { return this; } }), MimeType: { JSON: "json" } },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { formatDate: d => d.toISOString().slice(0, 10) },
    console,
  };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  const post = body => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).text);
  const get = params => JSON.parse(ctx.doGet({ parameter: params }).text);
  return { post, get, sheets };
}

module.exports = { makeSheet, makeGas };
