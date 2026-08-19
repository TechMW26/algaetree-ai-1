const CACHE_NAME = "algaetree-v3";
const PRECACHE_URLS = ["/", "/talk"];

// Files that should never be cached by the SW
const NO_CACHE_PATTERNS = [/\.glb/, /\.gltf/, /avatar/];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      const oldAlgaeTreeCache = keys.some(
        (key) => key.startsWith("algaetree-") && key !== CACHE_NAME
      );

      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
      await self.clients.claim();

      if (oldAlgaeTreeCache) {
        const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        await Promise.all(clients.map((client) => client.navigate(client.url)));
      }
    })
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Never cache large assets or API calls
  if (NO_CACHE_PATTERNS.some((p) => p.test(url.pathname))) return;
  if (url.hostname !== self.location.hostname) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
