/**
 * 無限そば道 - GAS (修正版 v5)
 * players:    [name, pass, date, perfectCount]  ※実際の列順（環境により異なってもgetPlayerColumnsが動的に検出）
 * 月間シート・歴代番付: 実際のヘッダーの並び順はシートごとに異なる可能性があるため、
 *   getScoreSheetColumns()でヘッダー文字列から毎回動的に列位置を検出する（v4で全面的に対応）。
 * profiles:   [名前, データ(JSON), 更新日時]  ※v5で追加。マイページ・キャラ・ガチャ用。初回アクセス時に自動作成。
 *
 * ▼v2での修正点
 * 1) 月間シートのupsertキーを「UUID」から「名前(+モード)」に変更。
 * 2) ランクマのスコアも「歴代番付」シートにupsertするように追加。
 *
 * ▼v3での修正点（累計極上番付が機能しない問題）
 * 3) playersシートの列位置を毎回ヘッダーから動的検出するgetPlayerColumns()を新設。
 * 4) 新規登録時の列順の決め打ちを修正。
 *
 * ▼v4での修正点（歴代番付が「ずれる」問題・根本原因）
 * 5) 歴代番付・月間シートへの書き込み処理(upsertScoreByName)が、実際のヘッダー並び
 *    ([名前,スコア,モード,日時]等)を無視して固定の列番号(2列目=名前,4列目=モード等)で
 *    読み書きしていたため、実際のヘッダーと異なる位置にデータを書き込み続けていた。
 *    getScoreSheetColumns()でヘッダーから動的に列位置を検出するよう全面修正。
 * 6) 歴代番付の既存データの列ズレを直す runFixRekidaiSheet() を、位置ベースの判定から
 *    「値の中身」で判定する方式に作り直した（Dateオブジェクトかどうか、30/60/infinite
 *    のどれかどうかで判定）。実際のヘッダーが何であっても正しく検出でき、既に正しい行は
 *    書き換えても値が変わらないため、何度実行しても安全（べき等）。
 *
 * ▼v5での追加点（マイページ・キャラクター・ガチャ）
 * 7) doGetの応答に apiVersion を追加。フロントはこれを見て、サーバーが新機能に
 *    対応しているかを判定する（古いGASのままでも誤ってデータを書き込まないため）。
 * 8) doPostに action = profile / earn / gacha / select を追加（ファイル末尾の v5 セクション）。
 *    いずれも players シートの名前＋パスワードで認証してから処理する。
 *    コイン（そば粉）の加算とガチャの抽選はサーバー側で行い、クライアントの改ざんを防ぐ。
 * 9) 未知の action が来た場合は、スコア保存に流れずにエラーを返すようにした。
 *
 * ▼v6での追加点（今日のそば打ち＝デイリー）
 * 10) daily シート [日付, 名前, スコア, 日時] を追加（初回アクセス時に自動作成）。
 *     doGet に ?daily=1 を付けると今日の番付を返す（&name= を付けると自分の記録も返す）。
 * 11) action = daily_submit で今日の記録を保存。1人1日1回目だけが残る。
 *     日付はサーバー側の日本時間で決める（端末の時計をずらしても別の日にはできない）。
 *
 * ▼v7での追加点（名前のチェック）
 * 12) 不適切な名前（暴言・性的な語・差別語。英語と日本語）と長すぎる名前を、新規登録とスコア保存で弾く。
 *     ページ側でも同じチェックをしているが、直接サーバーに送られた場合に備えてこちらでも判定する。
 *     弾いたときは { status: "bad_name" } を返す。NGワードの一覧はファイル末尾（index.html と揃えること）。
 *
 * ▼v8での変更点（動作の軽量化）
 * 13) 番付の読み込み（doGet）でスクリプトの鍵（LockService）をかけないようにした。
 *     読み込みは何も書き換えないので鍵は不要。鍵をかけていたため、番付表示・ログイン・保存が
 *     同時に来ると1件ずつ順番待ちになり、遅く感じる原因になっていた。書き込み（doPost）は従来どおり鍵をかける。
 */

