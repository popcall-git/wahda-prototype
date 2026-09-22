/* Wahda UX Demo service worker
   - HTML（index.html / reels.html）：网络优先（原型频繁更新，保证打开即最新版），断网回退缓存
   - 其余静态资源：缓存优先
   多页结构：Reels 页以 iframe 形式加载，同样走网络优先，且缓存按各自 URL 分开存放 */
var CACHE = "wahda-ux-demo-v5";
var ASSETS = [
  "./",
  "./index.html",
  "./reels.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-192.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;

  var isHtml = req.mode === "navigate" || /\.html?$/.test(url.pathname) || /\/$/.test(url.pathname);

  if (isHtml) {
    e.respondWith(
      fetch(req).then(function (res) {
        var cp = res.clone();
        /* 按各自 URL 存缓存，避免 reels.html 覆盖 index.html 的缓存条目 */
        caches.open(CACHE).then(function (c) { c.put(req.url, cp); });
        return res;
      }).catch(function () {
        return caches.match(req.url).then(function (hit) {
          if (hit) return hit;
          if (/\/$|index\.html$/.test(url.pathname)) return caches.match("./index.html");
          return new Response("<h1>Offline</h1>", { status: 503, headers: { "Content-Type": "text/html" } });
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        var cp = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, cp); });
        return res;
      });
    })
  );
});
