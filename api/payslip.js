import { google } from 'googleapis';

// 顯示 A-Z + AA 欄（27欄），不顯示 AB 以後的欄位
const COLUMNS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','AA'];
// 排除的欄位：M(12), N(13), O(14), P(15)
const EXCLUDED_COLUMNS = ['M', 'N', 'O', 'P'];

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
    
    const { aKey, sheetTitle, name } = body || {};

    if (!sheetTitle) {
      return res.status(400).json({ error: '請選擇日期分頁' });
    }

    if (!aKey && !name) {
      return res.status(400).json({ error: '請提供識別碼或姓名' });
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

    // 解析 sheetTitle，格式：B:sheetTitle 或 B:sheetTitle:rowIndex 或 B:sheetTitle第N筆:rowIndex
    let targetSheetId = SHEET_B_ID;
    let actualSheetTitle = sheetTitle;
    let specifiedRowIndex = null;
    let sheetType = 'B'; // B = 宏盛薪資單, D = 宏盛週領薪資單
    
    if (sheetTitle.startsWith('B:')) {
      targetSheetId = SHEET_B_ID;
      actualSheetTitle = sheetTitle.substring(2);
      sheetType = 'B';
    } else if (sheetTitle.startsWith('D:')) {
      targetSheetId = SHEET_D_ID;
      actualSheetTitle = sheetTitle.substring(2);
      sheetType = 'D';
    }
    
    // 檢查是否有指定行號（格式：sheetTitle:rowIndex 或 sheetTitle第N筆:rowIndex）
    const rowIndexMatch = actualSheetTitle.match(/^(.+):(\d+)$/);
    if (rowIndexMatch) {
      actualSheetTitle = rowIndexMatch[1].replace(/第\d+筆$/, ''); // 移除「第N筆」後綴
      specifiedRowIndex = parseInt(rowIndexMatch[2], 10);
    }

    // Read A-AA columns from the specified sheet (27 columns)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: targetSheetId,
      range: `'${actualSheetTitle}'!A1:AA1000`,
    });

    const rows = response.data.values || [];
    
    if (rows.length === 0) {
      return res.status(200).json({ error: '該分頁無資料' });
    }

    // Find the row with matching aKey (column A) or name (column B with includes)
    let targetRow = null;
    let rowIndex = -1;
    let headerRow = rows[0] || [];

    // 如果有指定行號，直接使用該行
    if (specifiedRowIndex !== null && specifiedRowIndex < rows.length) {
      targetRow = rows[specifiedRowIndex];
      rowIndex = specifiedRowIndex;
    } else {
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const colB = (row[1] || '').toString().trim();

        // 使用姓名匹配 B 欄（包含姓名即可）
        if (name && colB.includes(name.trim())) {
          targetRow = row;
          rowIndex = i;
          break;
        }
      }
    }

    if (!targetRow) {
      return res.status(200).json({ error: '找不到該員工的薪資資料' });
    }

    // 嚴格限制只處理前 27 欄（A-Z + AA），截斷多餘的資料
    const maxColumns = 27;
    const limitedTargetRow = targetRow.slice(0, maxColumns);
    const limitedHeaderRow = headerRow.slice(0, maxColumns);

    // 記錄已出現的標題，用於過濾重複標題的欄位
    const seenHeaders = new Set();

    // Build data object with column letters as keys (excluding M-P columns and duplicate headers)
    const data = {};
    const headers = {};
    for (let i = 0; i < maxColumns && i < COLUMNS.length; i++) {
      const col = COLUMNS[i];
      if (EXCLUDED_COLUMNS.includes(col)) continue;
      
      const headerValue = (limitedHeaderRow[i] || '').toString().trim();
      
      // 如果標題已經出現過，跳過這個欄位（過濾重複的姓名欄等）
      if (headerValue && seenHeaders.has(headerValue)) {
        continue;
      }
      if (headerValue) {
        seenHeaders.add(headerValue);
      }
      
      data[col] = (limitedTargetRow[i] !== undefined ? limitedTargetRow[i] : '') || '';
      if (rowIndex > 0 && headerValue) {
        headers[col] = headerValue;
      }
    }

    // 根據使用的 spreadsheetId 判斷標題
    // SHEET_D_ID (1T2YDiKFTLnKgFgSvSfc4yvjBr9kboq-0CedKHIAedSM) = 宏盛週領薪資單
    // SHEET_B_ID (1EBYVvYLQEe01H3ZDX1yozz_3S5o4_r6tGR479U5Fhjc) = 宏盛薪資單
    const isWeeklyPayslip = targetSheetId === SHEET_D_ID;
    
    return res.status(200).json({
      sheetTitle,
      sheetType,
      isWeeklyPayslip,
      rowIndex: rowIndex + 1, // 1-indexed for display
      data,
      headers: Object.keys(headers).length > 0 ? headers : null
    });
  } catch (error) {
    console.error('Payslip error:', error);
    return res.status(500).json({ error: '系統錯誤，請稍後再試' });
  }
}
