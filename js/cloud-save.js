// ===== クラウドセーブ（自動ログイン＋Google連携） =====
// 1) 初回アクセス：登録画面は出さず、裏で「ゲストアカウント（匿名ログイン）」を作ってログインする。
// 2) 2回目以降：ログイン状態はブラウザに残るので、そのまま前回のセーブを読み込む。
// 3) 設定の「Googleアカウントと連携」：今のゲストアカウントをGoogleアカウントに紐付ける。
//    紐付けておけば、別の端末やブラウザでも同じGoogleでログインすればセーブが戻る。
//
// 仕組み：ゲームは今までどおり localStorage（端末の保存場所）に "sobamichi_〜" の名前で記録する。
// このファイルはその書き込みを見張り、少し待ってまとめて Firestore（Firebaseのデータベース）の
// users/{自分のユーザーID} に写す。読み込み時はクラウドの方が新しければ端末に戻して再読込する。
// そのため index.html 側のゲーム処理は書き換えていない（ストーリーモードなどで増えた記録も自動で同期される）。
//
// 番付・ガチャ（そば粉・職人）は今までどおり GAS（gas/Code.gs）が担当する。
// そのアカウント（名前＋パスワード）のログイン・ログアウトも、この設定画面に並べる（中身は index.html の renderAccountSettings）。
// npm は不要。Firebase は CDN から ES モジュールとして直接読み込む。

import { firebaseConfig } from "./firebase-config.js";
// Firebase 本体は start() の中で読み込む（通信できなくても設定画面だけは開けるように）
const FB = "https://www.gstatic.com/firebasejs/11.0.2";
let fb = null; // 読み込んだ Firebase の関数をまとめて入れる

const PREFIX = "sobamichi_";
// 同期しないもの：サーバー対応状況の一時メモ、このファイル自身の管理用
const SKIP_KEYS = new Set(["sobamichi_api", "sobamichi_cloud_meta"]);
const META_KEY = "sobamichi_cloud_meta";      // { savedAt: 端末で最後に変更した時刻(ms) }
const RELOAD_FLAG = "sobamichi_cloud_reloaded"; // 再読込を1回だけにするための印（sessionStorage）
const PUSH_DELAY_MS = 3000;
const SAVE_VERSION = 1;

// ゲームの言語設定（index.html が <html lang> に入れている）に合わせる
const t = (ja, en) => (document.documentElement.lang === "en" ? en : ja);

// 画面やほかの処理から状態を見られるように公開する
const SobaCloud = window.SobaCloud = {
    enabled: false, ready: false, uid: null, isGuest: true, email: null, lastError: null,
    linkGoogle: () => linkGoogle(),
};

// ---------- 端末の保存データ ----------
function readLocalSave() {
    const save = {};
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX) && !SKIP_KEYS.has(k)) save[k] = localStorage.getItem(k);
    }
    return save;
}
function localSavedAt() {
    try { return Number(JSON.parse(localStorage.getItem(META_KEY) || "{}").savedAt) || 0; } catch (e) { return 0; }
}
function setLocalSavedAt(ms) {
    origSetItem.call(localStorage, META_KEY, JSON.stringify({ savedAt: ms }));
}
// クラウドのデータで端末を置き換える
function applyToLocal(save, savedAt) {
    Object.keys(readLocalSave()).forEach(k => { if (!(k in save)) origRemoveItem.call(localStorage, k); });
    Object.entries(save).forEach(([k, v]) => {
        if (k.startsWith(PREFIX) && !SKIP_KEYS.has(k) && typeof v === "string") origSetItem.call(localStorage, k, v);
    });
    setLocalSavedAt(savedAt);
}

// ---------- 書き込みの見張り ----------
const origSetItem = Storage.prototype.setItem;
const origRemoveItem = Storage.prototype.removeItem;
let watching = false;
let pushTimer = null;

function installWatcher() {
    if (watching) return;
    watching = true;
    Storage.prototype.setItem = function (k, v) {
        origSetItem.call(this, k, v);
        if (this === localStorage && typeof k === "string" && k.startsWith(PREFIX) && !SKIP_KEYS.has(k)) markDirty();
    };
    Storage.prototype.removeItem = function (k) {
        origRemoveItem.call(this, k);
        if (this === localStorage && typeof k === "string" && k.startsWith(PREFIX) && !SKIP_KEYS.has(k)) markDirty();
    };
    // タブを閉じる・裏に回すときは待たずに送る
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushPush(); });
}
function markDirty() {
    setLocalSavedAt(Date.now());
    clearTimeout(pushTimer);
    pushTimer = setTimeout(flushPush, PUSH_DELAY_MS);
}
function flushPush() {
    if (!pushTimer) return;
    clearTimeout(pushTimer);
    pushTimer = null;
    pushToCloud().catch(e => { SobaCloud.lastError = e; console.warn("[cloud-save] push failed", e); });
}

