# 買い物リスト共有アプリ - 開発履歴

## 概要
夫婦で買い物リストを共有できるPWAアプリ。Google Apps Script + Google Sheetsをバックエンド、Vanilla JavaScriptフロントエンドで構築。

---

## v8.4 (2025-10-04) - ブラウザキャッシュバイパス完全対応 ✨

### 修正内容
- **apiGet()にキャッシュバスター追加**: `_=${Date.now()}`でクエリ文字列を毎回変更
- **fetch()に`cache: 'no-store'`追加**: ブラウザキャッシュを完全バイパス
- **favicon.icoの404解消**: `<link rel="icon" href="/icon-192.png">`追加
- **load()引数名を`first`に戻して互換性確保**

### 解決した問題
- PC↔スマホのクロス端末同期遅延
- ブラウザがGETリクエストの古いレスポンスをキャッシュして返す問題
- favicon.icoの404エラー

### コード変更
```javascript
function apiGet(action, params={}){
  const qs = new URLSearchParams({ action, household: HOUSEHOLD, ...params, _: Date.now() }).toString();
  return fetch(`${GAS_URL}?${qs}`, { cache: 'no-store' }).then(r=>r.text()).then(safeJSON);
}
```

---

## v8.3.1 (2025-10-04) - モバイル通信エラー対応

### 修正内容
- **load()のtry/catch/finally構造修正**: `isLoading`をtryの外で設定、finallyで必ず解除
- **catch節でエラーログ出力**: `console.error('load() error:', err)`
- **通信エラー時のキャッシュフォールバック**

### 解決した問題
- モバイルの不安定な通信で一度エラーが起きると`isLoading`が`true`のまま固まる
- ポーリングが全て早期returnして更新が止まる問題

### コード変更
```javascript
async function load(first=false){
  if(isLoading) return;
  isLoading = true;
  try {
    const res = await apiGet('list');
    if(res && res.ok){
      // 既存処理
    } else {
      setStatus('オフライン');
      const cache = localStorage.getItem('snapshot');
      if(cache){ lastSnapshot = JSON.parse(cache); render(); }
    }
  } catch(err) {
    console.error('load() error:', err);
    setStatus('通信エラー');
    const cache = localStorage.getItem('snapshot');
    if(cache){ lastSnapshot = JSON.parse(cache); render(); }
  } finally {
    isLoading = false;
  }
}
```

---

## v8.3 (2025-10-04) - アーカイブ操作即時表示対応

### 修正内容
1. **complete()の楽観的更新実装**
   - アイテムを未完了リストから削除
   - アーカイブ配列に追加
   - API失敗時のロールバック処理

2. **restoreItem()の楽観的更新実装**
   - アーカイブから削除
   - 未完了リストに追加
   - API失敗時のロールバック処理

3. **deleteArchivedItem()の楽観的更新実装**
   - アーカイブから即座に削除
   - API失敗時の復元処理

4. **renderArchive()関数追加**
   - アーカイブ表示を独立した関数に分離
   - toggleArchive()から呼び出し

5. **load()に強制実行対応**
   - `force`パラメータ追加（後に`first`に戻す）
   - try/finally構造で確実に`isLoading`解除

6. **faviconリンク追加**
   - icon-192.png, icon-512.pngへのlink追加

### 解決した問題
- アーカイブの「戻す」「削除」ボタンを押しても即座に表示更新されない
- 2回押さないと反映されない問題
- complete()でアイテムがアーカイブに表示されない

### コード変更例
```javascript
async function complete(item){
  if(isProcessing) return;
  isProcessing = true;
  document.body.classList.add('processing');
  pendingCompletes.add(item.itemId);

  // 楽観的更新
  lastSnapshot.items = lastSnapshot.items.filter(x=>x.itemId!==item.itemId);
  item.done = true;
  item.updatedAt = new Date().toISOString();
  lastSnapshot.archived.unshift(item);

  render();
  const wasOpen = document.getElementById('archiveList').style.display === 'block';
  if(wasOpen){
    renderArchive();
  }

  const res = await apiPost('toggle', { itemId:item.itemId, done:true });

  pendingCompletes.delete(item.itemId);
  isProcessing = false;
  document.body.classList.remove('processing');

  if(!(res && res.ok)){
    // ロールバック
    lastSnapshot.archived = lastSnapshot.archived.filter(x=>x.itemId!==item.itemId);
    lastSnapshot.items.unshift(item);
    render();
    if(wasOpen){
      renderArchive();
    }
    toast('更新に失敗しました');
  }
}
```

