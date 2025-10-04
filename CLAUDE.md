# 要件定義書

## プロジェクト概要

**プロジェクト名**: 買い物リスト（夫婦共有アプリ）

**目的**: 夫婦で「今買うもの」をサクッと共有。スマホから素早く追加・チェックできる最小限のアプリを作る。

**ターゲットユーザー**: 夫婦2名（将来的に家族に拡張可能）

**開発期間**: 1日（MVP）

---

## 技術スタックと制約

### フロントエンド
- **技術**: 単一ファイル `index.html`（HTML/CSS/JSを同一ファイル内に記述）
- **制約**:
  - ビルドなし
  - 外部ライブラリ不使用（ブラウザ標準機能のみ）
  - vanilla JavaScript

### ホスティング
- **サービス**: Vercel
- **構成**: 静的ホスティング（`index.html` 1枚）

### バックエンド
- **技術**: Google Apps Script（GAS Webアプリ）
- **データベース**: Google スプレッドシート（データ永続化）

### 認証
- **方式**: Google Identity Services（GIS）
- **フロー**:
  1. フロントでGoogleログイン→IDトークンを取得
  2. GASに送信
  3. GAS側でIDトークンを検証
  4. 許可メールアドレスのホワイトリストに含まれる場合のみ処理を許可

### 同期方式
- **リアルタイム同期**: 不要
- **ポーリング**: 3秒ごとに更新

---

## データ仕様

### スプレッドシート構成

#### items シート（ヘッダー行あり）

| 列 | 項目名 | 型 | 必須 | 備考 |
|----|--------|-----|------|------|
| A | householdId | string | ✓ | 世帯ID（例: home01） |
| B | listId | string | ✓ | 固定値 'default' |
| C | itemId | string | ✓ | UUID |
| D | name | string | ✓ | 品名 |
| E | qty | string | - | 数量 |
| F | note | string | - | メモ |
| G | storeTag | string | - | 将来用（今回未使用） |
| H | done | boolean | ✓ | TRUE/FALSE |
| I | updatedAt | string | ✓ | ISO8601形式 |
| J | updatedBy | string | ✓ | メールアドレス or 'web' |

#### settings シート

| 行 | A列 | B列 | 備考 |
|----|-----|-----|------|
| 2 | ALLOWED_EMAILS | me@example.com,partner@example.com | カンマ区切りの許可メール |
| 3 | HOUSEHOLD_ID | home01 | 世帯ID |

---

## バックエンド（GAS）要件

### エンドポイント一覧

#### 1. GET /list
**説明**: 買い物リストを取得

**パラメータ**:
- `household`: 世帯ID（必須）

**レスポンス**:
```json
{
  "ok": true,
  "items": [
    {
      "itemId": "uuid",
      "name": "牛乳",
      "qty": "1本",
      "note": "",
      "done": false,
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "archivedCount": 5
}
```

**仕様**:
- 未完了（`done=false`）のみを返却
- 更新日時の新しい順

---

#### 2. POST /add
**説明**: アイテムを追加

**ボディ**:
```json
{
  "action": "add",
  "household": "home01",
  "name": "牛乳",
  "qty": "1本",
  "note": "",
  "idToken": "..."
}
```

**レスポンス**:
```json
{
  "ok": true,
  "itemId": "uuid"
}
```

---

#### 3. POST /toggle
**説明**: アイテムの完了状態を切り替え

**ボディ**:
```json
{
  "action": "toggle",
  "household": "home01",
  "itemId": "uuid",
  "done": true,
  "idToken": "..."
}
```

**レスポンス**:
```json
{
  "ok": true
}
```

---

#### 4. POST /delete
**説明**: アイテムを削除

**ボディ**:
```json
{
  "action": "delete",
  "household": "home01",
  "itemId": "uuid",
  "idToken": "..."
}
```

**レスポンス**:
```json
{
  "ok": true
}
```

---

#### 5. GET /suggest
**説明**: 予測変換候補を取得

**パラメータ**:
- `household`: 世帯ID（必須）
- `q`: 検索クエリ（必須）

**レスポンス**:
```json
{
  "ok": true,
  "suggestions": ["牛乳", "牛肉"]
}
```

**仕様**:
- 過去（アーカイブ含む）の名称から部分一致
- 最大10件

---

### 認証処理

#### IDトークンの検証フロー

