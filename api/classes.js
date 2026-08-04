import { google } from 'googleapis';

// 解析日期欄位標題，支援「2/16」「3/1」「08/04 (二)」「[08/04 (二)]」等，統一轉為「M/D」
function parseDateHeader(raw) {
  const s = (raw || '').toString().replace(/[[\]]/g, '').trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})/);
  if (!m) return null;
  return `${parseInt(m[1], 10)}/${parseInt(m[2], 10)}`;
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
      },
      '蝦皮報班': {
        output: '蝦皮',        // 與「蝦皮」合併
        idColIndex: 14,        // O 身分證
        nameMatchColIndex: 9,  // J 姓名
        classColIndex: 7,      // H 班別
        warehouseColIndex: 6,  // G 倉別
        // 顯示欄位 E~J 依序對應「蝦皮報班」的 H,E,F,G,H,I 欄
        infoColumns: [7, 4, 5, 6, 7, 8],
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
        const groupKey = `${cfg.output}|${classValue}|${warehouseValue}`;

        if (!mergedGroups.has(groupKey)) {
          mergedGroups.set(groupKey, {
            sheetName: cfg.output,
            warehouse: warehouseValue,
            classValue,
            info: [],           // { label, value }
            dates: new Map(),   // date(M/D) -> { values:Set, registered:bool }
          });
        }
        const g = mergedGroups.get(groupKey);

        // 合併資訊欄位（依 label 去重，保留第一個非空值）
        for (const col of infoColumns) {
          const label = col.header;
          if (!label) continue;
          const value = (row[col.index] || '').toString().trim();
          const existing = g.info.find(x => x.label === label);
          if (existing) {
            if (!existing.value && value) existing.value = value;
          } else {
            g.info.push({ label, value });
          }
        }

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

      results.push({
        sheetName: g.sheetName,
        warehouse: g.warehouse,
        info: g.info,
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
