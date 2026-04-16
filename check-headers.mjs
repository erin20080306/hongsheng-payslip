import { google } from 'googleapis';
import { readFileSync } from 'fs';

// Read .env.local
const envContent = readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)="?(.*?)"?$/);
  if (match) env[match[1].trim()] = match[2].replace(/\\n/g, '\n');
});

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: env.GOOGLE_PRIVATE_KEY,
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });
const SHEET_ID = '1kkpvPPq6IjqkM2etIML6bIM-VU2Ms-ms6AsMo4oZvfA';

// Get all sheet names
const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
const allSheets = spreadsheet.data.sheets || [];
console.log('=== 分頁清單 ===');
allSheets.forEach(s => console.log(' -', s.properties.title));

// Read first row (headers) of 酷澎 and 蝦皮
for (const name of ['酷澎', '蝦皮']) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${name}'!1:1`,
    });
    const headers = res.data.values?.[0] || [];
    console.log(`\n=== ${name} 欄位標題 ===`);
    headers.forEach((h, i) => {
      const col = i < 26 ? String.fromCharCode(65 + i) : 'A' + String.fromCharCode(65 + i - 26);
      console.log(`  ${col}欄(索引${i}): ${h}`);
    });
  } catch (e) {
    console.log(`\n${name}: 找不到此分頁`);
  }
}