function doGet(e) {
  const mode = e.parameter.mode || "30";

  try {
    // 読み込み専用なので鍵（LockService）はかけない（v8）
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // v6: 今日のそば打ち（デイリー）の番付
    if (e.parameter.daily) {
      return jsonOut(getDailyRanking(ss, String(e.parameter.name || "").trim()));
    }

    const now = new Date();
    const currentMonthSheetName = Utilities.formatDate(now, "GMT+9", "yyyy-MM");
    const monthSheet = ss.getSheetByName(currentMonthSheetName);

    // 月間スコアランキング（同名は最高スコアのみ残す）
    let monthFiltered = [];
    if (monthSheet && monthSheet.getLastRow() > 1) {
      const monthAll = monthSheet.getDataRange().getValues();
      const mCols = getScoreSheetColumns(monthAll[0]);
      const monthData = monthAll.slice(1);
      const nameMap = {};
      monthData.forEach(row => {
        if (String(row[mCols.modeCol]).trim() !== mode) return;
        const name = String(row[mCols.nameCol]).trim();
        const score = Number(row[mCols.scoreCol]);
        if (!name || isNaN(score)) return;
        if (!nameMap[name] || score > nameMap[name]) nameMap[name] = score;
      });
      monthFiltered = Object.entries(nameMap)
        .map(([name, score]) => ({ name, score }))
        .sort((a, b) => b.score - a.score);
    }

    // 歴代ランキング（ヘッダーから列を動的取得、同名最高スコア）
    const rekidaiSheet = ss.getSheetByName("歴代番付");
    let rekidaiFiltered = [];
    if (rekidaiSheet && rekidaiSheet.getLastRow() > 1) {
      const rekidaiAll = rekidaiSheet.getDataRange().getValues();
      const rHeader = rekidaiAll[0];
      let rNameCol = 0, rScoreCol = 1, rModeCol = 2;
      rHeader.forEach((h, i) => {
        const t = String(h).toLowerCase().trim();
        if (t === "name" || t === "名前") rNameCol = i;
        if (t === "score" || t === "スコア") rScoreCol = i;
        if (t === "mode" || t === "モード") rModeCol = i;
      });
      const nameMap = {};
      rekidaiAll.slice(1).forEach(row => {
        const rowMode = String(row[rModeCol]).trim();
        if (rowMode !== mode) return;
        const name = String(row[rNameCol]).trim();
        const score = Number(row[rScoreCol]);
        if (!name || isNaN(score) || name === "name" || name === "名前") return;
        if (!nameMap[name] || score > nameMap[name]) nameMap[name] = score;
      });
      rekidaiFiltered = Object.entries(nameMap)
        .map(([name, score]) => ({ name, score }))
        .sort((a, b) => b.score - a.score);
    }

    // 累計極上ランキング（全部門合算・モード関係なし）
    const userSheet = ss.getSheetByName("players");
    let perfectRank = [];
    if (userSheet && userSheet.getLastRow() > 1) {
      const userData = userSheet.getDataRange().getValues();
      const cols = getPlayerColumns(userData[0]);
      if (cols.perfectCol >= 0) {
        perfectRank = userData.slice(1)
          .map(row => ({ name: String(row[cols.nameCol]).trim(), score: toSafeNumber(row[cols.perfectCol]) }))
          .filter(u => u.name && u.score > 0)
          .sort((a, b) => b.score - a.score);
      }
    }

    const result = {
      apiVersion: API_VERSION,
      month: monthFiltered.slice(0, 30),
      monthTotal: monthFiltered,
      rekidai: rekidaiFiltered.slice(0, 10),
      rekidaiTotal: rekidaiFiltered,
      monthPerfect: perfectRank.slice(0, 10),
      monthPerfectTotal: perfectRank
    };

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  const postData = JSON.parse(e.postData.contents);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    // --- 認証リクエスト ---
    if (postData.action === "auth") {
      return handleAuth(postData, ss);
    }

    // --- v5: マイページ・キャラ・ガチャ ---
    if (PLAYER_ACTIONS.indexOf(postData.action) >= 0) {
      return handlePlayerAction(postData, ss);
    }

    // --- 未知のaction：スコア保存に流さない（名前・スコアの無い行が番付に書き込まれるのを防ぐ）---
    if (postData.action) {
      return jsonOut({ status: "error", message: "unknown action: " + postData.action });
    }

    // --- v7: 不適切な名前・長すぎる名前ではスコアを保存しない ---
    if (!isAllowedName(String(postData.name || "").trim())) {
      return jsonOut({ status: "bad_name" });
    }

    // --- スコア保存 ---
    if (postData.rankma) {
      // ランクマ：月間シート + 歴代番付の両方に「名前+モード」単位でupsert
      const now = new Date();
      const currentMonthSheetName = Utilities.formatDate(now, "GMT+9", "yyyy-MM");
      let monthSheet = ss.getSheetByName(currentMonthSheetName);
      if (!monthSheet) {
        monthSheet = ss.insertSheet(currentMonthSheetName);
        monthSheet.appendRow(["日時", "名前", "スコア", "モード", "UUID"]);
      }

      const uuid = String(postData.uuid || "").trim();
      const name = String(postData.name || "").trim();
      const score = Number(postData.score);
      const mode = String(postData.mode || "").trim();
      const perfectCount = Number(postData.perfectCount) || 0;

      // ---- ① 月間シートへupsert（名前+モードで識別）----
      upsertScoreByName(monthSheet, name, score, mode, now, uuid);

      // ---- ② 歴代番付にもupsert（ランクマ結果も歴代に反映）----
      let rekidaiSheet = ss.getSheetByName("歴代番付");
      if (!rekidaiSheet) {
        rekidaiSheet = ss.insertSheet("歴代番付");
        rekidaiSheet.appendRow(["日時", "名前", "スコア", "モード"]);
      }
      upsertScoreByName(rekidaiSheet, name, score, mode, now, null);

      // 累計極上をplayersシートに加算（ヘッダー動的取得）
      if (perfectCount > 0) {
        const userSheet = ss.getSheetByName("players");
        if (userSheet) {
          ensurePlayersHeader(userSheet);
          const userData = userSheet.getDataRange().getValues();
          const cols = getPlayerColumns(userData[0]);
          if (cols.perfectCol >= 0) {
            for (let i = 1; i < userData.length; i++) {
              if (String(userData[i][cols.nameCol]).trim() === name) {
                const current = toSafeNumber(userData[i][cols.perfectCol]);
                const targetCell = userSheet.getRange(i + 1, cols.perfectCol + 1);
                targetCell.setNumberFormat("0"); // Sheetsが自動で日付書式を引き継ぐ事故を防ぐ
                targetCell.setValue(current + perfectCount);
                break;
              }
            }
          }
        }
      }

    } else {
      // 通常修行：歴代番付に追記（名前+モードで識別）
      let rekidaiSheet = ss.getSheetByName("歴代番付");
      if (!rekidaiSheet) {
        rekidaiSheet = ss.insertSheet("歴代番付");
        rekidaiSheet.appendRow(["日時", "名前", "スコア", "モード"]);
      }
      const name = String(postData.name || "").trim();
      const score = Number(postData.score);
      const mode = String(postData.mode || "").trim();
      const now = new Date();

      upsertScoreByName(rekidaiSheet, name, score, mode, now, null);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/**
 * 月間シート・歴代番付シート共通：ヘッダー文字列から各列のインデックスを動的に検出する。
 * 実際のシートの列並びが [日時,名前,スコア,モード] でも [名前,スコア,モード,日時] でも、
 * どちらでも正しく書き込み・upsertできるようにするため。
 */
function getScoreSheetColumns(header) {
  let dateCol = 0, nameCol = 1, scoreCol = 2, modeCol = 3, uuidCol = 4;
  header.forEach((h, i) => {
    const t = String(h).toLowerCase().trim();
    if (t === "name" || t === "名前") nameCol = i;
    else if (t === "score" || t === "スコア") scoreCol = i;
    else if (t === "mode" || t === "モード") modeCol = i;
    else if (t === "date" || t === "日時" || t === "日付") dateCol = i;
    else if (t === "uuid") uuidCol = i;
  });
  return { dateCol, nameCol, scoreCol, modeCol, uuidCol };
}

/**
 * 「名前+モード」をキーに、シートへスコアをupsertする共通関数。
 * ヘッダーから列位置を動的に検出するので、実際の列並びが日時始まりでも名前始まりでも対応する。
 * 既存行があればスコアが上回った時だけ更新、なければ新規追加。
 */
function upsertScoreByName(sheet, name, score, mode, now, uuid) {
  const lastCol = sheet.getLastColumn();
  const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const cols = getScoreSheetColumns(header);

  if (sheet.getLastRow() > 1) {
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][cols.nameCol]).trim() === name && String(data[i][cols.modeCol]).trim() === mode) {
        // UUID列がある（月間シート）場合は最新のUUIDを記録しておく（参考情報として）
        if (uuid !== null && cols.uuidCol < lastCol) {
          sheet.getRange(i + 1, cols.uuidCol + 1).setValue(uuid);
        }
        if (score > Number(data[i][cols.scoreCol])) {
          sheet.getRange(i + 1, cols.dateCol + 1).setValue(now);
          sheet.getRange(i + 1, cols.scoreCol + 1).setValue(score);
        }
        return;
      }
    }
  }
  // 新規行：ヘッダーの並びに合わせて正しい位置に値を入れる
  const newRow = new Array(lastCol).fill("");
  newRow[cols.dateCol] = now;
  newRow[cols.nameCol] = name;
  newRow[cols.scoreCol] = score;
  newRow[cols.modeCol] = mode;
  if (uuid !== null && cols.uuidCol < lastCol) newRow[cols.uuidCol] = uuid;
  sheet.appendRow(newRow);
}