1. フロントから送られてくる `idToken`（GISのIDトークン）を受信
2. Googleの`tokeninfo`エンドポイントで署名と有効期限を確認
   ```
   https://oauth2.googleapis.com/tokeninfo?id_token={idToken}
   ```
3. メールアドレスを取り出す
4. `settings!B2` の許可メール一覧（カンマ区切り）と照合
5. 含まれない場合は `{ ok: false, error: 'Unauthorized' }` を返す

---

### その他の仕様

- `items` シートがなければ自動作成し、ヘッダーを生成
- `updatedAt` は `new Date().toISOString()`
- 例外は `{ ok: false, error: '...' }` のJSON形式で返す

---

## フロントエンド（index.html）要件

### UI構成

#### 1. ヘッダー
- ログインユーザのメールアドレス（小さく表示）
- 同期状態（「同期完了」「オフライン」など）
- アーカイブ件数

#### 2. 入力エリア
- 「買いたいもの」入力欄（メイン）
- 「数量」入力欄（任意、幅80px）
- 「追加」ボタン
- 予測変換ドロップダウン
- 「更新」ボタン（手動同期）

#### 3. アイテムリスト
- チェックボックス（左）
- 品名・数量・メモ（中央）
- 削除ボタン（右）

#### 4. スナックバー
- 「完了しました」メッセージ
- 「元に戻す」ボタン（5秒間表示）

---

### 機能詳細

#### アイテム追加
- Enterキーまたは「追加」ボタンで登録
- 入力欄をクリア
- 予測変換を非表示

#### チェック機能
- チェックを入れたら即リストから消える（`done=true`、アーカイブ入り）
- スナックバーで「元に戻す」を5秒間表示
- ワンタップで復帰（`done=false`）

#### 予測変換
- 入力中の文字に部分一致で候補をドロップダウン表示
- 過去＋アーカイブから取得
- クリックで入力欄に反映

#### 同期
- 3秒ごとに `/list` をポーリング
- 手動「更新」ボタン

#### オフライン対応
- 最後のスナップショットを `localStorage` に保存
- オフライン時は保存データを表示

#### エラーハンドリング
- エラーメッセージは日本語で短く表示
- 5秒後に自動で非表示

#### ログイン
- ページロード時にGISのGoogleログインUI
- 成功後、IDトークンを保持
- API呼び出し時に付与

---

### 設定値

フロント上部に定数として配置：

```javascript
const GAS_URL = 'YOUR_GAS_WEB_APP_URL_HERE';  // プレースホルダ
const CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID_HERE';  // プレースホルダ
const HOUSEHOLD = 'home01';  // settings!B3と一致
```

---

### アクセシビリティ/モバイル

- タップしやすい大きめボタン
- シンプルな配色
- 外部CSSなし
- viewport設定済み

---

## 非機能要件

### パフォーマンス
- 初回ロード: 3秒以内
- API応答: 2秒以内

### セキュリティ
- IDトークン検証必須
- 許可メールアドレス以外は拒否
- HTTPS通信

### 可用性
- オフライン時もスナップショット表示
- エラー時も操作継続可能

---

## 受け入れ基準（DoD）

- [ ] 2端末から同一URLにアクセス可能
- [ ] Googleでログイン後、追加操作可能
- [ ] 追加したアイテムが3秒以内に相互反映
- [ ] チェック→即消える→「元に戻す」で復帰
- [ ] 予測変換が履歴から候補を返す
- [ ] 許可メール以外は更新操作が拒否される
- [ ] オフライン時にスナップショット表示
- [ ] エラーメッセージが日本語で表示

---

## スコープ外（将来機能）

以下は今回の実装に含めない：

- ❌ 複数リスト（`listId` は固定で `'default'`）
- ❌ 店舗タグ（`storeTag` は未使用）
- ❌ カテゴリ分類
- ❌ 並び替え機能（更新日時の新しい順で固定）
- ❌ 通知機能
- ❌ PWA化（完全なオフライン対応）
- ❌ ダークモード
- ❌ リアルタイム同期（WebSocket等）

---

## セットアップ手順

### 1. Googleスプレッドシートの作成
1. 新しいスプレッドシートを作成
2. `settings` シートを作成
3. A2に `ALLOWED_EMAILS`、B2に許可メールアドレス（カンマ区切り）
4. A3に `HOUSEHOLD_ID`、B3に世帯ID（例: `home01`）