---

## v5.1 (GAS) - CacheService一時無効化

### 修正内容
- **CacheServiceを一時的にオフ**: 表示遅延問題の調査のため
- **getLastRow最適化は維持**: パフォーマンスは保持

### 解決した問題
- CacheServiceの3秒TTLが原因で、アーカイブ操作後のload()が古いデータを返す
- スマホ→PCの反映が3秒遅延する

### コード変更
```javascript
function listItems(household) {
  // キャッシュを一時的にオフ（デバッグ用）
  // const cache = CacheService.getScriptCache();
  // const cacheKey = 'list_' + household;
  // const cached = cache.get(cacheKey);

  // if (cached) {
  //   return JSON.parse(cached);
  // }

  const sheet = itemsSheet();
  const lastRow = sheet.getLastRow();
  // ... 以下既存処理
}

function invalidateCache(household) {
  // const cache = CacheService.getScriptCache();
  // cache.remove('list_' + household);
}
```

---

## トラブルシューティング履歴

### 問題1: アーカイブ操作が2回押さないと反映されない

**症状**:
- 「削除しました」トーストは出るが表示は残る
- もう一度削除ボタンを押すと「削除できません」エラー
- 実際はDBから削除されているが表示だけ追いついていない

**原因分析**:
1. CacheServiceの3秒TTLでload()が古いデータを返す
2. complete()でアーカイブ配列に追加していない
3. restoreItem()で未完了リストに追加していない
4. toggleArchive()が二重トグルで無理やり再描画していた
5. load()の二重実行ガードでポーリング中の強制更新ができない

**解決策**:
1. CacheService一時無効化
2. 楽観的更新実装（UI先行、API後追い、失敗時ロールバック）
3. renderArchive()関数分離
4. load()にforce引数追加＋try/finally構造

---

### 問題2: モバイルで一度通信エラーが起きると更新が止まる

**症状**:
- スマホで最初のリクエストがコケた瞬間、それ以降更新されない
- PCは安定しているので気づきにくい

**原因**:
- load()で`isLoading = true`後にfetchが失敗すると、`isLoading = false`が呼ばれない
- 以降のポーリングが全て早期returnする

**解決策**:
```javascript
async function load(first=false){
  if(isLoading) return;
  isLoading = true;
  try {
    // fetch処理
  } catch(err) {
    // エラー処理
  } finally {
    isLoading = false; // 必ず実行
  }
}
```

---

### 問題3: PC↔スマホのクロス端末同期が遅い

**症状**:
- スマホで操作→PCに反映されるまで数秒かかる
- PC→スマホは比較的速い

**原因**:
1. CacheServiceの3秒TTL（GAS側）
2. ブラウザキャッシュ（PC側が特に顕著）
3. GETリクエストのURLが同じため、ブラウザが古いレスポンスを返す

**解決策**:
```javascript
function apiGet(action, params={}){
  const qs = new URLSearchParams({
    action,
    household: HOUSEHOLD,
    ...params,
    _: Date.now() // キャッシュバスター
  }).toString();
  return fetch(`${GAS_URL}?${qs}`, {
    cache: 'no-store' // ブラウザキャッシュ無効化
  }).then(r=>r.text()).then(safeJSON);
}
```

---

### 問題4: favicon.icoの404エラー

**症状**:
- コンソールに`GET https://kaimono-share.vercel.app/favicon.ico 404`

**原因**:
- ブラウザがデフォルトでfavicon.icoを探す
- 実際のファイルはicon-192.png/icon-512.png

**解決策**:
```html
<!-- Favicon -->
<link rel="icon" href="/icon-192.png">
<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">
<link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png">
```