// --- 認証処理 ---
function handleAuth(postData, ss) {
  const name = String(postData.name || "").trim();
  const pass = String(postData.pass || "").trim();
  const mode = String(postData.mode || "30").trim();

  let userSheet = ss.getSheetByName("players");
  if (!userSheet) {
    userSheet = ss.insertSheet("players");
    userSheet.appendRow(["名前", "パスワード", "累計極上", "UUID", "最終更新"]);
  }

  const userData = userSheet.getDataRange().getValues();
  const colsForExisting = getPlayerColumns(userData[0]);
  for (let i = 1; i < userData.length; i++) {
    if (String(userData[i][colsForExisting.nameCol]).trim() === name) {
      if (String(userData[i][colsForExisting.passCol]).trim() !== pass) {
        return ContentService.createTextOutput(JSON.stringify({ status: "wrong_pass" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      // 認証成功：今月のスコアと累計極上を返す
      const now = new Date();
      const currentMonthSheetName = Utilities.formatDate(now, "GMT+9", "yyyy-MM");
      const monthSheet = ss.getSheetByName(currentMonthSheetName);
      let score = 0;
      if (monthSheet && monthSheet.getLastRow() > 1) {
        const monthAll = monthSheet.getDataRange().getValues();
        const mCols = getScoreSheetColumns(monthAll[0]);
        const monthData = monthAll.slice(1);
        monthData.forEach(row => {
          if (String(row[mCols.nameCol]).trim() === name && String(row[mCols.modeCol]).trim() === mode) {
            if (Number(row[mCols.scoreCol]) > score) score = Number(row[mCols.scoreCol]);
          }
        });
      }
      const perfect = colsForExisting.perfectCol >= 0 ? toSafeNumber(userData[i][colsForExisting.perfectCol]) : 0;
      return ContentService.createTextOutput(JSON.stringify({ status: "ok", score, perfect }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  // v7: 不適切な名前・長すぎる名前では新規登録させない
  if (!isAllowedName(name)) {
    return jsonOut({ status: "bad_name" });
  }

  // 新規登録：ヘッダーの並び順に合わせて正しい列に値を入れる
  ensurePlayersHeader(userSheet);
  const header = userSheet.getRange(1, 1, 1, userSheet.getLastColumn()).getValues()[0];
  const cols = getPlayerColumns(header);
  const newRow = new Array(header.length).fill("");
  newRow[cols.nameCol] = name;
  newRow[cols.passCol] = pass;
  if (cols.dateCol >= 0) newRow[cols.dateCol] = new Date();
  if (cols.perfectCol >= 0) newRow[cols.perfectCol] = 0;
  userSheet.appendRow(newRow);
  const newRowIndex = userSheet.getLastRow();
  if (cols.perfectCol >= 0) {
    // Sheetsが直前行の書式（日付など）を自動で引き継いでしまう事故を防ぐため、明示的に数値書式へ矯正
    userSheet.getRange(newRowIndex, cols.perfectCol + 1).setNumberFormat("0");
  }
  if (cols.dateCol >= 0) {
    userSheet.getRange(newRowIndex, cols.dateCol + 1).setNumberFormat("yyyy/MM/dd HH:mm:ss");
  }
  return ContentService.createTextOutput(JSON.stringify({ status: "new" }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * playersシートのヘッダー文字列から各列のインデックスを動的に検出する。
 * 列の並び順が環境によって違っても（name/pass/date/perfectCount等）壊れないようにするため。
 * 見つからない場合は妥当なデフォルト値、あるいは-1（存在しない）を返す。
 */
/**
 * セルの値を安全に数値として読み取る。
 * スプレッドシート側の書式が「日付」のまま残っていると、getValues()が
 * 数値ではなくDateオブジェクトを返すことがある（過去のバグの後遺症）。
 * その場合は巨大な数字に化けてランキングを壊すので、Dateが来たら0として扱う。
 */
function toSafeNumber(v) {
  if (v instanceof Date) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function getPlayerColumns(header) {
  let nameCol = 0, passCol = 1, dateCol = -1, perfectCol = -1;
  header.forEach((h, i) => {
    const t = String(h).toLowerCase().trim();
    if (t === "name" || t === "名前") nameCol = i;
    else if (t === "pass" || t === "password" || t === "パスワード") passCol = i;
    else if (t === "perfectcount" || t === "累計極上") perfectCol = i;
    else if (t === "date" || t === "最終更新" || t === "登録日") dateCol = i;
  });
  return { nameCol, passCol, dateCol, perfectCol };
}

function ensurePlayersHeader(sheet) {
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const cols = getPlayerColumns(header);
  if (cols.perfectCol === -1) {
    // perfectCount列が無ければ末尾に追加し、既存行に0を設定
    const newColIndex = sheet.getLastColumn() + 1;
    const lastRow = sheet.getLastRow();
    sheet.getRange(1, newColIndex).setValue("perfectCount");
    if (lastRow > 1) {
      const range = sheet.getRange(2, newColIndex, lastRow - 1, 1);
      range.setNumberFormat("0");
      for (let i = 2; i <= lastRow; i++) {
        const val = sheet.getRange(i, newColIndex).getValue();
        if (!val && val !== 0) sheet.getRange(i, newColIndex).setValue(0);
      }
    }
  }
}

// Googleスプレッドシートの日付シリアル値は 1899-12-30 を 0 とする。
// モード("30"や"60")が誤って日付として書き込まれてしまった値を、日数差から逆算して復元する。
function _sheetsSerialFromDate(d) {
  const epoch = new Date(Date.UTC(1899, 11, 30));
  const utcMs = d.getTime() - (d.getTimezoneOffset() * 60000);
  return Math.round((utcMs - epoch.getTime()) / 86400000);
}

// ===== 【手動実行用】歴代番付の列ズレを修正 =====
// 「どの列が正しいか」は実際のヘッダー文字列から判定し、各行は値の中身（Dateかどうか、
// 30/60/infiniteのどれかどうか、数値かどうか）で名前・スコア・モード・日時を判定してから、
// ヘッダーに合う位置へ並べ直す。既に正しい行は書き換えても値が変わらないので、
// 何度実行しても安全（べき等）。判定できない行は壊さないようスキップする。
// また、モード欄(30/60)が誤って日付(1900/01/29や1900/02/28)として書き込まれてしまった
// パターンも、日付のシリアル値から30/60を逆算して復元する。
function runFixRekidaiSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("歴代番付");
  if (!sheet) {
    SpreadsheetApp.getUi().alert("歴代番付シートが見つかりません。");
    return;
  }
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) {
    SpreadsheetApp.getUi().alert("データがありません。");
    return;
  }

  const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const cols = getScoreSheetColumns(header);
  const validModes = ["30", "60", "infinite"];

  const range = sheet.getRange(2, 1, lastRow - 1, lastCol);
  const data = range.getValues();
  let fixedCount = 0, recoveredModeCount = 0, skippedCount = 0;

  for (let i = 0; i < data.length; i++) {
    const cells = data[i].slice(0, 4);

    const dateIdxs = [0, 1, 2, 3].filter(idx => cells[idx] instanceof Date);
    let dateIdx = -1, modeIdx = -1, recoveredMode = null;

    if (dateIdxs.length === 1) {
      dateIdx = dateIdxs[0];
      const modeIdxs = [0, 1, 2, 3].filter(idx => idx !== dateIdx && validModes.includes(String(cells[idx]).trim()));
      if (modeIdxs.length === 1) modeIdx = modeIdxs[0];
    } else if (dateIdxs.length === 2) {
      // 2つともDate型の場合、片方は「30」または「60」が誤って日付化したモード欄の可能性を調べる
      for (const idx of dateIdxs) {
        const serial = _sheetsSerialFromDate(cells[idx]);
        if (serial === 30 || serial === 60) {
          modeIdx = idx;
          recoveredMode = String(serial);
          break;
        }
      }
      if (modeIdx !== -1) {
        dateIdx = dateIdxs.find(idx => idx !== modeIdx);
      }
    }

    if (dateIdx === -1 || modeIdx === -1) { skippedCount++; continue; }

    const remaining = [0, 1, 2, 3].filter(idx => idx !== dateIdx && idx !== modeIdx);
    const [i1, i2] = remaining;
    const n1 = Number(cells[i1]), n2 = Number(cells[i2]);
    const v1isNum = cells[i1] !== "" && !isNaN(n1);
    const v2isNum = cells[i2] !== "" && !isNaN(n2);

    let scoreVal, nameVal;
    if (v1isNum && !v2isNum) { scoreVal = n1; nameVal = String(cells[i2]).trim(); }
    else if (v2isNum && !v1isNum) { scoreVal = n2; nameVal = String(cells[i1]).trim(); }
    else if (v1isNum && v2isNum) {
      if (n1 >= n2) { scoreVal = n1; nameVal = String(cells[i2]).trim(); }
      else { scoreVal = n2; nameVal = String(cells[i1]).trim(); }
    } else { skippedCount++; continue; }

    const newRow = data[i].slice();
    newRow[cols.dateCol] = cells[dateIdx];
    newRow[cols.nameCol] = nameVal;
    newRow[cols.scoreCol] = scoreVal;
    newRow[cols.modeCol] = recoveredMode !== null ? recoveredMode : String(cells[modeIdx]).trim();
    data[i] = newRow;
    fixedCount++;
    if (recoveredMode !== null) recoveredModeCount++;
  }

  range.setValues(data);
  // モード欄を復元した行は、そのセルの書式が「日付」のまま残っているので数値表示に矯正
  if (recoveredModeCount > 0) {
    sheet.getRange(2, cols.modeCol + 1, lastRow - 1, 1).setNumberFormat("@"); // 文字列として表示
  }
  SpreadsheetApp.getUi().alert(
    `完了！\n並べ替え済み: ${fixedCount}件（うちモード復元: ${recoveredModeCount}件）\n判定不能でスキップ: ${skippedCount}件\n\n` +
    `実際のヘッダー [${header.join(", ")}] に合わせて並べました。\n` +
    `スキップされた行が残っている場合は教えてください、個別に確認します。`
  );
}

// ===== 【手動実行用】playersシートにperfectCount列を追加 =====
function runEnsurePlayersHeader() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const userSheet = ss.getSheetByName("players");
  if (!userSheet) {
    SpreadsheetApp.getUi().alert("playersシートが見つかりません。");
    return;
  }
  ensurePlayersHeader(userSheet);
  SpreadsheetApp.getUi().alert("完了！playersシートにperfectCount列を追加しました。");
}

// =====================================================================
// v5: マイページ・キャラクター・ガチャ
// =====================================================================

// フロント(index.html)はdoGetのapiVersionがこの値以上のときだけ新機能を使う
const API_VERSION = 6;

const PLAYER_ACTIONS = ["profile", "earn", "gacha", "select", "daily_submit"];

// キャラの排出表。idとレア度はフロント(index.html)の CHARACTERS と必ず一致させること。
const GACHA_POOL = [
  { id: "minarai",       r: "N" },
  { id: "oroshi_musume", r: "N" },
  { id: "kamaban",       r: "N" },
  { id: "shokunin",      r: "R" },
  { id: "ekiin",         r: "R" },
  { id: "ashigaru",      r: "R" },
  { id: "honda",         r: "SR" },
  { id: "kaneko",        r: "SR" },
  { id: "sennin",        r: "SSR" },
  { id: "oroshi_ryu",    r: "SSR" }
];
const RARITY_WEIGHT = { N: 60, R: 30, SR: 8, SSR: 2 };    // 排出率(%)
const DUPLICATE_REFUND = { N: 10, R: 30, SR: 80, SSR: 200 }; // かぶり時に返すそば粉
const GACHA_COST = { 1: 100, 10: 900 };
const START_COINS = 300;              // 初回はガチャ3回分をプレゼント
const EARN_MAX = 300;                 // 1プレイで貯まるそば粉の上限
const EARN_MIN_INTERVAL_MS = 15000;   // 連打による荒稼ぎ防止（1プレイは最低でもカウントダウン込みで十数秒かかる）

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// playersシートの名前＋パスワードで認証する。戻り値: "ok" / "wrong_pass" / "no_user"
function verifyPlayer(ss, name, pass) {
  const sheet = ss.getSheetByName("players");
  if (!name || !sheet || sheet.getLastRow() < 2) return "no_user";
  const data = sheet.getDataRange().getValues();
  const cols = getPlayerColumns(data[0]);
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][cols.nameCol]).trim() === name) {
      return String(data[i][cols.passCol]).trim() === pass ? "ok" : "wrong_pass";
    }
  }
  return "no_user";
}

function getProfileSheet(ss) {
  let sheet = ss.getSheetByName("profiles");
  if (!sheet) {
    sheet = ss.insertSheet("profiles");
    sheet.appendRow(["名前", "データ", "更新日時"]);
    // 数字だけの名前が数値に化けないよう、名前・データ列は文字列書式にしておく
    sheet.getRange("A:B").setNumberFormat("@");
  }
  return sheet;
}

function defaultProfile() {
  return { coins: START_COINS, chars: {}, selected: "", plays: 0, totalEarned: 0, lastEarnAt: 0 };
}

function loadProfile(sheet, name) {
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim() === name) {
        let saved = {};
        try { saved = JSON.parse(data[i][1] || "{}"); } catch (err) { saved = {}; }
        return { row: i + 2, profile: Object.assign(defaultProfile(), saved) };
      }
    }
  }
  return { row: -1, profile: defaultProfile() };
}

function saveProfile(sheet, row, name, profile) {
  const values = [name, JSON.stringify(profile), new Date()];
  if (row > 0) sheet.getRange(row, 1, 1, 3).setValues([values]);
  else sheet.appendRow(values);
}

// クライアントに返す項目だけに絞る
function publicProfile(p) {
  return { coins: p.coins, chars: p.chars, selected: p.selected, plays: p.plays, totalEarned: p.totalEarned };
}

// 歴代番付のモード別最高スコアと累計極上
function getPlayerStats(ss, name) {
  const best = { "30": 0, "60": 0, "infinite": 0 };
  const rekidai = ss.getSheetByName("歴代番付");
  if (rekidai && rekidai.getLastRow() > 1) {
    const all = rekidai.getDataRange().getValues();
    const c = getScoreSheetColumns(all[0]);
    all.slice(1).forEach(row => {
      if (String(row[c.nameCol]).trim() !== name) return;
      const m = String(row[c.modeCol]).trim();
      const s = Number(row[c.scoreCol]);
      if (m in best && !isNaN(s) && s > best[m]) best[m] = s;
    });
  }
  let perfect = 0;
  const players = ss.getSheetByName("players");
  if (players && players.getLastRow() > 1) {
    const data = players.getDataRange().getValues();
    const cols = getPlayerColumns(data[0]);
    if (cols.perfectCol >= 0) {
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][cols.nameCol]).trim() === name) { perfect = toSafeNumber(data[i][cols.perfectCol]); break; }
      }
    }
  }
  return { best, perfect };
}

