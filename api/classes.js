import { google } from 'googleapis';

// 解析日期欄位標題，支援「2/16」「3/1」「08/04 (二)」「[08/04 (二)]」等，統一轉為「M/D」
function parseDateHeader(raw) {
  const s = (raw || '').toString().replace(/[[\]]/g, '').trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})/);
  if (!m) return null;
  return `${parseInt(m[1], 10)}/${parseInt(m[2], 10)}`;
}

// 班別正規化：不同分頁的班別名稱可能不同（如「建國晚班」與「晚班」其實同一班），
// 統一對應到標準班別後再分組合併。順序需長者優先（大夜班 要在 大夜 之前）。
const SHIFT_KEYWORDS = ['大夜班', '大夜', '早班', '晚八班', '晚班', '晚4', '夜10', '夜短'];
function normalizeShift(classValue) {
  const s = (classValue || '').toString().replace(/\s/g, '');
  for (const kw of SHIFT_KEYWORDS) {
    if (s.includes(kw)) return kw;
  }
  return s;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') body = JSON.parse(body);
  const name = (body?.name || '').trim();
  const idNumber = (body?.idNumber || '').trim();

  if (!name && !idNumber) {
    return res.status(400).json({ error: '請提供姓名或身分證號' });
  }

  // 用於匹配的識別碼（優先用身分證）
  const matchValue = idNumber || name;

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.SHEET_C_ID;

    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const allSheets = spreadsheet.data.sheets || [];

    // 分頁設定（欄位以 A=索引0 換算）
    // 「蝦皮報班」與「蝦皮」合併輸出（output 同為「蝦皮」），同人依 班別|倉別 合併成一筆
    const SHEET_CONFIGS = {
      '酷澎': {
        output: '酷澎',
        idColIndex: 6,        // G 身分證
        nameMatchColIndex: 5, // F 姓名
        classColIndex: 4,     // E 班別
        warehouseColIndex: 9, // J 倉別
        infoColumns: [4, 5, 6, 7, 8, 9], // E~J
      },
      '蝦皮': {
        output: '蝦皮',
        idColIndex: 14,        // O 身分證
        nameMatchColIndex: 10, // K 姓名
        classColIndex: 4,      // E 班別
        warehouseColIndex: 7,  // H 倉別
        infoColumns: [4, 5, 6, 7, 8, 9], // E~J
        mergeByShift: true, // 同倉 + 同正規化班別 合併（建國晚班≡晚班）
      },
      '蝦皮報班': {
        output: '蝦皮',        // 與「蝦皮」合併
        idColIndex: 13,        // N 身分證
        nameMatchColIndex: 9,  // J 姓名
        classColIndex: 7,      // H 班別
        warehouseColIndex: 6,  // G 倉別
        // 顯示欄位 E~J 依序對應「蝦皮報班」的 H,E,F,G,H,I 欄
        infoColumns: [7, 4, 5, 6, 7, 8],
        mergeByShift: true, // 同倉 + 同正規化班別 合併（建國晚班≡晚班）
      },
    };

    const targetTitles = Object.keys(SHEET_CONFIGS);
    const targetSheets = allSheets.filter(s => targetTitles.includes(s.properties.title));

    if (targetSheets.length === 0) {
      return res.status(404).json({ error: '找不到酷澎、蝦皮或蝦皮報班分頁' });
    }

    // 合併用：key = output|班別|倉別
    const mergedGroups = new Map();
    const debug = [];

    for (const sheet of targetSheets) {
      const sheetTitle = sheet.properties.title;
      const cfg = SHEET_CONFIGS[sheetTitle];

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetTitle}'!A:DM`,
      });

      const rows = response.data.values || [];
      if (rows.length === 0) continue;

      // 第一列是標題
      const headers = rows[0] || [];

      // 資訊欄位（顯示用）
      const infoColumns = [];
      for (const j of cfg.infoColumns) {
        const h = (headers[j] || '').toString().trim();
        infoColumns.push({ index: j, header: h });
      }
      // 資訊欄位顯示：標題以「蝦皮」E~J 為主，值以「蝦皮報班」對應欄位為主
      const labelPriority = sheetTitle === '蝦皮' ? 2 : 1;
      const valuePriority = sheetTitle === '蝦皮報班' ? 2 : 1;

      // 日期報名欄位（動態偵測，支援 2/16 與 08/04 (二) 等格式，統一轉為 M/D）
      const dateColumns = [];
      for (let j = 0; j < headers.length; j++) {
        const norm = parseDateHeader(headers[j]);
        if (norm) dateColumns.push({ index: j, header: norm });
      }
      debug.push({ sheet: sheetTitle, headersCount: headers.length, dateColumnsCount: dateColumns.length });

      // 如果沒有日期欄位，跳過這個分頁
      if (dateColumns.length === 0) {
        debug.push({ sheet: sheetTitle, skipped: 'no date columns' });
        continue;
      }

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];

        let matched = false;
        if (idNumber) {
          // 一般員工：身分證 + 姓名 雙重驗證
          const rowId = (row[cfg.idColIndex] || '').toString().trim();
          const rowName = (row[cfg.nameMatchColIndex] || '').toString().trim();
          matched = rowId === idNumber && rowName === name;
        } else {
          // 管理者：只用姓名精準匹配
          const rowName = (row[cfg.nameMatchColIndex] || '').toString().trim();
          matched = rowName === matchValue;
        }
        if (!matched) continue;

        const classValue = (row[cfg.classColIndex] || '').toString().trim();
        const warehouseValue = (row[cfg.warehouseColIndex] || '').toString().trim();
        // 蝦皮家族（蝦皮 + 蝦皮報班）：同一查詢者的兩個分頁合併成一張卡片（僅以 output 當 key）
        // 其他（酷澎）：維持 班別|倉別 分組
        const groupKey = cfg.mergeByShift
          ? `${cfg.output}`
          : `${cfg.output}|${classValue}|${warehouseValue}`;

        if (!mergedGroups.has(groupKey)) {
          mergedGroups.set(groupKey, {
            sheetName: cfg.output,
            warehouse: warehouseValue,
            classValue,
            infoSlots: [],      // 依顯示位置 slot -> { label, labelPrio, value, valuePrio }
            dates: new Map(),   // date(M/D) -> { values:Set, registered:bool }
          });
        }
        const g = mergedGroups.get(groupKey);
        // 合併時補上倉別/班別的非空值（一個分頁可能缺）
        if (!g.warehouse && warehouseValue) g.warehouse = warehouseValue;
        if (!g.classValue && classValue) g.classValue = classValue;

        // 合併資訊欄位（依「顯示位置」對齊）：標題取蝦皮，值取蝦皮報班，另一方遞補空缺
        infoColumns.forEach((col, slot) => {
          const label = col.header;
          const value = (row[col.index] || '').toString().trim();
          let cur = g.infoSlots[slot];
          if (!cur) {
            cur = { label: '', labelPrio: 0, value: '', valuePrio: 0 };
            g.infoSlots[slot] = cur;
          }
          // 標題：以較高 labelPriority（蝦皮）為主，蝦皮報班僅遞補空缺
          if (label && (!cur.label || labelPriority > cur.labelPrio)) {
            cur.label = label;
            cur.labelPrio = labelPriority;
          }
          // 值：以較高 valuePriority（蝦皮報班）為主，蝦皮僅遞補空缺
          if (value && (!cur.value || valuePriority > cur.valuePrio)) {
            cur.value = value;
            cur.valuePrio = valuePriority;
          }
        });

        // 合併日期報名（任一有 v 即視為已報名）
        for (const col of dateColumns) {
          const value = (row[col.index] || '').toString().trim();
          const registered = value.toLowerCase().includes('v');
          if (!g.dates.has(col.header)) {
            g.dates.set(col.header, { values: new Set(), registered: false });
          }
          const d = g.dates.get(col.header);
          if (value) d.values.add(value);
          if (registered) d.registered = true;
        }
      }
    }

    // 建立輸出（日期依 月/日 排序）
    const results = [];
    for (const g of mergedGroups.values()) {
      const registrations = [...g.dates.entries()]
        .map(([date, d]) => ({
          date,
          value: [...d.values].join(', '),
          registered: d.registered,
        }))
        .sort((a, b) => {
          const [am, ad] = a.date.split('/').map(Number);
          const [bm, bd] = b.date.split('/').map(Number);
          return (am - bm) || (ad - bd);
        });

      const info = g.infoSlots
        .filter(s => s && (s.label || s.value))
        .map(s => ({ label: s.label, value: s.value }));

      results.push({
        sheetName: g.sheetName,
        warehouse: g.warehouse,
        info,
        registrations,
      });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: '找不到報班資料', debug });
    }

    return res.status(200).json({ ok: true, results, debug });

  } catch (error) {
    console.error('Classes API error:', error);
    return res.status(500).json({ error: '伺服器錯誤：' + error.message });
  }
}
