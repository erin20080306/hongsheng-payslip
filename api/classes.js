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
        range: `'${sheetTitle}'!A:DM`,
      });

      const rows = response.data.values || [];
      if (rows.length === 0) continue;

      // 第一列是標題
      const headers = rows[0] || [];
      
      // 根據分頁設定欄位對應
      // 酷澎：B欄=姓名(索引1), J欄=倉別(索引9)
      // 蝦皮：C欄=姓名(索引2), H欄=倉別(索引7)
      let nameColIndex, warehouseColIndex, warehouseColIndex2, infoStartCol, infoEndCol;
      if (sheetTitle === '酷澎') {
        nameColIndex = 1;      // B欄
        warehouseColIndex = 9; // J欄
        warehouseColIndex2 = null;
        infoStartCol = 4;      // E欄
        infoEndCol = 9;        // J欄
      } else if (sheetTitle === '蝦皮') {
        nameColIndex = 2;      // C欄（姓名）
        warehouseColIndex = 7; // H欄（倉別）
        warehouseColIndex2 = null;
        infoStartCol = 4;      // E欄
        infoEndCol = 9;        // J欄
      } else {
        continue;
      }
      
      // 資訊欄位
      const infoColumns = [];
      for (let j = infoStartCol; j <= infoEndCol && j < headers.length; j++) {
        const h = (headers[j] || '').toString().trim();
        if (h) {
          infoColumns.push({ index: j, header: h });
        }
      }
      
      // 日期格式的欄位（如 2/16, 2/17, 3/1 等）
      const dateColumns = [];
      console.log(`${sheetTitle} headers count: ${headers.length}, first 15 headers:`, headers.slice(0, 15));
      for (let j = 0; j < headers.length; j++) {
        const h = (headers[j] || '').toString().trim();
        // 檢查是否為日期格式 (如 2/16, 2/17, 3/1)
        if (/^\d{1,2}\/\d{1,2}$/.test(h)) {
          dateColumns.push({ index: j, header: h });
        }
      }
      console.log(`${sheetTitle} dateColumns count: ${dateColumns.length}`);
      
      // 如果沒有日期欄位，跳過這個分頁
      if (dateColumns.length === 0) {
        console.log(`${sheetTitle} skipped - no date columns found`);
        continue;
      }
      
      // 搜尋姓名，每個倉別只保留一筆
      const warehouseMap = new Map();
      console.log(`Searching ${sheetTitle}: nameColIndex=${nameColIndex}, total rows=${rows.length}`);
      
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const nameValue = (row[nameColIndex] || '').toString().trim();
        
        // 姓名欄包含搜尋的姓名
        if (nameValue.includes(name)) {
          console.log(`Found ${name} in ${sheetTitle} row ${i}: nameValue=${nameValue}`);
          // 取得倉別值（蝦皮使用 E+H 組合）
          let warehouseValue = (row[warehouseColIndex] || '').toString().trim();
          if (warehouseColIndex2 !== null) {
            const warehouse2 = (row[warehouseColIndex2] || '').toString().trim();
            warehouseValue = warehouseValue + (warehouse2 ? '-' + warehouse2 : '');
          }
          
          // 每個倉別只保留第一筆
          if (!warehouseMap.has(warehouseValue)) {
            warehouseMap.set(warehouseValue, row);
          }
        }
      }

      // 處理每個倉別的資料
      for (const [warehouseValue, foundRow] of warehouseMap) {
        // 確認姓名欄確實包含搜尋的姓名
        const actualName = (foundRow[nameColIndex] || '').toString().trim();
        if (!actualName.includes(name)) continue;
        
        // E-J 欄資訊（加上 S 前綴）
        const info = infoColumns.map(col => ({
          label: col.header,
          value: (foundRow[col.index] || '').toString().trim()
        }));
        
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
