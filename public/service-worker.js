self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open("bb-cache-v1").then((cache) =>
      cache.addAll(["/", "/index.html", "/styles.css", "/js/app.js"])
    )
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