function rollCharacter(guaranteeSR) {
  const weights = Object.assign({}, RARITY_WEIGHT);
  if (guaranteeSR) { weights.N = 0; weights.R = 0; }
  const total = Object.keys(weights).reduce((sum, k) => sum + weights[k], 0);
  let x = Math.random() * total;
  let rarity = "N";
  for (const r of ["SSR", "SR", "R", "N"]) {
    if (x < weights[r]) { rarity = r; break; }
    x -= weights[r];
  }
  const pool = GACHA_POOL.filter(c => c.r === rarity);
  return pool[Math.floor(Math.random() * pool.length)];
}

function handlePlayerAction(postData, ss) {
  const name = String(postData.name || "").trim();
  const pass = String(postData.pass || "").trim();
  const auth = verifyPlayer(ss, name, pass);
  if (auth !== "ok") return jsonOut({ status: auth });

  const sheet = getProfileSheet(ss);
  const loaded = loadProfile(sheet, name);
  const p = loaded.profile;

  // v6: 今日のそば打ちの記録（1日1回目だけ残す）
  if (postData.action === "daily_submit") {
    return jsonOut(submitDaily(ss, name, Number(postData.score)));
  }

  // マイページ表示用：プロフィール＋戦績
  if (postData.action === "profile") {
    if (loaded.row < 0) saveProfile(sheet, -1, name, p); // 初回アクセスで作成（初期そば粉つき）
    return jsonOut({ status: "ok", profile: publicProfile(p), stats: getPlayerStats(ss, name) });
  }

  // プレイ終了時のそば粉獲得（スコアに応じて。短時間の連続送信は無効）
  if (postData.action === "earn") {
    const score = Number(postData.score);
    const now = Date.now();
    let earned = 0;
    if (isFinite(score) && score >= 0 && now - Number(p.lastEarnAt || 0) >= EARN_MIN_INTERVAL_MS) {
      earned = Math.min(EARN_MAX, 10 + Math.floor(score / 250));
      p.coins += earned;
      p.totalEarned += earned;
      p.plays += 1;
      p.lastEarnAt = now;
      saveProfile(sheet, loaded.row, name, p);
    }
    return jsonOut({ status: "ok", earned, profile: publicProfile(p) });
  }

  // ガチャ（1回 / 10連。10連はSR以上1体確定）
  if (postData.action === "gacha") {
    const count = Number(postData.count) === 10 ? 10 : 1;
    const cost = GACHA_COST[count];
    if (p.coins < cost) return jsonOut({ status: "no_coins", profile: publicProfile(p) });
    p.coins -= cost;
    const results = [];
    for (let k = 0; k < count; k++) {
      const guarantee = count === 10 && k === count - 1 && !results.some(r => r.rarity === "SR" || r.rarity === "SSR");
      const ch = rollCharacter(guarantee);
      const dup = !!p.chars[ch.id];
      p.chars[ch.id] = (p.chars[ch.id] || 0) + 1;
      const refund = dup ? DUPLICATE_REFUND[ch.r] : 0;
      p.coins += refund;
      results.push({ id: ch.id, rarity: ch.r, dup: dup, refund: refund });
    }
    if (!p.selected) p.selected = results[0].id; // 初めてのキャラは自動で連れて行く
    saveProfile(sheet, loaded.row, name, p);
    return jsonOut({ status: "ok", results, profile: publicProfile(p) });
  }

  // 修行に連れて行くキャラの選択（"" ではずす）
  if (postData.action === "select") {
    const id = String(postData.charId || "");
    if (id && !p.chars[id]) return jsonOut({ status: "not_owned" });
    p.selected = id;
    saveProfile(sheet, loaded.row, name, p);
    return jsonOut({ status: "ok", profile: publicProfile(p) });
  }

  return jsonOut({ status: "error", message: "unknown action" });
}

