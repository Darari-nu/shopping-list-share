# トラブルシューティング

## 追加したアイテムが一瞬表示されて消える問題

### 症状
- アイテムを追加すると一瞬表示される
- 0.5秒後くらいに消える
- さらに0.5秒後に再表示される

### 原因
1. 追加ボタン → 楽観的UI更新で即座に表示（一時ID）
2. 0.5秒後、1秒ポーリングの`load()`が発火
3. しかしGASへの保存がまだ完了していないため、サーバーから取得したデータに新アイテムが含まれない
4. `lastSnapshot`が上書きされて消える
5. さらに0.5秒後、保存完了 → 次のポーリングで表示

### 解決方法
`pendingAdds` Setで「保存中の一時ID」を管理し、`load()`時に保存中のアイテムを保持するように修正。

```javascript
// グローバル変数に追加
let pendingAdds = new Set(); // 保存中のtempID

// load()関数を修正
async function load(first=false){
  const res = await apiGet('list');
  if(res && res.ok){
    // 保存中の楽観的アイテムを保持
    const pending = lastSnapshot.items.filter(x => pendingAdds.has(x.itemId));
    lastSnapshot = { items: [...pending, ...(res.items || [])] };
    // ...
  }
}

// add()関数を修正
async function add(){
  // ...
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

---

## CORSエラーが出る問題

### 症状
```
Access to fetch at 'https://script.google.com/...' has been blocked by CORS policy
```

### 原因
`Content-Type: application/json` ヘッダーを送るとプリフライトリクエスト（OPTIONS）が発生するが、GASはこれに対応していない。

### 解決方法
POSTリクエストから`Content-Type`ヘッダーを削除。

```javascript
// 修正前
function apiPost(action, body={}) {
  return fetch(GAS_URL, {
    method: 'POST',
    headers: {'Content-Type':'application/json'}, // ← 削除
    body: JSON.stringify({ action, household: HOUSEHOLD, password, ...body })
  }).then(r=>r.text()).then(safeJSON);
}

// 修正後
function apiPost(action, body={}) {
  return fetch(GAS_URL, {
    method: 'POST',
    body: JSON.stringify({ action, household: HOUSEHOLD, password, ...body })
  }).then(r=>r.text()).then(safeJSON);
}
```

---

## GASを再デプロイしても変更が反映されない

### 症状
- Code.gsを更新して保存した
- 再デプロイした
- でもアプリの動作が変わらない

### 原因
「デプロイを管理」で「新しいバージョン」を選択せずに再デプロイしている。

### 解決方法
1. Apps Scriptエディタで「デプロイ」→「デプロイを管理」
2. 鉛筆アイコン（編集）をクリック
3. 「バージョン」のプルダウンから **「新しいバージョン」** を選択
4. 「デプロイ」ボタンをクリック

---

## データが同期されない

### 確認事項
1. **GASのデプロイ設定**
   - 「アクセスできるユーザー」が「全員」になっているか確認

2. **URLの確認**
   - `index.html`の`GAS_URL`が正しいか確認
   - URLの末尾が `/exec` になっているか確認（`/dev`ではない）

3. **パスワードの確認**
   - スプレッドシートの`settings!B2`に正しいパスワードが設定されているか確認

4. **GASが動いているか確認**
   - ブラウザで以下にアクセス：
     ```
     https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?action=list&household=home01
     ```
   - `{"ok":true,"items":[...],...}` が返ってくればOK

---

## Unauthorized エラー

### 症状
追加・削除・完了などの操作で「Unauthorized」エラーが出る

### 原因
パスワードが間違っているか、スプレッドシートの設定が間違っている

### 解決方法
1. スプレッドシートの`settings`シートを開く
2. A2セル: `PASSWORD`、B2セル: `kankan`（または設定したパスワード）
3. スペースや全角文字が入っていないか確認
4. ブラウザで再ログイン

---

## ブラウザキャッシュの問題

### 症状
- `index.html`を更新したのに変更が反映されない
- 古い動作のままになっている

### 解決方法
**Shift + リロード**（スーパーリロード）を実行

- Windows/Linux: `Ctrl + Shift + R`
- Mac: `Command + Shift + R`

---

## 作成日
2025-10-04

## 最終更新日
2025-10-04
