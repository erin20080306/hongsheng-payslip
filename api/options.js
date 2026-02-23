import { getSheetsClient } from './sheets/auth.js';

const SHEET_B_ID = process.env.SHEET_B_ID || '1EBYVvYLQEe01H3ZDX1yozz_3S5o4_r6tGR479U5Fhjc';

// Check if sheet name contains date pattern (e.g., 2-19, 0219, 02-19)
function isDateSheet(sheetName) {
  // Match patterns like: 2-19, 02-19, 0219, 219
  const patterns = [
    /^\d{1,2}-\d{1,2}$/,      // 2-19, 02-19
    /^\d{3,4}$/,              // 219, 0219
    /\d{1,2}-\d{1,2}/,        // contains 2-19
    /\d{3,4}/                 // contains 0219
  ];
  return patterns.some(p => p.test(sheetName));
}

export default async function handler(req, res) {
  // No cache headers
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: '請提供姓名' });
    }

    const sheets = getSheetsClient();

    // Get all sheet names from Sheet B
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SHEET_B_ID,
    });

    const allSheets = spreadsheet.data.sheets || [];
    const dateSheets = allSheets
      .map(s => s.properties.title)
      .filter(isDateSheet);

    if (dateSheets.length === 0) {
      return res.status(200).json({ keys: [], error: '找不到符合日期格式的分頁' });
    }

    // For each date sheet, find the row with matching name and get A column value
    const keysMap = new Map(); // aKey -> dates[]

    for (const sheetTitle of dateSheets) {
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SHEET_B_ID,
          range: `'${sheetTitle}'!A:B`,
        });

        const rows = response.data.values || [];
        
        for (const row of rows) {
          const colA = (row[0] || '').toString().trim();
          const colB = (row[1] || '').toString().trim();
          
          // Check if name matches (in column B or any column that contains the name)
          if (colB === name.trim() || colA === name.trim()) {
            const aKey = colA || name;
            if (!keysMap.has(aKey)) {
              keysMap.set(aKey, []);
            }
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
    return res.status(500).json({ error: '系統錯誤，請稍後再試' });
  }
}
