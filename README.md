# 買い物リスト（夫婦共有アプリ）

夫婦で「今買うもの」をサクッと共有できる最小限の買い物リストアプリ

## 技術スタック

- **フロントエンド**: 単一HTML（vanilla JS）
- **ホスティング**: Vercel
- **バックエンド**: Google Apps Script
- **データベース**: Google スプレッドシート
- **認証**: パスワード認証（デフォルト: `kankan`）

## セットアップ手順

**初心者向けの詳しい手順は [SETUP.md](SETUP.md) をご覧ください。**

### 簡易手順

1. Googleスプレッドシートを作成し、`settings` シートに以下を設定：
   ```
   A2: PASSWORD      | B2: kankan
   A3: HOUSEHOLD_ID  | B3: home01
   ```

2. Apps Scriptで `Code.gs` をデプロイ（アクセス: 全員）

3. `index.html` の `GAS_URL` をデプロイURLに置き換え

4. Vercelにデプロイ

## 使い方

1. デプロイしたURLにアクセス
2. パスワード（デフォルト: `kankan`）を入力してログイン
3. 買いたいものを入力して「追加」
4. チェックを入れると即アーカイブ（リストから消える）
5. 「元に戻す」で復帰可能
6. 3秒ごとに自動同期

## 機能

- ✅ アイテムの追加（品名 + 数量）
- ✅ チェックで即アーカイブ
- ✅ 「元に戻す」機能
- ✅ アイテムの削除
- ✅ 予測変換（過去の入力から候補表示）
- ✅ 3秒ごとのポーリング同期
- ✅ オフライン時のスナップショット表示
- ✅ アーカイブ件数の表示

## データ仕様

### items シート

| 列 | 項目名 | 型 | 必須 | 備考 |
|----|--------|-----|------|------|
| A | householdId | string | ✓ | 世帯ID |
| B | listId | string | ✓ | 固定値 'default' |
| C | itemId | string | ✓ | UUID |
| D | name | string | ✓ | 品名 |
| E | qty | string | - | 数量 |
| F | note | string | - | メモ |
| G | storeTag | string | - | 将来用（今回未使用） |
| H | done | boolean | ✓ | TRUE/FALSE |
| I | updatedAt | string | ✓ | ISO8601形式 |
| J | updatedBy | string | ✓ | メールアドレス |

## API仕様

### GET /list
- パラメータ: `household`
- レスポンス: `{ ok: true, items: [...], archivedCount: number }`

### POST /add
- ボディ: `{ action: 'add', household, name, qty?, note?, idToken }`
- レスポンス: `{ ok: true, itemId }`

### POST /toggle
- ボディ: `{ action: 'toggle', household, itemId, done, idToken }`
- レスポンス: `{ ok: true }`

### POST /delete
- ボディ: `{ action: 'delete', household, itemId, idToken }`
- レスポンス: `{ ok: true }`

### GET /suggest
- パラメータ: `household`, `q`
- レスポンス: `{ ok: true, suggestions: [...] }`

## セキュリティ

- パスワード認証（スプレッドシートの `settings` シートで設定）
- パスワードが一致しない場合は401エラー
- すべての変更操作に `password` 必須

## パスワード変更方法

1. スプレッドシートの `settings` シートを開く
2. B2セル（PASSWORD列）の値を変更
3. 新しいパスワードでログイン

## トラブルシューティング

詳しくは [SETUP.md](SETUP.md) をご覧ください。

### データが同期されない
- GASのデプロイURLが正しいか確認
- GASのデプロイ設定で「アクセスできるユーザー」が「全員」になっているか確認

### Unauthorized エラー
- パスワードが正しいか確認
- スプレッドシートの `settings!B2` に正しいパスワードが設定されているか確認
