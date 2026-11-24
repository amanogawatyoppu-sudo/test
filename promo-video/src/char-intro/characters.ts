// キャラ紹介動画のデータ。名前・レア度・効果はゲーム本体(index.html の CHARACTERS)と合わせること。
export type Rarity = "N" | "R" | "SR" | "SSR";

export type CharIntroProps = {
  id: string;
  name: string;
  nameEn: string;
  rarity: Rarity;
  effect: string;
  profile: string;
  line: string; // 台詞。\n で改行位置を指定
};

export const RARITY_COLOR: Record<Rarity, string> = {
  N: "#aaaaaa",
  R: "#44aaff",
  SR: "#cc66ff",
  SSR: "#ffcc00",
};

// 背景グラデーション(中心色, 外側色)
export const RARITY_BG: Record<Rarity, [string, string]> = {
  N: ["#4a4036", "#0d0a07"],
  R: ["#123a5c", "#04101c"],
  SR: ["#3e1a5a", "#0c0514"],
  SSR: ["#5a3a0a", "#0a0602"],
};

export const CHAR_INTROS: CharIntroProps[] = [
  {
    id: "minarai",
    name: "見習い小僧",
    nameEn: "Apprentice Boy",
    rarity: "N",
    effect: "得点+3%",
    profile:
      "武生のそば屋に住み込みで修行中の12歳。粉まみれで失敗ばかりだけど、へこたれない元気が取り柄。",
    line: "今日こそ親方に\n『うまい』って言わせるんや！",
  },
  {
    id: "oroshi_musume",
    name: "おろし娘",
    nameEn: "Daikon Girl",
    rarity: "N",
    effect: "ゲージがたまりやすい(+15%)",
    profile:
      "大根おろしならお任せの看板娘。すりおろす速さは町一番で、ちょっぴりツンとした性格も大根ゆずり。",
    line: "辛いの苦手？\nほんならまだ早いね",
  },
  {
    id: "kamaban",
    name: "釜番の爺",
    nameEn: "Old Pot Keeper",
    rarity: "N",
    effect: "得点+5%",
    profile:
      "50年間、釜の火を守ってきた無口なおじいさん。湯気の立ち方だけで茹で上がりがわかる。",
    line: "…湯は嘘をつかん",
  },
  {
    id: "soba_hatake",
    name: "そば畑の少女",
    nameEn: "Buckwheat Field Girl",
    rarity: "N",
    effect: "極上を出すとゲージが少し多く回復",
    profile:
      "奥越のそば畑で育った麦わら帽子の女の子。白いそばの花が咲く秋が一番好き。",
    line: "花が咲いたら、\nもうすぐ新そばやよ！",
  },
  {
    id: "shokunin",
    name: "蕎麦打ち職人",
    nameEn: "Soba Master",
    rarity: "R",
    effect: "得点+10%",
    profile:
      "三代続くそば屋の主人。口数は少ないが弟子思いで、見習い小僧の成長をこっそり楽しみにしている。",
    line: "そばには打つ人の心が\nそのまま出るんや",
  },
  {
    id: "ekiin",
    name: "今庄の駅員",
    nameEn: "Imajo Stationmaster",
    rarity: "R",
    effect: "ゲージ40%から開始",
    profile:
      "宿場町・今庄の駅で働く駅員。町の歴史とそばの話を始めると止まらない。",
    line: "次は〜今庄〜。\nそばの町でございます！",
  },
  {
    id: "ashigaru",
    name: "朝倉の足軽",
    nameEn: "Asakura Foot Soldier",
    rarity: "R",
    effect: "ミスを1回だけ帳消し",
    profile:
      "一乗谷の朝倉家に仕える若い足軽。腕っぷしは普通だが、仲間の失敗をかばう面倒見の良さで慕われている。",
    line: "ここはオレに任せとけ！\n一回だけな！",
  },
  {
    id: "tabi_shonin",
    name: "越前の旅商人",
    nameEn: "Echizen Peddler",
    rarity: "R",
    effect: "連打が続くほど得点アップ(最大+15%)",
    profile:
      "北陸道を行き来して、噂話とお土産を運ぶ商人。商売上手でおしゃべり好き。",
    line: "いい話がありますよ。\nまずはそば一杯おごってくれたらね",
  },
  {
    id: "megane",
    name: "鯖江の眼鏡職人",
    nameEn: "Sabae Glasses Maker",
    rarity: "R",
    effect: "良でもゲージが減らず、得点も多め",
    profile:
      "眼鏡の町・鯖江で0.1ミリの狂いも見逃さない職人。几帳面すぎて、そばの太さがバラバラだと落ち着かない。",
    line: "おっと、\nこの一本だけ太いですね",
  },
  {
    id: "honda",
    name: "府中城主",
    nameEn: "Lord of Fuchu Castle",
    rarity: "SR",
    effect: "得点+20%",
    profile:
      "越前府中（今の武生）の殿様。大のそば好きで、城下にそばを広めた張本人。威厳たっぷりだが、おかわりは必ず三杯。",
    line: "うむ、余は満足じゃ…\nもう一杯！",
  },
  {
    id: "kaneko",
    name: "金子権左衛門",
    nameEn: "Kaneko Gonzaemon",
    rarity: "SR",
    effect: "極上の判定が広い",
    profile:
      "殿様に招かれて京の都から来た伝説のそば職人で、越前おろしそばの元祖とも言われる。穏やかだが、そばの話になると目つきが変わる。",
    line: "大根の辛みとそばの香り、\nこれぞ越前の味です",
  },
  {
    id: "kyoryu",
    name: "恐竜博士",
    nameEn: "Dinosaur Professor",
    rarity: "SR",
    effect: "30連打ごとに5秒間 得点1.5倍",
    profile:
      "勝山の山で化石を掘り続ける恐竜マニア。興奮すると話が止まらず、そばをすする勢いも恐竜級。",
    line: "この歯型！\nまさか…フクイラプトル！？",
  },
  {
    id: "kasumi",
    name: "越前忍・カスミ",
    nameEn: "Kasumi, Echizen Ninja",
    rarity: "SR",
    effect: "ミスしてもゲージが半分残る",
    profile:
      "越前の山奥で修行したくノ一。普段は物静かだが、何度倒れても立ち上がる。好物はもちろんおろしそば。",
    line: "…まだ、終わってない",
  },
  {
    id: "sennin",
    name: "越前そば仙人",
    nameEn: "Echizen Soba Sage",
    rarity: "SSR",
    effect: "得点+25%・フィーバー長持ち",
    profile:
      "白山の奥に住むと噂される謎の仙人。何百年もそばを打ち続けていて、その一杯を食べると長生きできるとか。",
    line: "ふぉっふぉっ、\nそば道に終わりはないのじゃ",
  },
  {
    id: "oroshi_ryu",
    name: "おろし龍",
    nameEn: "Oroshi Dragon",
    rarity: "SSR",
    effect: "虹極上の判定が広い・得点+15%",
    profile:
      "大根おろしの雪から生まれたと伝わる白い龍。冬の越前に吹く冷たい風は、この龍のため息だという。",
    line: "我が辛みに耐えられるか、\n人の子よ",
  },
  {
    id: "kuzuryu_hime",
    name: "九頭竜の姫",
    nameEn: "Kuzuryu Princess",
    rarity: "SSR",
    effect: "フィーバー中の得点2.5倍・極上の判定が少し広い",
    profile:
      "九頭竜川を守る水の姫。この清流がそばのおいしさを支えていることが自慢。普段はおっとりだが、お祭りになると誰より盛り上がる。",
    line: "九頭竜の水で茹でたそば、\n召し上がれ♪",
  },
];
