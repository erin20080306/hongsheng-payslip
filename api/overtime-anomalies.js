import { google } from 'googleapis';

const TARGET_SPREADSHEET_ID = process.env.OVERTIME_SHEET_ID || '1fWzuCuUNmmvuOSSy1jAw8VeKhM2Y9YRdmPl3ccnyiXY';
const TARGET_SHEET_NAME = '時數異常';
const ADMIN_NAME = '宏盛';
const ADMIN_ID = '0000';

function parseBody(rawBody) {
  if (!rawBody) return {};
  if (typeof rawBody === 'object') return rawBody;

  try {
    return JSON.parse(rawBody);
  } catch {
    return {};
  }
}

function normalize(value) {
  return (value || '').toString().trim();
}

function normalizeForMatch(value) {
  return normalize(value).replace(/\s+/g, '').toLocaleLowerCase('zh-TW');
}

function createSheetsClient() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    throw new Error('Google 服務帳號環境變數尚未設定');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  return google.sheets({ version: 'v4', auth });
}

async function canQueryName(sheets, { authName, authIdNumber, queryName }) {
  if (authName === ADMIN_NAME && authIdNumber === ADMIN_ID) {
    return true;
  }

  if (!authName || !authIdNumber || queryName !== authName) {
    return false;
  }

  const loginSpreadsheetId = process.env.SHEET_A_ID;
  if (!loginSpreadsheetId) {
    throw new Error('登入名單試算表環境變數尚未設定');
  }

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: loginSpreadsheetId,
    range: 'A:C',
  });

  const rows = response.data.values || [];
  return rows.some((row) => {
    const rowName = normalize(row[1]);
    const rowId = normalize(row[2]);
    return rowName === authName && rowId === authIdNumber;
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = parseBody(req.body);
    const queryName = normalize(body.name);
    const authName = normalize(body.authName);
    const authIdNumber = normalize(body.authIdNumber);

    if (!queryName) {
      return res.status(400).json({ error: '請提供要查詢的姓名' });
    }

    const sheets = createSheetsClient();
    const authorized = await canQueryName(sheets, { authName, authIdNumber, queryName });

    if (!authorized) {
      return res.status(401).json({ error: '登入資訊已失效，請登出後重新登入' });
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: TARGET_SPREADSHEET_ID,
      range: `'${TARGET_SHEET_NAME}'!A:H`,
    });

    const values = response.data.values || [];
    if (values.length === 0) {
      return res.status(404).json({ error: '時數異常分頁目前沒有資料' });
    }

    const defaultHeaders = Array.from({ length: 8 }, (_, index) => `欄位 ${index + 1}`);
    const headers = Array.from(
      { length: 8 },
      (_, index) => normalize(values[0]?.[index]) || defaultHeaders[index],
    );
    const normalizedQueryName = normalizeForMatch(queryName);
    const rows = values
      .slice(1)
      .filter((row) => normalizeForMatch(row[2]).includes(normalizedQueryName))
      .map((row) => Array.from({ length: 8 }, (_, index) => normalize(row[index])));

    if (rows.length === 0) {
      return res.status(404).json({ error: `找不到包含「${queryName}」的異常工時資料` });
    }

    return res.status(200).json({
      ok: true,
      name: queryName,
      sheetName: TARGET_SHEET_NAME,
      headers,
      rows,
    });
  } catch (error) {
    console.error('Overtime anomalies API error:', error);
    return res.status(500).json({ error: '伺服器錯誤：' + error.message });
  }
}
