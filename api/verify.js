import { google } from 'googleapis';

export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { name, idNumber } = body;

    if (!name || !idNumber) {
      return res.status(400).json({ ok: false, error: '請輸入姓名與身分證號' });
    }

    // Check env vars
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      console.error('Missing env vars');
      return res.status(500).json({ ok: false, error: '伺服器設定錯誤' });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const SHEET_A_ID = process.env.SHEET_A_ID;
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_A_ID,
      range: 'A:C',
    });

    const rows = response.data.values || [];
    
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
    console.error('Verify error:', error.message);
    return res.status(500).json({ ok: false, error: '系統錯誤：' + error.message });
  }
}
