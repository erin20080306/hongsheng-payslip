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
      
      // 從 E 欄（索引 4）開始，只取有表頭的欄位
      const dataColumns = [];
      for (let j = 4; j < headers.length; j++) {
        const h = (headers[j] || '').toString().trim();
        // 只有表頭有資料才加入
        if (h) {
          dataColumns.push({ index: j, header: h });
        }
      }
      
      // 如果沒有資料欄位，跳過這個分頁
      if (dataColumns.length === 0) continue;
      
      // 在 B 欄搜尋姓名
      let foundRow = null;
      
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const colB = (row[1] || '').toString().trim();
        
        // B 欄包含姓名
        if (colB.includes(name)) {
          foundRow = row;
          break;
        }
      }

      if (foundRow) {
        // 從 E 欄開始取資料，只取有表頭的欄位
        const registrations = dataColumns.map(col => ({
          date: col.header,
          value: (foundRow[col.index] || '').toString().trim(),
          registered: (foundRow[col.index] || '').toString().toLowerCase().includes('v')
        }));

        results.push({
          sheetName: sheetTitle,
          registrations
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
