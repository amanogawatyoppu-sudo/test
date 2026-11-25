// 「このゲームについて」画面。設定画面（js/cloud-save.js）のボタンから開く。
// 作った人・連絡先の表記は、下の ABOUT_INFO だけを直せば差し替わる（privacy.html にも同じ表記があるので、そちらも合わせて直す）。
(function () {
    // author: 先生のOKが出たら「福井県立高志高校 探究活動 ○○」に差し替える。フルネームは書かない。
    // contact: ゲーム専用のメールアドレスができたら入れる。空のあいだは「準備中」と出る。
    window.ABOUT_INFO = {
        author: "福井県内の高校生（探究活動）",
        contact: "",
        purpose: {
            ja: "越前そばを知ってもらい、福井へ食べに来てもらうために作りました。ストーリーモードでは、福井の各地を巡りながら「おろしぶっかけ」の食べ方や、そばの豆知識を紹介しています。",
            en: "Made so that more people get to know Echizen soba and come to Fukui to eat it. Story Mode travels around Fukui and introduces how to eat oroshi bukkake soba, along with soba facts.",
        },
    };

    // 豆知識の出典（docs/story/content-review.md の略号と同じ5件）
    const SOURCES = [
        { ja: "農林水産省「うちの郷土料理 越前そば」", en: "MAFF: Our Regional Cuisines - Echizen Soba", url: "https://www.maff.go.jp/j/keikaku/syokubunka/traditional-foods/menu/etizensoba.html" },
        { ja: "福井市観光公式サイト「福いろ」越前そば特集", en: "Fukui City official tourism site 'Fukuiro': Echizen Soba", url: "https://fuku-iro.jp/feature/detail_80.html" },
        { ja: "福いろ「今庄宿」", en: "Fukuiro: Imajo-juku", url: "https://fuku-iro.jp/spot/detail_10034.html" },
        { ja: "福井県「そば」資料（PDF）", en: "Fukui Prefecture: Soba (PDF)", url: "https://www.pref.fukui.lg.jp/doc/nourinbu/majoritem/majoritem_d/fil/soba.pdf" },
        { ja: "福井県観光連盟「ふくいドットコム」越前おろしそば特集", en: "Fukui Prefectural Tourism Federation: Echizen Oroshi Soba", url: "https://www.fuku-e.com/feature/oroshisoba" },
    ];
    const CREDITS = [
        { ja: "BGM（一部）：伊藤ケイスケ「低音衝動」、Maniira「有明のユーロビート」「桜城にて」「和の街並み」（OpenTracks／旧DOVA-SYNDROME）", en: "BGM (some tracks): Keisuke Ito \"Teion Shodo\"; Maniira \"Ariake no Eurobeat\", \"Sakurajo nite\", \"Wa no Machinami\" (OpenTracks / formerly DOVA-SYNDROME)" },
        { ja: "地形：Terrain Tiles（AWS Open Data・SRTM ほか）", en: "Terrain: Terrain Tiles (AWS Open Data, SRTM and others)" },
        { ja: "陸地と県境：地球地図日本（国土地理院）", en: "Coastline and borders: Global Map Japan (GSI)" },
        { ja: "3D表示：three.js（MIT License）", en: "3D: three.js (MIT License)" },
    ];

    const t = (ja, en) => (document.documentElement.lang === "en" ? en : ja);
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    let panel = null;

    function build() {
        const style = document.createElement("style");
        style.textContent = `
#aboutPanel { position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: none; align-items: center; justify-content: center; z-index: 410; padding: 16px; box-sizing: border-box; }
#aboutPanel.open { display: flex; }
#aboutPanel .ab-box { background: #1b1b1b; color: #eee; border: 2px solid gold; border-radius: 12px; padding: 20px; width: 100%; max-width: 420px; max-height: calc(100dvh - 32px); overflow-y: auto; box-sizing: border-box; font-family: 'Noto Serif JP', serif; text-align: left; overflow-wrap: anywhere; }
#aboutPanel h2 { margin: 0 0 12px; color: gold; font-size: 22px; text-align: center; }
#aboutPanel h3 { margin: 14px 0 6px; color: #ffe9a8; font-size: 15px; border-top: 1px solid #333; padding-top: 12px; }
#aboutPanel p, #aboutPanel li { font-size: 13px; line-height: 1.7; margin: 0; }
#aboutPanel ul { margin: 0; padding-left: 1.2em; }
#aboutPanel a { color: #8fd0ff; }
#aboutPanel .ab-close { display: block; width: 100%; margin: 16px 0 0; padding: 12px; font-size: 16px; border-radius: 8px; border: none; cursor: pointer; font-family: inherit; background: #444; color: #fff; }
`;
        document.head.appendChild(style);
        panel = document.createElement("div");
        panel.id = "aboutPanel";
        document.body.appendChild(panel);
        panel.addEventListener("click", e => {
            if (e.target === panel || e.target.closest(".ab-close")) closeAbout();
        });
    }

    function render() {
        const info = window.ABOUT_INFO;
        const contact = info.contact
            ? `<a href="mailto:${esc(info.contact)}">${esc(info.contact)}</a>`
            : esc(t("準備中", "Coming soon"));
        const link = (url, label) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
        panel.innerHTML = `<div class="ab-box">
  <h2>ℹ ${esc(t("このゲームについて", "About this game"))}</h2>
  <h3>${esc(t("作った人", "Made by"))}</h3>
  <p class="ab-author">${esc(info.author)}</p>
  <h3>${esc(t("作った目的", "Why we made it"))}</h3>
  <p>${esc(t(info.purpose.ja, info.purpose.en))}</p>
  <h3>${esc(t("問い合わせ", "Contact"))}</h3>
  <p class="ab-contact">${contact}</p>
  <h3>${esc(t("豆知識の出典", "Sources for soba facts"))}</h3>
  <ul class="ab-sources">${SOURCES.map(s => `<li>${link(s.url, t(s.ja, s.en))}</li>`).join("")}</ul>
  <h3>${esc(t("素材", "Credits"))}</h3>
  <ul class="ab-credits">${CREDITS.map(c => `<li>${esc(t(c.ja, c.en))}</li>`).join("")}</ul>
  <h3>${esc(t("個人情報", "Privacy"))}</h3>
  <p><a class="ab-privacy" href="privacy.html" target="_blank" rel="noopener">${esc(t("プライバシーポリシー", "Privacy Policy"))}</a></p>
  <button class="ab-close">${esc(t("閉じる", "Close"))}</button>
</div>`;
    }

    function openAbout() {
        if (!panel) build();
        render(); // ABOUT_INFO と言語の変更を毎回反映する
        panel.classList.add("open");
    }
    function closeAbout() { if (panel) panel.classList.remove("open"); }
    window.openAbout = openAbout;
    window.closeAbout = closeAbout;
})();