---

## 主要技術スタック

### フロントエンド
- **Vanilla JavaScript**: フレームワークなし
- **PWA**: manifest.webmanifest, Service Worker対応
- **楽観的更新**: UIファーストでUX向上
- **ポーリング**: 1秒間隔で自動同期
- **LocalStorage**: オフライン対応＆スナップショット保存

### バックエンド
- **Google Apps Script**: サーバーレスAPI
- **Google Sheets**: NoSQLライクなデータベース
- **CORS対応**: すべてのオリジンから許可
- **パスワード認証**: settingsシートで管理

### デプロイ
- **Vercel**: フロントエンド（https://kaimono-share.vercel.app）
- **Google Apps Script**: バックエンド（Web App公開）
- **Git**: バージョン管理（GitHub）

---

## パフォーマンス最適化履歴

### GAS側最適化
1. **getLastRow()使用**: getDataRange()より高速
2. **必要な列のみ取得**: getRange(2, 1, lastRow-1, 9)で絞り込み
3. **一括更新**: setValues()で複数セルを1回で更新
4. **CacheService導入→一時無効化**: 表示遅延問題で調査中

### フロントエンド側最適化
1. **楽観的更新**: API待たずにUI更新
2. **ポーリング重複防止**: isLoadingフラグ
3. **数量編集のデバウンス**: qtyTimerで500ms遅延
4. **ブラウザキャッシュバイパス**: cache: 'no-store' + タイムスタンプ

---

## 今後の改善案

### 機能拡張
- [ ] 予測変換（suggest API活用）
- [ ] カテゴリ/店舗タグ機能
- [ ] 複数リスト対応
- [ ] 共有メンバー管理

### パフォーマンス
- [ ] CacheServiceの再有効化（適切な無効化タイミング実装後）
- [ ] WebSocket/SSEでリアルタイム同期
- [ ] Service Workerでオフライン完全対応

### UX改善
- [ ] ドラッグ&ドロップで並び替え
- [ ] スワイプジェスチャー
- [ ] ダークモード対応
- [ ] 通知機能（相手が追加したら通知）

---

## バージョン管理ルール

### フロントエンド (index.html)
- メジャー: 大規模リファクタリング、破壊的変更
- マイナー: 新機能追加、UI大幅変更
- パッチ: バグ修正、小規模改善

### バックエンド (Code.gs)
- v1.0: 初版
- v2.0: update API追加
- v3.0: アーカイブ一覧機能
- v4.0: パフォーマンス改善（一括更新）
- v5.0: 大幅最適化（getLastRow + Cache）
- v5.1: Cache一時無効化

---

## デバッグTips

### ブラウザ側
```javascript
// コンソールで現在の状態確認
console.log('isLoading:', isLoading);
console.log('lastSnapshot:', lastSnapshot);
console.log('pendingAdds:', pendingAdds);
console.log('pendingCompletes:', pendingCompletes);
```

### ハードリフレッシュ方法
- **Chrome/Edge**: Ctrl+Shift+R (Win) / Cmd+Shift+R (Mac)
- **Safari**: Cmd+Option+R
- **Firefox**: Ctrl+F5 (Win) / Cmd+Shift+R (Mac)

### GAS側デバッグ
- Apps Scriptエディタの「実行ログ」確認
- Logger.log()でデバッグ出力
- スプレッドシート直接確認

---

## 開発者メモ

### コミットメッセージ規則
```
fix: バグ修正
feat: 新機能
perf: パフォーマンス改善
refactor: リファクタリング
docs: ドキュメント
style: コードスタイル
```

### デプロイ手順
1. `git add . && git commit -m "..."`
2. `git push`
3. `vercel --prod`

### GAS更新手順
1. Apps Scriptエディタで編集
2. 「デプロイ」→「新しいデプロイ」
3. 「説明」にバージョン番号記入
4. URLをフロントエンドのGAS_URLに反映（必要時）

---

**最終更新**: 2025-10-04
**現在バージョン**: フロントエンドv8.4 / バックエンドv5.1
**デプロイURL**: https://kaimono-share.vercel.app
