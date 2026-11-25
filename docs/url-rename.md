# ゲームのURLを「test」から作品名に変える手順

いまのURL: `https://amanogawatyoppu-sudo.github.io/test/`
変えたあと（案）: `https://amanogawatyoppu-sudo.github.io/mugen-sobado/`

URLはリポジトリの名前で決まります。名前を変えるのは会長の操作が必要です。

## 変えても大丈夫なこと
- **遊んだ記録は消えません。** 記録は `amanogawatyoppu-sudo.github.io` というドメインごとに保存されていて、ドメインは変わらないからです。
- **Google連携（Firebase）もそのまま動きます。** 承認済みドメインは `amanogawatyoppu-sudo.github.io` のままで良いです。
- **番付（GAS）もそのまま動きます。**

## 手順
1. 名前を決める。おすすめは `mugen-sobado`（半角英数字とハイフンだけ）。
2. https://github.com/amanogawatyoppu-sudo/test/settings を開き、一番上の「Repository name」を新しい名前にして「Rename」。
3. 1〜2分待って、新しいURL（`https://amanogawatyoppu-sudo.github.io/新しい名前/`）でゲームが開けるか確かめる。
4. 古いURLを開いた人を新しいURLへ送るため、**`test` という名前の新しいリポジトリ**を作る。
   1. https://github.com/new で Repository name に `test`、Public を選んで作成
   2. 「uploading an existing file」から、このリポジトリの `tools/old-url-redirect/index.html` を入れる（新しい名前を `mugen-sobado` 以外にした場合は、先に Claude に頼んで書き換えてもらう）
   3. その `test` リポジトリの Settings → Pages で、Branch を `main` にして Save
   4. 数分後、古いURLを開くと新しいURLに飛べばOK
5. **Claude のプロジェクト設定のリポジトリを新しい名前に変える。** 4 で `test` を作り直すと、`test` はもう案内ページだけのリポジトリになるので、ゲーム本体の新しい名前を登録し直す必要があります。
6. Claude に「URLを変えた」と伝える。次の3つを直します。
   - `index.html` の canonical（検索エンジンに伝える正式なURL）
   - トップページ（`amanogawatyoppu-sudo.github.io`）の「ゲームをはじめる」ボタンの行き先
   - Search Console で新しいURLの登録をお願いする手順
