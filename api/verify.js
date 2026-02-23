import { getSheetsClient } from './sheets/auth.js';

const SHEET_A_ID = process.env.SHEET_A_ID || '1Szfar66pN4cdC-aBq8TPiRI1zOmOKd1GQODDgNYzlyk';

export default async function handler(req, res) {
  // No cache headers
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, idNumber } = req.body;

    if (!name || !idNumber) {
      return res.status(400).json({ ok: false, error: '請輸入姓名與身分證號' });
    }

    const sheets = getSheetsClient();
    
    // Read columns B and C from Sheet A
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_A_ID,
      range: 'A:C',
    });

    const rows = response.data.values || [];
    
    // Find matching row: B = name, C = idNumber (exact match)
    const found = rows.some((row) => {
      const rowName = (row[1] || '').toString().trim();
      const rowId = (row[2] || '').toString().trim();
      return rowName === name.trim() && rowId === idNumber.trim();
    });

    if (found) {
      return res.status(200).json({ ok: true });
    } else {
      return res.status(200).json({ ok: false, error: '姓名或身分證號不正確' });
    }
  } catch (error) {
    console.error('Verify error:', error);
    return res.status(500).json({ ok: false, error: '系統錯誤，請稍後再試' });
  }
}