// ---------- Firebase ----------
let auth = null, db = null;

async function pushToCloud() {
    const user = auth && auth.currentUser;
    if (!user) return;
    await fb.setDoc(fb.doc(db, "users", user.uid), {
        v: SAVE_VERSION,
        save: readLocalSave(),
        clientSavedAt: localSavedAt() || Date.now(),
        updatedAt: fb.serverTimestamp(),
    });
}

// ログイン直後：クラウドと端末のどちらが新しいかを比べてそろえる。
// 端末を書き換えたときは true（＝ゲームを読み直す必要がある）を返す。
async function syncOnLogin(user) {
    const snap = await fb.getDoc(fb.doc(db, "users", user.uid));
    const cloud = snap.exists() ? snap.data() : null;
    const cloudAt = cloud ? Number(cloud.clientSavedAt) || 0 : 0;
    if (cloud && cloud.save && cloudAt > localSavedAt()) {
        applyToLocal(cloud.save, cloudAt);
        return true;
    }
    if (!cloud || localSavedAt() > cloudAt) {
        if (!localSavedAt()) setLocalSavedAt(Date.now());
        await pushToCloud();
    }
    return false;
}

function reloadOnce() {
    try {
        if (sessionStorage.getItem(RELOAD_FLAG)) return false;
        sessionStorage.setItem(RELOAD_FLAG, "1");
    } catch (e) { return false; }
    location.reload();
    return true;
}

function updateUserState(user) {
    SobaCloud.uid = user ? user.uid : null;
    const google = user ? user.providerData.find(p => p.providerId === "google.com") : null;
    SobaCloud.isGuest = !google;
    SobaCloud.email = google ? google.email : null;
    renderPanel();
}

async function start() {
    if (!firebaseConfig || !firebaseConfig.apiKey) {
        console.info("[cloud-save] js/firebase-config.js が未設定のため、クラウドセーブは使わない。");
        return;
    }
    const [appMod, authMod, storeMod] = await Promise.all([
        import(`${FB}/firebase-app.js`), import(`${FB}/firebase-auth.js`), import(`${FB}/firebase-firestore.js`),
    ]);
    fb = { ...appMod, ...authMod, ...storeMod };
    const app = fb.initializeApp(firebaseConfig);
    auth = fb.getAuth(app);   // ログイン状態はブラウザに保存され、次回も自動で復元される
    db = fb.getFirestore(app);
    SobaCloud.enabled = true;

    let firstCheck = true;
    fb.onAuthStateChanged(auth, async (user) => {
        if (!user) {
            // 初回（または端末のログイン情報が消えた）→ 裏でゲストアカウントを作る
            try { await fb.signInAnonymously(auth); }
            catch (e) { SobaCloud.lastError = e; console.warn("[cloud-save] 匿名ログイン失敗", e); renderPanel(); }
            return; // 成功すると onAuthStateChanged がもう一度呼ばれる
        }
        updateUserState(user);
        if (!firstCheck) return;
        firstCheck = false;
        try {
            const changed = await syncOnLogin(user);
            if (changed && reloadOnce()) return;
        } catch (e) { SobaCloud.lastError = e; console.warn("[cloud-save] 読み込み失敗", e); }
        try { sessionStorage.removeItem(RELOAD_FLAG); } catch (e) {}
        installWatcher();
        SobaCloud.ready = true;
        renderPanel();
        window.dispatchEvent(new CustomEvent("sobamichi:cloud-ready", { detail: { uid: user.uid } }));
    });
}

// ---------- Googleアカウントと連携 ----------
async function linkGoogle() {
    if (!auth || !auth.currentUser) return;
    const provider = new fb.GoogleAuthProvider();
    setMsg(t("Googleの画面で選んでください…", "Choose your account in the Google window..."));
    try {
        const res = await fb.linkWithPopup(auth.currentUser, provider);
        updateUserState(res.user);
        flushPush();
        await pushToCloud();
        setMsg(t("連携できた！別の端末でも同じGoogleでログインすれば続きから遊べる。", "Linked! Sign in with the same Google account on another device to continue."), true);
    } catch (e) {
        if (e.code === "auth/credential-already-in-use") {
            // そのGoogleアカウントには、すでに別のセーブがある（前に別の端末で連携した等）
            const cred = fb.GoogleAuthProvider.credentialFromError(e);
            askSwitch(cred);
            return;
        }
        setMsg(linkErrorText(e));
        console.warn("[cloud-save] link failed", e);
    }
}

