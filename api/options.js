import { google } from 'googleapis';


// Check if sheet name contains date pattern (e.g., 2-19, 0219, 02-19, 0216-0222)
function isDateSheet(sheetName) {
  // 排除特定分頁
  if (sheetName === '2026乾淨版') return false;
  
  const patterns = [
    /^\d{1,2}-\d{1,2}$/,       // 2-19, 02-19
    /^\d{3,4}$/,               // 0219, 219
    /^\d{4}-\d{4}$/,           // 0216-0222 (SHEET_D format)
    /\d{1,2}-\d{1,2}/,         // contains 2-19
    /\d{3,4}/                  // contains 0219
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
    const SHEET_D_ID = process.env.SHEET_D_ID;

    const allDates = new Set();

    // 同時請求 Sheet B 和 Sheet D 的分頁清單（並行加速）
    const [spreadsheetB, spreadsheetD] = await Promise.all([
      SHEET_B_ID ? sheets.spreadsheets.get({ spreadsheetId: SHEET_B_ID }).catch(() => null) : null,
      SHEET_D_ID ? sheets.spreadsheets.get({ spreadsheetId: SHEET_D_ID }).catch(err => { console.error('SHEET_D error:', err.message); return null; }) : null,
    ]);

    // 並行取得 Sheet B 和 Sheet D 的資料（加速）
    const dataSheetsB = spreadsheetB ? (spreadsheetB.data.sheets || []).map(s => s.properties.title).filter(isDateSheet) : [];
    const dataSheetsD = spreadsheetD ? (spreadsheetD.data.sheets || []).map(s => s.properties.title).filter(isDateSheet) : [];

    const [batchB, batchD] = await Promise.all([
      dataSheetsB.length > 0 ? sheets.spreadsheets.values.batchGet({
        spreadsheetId: SHEET_B_ID,
        ranges: dataSheetsB.map(title => `'${title}'!A:B`),
      }).catch(() => null) : null,
      dataSheetsD.length > 0 ? sheets.spreadsheets.values.batchGet({
        spreadsheetId: SHEET_D_ID,
        ranges: dataSheetsD.map(title => `'${title}'!A:B`),
      }).catch(() => null) : null,
    ]);

    // 處理 Sheet B
    if (batchB) {
      const dataB = { dateSheets: dataSheetsB, valueRanges: batchB.data.valueRanges || [] };
      for (let idx = 0; idx < dataB.valueRanges.length; idx++) {
        const sheetTitle = dataB.dateSheets[idx];
        const rows = dataB.valueRanges[idx].values || [];
        // 收集同一分頁中相同姓名的所有行（A欄不同）
        const matchedRows = [];
        for (let i = 1; i < rows.length; i++) {
          const colA = (rows[i][0] || '').toString().trim();
          const colB = (rows[i][1] || '').toString().trim();
          if (colB.includes(name)) {
            matchedRows.push({ rowIndex: i, colA });
          }
        }
        // 如果有多筆，加上第N筆標記
        if (matchedRows.length === 1) {
          allDates.add(`B:${sheetTitle}`);
        } else if (matchedRows.length > 1) {
          for (let j = 0; j < matchedRows.length; j++) {
            if (j === 0) {
              allDates.add(`B:${sheetTitle}:${matchedRows[j].rowIndex}`);
            } else {
              allDates.add(`B:${sheetTitle}第${j + 1}筆:${matchedRows[j].rowIndex}`);
            }
          }
        }
      }
    }

    // 處理 Sheet D
    if (batchD) {
      const valueRangesD = batchD.data.valueRanges || [];
      for (let idx = 0; idx < valueRangesD.length; idx++) {
        const sheetTitle = dataSheetsD[idx];
        const rows = valueRangesD[idx].values || [];
        // 收集同一分頁中相同姓名的所有行（A欄不同）
        const matchedRows = [];
        for (let i = 1; i < rows.length; i++) {
          const colA = (rows[i][0] || '').toString().trim();
          const colB = (rows[i][1] || '').toString().trim();
          if (colB.includes(name)) {
            matchedRows.push({ rowIndex: i, colA });
          }
        }
        // 如果有多筆，加上第N筆標記
        if (matchedRows.length === 1) {
          allDates.add(`D:${sheetTitle}`);
        } else if (matchedRows.length > 1) {
          for (let j = 0; j < matchedRows.length; j++) {
            if (j === 0) {
              allDates.add(`D:${sheetTitle}:${matchedRows[j].rowIndex}`);
            } else {
              allDates.add(`D:${sheetTitle}第${j + 1}筆:${matchedRows[j].rowIndex}`);
            }
          }
        }
      }
    }

    // 整理結果，按 sheetId 分組
    const datesArray = Array.from(allDates);
    const dates = datesArray.map(d => d.split(':')[1]).sort();
    const keys = dates.length > 0 ? [{ aKey: name, dates: datesArray.sort() }] : [];

    if (keys.length === 0) {
      return res.status(200).json({ keys: [], error: '找不到該姓名的薪資資料' });
    }

    return res.status(200).json({ keys });
  } catch (error) {
    console.error('Options error:', error);
    return res.status(500).json({ error: '系統錯誤：' + error.message });
  }
}
