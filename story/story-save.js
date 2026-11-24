// ストーリーの進捗の保存。保存先を変えるときは、この2つの関数だけを差し替える。
// （クラウド保存は sobamichi_ で始まるキーを自動で写すので、毎回 load() で読み直すこと）
window.StorySave = {
    KEY: "sobamichi_story",
    load() {
        try { return StoryCore.normalize(JSON.parse(localStorage.getItem(this.KEY))); }
        catch (e) { return StoryCore.newState(); }
    },
    save(state) {
        try { localStorage.setItem(this.KEY, JSON.stringify(state)); } catch (e) {}
    },
};
