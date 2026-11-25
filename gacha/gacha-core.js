// ガチャ演出の決まりごと（画面に関係しない部分）。結果はサーバーが決めた値だけを使う。
(function () {
    const RANK = { SSR: 0, SR: 1, R: 2, N: 3 };
    const UPGRADE_CHANCE = 0.3;

    function bestRarity(results) {
        let best = "N";
        for (const r of results || []) if (RANK[r.rarity] < RANK[best]) best = r.rarity;
        return best;
    }
    // 釜の光の色。N と R は同じ青白。SR 以上はときどき青白から格上げされる。
    function chargePlan(best, rand) {
        const to = best === "SSR" || best === "SR" ? best : "R";
        const from = to !== "R" && rand() < UPGRADE_CHANCE ? "R" : to;
        return { from, to };
    }
    function revealSteps(results) {
        return (results || []).map((r, index) => ({ index, id: r.id, rarity: r.rarity, isNew: !r.dup, special: !r.dup }));
    }

    const GachaCore = { RANK, bestRarity, chargePlan, revealSteps };
    if (typeof module !== "undefined" && module.exports) module.exports = GachaCore;
    else window.GachaCore = GachaCore;
})();