async function switchToExisting(cred) {
    setMsg(t("切り替え中…", "Switching..."));
    try {
        const res = await fb.signInWithCredential(auth, cred);
        const snap = await fb.getDoc(fb.doc(db, "users", res.user.uid));
        const cloud = snap.exists() ? snap.data() : null;
        if (cloud && cloud.save) applyToLocal(cloud.save, Number(cloud.clientSavedAt) || Date.now());
        else { setLocalSavedAt(Date.now()); await pushToCloud(); }
        try { sessionStorage.removeItem("sobamichi_account"); sessionStorage.removeItem("sobamichi_profile"); } catch (e) {}
        location.reload();
    } catch (e) {
        setMsg(linkErrorText(e));
        console.warn("[cloud-save] switch failed", e);
    }
}

function linkErrorText(e) {
    switch (e && e.code) {
        case "auth/popup-closed-by-user":
        case "auth/cancelled-popup-request": return t("キャンセルした。", "Cancelled.");
        case "auth/popup-blocked": return t("ポップアップがブロックされた。ブラウザの設定で許可してもう一度押してください。", "The pop-up was blocked. Allow pop-ups and try again.");
        case "auth/unauthorized-domain": return t("このサイトのアドレスがFirebaseに登録されていない（承認済みドメインに追加が必要）。", "This site's domain is not authorized in Firebase.");
        case "auth/operation-not-allowed": return t("FirebaseでGoogleログインが有効になっていない。", "Google sign-in is not enabled in Firebase.");
        case "auth/network-request-failed": return t("通信に失敗した。電波の良い所でもう一度。", "Network error. Please try again.");
        default: return t("連携に失敗した。", "Couldn't link.") + (e && e.code ? ` (${e.code})` : "");
    }
}

// ---------- 設定画面（このファイルが自分で作る） ----------
let panel = null, pendingCred = null;

