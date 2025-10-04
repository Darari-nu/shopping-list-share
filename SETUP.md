# セットアップ手順（初心者向け）

このドキュメントでは、買い物リストアプリを動かすための手順を、**コピペだけ**で完了できるように説明します。

---

## 📋 必要なもの

- Googleアカウント
- Vercelアカウント（無料で作成可能）

---

## ステップ1: Googleスプレッドシートの作成

### 1-1. 新しいスプレッドシートを作成

1. [Google スプレッドシート](https://sheets.google.com/)を開く
2. 左上の「➕ 空白」をクリック
3. スプレッドシート名を「買い物リスト」に変更（任意）

### 1-2. settingsシートを作成

1. 左下の「➕」ボタンをクリックして新しいシートを追加
2. シート名を「settings」に変更
3. 以下の内容を入力：

| | A列 | B列 |
|---|-----|-----|
| 2行目 | PASSWORD | kankan |
| 3行目 | HOUSEHOLD_ID | home01 |

入力後のイメージ：
```
     A              B
1
2  PASSWORD      kankan
3  HOUSEHOLD_ID  home01
```

---

## ステップ2: Google Apps Scriptのデプロイ

### 2-1. Apps Scriptエディタを開く

1. スプレッドシートの上部メニューから「拡張機能」→「Apps Script」をクリック
2. 新しいタブでエディタが開きます

### 2-2. コードを貼り付け

1. 既存のコード（`function myFunction() { ... }`）を**全て削除**
2. `Code.gs` ファイルの内容を**全てコピー**して貼り付け
3. 上部の「💾 保存」ボタンをクリック

### 2-3. デプロイする

1. 右上の「デプロイ」→「新しいデプロイ」をクリック
2. 左側の「⚙️」（歯車アイコン）をクリック
3. 「種類の選択」で「ウェブアプリ」を選択
4. 以下のように設定：
   - **説明**: 買い物リスト（任意）
   - **次のユーザーとして実行**: 自分
   - **アクセスできるユーザー**: 全員
5. 「デプロイ」ボタンをクリック
6. 「アクセスを承認」をクリック
7. 自分のGoogleアカウントを選択
8. 「詳細」→「（プロジェクト名）に移動」をクリック
9. 「許可」をクリック
10. **ウェブアプリのURL**が表示されるので、これを**コピーして保存**
    - 例: `https://script.google.com/macros/s/XXXXX.../exec`

---

## ステップ3: index.htmlの設定値を更新

### 3-1. index.htmlを開く

1. `index.html` ファイルをテキストエディタで開く

### 3-2. GAS_URLを書き換え

248行目付近の以下の行を探す：

```javascript
const GAS_URL = 'YOUR_GAS_WEB_APP_URL_HERE';
```

これを、ステップ2-3でコピーしたURLに置き換える：

```javascript
const GAS_URL = 'https://script.google.com/macros/s/XXXXX.../exec';
```

**注意**: シングルクォート `'` は残したまま、中身だけを置き換えてください。

### 3-3. 保存

ファイルを保存します（Ctrl+S / Command+S）

---

## ステップ4: Vercelへのデプロイ

### 4-1. Vercelアカウント作成（初回のみ）

1. [Vercel](https://vercel.com/)を開く
2. 「Sign Up」をクリック
3. Githubアカウントで登録（または他の方法で登録）

### 4-2. 新しいプロジェクトを作成

1. Vercelのダッシュボードで「Add New...」→「Project」をクリック
2. 「Import Git Repository」の下にある「Or, deploy without Git」をクリック
3. プロジェクト名を入力（例: `shopping-list`）
4. 「Create」をクリック

### 4-3. index.htmlをアップロード

1. ターミナル（Mac）またはコマンドプロンプト（Windows）を開く
2. プロジェクトフォルダに移動：
   ```bash
   cd "/Users/watanabehidetaka/Claudecode/shopping sharing"
   ```
3. Vercel CLIをインストール（初回のみ）：
   ```bash
   npm install -g vercel
   ```
4. ログイン：
   ```bash
   vercel login
   ```
5. デプロイ：
   ```bash
   vercel
   ```
6. 質問に答える：
   - Set up and deploy? → `Y`
   - Which scope? → 自分のアカウントを選択
   - Link to existing project? → `N`
   - What's your project's name? → `shopping-list`（任意）
   - In which directory is your code located? → `./`（そのままEnter）
7. デプロイが完了すると、URLが表示されます
   - 例: `https://shopping-list-xxxx.vercel.app`

---

## ✅ 完了！

デプロイされたURL（`https://shopping-list-xxxx.vercel.app`）にアクセスして、以下を確認：

1. パスワード入力画面が表示される
2. `kankan` と入力してログイン
3. 買い物リストが表示される
4. アイテムを追加してみる

---

## 🔧 トラブルシューティング

### エラー: 「読み込みエラー」

**原因**: GAS_URLが正しく設定されていない

**解決方法**:
1. `index.html` の248行目のURLを確認
2. ステップ2-3でコピーしたURLと一致しているか確認
3. シングルクォート `'` が正しく残っているか確認
4. 再度Vercelにデプロイ：
   ```bash
   vercel --prod
   ```

### エラー: 「Unauthorized」

**原因**: パスワードが間違っている、またはスプレッドシートの設定が間違っている

**解決方法**:
1. スプレッドシートの `settings` シートを確認
2. A2に `PASSWORD`、B2に `kankan` が入力されているか確認
3. スペースや全角文字が入っていないか確認

### データが同期されない

**原因**: GASのデプロイ設定が間違っている

**解決方法**:
1. Apps Scriptエディタで「デプロイ」→「デプロイを管理」
2. 「アクセスできるユーザー」が「全員」になっているか確認
3. 「編集」→「新しいバージョン」でデプロイし直す

---

## 📝 パスワードを変更したい場合

1. スプレッドシートの `settings` シートのB2セルを変更
2. 新しいパスワードを入力
3. アプリで再ログイン

---

## 🎉 次のステップ

- 夫婦でURLを共有して、両方からアクセスしてみる
- スマホのホーム画面にショートカットを追加する
  - Safari: 共有ボタン → ホーム画面に追加
  - Chrome: ⋮ → アプリをインストール

---

困ったことがあれば、このファイルを見返してください！
