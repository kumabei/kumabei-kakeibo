# くまべえ家計簿

かんたん入力の家計簿（PWA）。GitHub Pagesで公開し、iPhoneのホーム画面に追加して使う。
公開URL：https://kumabei.github.io/kumabei-kakeibo/

家計のデータは端末内（IndexedDB）にだけ保存され、このリポジトリには入らない。
ホーム画面のアイコンを削除すると記録も消えるので、設定の「バックアップを書き出す」で定期的に保存する。

## 開発

- テスト：`node --test`
- 手元で動かす：`python -m http.server 8123` を実行し、http://localhost:8123/ を開く
- くまべえ画像の作り直し：`python tools/make_kuma_images.py <くまべえスタンプのフォルダ> <家族スタンプのフォルダ> --sheet preview.png`
  （Pillow・numpy・scipy が必要）
- リリース：`js/version.js` と `sw.js` の VERSION を同じ値に上げる（テストが一致を確かめる）
