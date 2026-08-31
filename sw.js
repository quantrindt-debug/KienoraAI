const CACHE_NAME = "kienoraai-v5";

const APP_FILES = [
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/script.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {

      for (const file of APP_FILES) {
        try {
          await cache.add(file);
          console.log("KienoraAI cache OK:", file);
        } catch (error) {
          console.warn(
            "KienoraAI không cache được:",
            file,
            error
          );
        }
      }

    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {

  // HTML: ưu tiên mạng để luôn lấy phiên bản mới.
  if (event.request.mode === "navigate") {

    event.respondWith(
      fetch(event.request)
        .then(response => {

          const copy = response.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put("./index.html", copy);
          });

          return response;
        })
        .catch(() =>
          caches.match("./index.html")
        )
    );

    return;
  }

  // Các tài nguyên khác: cache trước, mạng sau.
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request);
    })
  );
});
