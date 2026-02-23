import { google } from 'googleapis';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') body = JSON.parse(body);
  const name = (body?.name || '').trim();

  if (!name) {
    return res.status(400).json({ error: '請提供姓名' });
  }

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

    // 篩選「酷澎」或「蝦皮」分頁
    const targetSheets = allSheets.filter(s => {
      const title = s.properties.title;
      return title.includes('酷澎') || title.includes('蝦皮');
    });

    if (targetSheets.length === 0) {
      return res.status(404).json({ error: '找不到酷澎或蝦皮分頁' });
    }

    const results = [];

    for (const sheet of targetSheets) {
      const sheetTitle = sheet.properties.title;
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetTitle}'!A:Z`,
      });

      const rows = response.data.values || [];
      if (rows.length === 0) continue;

      // 第一列是標題
      const headers = rows[0] || [];
      
      // 找出姓名欄位的索引（搜尋整列）
      // 搜尋姓名符合的所有列
      const matchedRows = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        // 搜尋整列找姓名
        const nameIndex = row.findIndex(cell => cell && cell.toString().trim() === name);
        
        if (nameIndex !== -1) {
          // 找到姓名，取得 E 欄 (index 4) 以後的資料
          const rowData = {};
          
          for (let j = 4; j < Math.max(row.length, headers.length); j++) {
            const headerText = (headers[j] || '').toString().trim();
            const cellValue = (row[j] || '').toString().trim();
            if (headerText) {
              rowData[headerText] = cellValue;
            }
          }
          
          matchedRows.push({
            data: rowData
          });
        }
      }

      // E 欄以後的表頭
      const displayHeaders = headers.slice(4).filter(h => h).map(h => h.toString().trim());

      if (matchedRows.length > 0 && displayHeaders.length > 0) {
        results.push({
          sheetName: sheetTitle,
          headers: displayHeaders,
          rows: matchedRows
        });
      }
    }

    if (results.length === 0) {
      return res.status(404).json({ error: '找不到報班資料' });
    }

    return res.status(200).json({ ok: true, data: results });

  } catch (error) {
    console.error('Classes API error:', error);
    return res.status(500).json({ error: '伺服器錯誤：' + error.message });
  }
}
