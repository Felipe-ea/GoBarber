const CACHE = "gobarber-v4";
const ASSETS = ["/", "/index.html", "/style.css", "/app.js", "/manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});

self.addEventListener("push", (e) => {
  console.log('🔔 Push event received in Service Worker');
  let data = { title: "GoBarber", body: "Notificação" };
  try {
    if (e.data) {
      data = e.data.json();
      console.log('📦 Push data:', data);
    }
  } catch (err) {
    console.error('❌ Error parsing push data:', err);
  }
  const options = { 
    body: data.body, 
    data: { url: data.url || "/" },
    icon: '/manifest.json',
    badge: '/manifest.json',
    tag: 'gobarber-notification',
    requireInteraction: false
  };
  console.log('📢 Showing notification:', data.title);
  e.waitUntil(
    self.registration.showNotification(data.title, options)
      .then(() => console.log('✅ Notification shown successfully'))
      .catch(err => console.error('❌ Error showing notification:', err))
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  let url =
    (event.notification &&
      event.notification.data &&
      event.notification.data.url) ||
    "/";
  try {
    url = new URL(url, self.location.origin).toString();
  } catch (e) {
    url = self.location.origin + "/";
  }
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          try {
            const cu = new URL(client.url);
            const tu = new URL(url);
            if (
              cu.origin === tu.origin &&
              cu.pathname === tu.pathname &&
              "focus" in client
            )
              return client.focus();
          } catch (e) {}
        }
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});
