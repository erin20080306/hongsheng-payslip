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

    // 使用 batchGet 一次取得所有分頁的 B 欄資料，減少 API 請求次數
    const ranges = dateSheets.map(title => `'${title}'!A:B`);
    
    try {
      const batchResponse = await sheets.spreadsheets.values.batchGet({
        spreadsheetId: SHEET_B_ID,
        ranges: ranges,
      });

      const valueRanges = batchResponse.data.valueRanges || [];
      
      for (let idx = 0; idx < valueRanges.length; idx++) {
        const sheetTitle = dateSheets[idx];
        const rows = valueRanges[idx].values || [];
        if (rows.length === 0) continue;

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const colA = (row[0] || '').toString().trim();
          const colB = (row[1] || '').toString().trim();
          
          // B 欄包含姓名
          if (colB.includes(name)) {
            const aKey = colA || name;
            if (!keysMap.has(aKey)) keysMap.set(aKey, []);
            if (!keysMap.get(aKey).includes(sheetTitle)) {
              keysMap.get(aKey).push(sheetTitle);
            }
            break;
          }
        }
      }
    } catch (err) {
      console.error('Batch get error:', err.message);
      return res.status(500).json({ error: '系統錯誤：' + err.message });
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
