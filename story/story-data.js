// 福井めぐりストーリーの中身（会話・豆知識・好み診断）。
// 史実や食べ方の出典は docs/story/content-review.md にまとめてある。文章を直すときはそちらも合わせて直す。
(function () {
    const L = (who, ja, en) => ({ who, ja, en });
    // 正体を明かす前の金子権左衛門（名前と姿を隠し「京都から来たそば職人」として出す）
    const K = (ja, en) => ({ who: "kaneko", mask: true, ja, en });
    const FORM = [["I", 2, 0.2], ["A", 8, 0.5], ["B", 8, 0.7], ["C", 8, 0.95], ["O", 2, 0]];
    const FORM_LONG = [["I", 2, 0.2], ["A", 8, 0.5], ["B", 8, 0.7], ["C", 8, 0.95], ["D", 8, 0.45], ["C", 8, 1.0], ["O", 2, 0]];
    const song = (style, bpm, seed, form) => ({ style, bpm, seed, form: form || FORM });

    const STORY_CHAPTERS = [
        {
            id: "c1", area: { ja: "越前市（武生）", en: "Echizen City (Takefu)" }, guides: ["minarai", "shokunin"],
            stages: [
                {
                    id: "1-1", kind: "meet", diff: "easy", song: song("takefu", 120, 9101),
                    title: { ja: "そばの香りに誘われて", en: "Drawn in by the Scent" },
                    before: [
                        L("you", "（福井にやってきた。駅前を歩いていると、どこからかいい香りが…）", "(You've just arrived in Fukui. Walking from the station, a wonderful smell drifts by...)"),
                        L("minarai", "お、旅の人？ そんなとこで鼻ひくひくさせて、そばの匂いやろ！", "Hey, a traveller? You're sniffing the air. That's soba you smell!"),
                        L("minarai", "うちの店、ちょうど忙しいんや。ちょっと手伝ってってや！", "Our shop's slammed right now. Come give us a hand!"),
                    ],
                    after: [
                        L("shokunin", "…筋がいいな。旅の人、しばらくうちで修行していかんか。", "...You've got a knack. Traveller, why not train here a while?"),
                        L("minarai", "やった！ 今日からオレが兄弟子やな！", "Yes! From today, I'm your senior apprentice!"),
                    ],
                },
                {
                    id: "1-2", kind: "train", diff: "easy", song: song("takefu", 128, 9102),
                    title: { ja: "ぶっかけ修行", en: "The Pour-Over Lesson" },
                    before: [
                        L("minarai", "越前のおろしそばはな、つゆにつけるんやなくて、上から「ぶっかけ」るんや！", "Echizen oroshi soba isn't dipped. You pour the broth right over it!"),
                        L("minarai", "冷たいそばに、大根おろし・かつお節・ねぎ。そこに冷たいつゆをかける。", "Cold soba, grated daikon, bonito flakes, green onion. Then pour on cold broth."),
                    ],
                    after: [
                        L("shokunin", "かけ方は店や人によっていろいろある。自分の好きなかけ方を見つけるといい。", "Every shop and every person pours a little differently. Find the way you like."),
                    ],
                    tip: { ja: "越前おろしそばは、冷たいそばに大根おろし・かつお節・ねぎをのせ、つゆを上から「ぶっかけ」て食べるのが定番。", en: "Echizen oroshi soba: cold noodles topped with grated daikon, bonito flakes and green onion, with broth poured over the top." },
                },
                {
                    id: "1-3", kind: "taste", diff: "easy", song: song("takefu", 136, 9103),
                    title: { ja: "三つのかけ方", en: "Three Ways to Pour" },
                    before: [
                        L("shokunin", "つゆのかけ方は、だいたい三通りあると言われとる。", "They say there are roughly three ways to pour the broth."),
                        L("shokunin", "①つゆとおろしを別々にかける ②おろしをつゆに混ぜてかける ③おろしの絞り汁をつゆに混ぜてかける。", "1) Pour broth and daikon separately. 2) Mix the daikon into the broth. 3) Mix just the daikon juice into the broth."),
                    ],
                    after: [
                        L("minarai", "オレは②派！ 旅の人はどれが好き？ 福井に来たら全部試してみてや！", "I'm a #2 guy! Which one do you like? Try them all when you're in Fukui!"),
                        K("（店の奥の席から）…ほう、筋のいい弟子が入りましたね。", "(From a seat at the back) ...My, what a promising new apprentice."),
                        L("minarai", "あの人？ ときどき来る、京都から来たそば職人さんや。名前は…そういえば知らんなあ。", "Him? A soba maker from Kyoto who drops by now and then. His name... come to think of it, I don't know."),
                        L("shokunin", "次は鯖江へ行ってこい。そばの太さの話を、几帳面な男が教えてくれる。", "Next, go to Sabae. A very precise man there will teach you about noodle thickness."),
                    ],
                    tip: { ja: "つゆのかけ方は主に3通り。①つゆと大根おろしを別々に ②おろし入りのつゆを ③おろしの絞り汁を入れたつゆを、そばにかける。", en: "Three common pours: broth and daikon separately, broth mixed with daikon, or broth mixed with just the daikon juice." },
                },
            ],
        },
        {
            id: "c2", area: { ja: "鯖江市", en: "Sabae City" }, guides: ["megane"],
            stages: [
                {
                    id: "2-1", kind: "meet", diff: "easy", song: song("sabae", 130, 9201),
                    title: { ja: "眼鏡の町の職人", en: "The Glasses-Town Craftsman" },
                    before: [
                        L("megane", "おや、弟子入りした旅の方ですね。…失礼、背筋が0.5度傾いていますよ。", "Ah, the traveller who became an apprentice. ...Pardon me, your posture is tilted 0.5 degrees."),
                        L("megane", "まずはリズムを正確に。そばも眼鏡も、精度が命です。", "First, keep the rhythm precise. Soba and glasses both live on precision."),
                    ],
                    after: [
                        L("megane", "なかなかの精度です。では、そばの「太さ」の話をしましょう。", "Quite precise. Now, let's talk about noodle thickness."),
                    ],
                },
                {
                    id: "2-2", kind: "train", diff: "easy", song: song("sabae", 138, 9202), ask: "noodle",
                    title: { ja: "太さをそろえる", en: "Even Thickness" },
                    before: [
                        L("megane", "越前のそばは、色が黒っぽく、やや太めの田舎そばが多いと言われます。", "Echizen soba is said to be mostly dark, slightly thick country-style noodles."),
                        L("megane", "そばの実を甘皮ごと挽く「挽きぐるみ」なので、色が濃く、香りが強いのです。", "The buckwheat is ground with its inner husk, so the flour is darker and more fragrant."),
                    ],
                    after: [
                        L("megane", "もちろん、細めのそばを出すお店もあります。あなたはどちらがお好みですか？", "Of course, some shops serve thinner noodles too. Which do you prefer?"),
                    ],
                    tip: { ja: "越前そばは、そばの実を甘皮ごと挽く「挽きぐるみ」。色が黒っぽく、香りが強い。やや太めの田舎そばが多い。", en: "Echizen soba flour is ground with the inner husk, so it's dark and fragrant. Many shops serve slightly thick country-style noodles." },
                },
                {
                    id: "2-3", kind: "taste", diff: "easy", song: song("sabae", 144, 9203),
                    title: { ja: "石臼の回る音", en: "The Turning Millstone" },
                    before: [
                        L("megane", "福井のそば粉は、ほとんどが石臼でゆっくり挽かれているそうです。", "They say most Fukui soba flour is slowly ground on stone mills."),
                        L("megane", "ゆっくり挽くと熱が出にくく、香りと甘みが残る。精度と忍耐の世界ですね。", "Grinding slowly keeps the heat down, so the aroma and sweetness stay. A world of precision and patience."),
                    ],
                    after: [
                        L("megane", "次は今庄へ。駅員さんが待っていますよ。…話が長いので、覚悟してください。", "Next, Imajo. The station worker is waiting. ...He talks a lot, so be ready."),
                    ],
                    tip: { ja: "福井のそば粉は石臼挽きが多い。ゆっくり挽くので熱が出にくく、風味と甘みが残る。", en: "Most Fukui soba flour is stone-ground. Slow grinding keeps the heat low, so flavour and sweetness stay." },
                },
            ],
        },
        {
            id: "c3", area: { ja: "南越前町（今庄）", en: "Minamiechizen (Imajo)" }, guides: ["ekiin"],
            stages: [
                {
                    id: "3-1", kind: "meet", diff: "normal", song: song("imajo", 140, 9301),
                    title: { ja: "次は〜今庄〜", en: "Next Stop, Imajo" },
                    before: [
                        L("ekiin", "次は〜今庄〜。そばの町でございます！ ようこそ、修行中の旅の方！", "Next stop, Imajo! The town of soba! Welcome, travelling apprentice!"),
                        L("ekiin", "今庄は昔の面影が残る宿場町。駅から歩いてすぐですよ。", "Imajo is an old post town that still looks the part. It's a short walk from the station."),
                    ],
                    after: [
                        L("ekiin", "いいリズム！ 列車の発車ベルにも負けませんね。", "Great rhythm! As sharp as a departure bell."),
                    ],
                },
                {
                    id: "3-2", kind: "train", diff: "normal", song: song("imajo", 118, 9302),
                    title: { ja: "峠の在来種", en: "The Mountain Native Strain" },
                    before: [
                        L("ekiin", "福井には、昔からその土地で育てられてきた「在来種」のそばがいくつもあるんです。", "Fukui has several native buckwheat strains, grown in the same places for generations."),
                        L("ekiin", "ここ今庄にも「今庄在来」がありますよ。小粒でも味が濃くて香りが高い！", "Imajo has its own, Imajo Zairai. Small grains, but rich and fragrant!"),
                    ],
                    after: [
                        L("ekiin", "そしてこの話はまだ続くのですが…あ、もう次の列車の時間でした。", "And the story goes on... Oh, it's already time for the next train."),
                    ],
                    tip: { ja: "福井には「大野在来」「丸岡在来」「今庄在来」など、土地ごとの在来種のそばがある。小粒だが味が濃く香りが高いと言われる。", en: "Fukui has local native strains such as Ono, Maruoka and Imajo Zairai. Small grains, said to be rich and fragrant." },
                },
                {
                    id: "3-3", kind: "taste", diff: "normal", song: song("imajo", 148, 9303),
                    title: { ja: "大盛りは二枚", en: "Large Means Two Plates" },
                    before: [
                        L("ekiin", "越前のおろしそばは、一杯の量が控えめなことが多いんです。", "A bowl of Echizen oroshi soba is often on the small side."),
                        L("ekiin", "だから大盛りを頼むと、二枚出てくるお店も多いんですよ！", "So when you order a large, many shops bring you two plates!"),
                    ],
                    after: [
                        K("おや、また会いましたね。私も昔、京の都から峠を越えて、この越前へ来たのですよ。", "Ah, we meet again. Long ago, I too crossed the mountain pass from Kyoto to come to Echizen."),
                        L("ekiin", "最後に、そば湯もぜひ。…次は福井市の一乗谷へ。足軽くんが待ってます！", "And don't forget the soba-cooking water at the end. Next is Ichijodani in Fukui City. The foot soldier is waiting!"),
                    ],
                    tip: { ja: "一杯の量は控えめなことが多く、大盛りだと二枚出てくる店も多い。食後はそば湯も楽しめる。", en: "Portions are often modest, so a large order may come as two plates. Many shops also serve the soba water to finish." },
                },
            ],
        },
        {
            id: "c4", area: { ja: "福井市（一乗谷）", en: "Fukui City (Ichijodani)" }, guides: ["ashigaru", "oroshi_musume"],
            stages: [
                {
                    id: "4-1", kind: "meet", diff: "normal", song: song("ichijo", 146, 9401),
                    title: { ja: "朝倉の谷", en: "The Asakura Valley" },
                    before: [
                        L("ashigaru", "おう、旅の弟子か！ ここは朝倉家の城下、一乗谷だ。", "Hey, the travelling apprentice! This is Ichijodani, the Asakura clan's castle town."),
                        L("ashigaru", "まずはオレについてこい！ 遅れたら…一回だけかばってやる！", "Keep up with me! If you fall behind... I'll cover for you. Once!"),
                    ],
                    after: [
                        L("ashigaru", "やるじゃねえか。じゃあ、ちょっといい話をしてやろう。", "Not bad. All right, let me tell you something good."),
                    ],
                },
                {
                    id: "4-2", kind: "train", diff: "normal", song: song("ichijo", 124, 9402), ask: "spice",
                    title: { ja: "籠城のそば", en: "Soba for the Siege" },
                    before: [
                        L("ashigaru", "福井のそばの始まりは、朝倉家が一乗谷に城を築いたころと言われてるんだ。", "They say Fukui's soba began around when the Asakura clan built their castle here."),
                        L("ashigaru", "そばは短い期間で育つから、籠城のときの食料にしたらしい。そのころは麺じゃなく「そばがき」だったとか。", "Buckwheat grows fast, so it was supposedly kept as siege food. Back then it was a dough, not noodles."),
                    ],
                    after: [
                        L("oroshi_musume", "ちょっと、そこの弟子！ 大根おろしの辛さ、どこまでいける？", "Hey, apprentice! How spicy can you take your daikon?"),
                        L("oroshi_musume", "季節によっては「辛味大根」を使うお店もあるんよ。", "Some shops use extra-spicy daikon, depending on the season."),
                    ],
                    tip: { ja: "福井のそばの始まりは、朝倉氏が一乗谷に城を築いたころと伝わる。育つのが早いそばを籠城の食料にし、当時は麺ではなく「そばがき」などで食べたという。", en: "Fukui's soba is said to date back to the Asakura clan at Ichijodani, who stored fast-growing buckwheat as siege food, eaten as dough rather than noodles." },
                },
                {
                    id: "4-3", kind: "taste", diff: "normal", song: song("ichijo", 152, 9403),
                    title: { ja: "辛さはお好みで", en: "Spice to Taste" },
                    before: [
                        L("oroshi_musume", "大根おろしは、越前おろしそばの主役のひとつ。辛さで印象がガラッと変わるんよ。", "Grated daikon is one of the stars of oroshi soba. The spiciness changes everything."),
                        L("ashigaru", "オレは辛いのは…まあ、一回だけなら！", "Me? Spicy... well, just once!"),
                    ],
                    after: [
                        L("ashigaru", "次は奥越だ。勝山と大野、そばの産地だぜ。恐竜もいるらしいけどな！", "Next is Okuetsu: Katsuyama and Ono, soba country. Dinosaurs too, apparently!"),
                    ],
                    tip: { ja: "大根おろしは越前おろしそばに欠かせない薬味。季節によっては辛味大根を使う店もある。", en: "Grated daikon is essential to oroshi soba, and some shops use extra-spicy daikon in season." },
                },
            ],
        },
        {
            id: "c5", area: { ja: "勝山市・大野市（奥越）", en: "Katsuyama & Ono (Okuetsu)" }, guides: ["kyoryu", "soba_hatake"],
            stages: [
                {
                    id: "5-1", kind: "meet", diff: "normal", song: song("dino", 150, 9501),
                    title: { ja: "恐竜とそば畑", en: "Dinosaurs and Soba Fields" },
                    before: [
                        L("kyoryu", "おおっ、きみが噂の弟子か！ 見てくれこの化石…じゃなかった、そばの実だ！", "Oh! You're the apprentice I've heard about! Look at this fossil... I mean, buckwheat grain!"),
                        L("soba_hatake", "博士、また興奮してる。ようこそ、奥越へ！", "Doctor, you're getting excited again. Welcome to Okuetsu!"),
                    ],
                    after: [
                        L("soba_hatake", "すごい！ 畑のみんなも喜んでるよ。", "Amazing! Everyone in the fields is cheering."),
                    ],
                },
                {
                    id: "5-2", kind: "train", diff: "normal", song: song("dino", 156, 9502),
                    title: { ja: "そばの産地", en: "Soba Country" },
                    before: [
                        L("soba_hatake", "大野や勝山は、福井でも大きなそばの産地なんやよ。", "Ono and Katsuyama are some of Fukui's biggest soba-growing areas."),
                        L("kyoryu", "福井県はそばの作付面積が全国でも上位なんだ！ 恐竜の化石と同じくらい誇らしい！", "Fukui ranks near the top in Japan for buckwheat acreage! As proud as our dinosaur fossils!"),
                    ],
                    after: [
                        L("soba_hatake", "そばの白い花が畑一面に咲くのは、9月の終わりごろ。そこから実がなって、新そばの季節が来るんやよ。", "The fields fill with white soba flowers around late September. Then the grains ripen, and new-soba season arrives."),
                    ],
                    tip: { ja: "大野市・勝山市などはそばの主な産地。福井県はそばの作付面積が全国でも上位。", en: "Ono and Katsuyama are major soba-growing areas, and Fukui ranks among Japan's top prefectures for buckwheat acreage." },
                },
                {
                    id: "5-3", kind: "taste", diff: "normal", song: song("dino", 160, 9503),
                    title: { ja: "新そば祭り", en: "New Soba Festival" },
                    before: [
                        L("soba_hatake", "そばの収穫は11月ごろ。県内のあちこちで「新そば祭り」があるんやよ！", "Buckwheat is harvested around November, and there are new-soba festivals all over the prefecture!"),
                        L("kyoryu", "新そばの香り…これはもう、ジュラ紀級の大発見だ！", "The aroma of new soba... a Jurassic-level discovery!"),
                        K("この香り…都を出て、初めて越前のそばを打った日を思い出します。", "This aroma... It reminds me of the day I first made soba in Echizen, after leaving the capital."),
                    ],
                    after: [
                        L("shokunin", "（手紙）旅の弟子へ。そろそろ戻ってこい。殿がお前のそばを食べたいそうだ。", "(A letter) To my travelling apprentice: come back. His Lordship wants to taste your soba."),
                    ],
                    tip: { ja: "福井のそばの収穫は11月ごろ。県内各地で新そば祭りが開かれる。", en: "Fukui's buckwheat harvest is around November, with new-soba festivals across the prefecture." },
                },
            ],
        },
        {
            id: "c6", area: { ja: "越前府中の城", en: "Echizen Fuchu Castle" }, guides: ["honda", "kaneko"],
            stages: [
                {
                    id: "6-1", kind: "meet", diff: "normal", song: song("fuchu", 150, 9601),
                    title: { ja: "殿のお呼び出し", en: "Summoned by the Lord" },
                    before: [
                        L("honda", "うむ、そなたが旅の弟子か。余はそばが大好物じゃ。", "So you are the travelling apprentice. I adore soba."),
                        L("honda", "府中（今の越前市）は、おろしそばが生まれた地とも言われておる。", "Fuchu, today's Echizen City, is said to be where oroshi soba was born."),
                    ],
                    after: [
                        K("殿、お久しゅうございます。", "My lord, it has been a long time."),
                        L("honda", "おお、そなたも来ておったか。見事じゃ、弟子よ。では、そばの由来を聞かせてやろう。", "Ah, you're here too. Splendid, apprentice. Now, let me tell you where this soba came from."),
                    ],
                },
                {
                    id: "6-2", kind: "train", diff: "normal", song: song("fuchu", 130, 9602),
                    title: { ja: "おろしそばの由来", en: "Where Oroshi Soba Began" },
                    before: [
                        L("honda", "府中の城主・本多富正公が、京都からそば職人を連れてきたのが始まりと伝わっておる。", "It is said to begin with Lord Honda Tomimasa of Fuchu, who brought a soba maker from Kyoto."),
                        L("minarai", "京都からのそば職人…って、まさか！", "A soba maker from Kyoto... wait, you mean!"),
                        L("kaneko", "ええ。殿に伴われて京から来たそば職人…それが私、金子権左衛門です。", "Yes. The soba maker who came from Kyoto with His Lordship... that is me, Kaneko Gonzaemon."),
                        L("you", "（金子権左衛門。越前おろしそばの祖とも語り継がれる、伝説のそば職人だ――）", "(Kaneko Gonzaemon. A legendary soba maker, handed down in stories as a founder of Echizen oroshi soba.)"),
                        L("kaneko", "大根の辛みとそばの香り。この組み合わせが、ここで生まれたと語られています。", "The bite of daikon and the aroma of soba. They say this pairing was born here."),
                    ],
                    after: [
                        L("kaneko", "昭和22年、昭和天皇がこのそばを召し上がり、のちに懐かしまれたことから「越前そば」の名が広まったとも言われます。", "It's also said the name 'Echizen soba' spread after Emperor Showa ate it in 1947 and fondly remembered it."),
                    ],
                    tip: { ja: "おろしそばは、府中（今の越前市）の城主・本多富正が京都からそば職人を伴ったのが始まりと伝わる。「越前そば」の名は、昭和22年に昭和天皇が召し上がったことに由来するとも言われる。", en: "Oroshi soba is said to begin with Lord Honda Tomimasa of Fuchu bringing a soba maker from Kyoto. The name 'Echizen soba' is said to come from Emperor Showa's 1947 visit." },
                },
                {
                    id: "6-3", kind: "taste", diff: "hard", song: song("fuchu", 168, 9603, FORM_LONG),
                    title: { ja: "一人前の一杯", en: "A Bowl Worthy of a Master" },
                    before: [
                        L("shokunin", "最後の試練だ。お前の一杯を、殿にお出ししろ。", "Your final test. Serve your bowl to His Lordship."),
                        L("minarai", "今日こそ…いや、今日は兄弟子として応援するで！", "Today's the day... no, today I'm cheering you on as your senior!"),
                    ],
                    after: [
                        L("honda", "うむ、余は満足じゃ…もう一杯！", "Hmm, I am satisfied... One more bowl!"),
                        L("shokunin", "…一人前だ。旅の弟子、よくやった。", "...You're a full-fledged soba maker now. Well done."),
                        L("minarai", "次は本物の福井で、本物の一杯を食べに来てや！", "Next time, come to the real Fukui and eat the real thing!"),
                    ],
                },
            ],
        },
    ];

    const STORY_TASTE_TYPES = {
        thin_mild: { name: { ja: "細麺・まろやかタイプ", en: "Thin & Mellow" },
            hint: { ja: "細めの麺を出すお店を探して、まずはおろし入りのつゆで、やさしく味わってみて。", en: "Look for shops with thinner noodles, and start gently with daikon mixed into the broth." } },
        thin_hot: { name: { ja: "細麺・辛口タイプ", en: "Thin & Spicy" },
            hint: { ja: "細めの麺で、辛味大根を使うお店を探してみて。季節で辛さが変わるのも楽しみのひとつ。", en: "Look for thinner noodles with spicy daikon. The heat changes with the season." } },
        thick_mild: { name: { ja: "太麺・まろやかタイプ", en: "Thick & Mellow" },
            hint: { ja: "黒っぽい太めの田舎そばのお店がおすすめ。香りを楽しむなら、つゆとおろしを別々にかけてみて。", en: "Try a shop with dark, thick country noodles. Pour broth and daikon separately to enjoy the aroma." } },
        thick_hot: { name: { ja: "太麺・辛口タイプ", en: "Thick & Spicy" },
            hint: { ja: "太めの田舎そばに、辛味大根をたっぷり。大盛りで二枚いくのもアリ！", en: "Thick country noodles with plenty of spicy daikon. Going large for two plates is allowed!" } },
    };

    // 福井県観光連盟「ふくいドットコム」の越前おろしそば特集（県内のお店の探し方へつながる）
    const STORY_GUIDE_URL = "https://www.fuku-e.com/feature/oroshisoba";
    // 了解をもらえたお店をここに足す（{ name:{ja,en}, area:{ja,en}, noodle, spice, url }）。今は空。
    const STORY_SHOPS = [];

    const StoryData = { STORY_CHAPTERS, STORY_TASTE_TYPES, STORY_GUIDE_URL, STORY_SHOPS };
    if (typeof module !== "undefined" && module.exports) module.exports = StoryData;
    else Object.assign(window, StoryData);
})();