function buildPanel() {
    const style = document.createElement("style");
    style.textContent = `
#cloudSettings { position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: none; align-items: center; justify-content: center; z-index: 400; padding: 16px; }
#cloudSettings.open { display: flex; }
#cloudSettingsBox { background: #1b1b1b; color: #eee; border: 2px solid gold; border-radius: 12px; padding: 20px; width: 100%; max-width: 420px; font-family: 'Noto Serif JP', serif; text-align: center; }
#cloudSettingsBox { max-height: calc(100dvh - 32px); overflow-y: auto; box-sizing: border-box; }
#cloudSettingsBox h2 { margin: 0 0 12px; color: gold; font-size: 22px; }
#cloudSettingsBox h3 { margin: 0 0 8px; color: #ffe9a8; font-size: 16px; text-align: left; }
#cloudSettingsBox .cs-section { border-top: 1px solid #333; padding-top: 14px; margin-top: 14px; }
#cloudSettingsBox .cs-plain { background: #2c4a63; color: #fff; }
#cloudSettingsBox .cs-status { background: #000; border-radius: 8px; padding: 10px; font-size: 14px; line-height: 1.6; margin-bottom: 12px; }
#cloudSettingsBox .cs-note { font-size: 12px; color: #aaa; line-height: 1.6; margin: 8px 0 12px; text-align: left; }
#cloudSettingsBox button { display: block; width: 100%; margin: 8px 0 0; padding: 12px; font-size: 16px; border-radius: 8px; border: none; cursor: pointer; font-family: inherit; }
#cloudSettingsBox .cs-google { background: #fff; color: #333; font-weight: bold; }
#cloudSettingsBox .cs-google:disabled { opacity: 0.5; cursor: default; }
#cloudSettingsBox .cs-danger { background: #a33; color: #fff; }
#cloudSettingsBox .cs-close { background: #444; color: #fff; }
#cloudSettingsBox .cs-msg { min-height: 1.4em; font-size: 13px; color: #ff8866; margin-top: 10px; }
#cloudSettingsBox .cs-msg.ok { color: #8fdc7a; }
`;
    document.head.appendChild(style);
    panel = document.createElement("div");
    panel.id = "cloudSettings";
    panel.innerHTML = `<div id="cloudSettingsBox">
  <h2>⚙ ${t("設定", "Settings")}</h2>
  <h3>☁ ${t("セーブの引き継ぎ（Google連携）", "Save transfer (Google)")}</h3>
  <div class="cs-status"></div>
  <div class="cs-note"></div>
  <button class="cs-google"></button>
  <div class="cs-switch" style="display:none;">
    <div class="cs-note">${t("このGoogleアカウントには、別の端末のセーブがすでにある。そちらに切り替えると、この端末の今のセーブ（ゲスト分）は消えて、Google側のセーブで上書きされる。", "This Google account already has a save from another device. Switching will replace this device's guest save with that one.")}</div>
    <button class="cs-danger">${t("Google側のセーブに切り替える", "Switch to the Google save")}</button>
  </div>
  <div class="cs-msg"></div>
  <div class="cs-account cs-section"></div>
  <button class="cs-close">${t("閉じる", "Close")}</button>
</div>`;
    document.body.appendChild(panel);
    panel.addEventListener("click", e => { if (e.target === panel) closePanel(); });
    panel.querySelector(".cs-close").onclick = closePanel;
    panel.querySelector(".cs-google").onclick = linkGoogle;
    panel.querySelector(".cs-danger").onclick = () => { if (pendingCred) switchToExisting(pendingCred); };
}
function renderPanel() {
    if (!panel) return;
    if (window.renderAccountSettings) window.renderAccountSettings(panel.querySelector(".cs-account"));
    const status = panel.querySelector(".cs-status");
    const note = panel.querySelector(".cs-note");
    const btn = panel.querySelector(".cs-google");
    if (!SobaCloud.enabled) {
        status.innerHTML = t("クラウドセーブは準備中。<br>記録はこの端末に保存されている。", "Cloud save is not set up yet.<br>Progress is saved on this device.");
        note.textContent = "";
        btn.style.display = "none";
        return;
    }
    btn.style.display = "";
    if (!SobaCloud.uid) {
        status.textContent = SobaCloud.lastError ? t("ログインできなかった（通信を確認）。", "Couldn't sign in (check your connection).") : t("ログイン中…", "Signing in...");
        btn.disabled = true;
        note.textContent = "";
    } else if (SobaCloud.isGuest) {
        status.innerHTML = `${t("いまは", "You're playing as a")} <b style="color:gold;">${t("ゲスト", "guest")}</b>${t(" で遊んでいる。", ".")}<br>${t("セーブは自動でクラウドに保存されている。", "Your progress is backed up automatically.")}`;
        note.textContent = t("※ ゲストのままだと、ブラウザのデータを消したり機種変更したりするとセーブが戻せない。Googleと連携しておけば、別の端末でも続きから遊べる。", "As a guest, clearing browser data or changing devices loses your save. Link Google to keep it.");
        btn.textContent = t("Googleアカウントと連携", "Link Google account");
        btn.disabled = false;
    } else {
        status.innerHTML = `✅ ${t("Google連携済み", "Linked to Google")}<br><span style="font-size:12px;color:#aaa;">${escape(SobaCloud.email || "")}</span>`;
        note.textContent = t("別の端末では、ここで同じGoogleアカウントを選べば続きから遊べる。", "On another device, open this screen and choose the same Google account.");
        btn.textContent = t("連携済み", "Linked");
        btn.disabled = true;
    }
}
function askSwitch(cred) {
    pendingCred = cred;
    panel.querySelector(".cs-switch").style.display = "";
    setMsg("");
}
function setMsg(text, ok = false) {
    if (!panel) return;
    const m = panel.querySelector(".cs-msg");
    m.textContent = text;
    m.className = "cs-msg" + (ok ? " ok" : "");
}
function escape(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

function openPanel() {
    if (!panel) buildPanel();
    pendingCred = null;
    panel.querySelector(".cs-switch").style.display = "none";
    setMsg("");
    renderPanel();
    panel.classList.add("open");
}
function closePanel() { if (panel) panel.classList.remove("open"); }
window.openCloudSettings = openPanel;
window.closeCloudSettings = closePanel;

// ---------- 他の端末で連携済みのGoogleでログインしたいとき ----------
// ゲストのまま「Googleアカウントと連携」を押せば、そのGoogleにセーブがあれば切り替えの確認が出る。

start().catch(e => { SobaCloud.lastError = e; console.warn("[cloud-save] start failed", e); });
