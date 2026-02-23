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

    // 只篩選「酷澎」或「蝦皮」分頁（排除「報名表單」等）
    const targetSheets = allSheets.filter(s => {
      const title = s.properties.title;
      // 只要「酷澎」或「蝦皮」，排除「報名表單」
      return (title === '酷澎' || title === '蝦皮');
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
      
      // E-J 欄（索引 4-9）顯示為 "S" + 表頭
      const infoColumns = [];
      for (let j = 4; j <= 9 && j < headers.length; j++) {
        const h = (headers[j] || '').toString().trim();
        if (h) {
          infoColumns.push({ index: j, header: 'S' + h });
        }
      }
      
      // 日期格式的欄位（如 2/16, 2/17, 3/1 等）
      const dateColumns = [];
      for (let j = 0; j < headers.length; j++) {
        const h = (headers[j] || '').toString().trim();
        // 檢查是否為日期格式 (如 2/16, 2/17, 3/1)
        if (/^\d{1,2}\/\d{1,2}$/.test(h)) {
          dateColumns.push({ index: j, header: h });
        }
      }
      
      // 如果沒有日期欄位，跳過這個分頁
      if (dateColumns.length === 0) continue;
      
      // 在 B 欄搜尋姓名，顯示所有符合的記錄
      const foundRows = [];
      
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const colB = (row[1] || '').toString().trim();
        
        // B 欄包含姓名
        if (colB.includes(name)) {
          foundRows.push(row);
        }
      }

      // 處理每筆符合的資料
      for (const foundRow of foundRows) {
        // E-J 欄資訊（加上 S 前綴）
        const info = infoColumns.map(col => ({
          label: col.header,
          value: (foundRow[col.index] || '').toString().trim()
        }));
        
        // 取得倉別值
        const warehouseInfo = info.find(item => item.label.includes('倉別'));
        const warehouseValue = warehouseInfo ? warehouseInfo.value : '';
        
        // 日期欄位的資料
        const registrations = dateColumns.map(col => ({
          date: col.header,
          value: (foundRow[col.index] || '').toString().trim(),
          registered: (foundRow[col.index] || '').toString().toLowerCase().includes('v')
        }));

        results.push({
          sheetName: sheetTitle,
          warehouse: warehouseValue,
          info: info,
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