### 2. Google Apps Scriptのデプロイ
1. スプレッドシートから「拡張機能」→「Apps Script」
2. `Code.gs` の内容を貼り付け
3. 「デプロイ」→「新しいデプロイ」
4. 種類: Webアプリ、アクセス: 全員
5. デプロイURLをコピー

### 3. Google Cloud Consoleの設定
1. プロジェクト作成
2. 「APIとサービス」→「認証情報」
3. OAuthクライアントID作成（ウェブアプリケーション）
4. 承認済みのJavaScript生成元にVercelのURLを追加
5. クライアントIDをコピー

### 4. index.htmlの設定値を更新
- `GAS_URL` をデプロイURLに置き換え
- `CLIENT_ID` をクライアントIDに置き換え
- `HOUSEHOLD` をスプレッドシートの設定と一致させる

### 5. Vercelへのデプロイ
- `index.html` をVercelにアップロード
- デプロイ完了後、URLをGoogle Cloud Consoleの承認済みURLに追加

---

## トラブルシューティング

### ログインできない
- Google Cloud ConsoleのOAuth設定を確認
- 承認済みのJavaScript生成元にVercelのURLが追加されているか確認

### データが同期されない
- GASのデプロイURLが正しいか確認
- スプレッドシートの`ALLOWED_EMAILS`にメールアドレスが追加されているか確認
- ブラウザの開発者ツールでエラーログを確認

### Unauthorized エラー
- スプレッドシートの`settings!B2`に自分のメールアドレスが含まれているか確認
- カンマ区切りで正しく設定されているか確認

---

## バージョン管理ルール

**重要**: Code.gsまたはindex.htmlを更新するたびに、必ず以下を実施すること：

1. ファイル冒頭のバージョン履歴を更新
2. このCLAUDE.mdの変更履歴セクションを更新
3. 変更内容を簡潔に記録

**バージョン番号の付け方**:
- **Major（x.0.0）**: 大規模な機能追加・仕様変更
- **Minor（1.x.0）**: 新機能追加
- **Patch（1.0.x）**: バグ修正・小規模な改善

---

## 変更履歴

| 日付 | バージョン | 変更内容 | ファイル |
|------|-----------|---------|---------|
| 2025-10-04 | 1.0 | 初版作成（Googleログイン版） | Code.gs, index.html |
| 2025-10-04 | 2.0 | パスワード認証に変更、楽観的UI更新、1秒ポーリング、インライン数量編集、Undo機能追加 | Code.gs, index.html |
| 2025-10-04 | 3.0 | アーカイブ一覧機能追加、予測変換削除 | Code.gs, index.html |
| 2025-10-04 | 3.1-backend | doGetのパラメータ名をpathからactionに修正（フロントエンドと統一） | Code.gs |
| 2025-10-04 | 3.1-frontend | pendingCompletes/pendingDeletes追加（チェック・削除時のチラツキ修正） | index.html |
| 2025-10-04 | 3.2 | 日本語変換中のEnter無視（isComposing対応） | index.html |
| 2025-10-04 | 4.0 | デザイン大幅刷新（Apple HIG + 21st.dev風、グラデーション背景、グラスモーフィズム、カスタムチェックボックス） | index.html |
| 2025-10-04 | 4.1 | 追加日時の相対表記表示（たった今、2分前、今日 14:30、昨日、2日前、2025/10/03） | index.html |
| 2025-10-04 | 4.2 | スマホ最適化（タップターゲット拡大、数量バッジ表示、削除アイコン化、FAB調整、入力フィールド縦並び） | index.html |
| 2025-10-04 | 4.3 | 削除ボタン廃止、チェックボックスのみでアーカイブ（完了）する仕様に変更 | index.html |
| 2025-10-04 | 4.4 | アーカイブ一覧にも日時と数量バッジを表示 | index.html |
| 2025-10-04 | 5.0 | デザイン強化（ノイズグラデーション背景、チェックアニメーション、アイテム追加アニメーション、数量バッジのグラデーション、カード3D効果、空状態デザイン） | index.html |
| 2025-10-04 | 5.1 | アイテム追加アニメーションを新規追加時のみに修正（ポーリング再描画時に動かないように） | index.html |

---

## 既知の問題とトラブルシューティング（重要）

### ⚠️ 絶対に繰り返してはいけないエラー

#### 1. **パラメータ名の不一致（Critical）**
**症状**: アイテム追加後、リストが表示されない・CORSエラー

