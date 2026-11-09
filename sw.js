// Service worker : garde l'app disponible hors connexion et reçoit les partages Android.
const VERSION = "cuisine-v1";
const SHELL = ["./", "./index.html", "./style.css", "./app.js", "./config.js", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== "cuisine-share").map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Partage depuis une autre app (Instagram, Facebook, galerie...)
  if (e.request.method === "POST" && url.pathname.endsWith("/share-target")) {
    e.respondWith((async () => {
      const form = await e.request.formData();
      const files = form.getAll("images").filter((f) => f && f.size);
      const box = await caches.open("cuisine-share");
      await box.put("meta", new Response(JSON.stringify({
        title: form.get("title") || "", text: form.get("text") || "", url: form.get("url") || "", files: files.length
      })));
      for (let i = 0; i < files.length; i++) await box.put("file-" + i, new Response(files[i]));
      return Response.redirect(new URL("./?shared=1", self.registration.scope).href, 303);
    })());
    return;
  }

  // Fichiers de l'app : réseau d'abord (pour recevoir les mises à jour), cache si hors connexion
  if (e.request.method === "GET" && url.origin === self.location.origin) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("./index.html")))
    );
  }
});
