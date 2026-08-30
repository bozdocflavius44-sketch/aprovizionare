/* Copie locala a aplicatiei, ca sa mearga si fara internet.
 *
 * Regula de baza: INTAI INTERNETUL. Daca raspunde, folosim ce vine de pe
 * server si improspatam copia. Doar cand nu raspunde ne intoarcem la copie.
 * Asa nu ramai niciodata blocat pe o versiune veche — problema clasica a
 * paginilor salvate local.
 *
 * Cererile catre Google (sincronizarea) NU sunt atinse deloc: ele trebuie
 * sa ajunga mereu la server, iar un raspuns vechi din copie ar fi periculos.
 */

var CACHE = 'aprovizionare-v1';

var FISIERE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './favicon-32.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(FISIERE); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (nume) {
        return Promise.all(nume.filter(function (n) { return n !== CACHE; })
                               .map(function (n) { return caches.delete(n); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }

  /* Sincronizarea cu Google: lasata complet in pace. */
  if (url.hostname.indexOf('script.google.com') > -1 ||
      url.hostname.indexOf('googleusercontent.com') > -1) return;

  /* Fonturile: copie mai intai, ca sa arate la fel si fara internet. */
  if (url.hostname.indexOf('fonts.googleapis.com') > -1 ||
      url.hostname.indexOf('fonts.gstatic.com') > -1) {
    e.respondWith(
      caches.match(req).then(function (copie) {
        if (copie) return copie;
        return fetch(req).then(function (res) {
          var dubla = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, dubla); });
          return res;
        });
      })
    );
    return;
  }

  /* Restul, doar de pe adresa noastra. */
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then(function (res) {
        if (res && res.ok) {
          var dubla = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, dubla); });
        }
        return res;
      })
      .catch(function () {
        return caches.match(req).then(function (copie) {
          return copie || caches.match('./index.html');
        });
      })
  );
});
