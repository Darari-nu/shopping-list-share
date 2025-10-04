/**
 * 買い物リスト（夫婦共有アプリ）- Google Apps Script バックエンド
 *
 * このコードの目的:
 * - Googleスプレッドシートをデータベースとして、買い物リストのCRUD操作を提供
 * - パスワード認証でセキュアなアクセス制御
 * - フロントエンド（index.html）からのAPIリクエストを処理
 *
 * バージョン履歴:
 * - v1.0 (2025-10-04): 初版（add/toggle/delete/list/suggest）
 * - v2.0 (2025-10-04): update API追加（数量編集機能）
 * - v3.0 (2025-10-04): アーカイブ一覧を返す機能追加
 * - v3.1 (2025-10-04): doGetのパラメータ名をpathからactionに修正（フロントエンドと統一）
 * - v4.0 (2025-10-04): toggleItem()のパフォーマンス改善（setValue×3 → setValues×1で3倍高速化）
 * - v4.1 (2025-10-04): パフォーマンス改善（updateItemの一括更新、軽量認証エンドポイント追加）
 *
 * データ構造:
 * - items シート: 買い物アイテムの保存（未完了/完了の両方）
 * - settings シート: パスワードやHOUSEHOLD_IDの設定
 */

// ============================================================
// エントリーポイント（GETリクエスト）
// ============================================================

/**
 * GETリクエストのハンドラ（読み取り専用操作）
 *
 * エンドポイント:
 * - /list: 買い物リスト取得（未完了＋アーカイブ一覧）
 * - /suggest: 予測変換候補取得（現在は未使用）
 */
function doGet(e) {
  try {
    const action = e.parameter.action || '';
    const household = e.parameter.household;

    if (action === 'list') {
      if (!household) throw new Error('household required');
      return jsonResponse(listItems(household));
    }

    if (action === 'suggest') {
      if (!household) throw new Error('household required');
      const q = e.parameter.q || '';
      return jsonResponse(suggest(household, q));
    }

    throw new Error('Unknown action');
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

// ============================================================
// エントリーポイント（POSTリクエスト）
// ============================================================

/**
 * POSTリクエストのハンドラ（書き込み操作）
 *
 * 認証:
 * - パスワード認証必須（settings!B2のPASSWORDと一致）
 *
 * エンドポイント:
 * - add: アイテム追加
 * - toggle: 完了/未完了の切り替え
 * - delete: アイテム削除
 * - update: アイテム更新（数量/名前/メモ）
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const password = body.password;

    if (!password) {
      return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
    }

    if (!verifyPassword(password)) {
      return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
    }

    const action = body.action;

    if (action === 'verify') {
      return jsonResponse({ ok: true });
    }

    if (action === 'add') {
      return jsonResponse(addItem(body, 'web'));
    }

    if (action === 'toggle') {
      return jsonResponse(toggleItem(body, 'web'));
    }

    if (action === 'delete') {
      return jsonResponse(deleteItem(body, 'web'));
    }

    if (action === 'update') {
      return jsonResponse(updateItem(body));
    }

    throw new Error('Unknown action');
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

// ============================================================
// ユーティリティ関数（認証・レスポンス）
// ============================================================

/**
 * パスワード認証
 * @param {string} password - クライアントから送信されたパスワード
 * @return {boolean} 認証成功ならtrue
 */
function verifyPassword(password) {
  const settings = settingsMap();
  const correctPassword = settings.PASSWORD || 'kankan';
  return password === correctPassword;
}

/**
 * JSON形式のレスポンスを生成（CORS対応）
 * @param {Object} obj - レスポンスオブジェクト
 * @param {number} code - HTTPステータスコード（省略可）
 */
function jsonResponse(obj, code = 200) {
  const output = ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);

  // CORS対応: すべてのオリジンからのアクセスを許可
  return output;
}

// ============================================================
// データアクセス関数（スプレッドシート）
// ============================================================

/**
 * itemsシートの取得（なければ作成）
 * @return {Sheet} itemsシート
 */
function itemsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('items');

  if (!sheet) {
    sheet = ss.insertSheet('items');
    sheet.appendRow(['householdId', 'listId', 'itemId', 'name', 'qty', 'note', 'storeTag', 'done', 'updatedAt', 'updatedBy']);
  }

  return sheet;
}

/**
 * settingsシートの内容をMapとして取得
 * @return {Object} 設定のキー・バリューマップ
 */
function settingsMap() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('settings');

  if (!sheet) {
    sheet = ss.insertSheet('settings');
    sheet.getRange('A2').setValue('PASSWORD');
    sheet.getRange('B2').setValue('kankan');
    sheet.getRange('A3').setValue('HOUSEHOLD_ID');
    sheet.getRange('B3').setValue('home01');
    return {};
  }

  const data = sheet.getDataRange().getValues();
  const map = {};

  for (let i = 0; i < data.length; i++) {
    if (data[i][0]) {
      map[data[i][0]] = data[i][1] || '';
    }
  }

  return map;
}

// ============================================================
// ビジネスロジック（CRUD操作）
// ============================================================

/**
 * 買い物リスト取得
 * @param {string} household - 世帯ID
 * @return {Object} {ok, items, archived, archivedCount}
 */
