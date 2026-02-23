import { google } from 'googleapis';

const COLUMNS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

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

    // Read A-Z columns from the specified sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_B_ID,
      range: `'${sheetTitle}'!A:Z`,
    });

    const rows = response.data.values || [];
    
    if (rows.length === 0) {
      return res.status(200).json({ error: '該分頁無資料' });
    }

    // Find the row with matching aKey (column A) or name (column B with includes)
    let targetRow = null;
    let rowIndex = -1;
    let headerRow = rows[0] || [];

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

    if (!targetRow) {
      return res.status(200).json({ error: '找不到該員工的薪資資料' });
    }

    // Build data object with column letters as keys
    const data = {};
    for (let i = 0; i < COLUMNS.length && i < targetRow.length; i++) {
      data[COLUMNS[i]] = targetRow[i] || '';
    }

    // Also include headers if first row looks like headers
    const headers = {};
    if (headerRow.length > 0 && rowIndex > 0) {
      for (let i = 0; i < COLUMNS.length && i < headerRow.length; i++) {
        headers[COLUMNS[i]] = headerRow[i] || '';
      }
    }

    return res.status(200).json({
      sheetTitle,
      rowIndex: rowIndex + 1, // 1-indexed for display
      data,
      headers: Object.keys(headers).length > 0 ? headers : null
    });
  } catch (error) {
    console.error('Payslip error:', error);
    return res.status(500).json({ error: '系統錯誤，請稍後再試' });
  }
}
