import { google } from 'googleapis';

// Check if sheet name contains date pattern (e.g., 2-19, 0219, 02-19)
function isDateSheet(sheetName) {
  const patterns = [
    /^\d{1,2}-\d{1,2}$/,
    /^\d{3,4}$/,
    /\d{1,2}-\d{1,2}/,
    /\d{3,4}/
  ];
  return patterns.some(p => p.test(sheetName));
}

// 找出姓名欄位的索引（從表頭或 A/B 欄）
function findNameColumnIndex(headerRow, rows) {
  // 先檢查表頭是否有「姓名」
  if (headerRow) {
    for (let i = 0; i < headerRow.length; i++) {
      const h = (headerRow[i] || '').toString().trim();
      if (h === '姓名' || h.includes('姓名') || h === 'name' || h === 'Name') {
        return i;
      }
    }
  }
  // 預設檢查 A 欄 (0) 和 B 欄 (1)
  return -1; // 表示要檢查 A 和 B 欄
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);
    const name = (body?.name || '').trim();

    if (!name) {
      return res.status(400).json({ error: '請提供姓名' });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const SHEET_B_ID = process.env.SHEET_B_ID;

    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SHEET_B_ID });
    const allSheets = spreadsheet.data.sheets || [];
    const dateSheets = allSheets.map(s => s.properties.title).filter(isDateSheet);

    if (dateSheets.length === 0) {
      return res.status(200).json({ keys: [], error: '找不到符合日期格式的分頁' });
    }

    const keysMap = new Map();

    for (const sheetTitle of dateSheets) {
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SHEET_B_ID,
          range: `'${sheetTitle}'!A:Z`,
        });

        const rows = response.data.values || [];
        if (rows.length === 0) continue;

        const headerRow = rows[0];
        const nameColIndex = findNameColumnIndex(headerRow, rows);

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          let found = false;
          let aKey = '';

          // 主要檢查 B 欄 (index 1)，用「包含」來比對姓名
          const colA = (row[0] || '').toString().trim();
          const colB = (row[1] || '').toString().trim();
          
          // 如果 B 欄包含姓名，或姓名欄包含姓名
          if (colB.includes(name) || (nameColIndex >= 0 && (row[nameColIndex] || '').toString().includes(name))) {
            found = true;
            aKey = colA || name;
          }

          if (found) {
            if (!keysMap.has(aKey)) keysMap.set(aKey, []);
            if (!keysMap.get(aKey).includes(sheetTitle)) {
              keysMap.get(aKey).push(sheetTitle);
            }
            break;
          }
        }
      } catch (err) {
        console.error(`Error reading sheet ${sheetTitle}:`, err.message);
      }
    }

    const keys = Array.from(keysMap.entries()).map(([aKey, dates]) => ({
      aKey,
      dates: dates.sort()
    }));

    if (keys.length === 0) {
      return res.status(200).json({ keys: [], error: '找不到該姓名的薪資資料' });
    }

    return res.status(200).json({ keys });
  } catch (error) {
    console.error('Options error:', error);
    return res.status(500).json({ error: '系統錯誤：' + error.message });
  }
}
