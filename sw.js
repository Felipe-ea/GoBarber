const CACHE = 'gobarber-v1';
const ASSETS = [ '/', '/index.html', '/style.css', '/app.js', '/manifest.json' ];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});

self.addEventListener('push', e => {
  let data = { title: 'GoBarber', body: 'Notificação' };
  try{ data = e.data.json(); }catch(e){}
  const options = { body: data.body, data: { url: data.url || '/' } };
  e.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  let url = (event.notification && event.notification.data && event.notification.data.url) || '/';
  try { url = new URL(url, self.location.origin).toString(); } catch(e) { url = self.location.origin + '/'; }
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then( windowClients => {
    for (let i = 0; i < windowClients.length; i++) {
      const client = windowClients[i];
      try {
        const cu = new URL(client.url);
        const tu = new URL(url);
        if (cu.origin === tu.origin && cu.pathname === tu.pathname && 'focus' in client) return client.focus();
      } catch(e){}
    }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});