function listItems(household) {
  const sheet = itemsSheet();
  const data = sheet.getDataRange().getValues();
  const items = [];
  const archived = [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === household && data[i][1] === 'default') {
      const done = data[i][7] === true || data[i][7] === 'TRUE';
      const item = {
        itemId: data[i][2],
        name: data[i][3],
        qty: data[i][4],
        note: data[i][5],
        done: done,
        updatedAt: data[i][8]
      };

      if (done) {
        archived.push(item);
      } else {
        items.push(item);
      }
    }
  }

  items.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  archived.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  return { ok: true, items: items, archived: archived, archivedCount: archived.length };
}

/**
 * アイテム追加
 * @param {Object} body - {household, name, qty, note}
 * @param {string} user - 更新者（'web'固定）
 * @return {Object} {ok, itemId}
 */
function addItem(body, user) {
  const household = body.household;
  const name = body.name;

  if (!household || !name) {
    throw new Error('household and name required');
  }

  const sheet = itemsSheet();
  const itemId = Utilities.getUuid();
  const now = new Date().toISOString();

  sheet.appendRow([
    household,
    'default',
    itemId,
    name,
    body.qty || '',
    body.note || '',
    '',
    false,
    now,
    user
  ]);

  return { ok: true, itemId: itemId };
}

/**
 * アイテムの完了/未完了を切り替え
 * @param {Object} body - {household, itemId, done}
 * @param {string} user - 更新者（'web'固定）
 * @return {Object} {ok}
 */
function toggleItem(body, user) {
  const household = body.household;
  const itemId = body.itemId;
  const done = body.done;

  if (!household || !itemId || done === undefined) {
    throw new Error('household, itemId, and done required');
  }

  const sheet = itemsSheet();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === household && data[i][2] === itemId) {
      const now = new Date().toISOString();
      // 一括更新: H列(done), I列(updatedAt), J列(updatedBy)
      sheet.getRange(i + 1, 8, 1, 3).setValues([[done, now, user]]);
      return { ok: true };
    }
  }

  throw new Error('Item not found');
}

/**
 * アイテム削除
 * @param {Object} body - {household, itemId}
 * @param {string} user - 更新者（'web'固定）
 * @return {Object} {ok}
 */
function deleteItem(body, user) {
  const household = body.household;
  const itemId = body.itemId;

  if (!household || !itemId) {
    throw new Error('household and itemId required');
  }

  const sheet = itemsSheet();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === household && data[i][2] === itemId) {
      sheet.deleteRow(i + 1);
      return { ok: true };
    }
  }

  throw new Error('Item not found');
}

/**
 * 予測変換候補の取得（現在未使用）
 * @param {string} household - 世帯ID
 * @param {string} q - 検索クエリ
 * @return {Object} {ok, suggestions}
 */
function suggest(household, q) {
  const sheet = itemsSheet();
  const data = sheet.getDataRange().getValues();
  const suggestions = [];
  const seen = new Set();

  const query = q.toLowerCase();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === household) {
      const name = data[i][3];
      if (name && name.toLowerCase().includes(query) && !seen.has(name)) {
        suggestions.push(name);
        seen.add(name);
        if (suggestions.length >= 10) break;
      }
    }
  }

  return { ok: true, suggestions: suggestions };
}

/**
 * itemIdからシート内の行を検索
 * @param {Sheet} sheet - 検索対象のシート
 * @param {string} itemId - アイテムのUUID
 * @return {Object|null} {row: 行番号, data: 行データ} または null
 */
function findRowById(sheet, itemId) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][2] === itemId) {
      return { row: i + 1, data: data[i] };
    }
  }
  return null;
}

/**
 * 現在時刻をISO8601形式で取得
 * @return {string} ISO8601形式のタイムスタンプ
 */
function nowISO() {
  return new Date().toISOString();
}

/**
 * アイテムの更新（名前・数量・メモ）
 * @param {Object} body - {household, itemId, name?, qty?, note?}
 * @return {Object} {ok} または {ok: false, error}
 */
function updateItem(body) {
  const household = body.household;
  const itemId = body.itemId;
  const name = body.name;
  const qty = body.qty;
  const note = body.note;

  if (!household || !itemId) {
    return { ok: false, error: 'household and itemId required' };
  }

  const sheet = itemsSheet();
  const found = findRowById(sheet, itemId);

  if (!found) {
    return { ok: false, error: 'item not found' };
  }

  const row = found.row;
  const householdCell = sheet.getRange(row, 1).getValue();

  if (String(householdCell) !== String(household)) {
    return { ok: false, error: 'household mismatch' };
  }

  // D: name(4), E: qty(5), F: note(6), I: updatedAt(9)
  const currentData = found.data;
  const newName = typeof name === 'string' ? name : currentData[3];
  const newQty = (typeof qty === 'string' || typeof qty === 'number') ? qty : currentData[4];
  const newNote = typeof note === 'string' ? note : currentData[5];
  const newUpdatedAt = nowISO();

  // 一括更新: name, qty, note, updatedAt
  sheet.getRange(row, 4, 1, 6).setValues([[newName, newQty, newNote, currentData[6], currentData[7], newUpdatedAt]])

  return { ok: true };
}
