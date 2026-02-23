import { google } from 'googleapis';

// 簡單的記憶體快取（5 分鐘過期）
let cache = {
  data: null,
  timestamp: 0,
  TTL: 5 * 60 * 1000 // 5 分鐘
};

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

    // 檢查快取是否有效
    const now = Date.now();
    let allData = null;
    
    if (cache.data && (now - cache.timestamp) < cache.TTL) {
      // 使用快取資料
      allData = cache.data;
      console.log('Using cached data');
    } else {
      // 從 Google Sheets 取得資料
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SHEET_B_ID });
      const allSheets = spreadsheet.data.sheets || [];
      const dateSheets = allSheets.map(s => s.properties.title).filter(isDateSheet);

      if (dateSheets.length === 0) {
        return res.status(200).json({ keys: [], error: '找不到符合日期格式的分頁' });
      }

      // 使用 batchGet 一次取得所有分頁的 A:B 欄資料
      const ranges = dateSheets.map(title => `'${title}'!A:B`);
      
      const batchResponse = await sheets.spreadsheets.values.batchGet({
        spreadsheetId: SHEET_B_ID,
        ranges: ranges,
      });

      allData = {
        dateSheets,
        valueRanges: batchResponse.data.valueRanges || []
      };
      
      // 更新快取
      cache.data = allData;
      cache.timestamp = now;
      console.log('Fetched fresh data and cached');
    }

    const { dateSheets, valueRanges } = allData;
    // 使用姓名作為 key，收集所有有該姓名的日期分頁
    const datesSet = new Set();
    
    for (let idx = 0; idx < valueRanges.length; idx++) {
      const sheetTitle = dateSheets[idx];
      const rows = valueRanges[idx].values || [];
      if (rows.length === 0) continue;

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const colB = (row[1] || '').toString().trim();
        
        // B 欄包含姓名
        if (colB.includes(name)) {
          datesSet.add(sheetTitle);
          break;
        }
      }
    }

    const dates = Array.from(datesSet).sort();
    const keys = dates.length > 0 ? [{ aKey: name, dates }] : [];

    if (keys.length === 0) {
      return res.status(200).json({ keys: [], error: '找不到該姓名的薪資資料' });
    }

    return res.status(200).json({ keys });
  } catch (error) {
    console.error('Options error:', error);
    return res.status(500).json({ error: '系統錯誤：' + error.message });
  }
}
