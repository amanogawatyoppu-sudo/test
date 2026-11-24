// 福井めぐりストーリー：進み方のルール（画面に関係しない部分）
(function () {
    const STORY_CLEAR_RATE = 0.6;
    const GRADES = ["C", "B", "A", "S"];
    const isObj = (x) => !!x && typeof x === "object" && !Array.isArray(x);

    function newState() {
        return { v: 1, cleared: {}, prefs: { noodle: null, spice: null }, finished: false };
    }
    function normalize(raw) {
        const s = newState();
        if (!isObj(raw) || raw.v !== 1) return s;
        if (isObj(raw.cleared)) {
            for (const [id, g] of Object.entries(raw.cleared)) if (GRADES.includes(g)) s.cleared[id] = g;
        }
        if (isObj(raw.prefs)) {
            if (raw.prefs.noodle === "thin" || raw.prefs.noodle === "thick") s.prefs.noodle = raw.prefs.noodle;
            if (raw.prefs.spice === "mild" || raw.prefs.spice === "hot") s.prefs.spice = raw.prefs.spice;
        }
        s.finished = raw.finished === true;
        return s;
    }
    const clone = (s) => ({ ...s, cleared: { ...s.cleared }, prefs: { ...s.prefs } });
    const stageOrder = (chapters) => chapters.flatMap(c => c.stages.map(st => st.id));

    function isUnlocked(state, chapters, stageId) {
        const order = stageOrder(chapters);
        const i = order.indexOf(stageId);
        if (i < 0) return false;
        return i === 0 || !!state.cleared[order[i - 1]];
    }
    function recordClear(state, stageId, rate, grade) {
        const s = clone(state);
        const ok = Number(rate) >= STORY_CLEAR_RATE;
        if (ok) {
            const prev = s.cleared[stageId];
            const g = GRADES.includes(grade) ? grade : "C";
            if (!prev || GRADES.indexOf(g) > GRADES.indexOf(prev)) s.cleared[stageId] = g;
        }
        return { state: s, cleared: ok };
    }
    const isStoryCleared = (state, chapters) => stageOrder(chapters).every(id => !!state.cleared[id]);
    function setPref(state, key, value) {
        const s = clone(state);
        s.prefs[key] = value;
        return s;
    }
    function tasteTypeId(prefs) {
        if (!prefs || !prefs.noodle || !prefs.spice) return null;
        return `${prefs.noodle}_${prefs.spice}`;
    }
    function metCharacters(state, chapters) {
        const out = ["minarai", "shokunin"];
        chapters.forEach(c => {
            if (c.stages.length && state.cleared[c.stages[0].id]) c.guides.forEach(g => { if (!out.includes(g)) out.push(g); });
        });
        return out;
    }
    function gachaUnlocked(state, chapters, ownedChars) {
        if (isStoryCleared(state, chapters)) return true;
        return isObj(ownedChars) && Object.values(ownedChars).some(n => Number(n) > 0);
    }

    const StoryCore = { STORY_CLEAR_RATE, newState, normalize, stageOrder, isUnlocked, recordClear,
        isStoryCleared, setPref, tasteTypeId, metCharacters, gachaUnlocked };
    if (typeof module !== "undefined" && module.exports) module.exports = StoryCore;
    else window.StoryCore = StoryCore;
})();
