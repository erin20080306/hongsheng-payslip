// 簡化版 Service Worker - 不快取任何內容，只做網路請求
// 版本號：每次部署時更新此數字會觸發 SW 更新
const SW_VERSION = '20260224-002';
const CACHE_NAME = `hongsheng-${SW_VERSION}`;

// 安裝時清除所有快取
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(names.map((name) => caches.delete(name)));
    })
  );
  self.skipWaiting();
});

// 啟用時清除所有快取並接管
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(names.map((name) => caches.delete(name)));
    }).then(() => self.clients.claim())
  );
});

// 所有請求都直接走網路，不使用快取
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response('網路連線失敗', { status: 503 });
    })
  );
});
