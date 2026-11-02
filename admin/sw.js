/* Area ristorante: notifiche (service worker)
   Lo script Google manda una spinta vuota; qui si chiede allo script il testo e si mostra la notifica.
   L'indirizzo dello script arriva nella registrazione (sw.js?s=…): nessun dominio scritto qui dentro. */
'use strict';

var SERVIZIO = new URL(self.location.href).searchParams.get('s') || '';
var VISTI = 'mara-notifiche-viste';

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

/* id delle notifiche già mostrate (per non ripetere la stessa) */
function leggiVisti() {
  return caches.open(VISTI).then(function (c) { return c.match('visti'); })
    .then(function (r) { return r ? r.json() : []; }).catch(function () { return []; });
}
function salvaVisti(lista) {
  return caches.open(VISTI).then(function (c) {
    return c.put('visti', new Response(JSON.stringify(lista.slice(-30)), { headers: { 'Content-Type': 'application/json' } }));
  }).catch(function () {});
}

function mostra(ev) {
  return self.registration.showNotification(ev.titolo || 'Mara admin', {
    body: ev.testo || '',
    tag: ev.id || 'mara',
    icon: 'icona-notifica.png',
    badge: 'icona-notifica.png',
    lang: 'it',
    data: { url: ev.url || '#prenotazioni' }
  });
}

self.addEventListener('push', function (e) {
  e.waitUntil(
    self.registration.pushManager.getSubscription()
      .then(function (iscr) {
        if (!SERVIZIO || !iscr) throw new Error('niente');
        return fetch(SERVIZIO, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ tipo: 'notifica', endpoint: iscr.endpoint })
        }).then(function (r) { return r.json(); });
      })
      .then(function (r) {
        var eventi = (r && r.ok && r.eventi) || [];
        return leggiVisti().then(function (visti) {
          var nuovi = eventi.filter(function (ev) { return visti.indexOf(ev.id) === -1; });
          // ogni spinta deve mostrare qualcosa (iPhone lo richiede): se non c'è niente di nuovo, l'ultima
          var daMostrare = nuovi.length ? nuovi.reverse() : eventi.slice(0, 1);
          if (!daMostrare.length) daMostrare = [{ titolo: 'Mara admin', testo: 'Novità nell’area ristorante.', id: 'mara' }];
          return Promise.all(daMostrare.map(mostra)).then(function () {
            return salvaVisti(visti.concat(daMostrare.map(function (ev) { return ev.id; })));
          });
        });
      })
      .catch(function () {
        return mostra({ titolo: 'Mara admin', testo: 'Novità nell’area ristorante: apri per vedere.', id: 'mara' });
      })
  );
});

/* Tocco sulla notifica: apre l'area ristorante sulla sezione giusta (o la porta in primo piano) */
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = new URL('./' + ((e.notification.data && e.notification.data.url) || '#prenotazioni'), self.registration.scope).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (finestre) {
      for (var i = 0; i < finestre.length; i++) {
        var f = finestre[i];
        if (f.url.indexOf(self.registration.scope) === 0 && 'focus' in f) {
          if ('navigate' in f) f.navigate(url).catch(function () {});
          return f.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
