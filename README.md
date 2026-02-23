# 宏盛薪資查詢系統

PWA 薪資單查詢系統，使用 Google Sheets API 即時讀取資料。

## 功能

- 身分驗證（姓名 + 身分證號）
- 即時讀取 Google Sheets 薪資資料
- 支援多日期分頁選擇
- 薪資單列印功能
- PNG 下載（支援舊 Android）
- PWA 可安裝到桌面

## 技術架構

- **前端**: Vite + React
- **後端**: Vercel Serverless Functions
- **資料來源**: Google Sheets API v4
- **認證**: Google Service Account

## 環境變數（Vercel）

```
SHEET_A_ID=1Szfar66pN4cdC-aBq8TPiRI1zOmOKd1GQODDgNYzlyk
SHEET_B_ID=1EBYVvYLQEe01H3ZDX1yozz_3S5o4_r6tGR479U5Fhjc
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## Google Sheets 設定

1. 在 Google Cloud Console 建立 Service Account
2. 下載 JSON 憑證
3. 將 A 表和 B 表分享給 Service Account email（設為檢視者）
4. 在 Vercel 設定環境變數

## 本地開發

```bash
npm install
npm run dev
```

## 部署到 Vercel

1. 連結 GitHub repo 到 Vercel
2. 設定環境變數
3. 部署

## API 端點

- `POST /api/verify` - 身分驗證
- `POST /api/options` - 取得可選日期分頁
- `POST /api/payslip` - 取得薪資單資料

## 無快取策略

- API 回應設定 `Cache-Control: no-store`
- Service Worker 對 `/api/*` 使用 network-only
- 前端 fetch 使用 `cache: 'no-store'`