// =====================================================================
// v6: 今日のそば打ち（デイリー）
// =====================================================================

function todayJST() {
  return Utilities.formatDate(new Date(), "GMT+9", "yyyy-MM-dd");
}

function getDailySheet(ss) {
  let sheet = ss.getSheetByName("daily");
  if (!sheet) {
    sheet = ss.insertSheet("daily");
    sheet.appendRow(["日付", "名前", "スコア", "日時"]);
    // 日付が日付型に、数字だけの名前が数値に化けないよう文字列書式にしておく
    sheet.getRange("A:B").setNumberFormat("@");
  }
  return sheet;
}

// 指定日の記録を高い順に返す
function readDaily(ss, date) {
  const sheet = getDailySheet(ss);
  if (sheet.getLastRow() < 2) return [];
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues();
  return rows
    .filter(r => (r[0] instanceof Date ? Utilities.formatDate(r[0], "GMT+9", "yyyy-MM-dd") : String(r[0]).trim()) === date)
    .map(r => ({ name: String(r[1]).trim(), score: Number(r[2]) || 0 }))
    .sort((a, b) => b.score - a.score);
}

function getDailyRanking(ss, name) {
  const date = todayJST();
  const all = readDaily(ss, date);
  const result = { apiVersion: API_VERSION, date: date, ranking: all.slice(0, 30), total: all.length, me: null };
  if (name) {
    const idx = all.findIndex(d => d.name === name);
    if (idx >= 0) result.me = { score: all[idx].score, rank: idx + 1 };
  }
  return result;
}