**原因**:
- フロントエンド（index.html）は `action` パラメータを送信
- バックエンド（Code.gs）は `path` パラメータを受け取る設定になっていた

**修正内容** (v3.1):
```javascript
// 修正前（NG）
function doGet(e) {
  const path = e.parameter.path || '';
  if (path === 'list') { ... }
}

// 修正後（OK）
function doGet(e) {
  const action = e.parameter.action || '';
  if (action === 'list') { ... }
}
```

**防止策**:
- フロントエンドとバックエンドのパラメータ名は必ず統一
- 新しいエンドポイント追加時は両方のコードを確認

---

#### 2. **Content-Type ヘッダーによるCORSエラー（Critical）**
**症状**:
```
Access to fetch at 'https://script.google.com/...' has been blocked by CORS policy
```

**原因**:
`Content-Type: application/json` ヘッダーを送るとプリフライトリクエスト（OPTIONS）が発生するが、GASはこれに対応していない。

**修正内容**:
```javascript
// 修正前（NG）
function apiPost(action, body={}) {
  return fetch(GAS_URL, {
    method: 'POST',
    headers: {'Content-Type':'application/json'}, // ← 削除必須
    body: JSON.stringify({ action, household: HOUSEHOLD, password, ...body })
  });
}

// 修正後（OK）
function apiPost(action, body={}) {
  return fetch(GAS_URL, {
    method: 'POST',
    body: JSON.stringify({ action, household: HOUSEHOLD, password, ...body })
  });
}
```

**防止策**:
- GASへのPOSTリクエストには絶対に `Content-Type` ヘッダーを追加しない
- GASはヘッダーなしでもJSON.parseできる

---

#### 3. **楽観的UI更新のチラツキ（High）**
**症状**:
- アイテム追加後、一瞬表示される
- 0.5秒後に消える
- さらに0.5秒後に再表示される

**原因**:
1. 追加ボタン → 楽観的UI更新で即座に表示（一時ID）
2. 0.5秒後、1秒ポーリングの`load()`が発火
3. しかしGASへの保存がまだ完了していないため、サーバーから取得したデータに新アイテムが含まれない
4. `lastSnapshot`が上書きされて消える
5. さらに0.5秒後、保存完了 → 次のポーリングで表示

**修正内容**:
```javascript
// グローバル変数に追加
let pendingAdds = new Set(); // 保存中のtempID

// load()関数を修正
async function load(first=false){
  const res = await apiGet('list');
  if(res && res.ok){
    // 保存中の楽観的アイテムを保持
    const pending = lastSnapshot.items.filter(x => pendingAdds.has(x.itemId));
    lastSnapshot = { items: [...pending, ...(res.items || [])], archived: res.archived || [] };
    // ...
  }
}

// add()関数を修正
async function add(){
  const tempId = 'tmp-'+Math.random().toString(36).slice(2);
  pendingAdds.add(tempId); // 保存中フラグ
  lastSnapshot.items.unshift({ itemId: tempId, name, qty, done:false });
  render();

  const res = await apiPost('add', { name, qty });
  if(res && res.ok){
    // 成功：pendingから削除（次のポーリングでサーバーから取得）
    pendingAdds.delete(tempId);
    lastSnapshot.items = lastSnapshot.items.filter(x=>x.itemId!==tempId);
    // ...
  }
}
```

**防止策**:
- 楽観的UI更新を実装する際は、保存中の状態を必ず管理
- ポーリング時に保存中のアイテムを上書きしないようにする

---

#### 4. **GAS再デプロイ時に変更が反映されない（Medium）**
**症状**:
- Code.gsを更新して保存した
- 再デプロイした
- でもアプリの動作が変わらない

**原因**:
「デプロイを管理」で「新しいバージョン」を選択せずに再デプロイしている。

**修正手順**:
1. Apps Scriptエディタで「デプロイ」→「デプロイを管理」
2. 鉛筆アイコン（編集）をクリック
3. 「バージョン」のプルダウンから **「新しいバージョン」** を選択
4. 「デプロイ」ボタンをクリック

**防止策**:
- GASの更新時は**必ず**「新しいバージョン」を選択
- 既存バージョンの再デプロイは動作しない

---

### その他のトラブルシューティング

詳細は [TROUBLESHOOTING.md](TROUBLESHOOTING.md) を参照。

---

## セットアップ手順
