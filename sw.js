/* Zwischenspeicher für die App: Seite und Symbole (Kern) und die Bibliotheken von Fremdadressen (Diagramme, PDF-Auslese).
   Damit startet die App auch ohne Internet, sobald sie einmal geladen wurde. Es werden nie Nutzerdaten gespeichert. */
const VERSION = "2026-10-05-2";
const KERN = "entgelt-kern-" + VERSION, LIBS = "entgelt-libs";
const KERN_DATEIEN = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(KERN).then(c => Promise.all(KERN_DATEIEN.map(u => c.add(new Request(u, { cache: "reload" })).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("entgelt-kern-") && k !== KERN).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (req.mode === "navigate") {                // Seite: erst das Netz (damit Neuerungen ankommen), sonst der Zwischenspeicher
      e.respondWith(fetch(req.url, { cache: "no-cache" }).then(res => {   // "no-cache": immer beim Server nachfragen, nie eine veraltete Kopie des Browsers nehmen
        res = res; if (res.ok) { const kopie = res.clone(); caches.open(KERN).then(c => c.put("./index.html", kopie)); } return res; })
        .catch(() => caches.match("./index.html").then(r => r || caches.match("./"))));
      return;
    }
    e.respondWith(caches.match(req).then(r => r || fetch(req)));
    return;
  }
  if (req.destination === "script" || /\.m?js(\?|$)/.test(url.pathname)) {      // Bibliotheken: erst Zwischenspeicher, sonst Netz und merken
    e.respondWith(caches.open(LIBS).then(c => c.match(req).then(r => r || fetch(req).then(res => { if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res; }))));
  }
});
/* Die Seite kann die Bibliotheken ausdrücklich vorab laden ("Für Offline-Nutzung vorbereiten") */
self.addEventListener("message", e => {
  const d = e.data;
  if (!d || d.typ !== "libs" || !Array.isArray(d.urls)) return;
  e.waitUntil(caches.open(LIBS).then(c => Promise.all(d.urls.map(u => fetch(u, { mode: "cors" }).then(res => res.ok ? c.put(u, res).then(() => true) : false).catch(() => false))))
    .then(ergebnis => e.source && e.source.postMessage({ typ: "libs-fertig", ok: ergebnis.every(Boolean), anzahl: ergebnis.filter(Boolean).length, von: ergebnis.length })));
});
