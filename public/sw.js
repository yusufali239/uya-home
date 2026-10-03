// Минимальный service worker: нужен браузеру, чтобы предложить
// «Установить приложение». Данные всегда берём из сети — склад должен быть актуальным.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
