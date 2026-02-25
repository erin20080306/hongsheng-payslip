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
    const debug = [];

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
      // 酷澎：B欄=姓名(索引1), E欄=班別(索引4), J欄=倉別(索引9)
      // 蝦皮：C欄=姓名(索引2), E欄=班別(索引4), H欄=倉別(索引7)
      let nameColIndex, warehouseColIndex, classColIndex, groupKeyColIndex, infoStartCol, infoEndCol;
      if (sheetTitle === '酷澎') {
        nameColIndex = 1;      // B欄
        classColIndex = 4;     // E欄（班別）
        warehouseColIndex = 9; // J欄（倉別）
        groupKeyColIndex = 9;  // J欄用於分組
        infoStartCol = 4;      // E欄
        infoEndCol = 9;        // J欄
      } else if (sheetTitle === '蝦皮') {
        nameColIndex = 2;      // C欄（姓名）
        classColIndex = 4;     // E欄（班別）
        warehouseColIndex = 7; // H欄（倉別）
        groupKeyColIndex = 7;  // H欄用於分組
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
      debug.push({ sheet: sheetTitle, headersCount: headers.length, first15: headers.slice(0, 15), rows: rows.length });
      for (let j = 0; j < headers.length; j++) {
        const h = (headers[j] || '').toString().trim();
        // 檢查是否為日期格式 (如 2/16, 2/17, 3/1)
        if (/^\d{1,2}\/\d{1,2}$/.test(h)) {
          dateColumns.push({ index: j, header: h });
        }
      }
      debug.push({ sheet: sheetTitle, dateColumnsCount: dateColumns.length });
      
      // 如果沒有日期欄位，跳過這個分頁
      if (dateColumns.length === 0) {
        debug.push({ sheet: sheetTitle, skipped: 'no date columns' });
        continue;
      }
      
      // 搜尋姓名，按 E欄(班別) + 倉別欄 分組
      const groupedRows = new Map(); // key: E欄+倉別欄, value: { rows, registrations }
      let foundCount = 0;
      const sampleNames = [];
      
      for (let i = 1; i < rows.length && i <= 10; i++) {
        const row = rows[i];
        sampleNames.push(row[nameColIndex] || '');
      }
      debug.push({ sheet: sheetTitle, nameColIndex, searchName: name, sampleNames });
      
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const nameValue = (row[nameColIndex] || '').toString().trim();
        
        // 姓名欄包含搜尋的姓名
        if (nameValue.includes(name)) {
          foundCount++;
          // 取得班別值 (E欄)
          const classValue = (row[classColIndex] || '').toString().trim();
          // 取得倉別值
          const warehouseValue = (row[warehouseColIndex] || '').toString().trim();
          
          // 分組 key: E欄(班別) + 倉別欄
          const groupKey = `${classValue}|${warehouseValue}`;
          
          if (!groupedRows.has(groupKey)) {
            groupedRows.set(groupKey, { 
              row, 
              warehouseValue, 
              classValue,
              allRegistrations: []
            });
          }
          
          // 收集該行的日期欄位資料
          const rowRegistrations = dateColumns.map(col => ({
            date: col.header,
            value: (row[col.index] || '').toString().trim(),
            registered: (row[col.index] || '').toString().toLowerCase().includes('v')
          }));
          
          groupedRows.get(groupKey).allRegistrations.push(rowRegistrations);
        }
      }

      // 處理分組後的記錄
      for (const [groupKey, { row: foundRow, warehouseValue, allRegistrations }] of groupedRows) {
        // 確認姓名欄確實包含搜尋的姓名
        const actualName = (foundRow[nameColIndex] || '').toString().trim();
        if (!actualName.includes(name)) continue;
        
        // E-J 欄資訊
        const info = infoColumns.map(col => ({
          label: col.header,
          value: (foundRow[col.index] || '').toString().trim()
        }));
        
        // 合併所有行的日期欄位資料（如果任一行有 v，則標記為已報名）
        const mergedRegistrations = dateColumns.map((col, idx) => {
          const hasRegistered = allRegistrations.some(regs => regs[idx]?.registered);
          const values = allRegistrations.map(regs => regs[idx]?.value).filter(v => v);
          return {
            date: col.header,
            value: values.join(', ') || '',
            registered: hasRegistered
          };
        });

        results.push({
          sheetName: sheetTitle,
          warehouse: warehouseValue,
          info: info,
          registrations: mergedRegistrations
        });
      }
    }

    if (results.length === 0) {
      return res.status(404).json({ error: '找不到報班資料', debug });
    }

    return res.status(200).json({ ok: true, results, debug });

  } catch (error) {
    console.error('Classes API error:', error);
    return res.status(500).json({ error: '伺服器錯誤：' + error.message });
  }
}