function submitDaily(ss, name, score) {
  const date = todayJST();
  const all = readDaily(ss, date);
  let recorded = false;
  let myScore;
  const existing = all.find(d => d.name === name);
  if (existing) {
    myScore = existing.score; // 今日はもう記録済み。2回目以降は残さない
  } else {
    if (!isFinite(score) || score < 0) return { status: "error", message: "bad score" };
    myScore = Math.floor(score);
    getDailySheet(ss).appendRow([date, name, myScore, new Date()]);
    all.push({ name: name, score: myScore });
    all.sort((a, b) => b.score - a.score);
    recorded = true;
  }
  const rank = all.filter(d => d.score > myScore).length + 1;
  return { status: "ok", recorded: recorded, date: date, score: myScore, rank: rank, total: all.length };
}

// =====================================================================
// v7: 名前のチェック（index.html の isBadName と同じ判定）
// =====================================================================

const NAME_MAX_LENGTH = 12; // 画面の入力欄は8文字まで。直接送られた長すぎる名前を弾く

// 判定前に「全角→半角」「カタカナ→ひらがな」「大文字→小文字」「空白・記号を除去」「数字の当て字を戻す」でそろえる
const NG_WORDS = [
    // 英語
    "fuck", "fuk", "shit", "bitch", "asshole", "dick", "pussy", "cunt", "nigg", "fag", "slut", "whore",
    "rape", "nazi", "hitler", "porn", "penis", "vagina", "retard", "kys", "boob", "sex", "damn", "bastard",
    // 日本語：暴言・脅し
    "しね", "氏ね", "死ね", "ころす", "殺す", "ころせ", "殺せ", "きえろ", "消えろ", "くたばれ",
    // 日本語：性的な語
    "ちんこ", "ちんぽ", "ちんちん", "まんこ", "おまんこ", "せっくす", "えっち", "えろ", "おっぱい", "ぱいぱい",
    "やりまん", "やりちん", "びっち", "れいぷ", "強姦", "痴漢", "ちかん", "ふぇら", "うんこ", "うんち", "くそ", "糞",
    // 日本語：差別語・侮辱
    "きちがい", "基地外", "気違い", "がいじ", "池沼", "ちしょう", "知障", "かたわ", "めくら", "つんぼ", "支那人", "しなじん", "部落", "ほも", "れず", "ぶす", "でぶ", "ごみくず", "ごみかす"
];

function normalizeName(name) {
  return String(name).normalize("NFKC").toLowerCase()
    .replace(/[\u30a1-\u30f6]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .replace(/[\s._\-・･\/|!！?？*＊~〜]/g, "")
    .replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e").replace(/4/g, "a").replace(/5/g, "s").replace(/@/g, "a").replace(/\$/g, "s");
}

function isAllowedName(name) {
  if (!name || name === "名無し" || name.length > NAME_MAX_LENGTH) return false;
  const n = normalizeName(name);
  return !NG_WORDS.some(w => n.indexOf(w) >= 0);
}
