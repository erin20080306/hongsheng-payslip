// 簡化版 Service Worker - 不快取任何內容，只做網路請求
const CACHE_NAME = 'hongsheng-v1';

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
