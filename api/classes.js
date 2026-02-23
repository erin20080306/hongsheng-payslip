import { google } from 'googleapis';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name } = req.body;

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

    // 取得所有分頁
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
      
      // 讀取分頁資料 (A:Z)
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetTitle}'!A:Z`,
      });

      const rows = response.data.values || [];
      if (rows.length === 0) continue;

      // 第一列是標題
      const headers = rows[0] || [];
      
      // 搜尋姓名符合的列
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        // 假設姓名在某欄，需要搜尋整列找姓名
        const nameIndex = row.findIndex(cell => cell && cell.toString().trim() === name.trim());
        
        if (nameIndex !== -1) {
          // 找到姓名，取得 E 欄以後的資料
          const eIndex = 4; // E 欄是 index 4
          const registrations = [];
          
          for (let j = eIndex; j < row.length; j++) {
            const cellValue = row[j];
            const headerValue = headers[j] || `欄位${j + 1}`;
            
            // 如果有打 v 或 V，表示已報名
            if (cellValue && (cellValue.toString().toLowerCase().includes('v') || cellValue.toString().trim() !== '')) {
              registrations.push({
                date: headerValue,
                registered: cellValue.toString().toLowerCase().includes('v'),
                value: cellValue
              });
            }
          }

          if (registrations.length > 0) {
            results.push({
              sheetName: sheetTitle,
              registrations
            });
          }
        }
      }
    }

    if (results.length === 0) {
      return res.status(404).json({ error: '找不到報班資料' });
    }

    return res.status(200).json({ ok: true, data: results });

  } catch (error) {
    console.error('Classes API error:', error);
    return res.status(500).json({ error: '伺服器錯誤，請稍後再試' });
  }
}
