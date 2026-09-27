// Retire the v1 Workbox worker at its original URL. Keep this file available
// so returning browsers can update out of the cached, retired storefront.
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const legacyCaches = new Set(["api-cache", "images-cache", "google-fonts-cache"]);
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith("workbox-") || legacyCaches.has(name))
      .map((name) => caches.delete(name)));
    await self.clients.claim();
    await self.registration.unregister();
  })());
});

// No fetch handler: subsequent requests go directly to the v2 deployment.
// Existing tabs keep their current form state until their next navigation.
