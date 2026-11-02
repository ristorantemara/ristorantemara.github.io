/* Area ristorante: prenotazioni, richieste, menù e orari del sito senza aprire il Foglio.
   Parla con lo script Google (js/config.js) con { tipo: 'admin', azione, sessione, ... }:
   funziona su qualsiasi dominio perché l'indirizzo dello script non dipende dal sito. */
(function () {
  'use strict';

  var CHIAVE = 'mara-admin';
  var ICONE = '../assets/icons.svg#';
  var GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
  var MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  var LINGUE = { en: 'Inglese', de: 'Tedesco' };

  var S = {
    sessione: '',
    dati: null,          // risposta di «carica»
    vista: 'prenotazioni',
    sotto: 'carta',      // sotto-vista del menù
    filtroPren: 'attesa',
    filtroRich: 'prossime',
    orariBozza: null,    // orari modificati e non ancora salvati
    occupato: false
  };

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- Utilità ---------- */
  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function icona(nome, cls) { return '<svg class="icona' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="' + ICONE + nome + '"/></svg>'; }
  function daISO(iso) { var p = String(iso).split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])); }
  function piuGiorni(iso, n) { var d = daISO(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function maiuscola(t) { return t ? t.charAt(0).toUpperCase() + t.slice(1) : t; }
  function giornoData(iso, conAnno) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return iso || '';
    var d = daISO(iso);
    var anno = conAnno || d.getUTCFullYear() !== daISO(oggi()).getUTCFullYear() ? ' ' + d.getUTCFullYear() : '';
    return GIORNI[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MESI[d.getUTCMonth()] + anno;
  }
  function dataBreve(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return iso || '';
    var d = daISO(iso);
    return d.getUTCDate() + ' ' + MESI[d.getUTCMonth()].slice(0, 3) + (d.getUTCFullYear() !== daISO(oggi()).getUTCFullYear() ? ' ' + d.getUTCFullYear() : '');
  }
  function quandoGiorno(iso) {
    var o = oggi();
    if (iso === o) return 'Oggi · ' + giornoData(iso);
    if (iso === piuGiorni(o, 1)) return 'Domani · ' + giornoData(iso);
    return maiuscola(giornoData(iso));
  }
  function oggi() { return window.maraOggi ? window.maraOggi() : new Date().toISOString().slice(0, 10); }
  function oraDa(isoCompleto) {
    if (!isoCompleto) return '';
    try {
      return new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(isoCompleto));
    } catch (e) { return ''; }
  }
  function telefonoLink(t) { return 'tel:' + String(t || '').replace(/[^\d+]/g, ''); }
  function copia(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------- Sessione salvata nel browser ---------- */
  function leggiSessione() { try { return localStorage.getItem(CHIAVE) || ''; } catch (e) { return ''; } }
  function salvaSessione(s) { try { if (s) localStorage.setItem(CHIAVE, s); else localStorage.removeItem(CHIAVE); } catch (e) { /* storage non disponibile */ } }

  /* ---------- Chiamate allo script ---------- */
  function chiama(azione, extra) {
    var dati = Object.assign({ tipo: 'admin', azione: azione, sessione: S.sessione }, extra || {});
    return window.maraInvia(dati).then(function (r) {
      if (r && r.accesso === false) { esci(true); var e = new Error(r.errore); e.accesso = true; throw e; }
      return r;
    });
  }
  function testoErrore(e) {
    if (!e) return 'Qualcosa è andato storto, riprova.';
    if (e.rete) return 'Connessione non riuscita: controlla la rete e riprova.';
    if (e.tecnico) return 'Lo script non ha risposto bene, riprova tra poco.';
    return e.message || 'Qualcosa è andato storto, riprova.';
  }

  /* ---------- Messaggio breve ---------- */
  var timerToast;
  /* Figma Admin/Avviso breve: con «Annulla» dopo le azioni rapide (interruttori, elimina) */
  function toast(testo, errore, azione) {
    var t = $('#toast');
    t.className = 'admin-toast' + (errore ? ' is-errore' : '');
    t.innerHTML = icona(errore ? 'alert' : 'check') + '<span class="admin-toast__testo"></span>' +
      (azione ? '<button class="admin-toast__azione" type="button"></button>' : '');
    t.querySelector('.admin-toast__testo').textContent = testo;
    if (azione) {
      var b = t.querySelector('button');
      b.textContent = azione.etichetta;
      b.addEventListener('click', function () { t.hidden = true; clearTimeout(timerToast); azione.fn(); });
    }
    t.hidden = false;
    clearTimeout(timerToast);
    timerToast = setTimeout(function () { t.hidden = true; }, azione ? 6000 : errore ? 6000 : 3200);
  }

  /* ==========================================================================
     Accesso
     ========================================================================== */
  function mostraAccesso() {
    $('#stato').hidden = true;
    $('#vista').hidden = true;
    $('#nav').hidden = true;
    $('#esci').hidden = true;
    $('#accesso').hidden = false;
    setTimeout(function () { $('#password').focus(); }, 50);
  }

  $('#form-accesso').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var campo = $('#campo-password');
    var pw = $('#password').value;
    var btn = $('#entra');
    campo.classList.remove('is-errore');
    if (!pw) { erroreAccesso('Scrivi la password.'); return; }
    btn.disabled = true; btn.classList.add('is-caricamento'); btn.textContent = 'Controllo…';
    window.maraInvia({ tipo: 'admin', azione: 'accedi', password: pw })
      .then(function (r) {
        if (!r.ok) throw new Error(r.errore);
        S.sessione = r.sessione;
        salvaSessione(r.sessione);
        $('#password').value = '';
        $('#accesso').hidden = true;
        carica();
      })
      .catch(function (e) { erroreAccesso(testoErrore(e)); })
      .then(function () { btn.disabled = false; btn.classList.remove('is-caricamento'); btn.textContent = 'Entra'; });
  });
  function erroreAccesso(t) {
    var campo = $('#campo-password');
    campo.classList.add('is-errore');
    $('#errore-password span').textContent = t;
    $('#password').focus();
  }

  function esci(scaduta) {
    if (!scaduta && S.sessione) chiama('esci').catch(function () { /* esce comunque */ });
    S.sessione = ''; S.dati = null; S.orariBozza = null;
    salvaSessione('');
    chiudiPannello();
    mostraAccesso();
    if (scaduta) erroreAccesso('Accesso scaduto: inserisci di nuovo la password.');
  }
  $('#esci').addEventListener('click', function () { esci(false); });

  /* ==========================================================================
     Caricamento e navigazione
     ========================================================================== */
  function carica(silenzioso) {
    if (!silenzioso) { $('#stato').hidden = false; $('#vista').hidden = true; }
    return chiama('carica')
      .then(function (r) {
        if (!r.ok) throw new Error(r.errore);
        S.dati = r; ultimoAggiornamento = new Date();
        if (N.stato === 'controllo') controllaNotifiche().then(function () { if (S.vista === 'prenotazioni' && $('#pannello').hidden) disegna(); });
        $('#stato').hidden = true;
        $('#nav').hidden = false;
        $('#esci').hidden = false;
        $('#vista').hidden = false;
        aggiornaConta();
        disegna();
      })
      .catch(function (e) {
        if (e.accesso) return;
        if (silenzioso) return toast(testoErrore(e), true);
        $('#stato').innerHTML = '';
        var box = document.createElement('div');
        box.className = 'form-errore';
        box.innerHTML = icona('alert') + '<span></span>';
        box.querySelector('span').textContent = testoErrore(e);
        var riprova = document.createElement('button');
        riprova.className = 'btn btn--secondario'; riprova.type = 'button'; riprova.textContent = 'Riprova';
        riprova.addEventListener('click', function () { location.reload(); });
        $('#stato').appendChild(box); $('#stato').appendChild(riprova);
      });
  }

  function leggiHash() {
    var h = location.hash.replace('#', '').split('/');
    var viste = ['prenotazioni', 'richieste', 'menu', 'orari'];
    S.vista = viste.indexOf(h[0]) !== -1 ? h[0] : 'prenotazioni';
    if (S.vista === 'menu') S.sotto = ['carta', 'pranzo', 'feste', 'evidenza'].indexOf(h[1]) !== -1 ? h[1] : 'carta';
  }
  window.addEventListener('hashchange', function () {
    if (S.orariBozza && S.vista === 'orari' && !confirm('Gli orari modificati non sono ancora salvati. Uscire senza salvare?')) {
      history.replaceState(null, '', '#orari'); return;
    }
    if (S.vista === 'orari') S.orariBozza = null;
    leggiHash(); if (S.dati) { disegna(); window.scrollTo(0, 0); }
  });

  function aggiornaConta() {
    var n = S.dati.prenotazioni.filter(function (p) { return p.stato === 'In attesa' && p.data >= oggi(); }).length;
    var b = $('[data-conta]');
    b.textContent = n; b.hidden = !n;
    b.setAttribute('aria-label', n + ' da confermare');
  }

  function disegna() {
    $$('#nav a').forEach(function (a) {
      if (a.getAttribute('data-vista') === S.vista) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    var v = $('#vista');
    v.innerHTML = '';
    ({ prenotazioni: vistaPrenotazioni, richieste: vistaRichieste, menu: vistaMenu, orari: vistaOrari })[S.vista](v);
  }

  /* Intestazione di una vista (Figma A02–A12: titolo Display, sottotitolo facoltativo) */
  function testa(titolo, accento, sotto) {
    return '<div class="admin-testa"><h1 tabindex="-1">' + esc(titolo) +
      (accento ? ' <span class="accento">' + esc(accento) + '</span>' : '') + '</h1>' +
      (sotto ? '<p class="testo-m">' + esc(sotto) + '</p>' : '') + '</div>';
  }
  /* Filtri a pillole (Figma Admin/Segmento) */
  function filtri(voci, attivo, attr) {
    return '<div class="admin-filtri"><div class="menu-tipi" role="group">' + voci.map(function (v) {
      return '<button type="button" ' + attr + '="' + v[0] + '" aria-pressed="' + (v[0] === attivo) + '">' + esc(v[1]) +
        (v[2] != null ? ' <span class="menu-tipi__giorni">' + v[2] + '</span>' : '') + '</button>';
    }).join('') + '</div></div>';
  }
  var ultimoAggiornamento = null;
  function oraAdesso() {
    try { return new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' }).format(ultimoAggiornamento || new Date()); } catch (e) { return ''; }
  }
  function collegaAggiorna(v) {
    $$('[data-aggiorna]', v).forEach(function (b) {
      b.addEventListener('click', function () {
        b.disabled = true; b.textContent = 'Aggiorno…';
        carica(true).then(function () { toast('Dati aggiornati.'); });
      });
    });
  }
  /* Link di contatto (telefono, mail) con icona pomodoro: si toccano per chiamare o scrivere */
  function contatti(o) {
    return '<div class="admin-contatti">' +
      (o.telefono ? '<a class="admin-link" href="' + esc(telefonoLink(o.telefono)) + '">' + icona('phone') + '<span>' + esc(o.telefono) + '</span></a>' : '') +
      (o.email ? '<a class="admin-link" href="mailto:' + esc(o.email) + '">' + icona('mail') + '<span>' + esc(o.email) + '</span></a>' : '') +
    '</div>';
  }

  /* ==========================================================================
     Prenotazioni (Figma A02–A04, AD01)
     ========================================================================== */
  function pillStato(stato, testo) {
    var cls = { 'In attesa': 'attesa', 'Confermata': 'ok', 'Rifiutata': 'no', 'Disdetta': 'spenta' }[stato] || 'neutro';
    return '<span class="admin-stato-pill admin-stato-pill--' + cls + '">' + esc(testo || (stato === 'In attesa' ? 'Da confermare' : stato)) + '</span>';
  }

  function vistaPrenotazioni(v) {
    var o = oggi();
    var tutte = S.dati.prenotazioni;
    var attesa = tutte.filter(function (p) { return p.stato === 'In attesa' && p.data >= o; });
    var arrivo = tutte.filter(function (p) { return p.stato === 'Confermata' && p.data >= o; });
    var altre = tutte.filter(function (p) { return attesa.indexOf(p) === -1 && arrivo.indexOf(p) === -1; });
    var gruppi = { attesa: attesa, arrivo: arrivo, altre: altre };
    var lista = gruppi[S.filtroPren].slice().sort(function (a, b) {
      var k = (a.data + a.ora).localeCompare(b.data + b.ora);
      return S.filtroPren === 'altre' ? -k : k;
    });
    var coperti = function (iso) {
      return arrivo.filter(function (p) { return p.data === iso; }).reduce(function (n, p) { return n + (p.persone || 0); }, 0);
    };
    var diOggi = arrivo.filter(function (p) { return p.data === o; }).sort(function (a, b) { return a.ora.localeCompare(b.ora); });

    // Figma A02/A04: su telefono solo il titolo; AD01: sottotitolo su computer
    var html = testa('Prenotazioni', '', attesa.length
      ? (attesa.length === 1 ? 'C’è 1 richiesta da confermare.' : 'Ci sono ' + attesa.length + ' richieste da confermare.')
      : 'Nessuna richiesta da confermare.').replace('class="testo-m"', 'class="testo-m solo-computer"');
    html += riquadroNotifiche();
    html += '<div class="admin-colonne' + (S.filtroPren !== 'attesa' ? ' is-senza-oggi' : '') + '">';

    // Oggi (scuro): coperti e tavoli confermati, elenco dei tavoli su computer
    html += '<aside class="admin-oggi su-scuro" aria-label="Oggi">' +
      '<p class="occhiello">Oggi · ' + esc(giornoData(o)) + '</p>' +
      '<div class="admin-oggi__numeri">' +
        '<p><span class="admin-oggi__numero">' + coperti(o) + '</span><span class="testo-s">coperti confermati</span></p>' +
        '<p><span class="admin-oggi__numero">' + diOggi.length + '</span><span class="testo-s">' + (diOggi.length === 1 ? 'tavolo' : 'tavoli') + '</span></p>' +
      '</div>' +
      (diOggi.length ? '<ul class="admin-oggi__tavoli">' + diOggi.map(function (p) {
        return '<li><span class="admin-oggi__ora">' + esc(p.ora) + '</span><span class="admin-oggi__nome">' + esc(p.nome) + '</span><span class="testo-s">' + esc(p.persone) + ' pers.</span></li>';
      }).join('') + '</ul>' : '') +
      '<p class="testo-s admin-oggi__aggiornato">Aggiornato alle ' + esc(oraAdesso()) + ' · <button class="admin-oggi__aggiorna" type="button" data-aggiorna>Aggiorna ora</button></p>' +
    '</aside>';

    html += '<div class="admin-principale">';
    html += filtri([['attesa', 'Da confermare', attesa.length], ['arrivo', 'In arrivo', arrivo.length], ['altre', 'Archivio', null]], S.filtroPren, 'data-filtro');
    if (!lista.length) {
      html += '<p class="admin-vuoto">' + ({ attesa: 'Tutto fatto: nessuna prenotazione aspetta una risposta.', arrivo: 'Nessuna prenotazione confermata nei prossimi giorni.', altre: 'Ancora niente qui.' })[S.filtroPren] + '</p>';
    } else {
      var giorno = null;
      lista.forEach(function (p) {
        if (p.data !== giorno) {
          if (giorno !== null) html += '</section>';
          giorno = p.data;
          var tot = S.filtroPren === 'arrivo' ? coperti(p.data) : 0;
          html += '<section class="admin-giorno"><h2 class="occhiello">' + esc(quandoGiorno(p.data)) + (tot ? ' · ' + tot + ' coperti' : '') + '</h2>';
        }
        html += cardPrenotazione(p);
      });
      html += '</section>';
    }
    html += '</div></div>';
    v.innerHTML = html;

    $$('[data-filtro]', v).forEach(function (b) {
      b.addEventListener('click', function () { S.filtroPren = b.getAttribute('data-filtro'); disegna(); });
    });
    $$('[data-decidi]', v).forEach(function (b) {
      b.addEventListener('click', function () {
        var p = trovaPren(b.getAttribute('data-id'));
        if (b.getAttribute('data-decidi') === 'rifiuta') confermaRifiuto(p); else decidi(p, 'conferma', b);
      });
    });
    collegaAggiorna(v);
    collegaNotifiche(v);
  }

  /* ==========================================================================
     Notifiche sul telefono (Figma Admin/Notifiche, A13)
     Lo script manda una spinta vuota, sw.js chiede il testo e mostra la notifica.
     ========================================================================== */
  var N = { stato: 'controllo', occupato: false };
  function eIos() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function daHome() { return navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches); }
  function supportate() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && window.isSecureContext; }
  function urlSw() { return 'sw.js?s=' + encodeURIComponent(window.MARA_SERVIZIO || ''); }
  function chiaveInByte(b64) {
    var s = (b64 + '==='.slice((b64.length + 3) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    var raw = atob(s), out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function nomeDispositivo() {
    var ua = navigator.userAgent;
    return (/iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Browser');
  }

  function controllaNotifiche() {
    if (!supportate()) { N.stato = eIos() && !daHome() ? 'home' : 'no'; return Promise.resolve(); }
    if (Notification.permission === 'denied') { N.stato = 'bloccate'; return Promise.resolve(); }
    return navigator.serviceWorker.getRegistration('./')
      .then(function (reg) { return reg ? reg.pushManager.getSubscription() : null; })
      .then(function (sub) {
        N.stato = sub ? 'attive' : 'spente';
        if (sub) { // riallinea lo script (es. dopo aver svuotato i dispositivi) e aggiorna il service worker
          navigator.serviceWorker.register(urlSw(), { scope: './' }).catch(function () {});
          chiama('stato-notifiche', { endpoint: sub.endpoint }).then(function (r) {
            if (r.ok && !r.iscritto) chiama('iscrivi', { endpoint: sub.endpoint, dispositivo: nomeDispositivo() });
          }).catch(function () {});
        }
      })
      .catch(function () { N.stato = 'spente'; });
  }

  function riquadroNotifiche() {
    var st = N.stato;
    if (st === 'no' || st === 'controllo') return '';
    if (st === 'attive') {
      return '<div class="admin-notifiche admin-notifiche--attive" role="status">' +
        '<span class="admin-notifiche__icona">' + icona('bell') + '</span>' +
        '<p class="label">Notifiche attive su questo ' + (eIos() || /Android/.test(navigator.userAgent) ? 'telefono' : 'dispositivo') + '</p>' +
        '<button class="admin-notifiche__disattiva" type="button" data-notifiche="spegni">Disattiva</button></div>';
    }
    var testo = {
      spente: 'Una notifica appena arriva una prenotazione, una richiesta o una disdetta, anche con l’app chiusa.',
      home: 'Su iPhone le notifiche arrivano solo dall’app sulla home: in Safari tocca Condividi → Aggiungi alla schermata Home, poi apri «Mara admin» da lì e attivale.',
      bloccate: 'Le notifiche sono bloccate per questa app: riattivale dalle impostazioni del telefono (Notifiche → Mara admin) e torna qui.'
    }[st];
    return '<div class="admin-notifiche">' +
      '<span class="admin-notifiche__icona">' + icona('bell') + '</span>' +
      '<div class="admin-notifiche__testo"><p class="label">Avvisi sul telefono</p><p class="testo-s">' + esc(testo) + '</p>' +
      (st === 'spente' ? '<button class="btn btn--primario" type="button" data-notifiche="accendi">Attiva le notifiche</button>' : '') +
      '</div></div>';
  }

  function collegaNotifiche(v) {
    var acc = $('[data-notifiche="accendi"]', v), sp = $('[data-notifiche="spegni"]', v);
    if (acc) acc.addEventListener('click', function () { attivaNotifiche(acc); });
    if (sp) sp.addEventListener('click', function () { disattivaNotifiche(sp); });
  }

  function attivaNotifiche(btn) {
    if (N.occupato) return;
    N.occupato = true; btn.disabled = true; btn.classList.add('is-caricamento'); btn.textContent = 'Attivo…';
    var reg;
    Notification.requestPermission()
      .then(function (permesso) {
        if (permesso !== 'granted') { var e = new Error(permesso === 'denied' ? 'Notifiche bloccate: riattivale dalle impostazioni del telefono.' : 'Per ricevere gli avvisi tocca «Consenti».'); e.permesso = permesso; throw e; }
        return navigator.serviceWorker.register(urlSw(), { scope: './' });
      })
      .then(function () { return navigator.serviceWorker.ready; })
      .then(function (r) { reg = r; return reg.pushManager.getSubscription(); })
      .then(function (vecchia) { return vecchia ? vecchia.unsubscribe() : null; })
      .then(function () { return chiama('chiave-notifiche'); })
      .then(function (r) {
        if (!r.ok) throw new Error(r.errore);
        return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chiaveInByte(r.chiave) });
      })
      .then(function (sub) { return chiama('iscrivi', { endpoint: sub.endpoint, dispositivo: nomeDispositivo() }); })
      .then(function (r) {
        if (!r.ok) throw new Error(r.errore);
        N.stato = 'attive';
        toast(r.inviate ? 'Notifiche attive: ti ho mandato una notifica di prova.' : 'Notifiche attive.');
      })
      .catch(function (e) {
        if (e.permesso === 'denied') N.stato = 'bloccate';
        if (!e.accesso) toast(e.permesso ? e.message : 'Non sono riuscito ad attivare le notifiche: ' + testoErrore(e), true);
      })
      .then(function () { N.occupato = false; if (S.vista === 'prenotazioni') disegna(); });
  }

  function disattivaNotifiche(btn) {
    if (N.occupato) return;
    N.occupato = true; btn.disabled = true;
    navigator.serviceWorker.getRegistration('./')
      .then(function (reg) { return reg ? reg.pushManager.getSubscription() : null; })
      .then(function (sub) {
        if (!sub) return null;
        var endpoint = sub.endpoint;
        return sub.unsubscribe().then(function () { return chiama('disiscrivi', { endpoint: endpoint }); });
      })
      .then(function () { N.stato = 'spente'; toast('Notifiche disattivate su questo dispositivo.'); })
      .catch(function (e) { if (!e.accesso) toast(testoErrore(e), true); })
      .then(function () { N.occupato = false; if (S.vista === 'prenotazioni') disegna(); });
  }

  /* Figma Admin/Prenotazione */
  function cardPrenotazione(p) {
    var attesa = p.stato === 'In attesa';
    return '<article class="admin-card' + (attesa ? ' is-attesa' : '') + (p.stato === 'Rifiutata' || p.stato === 'Disdetta' ? ' is-spenta' : '') + '">' +
      '<div class="admin-card__testa"><h3 class="admin-card__titolo">' + esc(p.nome) + '</h3>' + pillStato(p.stato) + '</div>' +
      '<p class="admin-card__meta">' +
        '<span>' + icona('clock') + 'Ore ' + esc(p.ora) + '</span>' +
        '<span>' + icona('users') + esc(p.persone) + (p.persone === 1 ? ' persona' : ' persone') + '</span>' +
        (LINGUE[p.lingua] ? '<span class="admin-card__tenue">' + icona('globe') + esc(LINGUE[p.lingua]) + '</span>' : '') +
      '</p>' +
      (p.note ? '<p class="admin-card__note">' + esc(p.note) + '</p>' : '') +
      contatti(p) +
      (attesa ? '<div class="admin-card__azioni">' +
        '<button class="btn btn--primario" type="button" data-decidi="conferma" data-id="' + esc(p.id) + '">Conferma' + icona('check') + '</button>' +
        '<button class="btn btn--secondario" type="button" data-decidi="rifiuta" data-id="' + esc(p.id) + '">Rifiuta</button>' +
      '</div>' : '') +
    '</article>';
  }
  function trovaPren(id) { return S.dati.prenotazioni.filter(function (p) { return p.id === id; })[0]; }

  function decidi(p, decisione, btn) {
    if (btn) { btn.disabled = true; btn.classList.add('is-caricamento'); }
    return chiama('decidi', { id: p.id, decisione: decisione })
      .then(function (r) {
        if (r.ok || r.giaGestita) {
          p.stato = r.stato;
          aggiornaConta(); disegna();
          if (r.giaGestita) toast('Era già ' + String(r.stato).toLowerCase() + ': nessuna nuova mail.');
          else toast(r.stato === 'Confermata' ? 'Confermata: ' + p.nome + ' ha ricevuto la mail.' : 'Rifiutata: il cliente è stato avvisato.');
          return true;
        }
        throw new Error(r.errore);
      })
      .catch(function (e) {
        if (btn) { btn.disabled = false; btn.classList.remove('is-caricamento'); }
        if (!e.accesso) toast(testoErrore(e), true);
        return false;
      });
  }

  /* Figma A03: foglio di conferma del rifiuto */
  function confermaRifiuto(p) {
    var lingua = { en: ' in inglese', de: ' in tedesco' }[p.lingua] || '';
    apriPannello('Rifiutare la prenotazione?', function (form) {
      form.innerHTML =
        '<div class="admin-riepilogo"><p class="label">' + esc(p.nome) + '</p><p class="testo-s">' + esc(maiuscola(giornoData(p.data))) + ', ore ' + esc(p.ora) + ' · ' + esc(p.persone) + (p.persone === 1 ? ' persona' : ' persone') + '</p></div>' +
        '<p class="testo-m">Riceverà una mail' + lingua + ' che lo invita a chiamarvi per scegliere un’altra data.</p>' +
        '<div class="admin-pannello__azioni admin-pannello__azioni--colonna">' +
          '<button class="btn btn--rifiuta btn--blocco" type="submit">Rifiuta e avvisa il cliente</button>' +
          '<button class="btn btn--secondario btn--blocco" type="button" data-chiudi>Annulla</button>' +
        '</div>';
      form.onsubmit = function (ev) {
        ev.preventDefault();
        var b = $('[type="submit"]', form);
        decidi(p, 'rifiuta', b).then(function (ok) { if (ok) chiudiPannello(); });
      };
    });
  }

  /* ==========================================================================
     Richieste: gruppi e cerimonie (Figma A05, Admin/Richiesta)
     ========================================================================== */
  function vistaRichieste(v) {
    var o = oggi();
    var tutte = S.dati.richieste;
    var prossime = tutte.filter(function (r) { return !r.data || r.data >= o; }).sort(function (a, b) { return String(a.data).localeCompare(String(b.data)); });
    var passate = tutte.filter(function (r) { return r.data && r.data < o; }).sort(function (a, b) { return String(b.data).localeCompare(String(a.data)); });
    var lista = S.filtroRich === 'prossime' ? prossime : passate;

    var html = testa('Richieste', '', 'Preventivi per gruppi e cerimonie arrivati dal sito.');
    html += filtri([['prossime', 'Prossime', prossime.length], ['passate', 'Passate', null]], S.filtroRich, 'data-filtro');
    if (!lista.length) {
      html += '<p class="admin-vuoto">' + (S.filtroRich === 'prossime' ? 'Nessuna richiesta per le prossime date.' : 'Ancora niente qui.') + '</p>';
    } else {
      html += '<div class="admin-elenco admin-elenco--griglia">' + lista.map(function (r) {
        var righe = [];
        if (r.referente) righe.push('Referente: ' + r.referente);
        if (r.occasione) righe.push('Occasione: ' + r.occasione);
        if (LINGUE[r.lingua]) righe.push('Lingua: ' + LINGUE[r.lingua].toLowerCase() + ' (se potete rispondete in ' + LINGUE[r.lingua].toLowerCase() + ')');
        if (r.ricevuta) righe.push('Arrivata ' + oraDa(r.ricevuta));
        return '<article class="admin-card">' +
          '<div class="admin-card__testa"><h3 class="admin-card__titolo">' + esc(r.nome) + '</h3>' + pillStato('', r.tipo) + '</div>' +
          '<p class="admin-card__meta"><span>' + icona('calendar') + esc(maiuscola(giornoData(r.data))) + '</span>' +
          (r.persone ? '<span>' + icona('users') + esc(r.persone) + ' persone</span>' : '') + '</p>' +
          (r.note ? '<p class="admin-card__note">' + esc(r.note) + '</p>' : '') +
          (righe.length ? '<div class="admin-card__dati">' + righe.map(function (x) { return '<p class="testo-s">' + esc(x) + '</p>'; }).join('') + '</div>' : '') +
          contatti(r) + '</article>';
      }).join('') + '</div>';
    }
    v.innerHTML = html;
    $$('[data-filtro]', v).forEach(function (b) {
      b.addEventListener('click', function () { S.filtroRich = b.getAttribute('data-filtro'); disegna(); });
    });
  }

  /* ==========================================================================
     Salvataggio delle schede del Foglio
     ========================================================================== */
  function scheda(k) { return S.dati.schede[k]; }

  /** modifiche: { menu: righeNuove, ... } · extra: { pranzo: { prezzo } } */
  /** modifiche: { menu: righeNuove, ... } · extra: { pranzo: { prezzo } } · opz: { messaggio, annullabile } */
  function salva(modifiche, extra, opz) {
    opz = opz || {};
    var schede = {}, prima = {};
    Object.keys(modifiche).forEach(function (k) {
      prima[k] = scheda(k).righe;
      schede[k] = Object.assign({ versione: scheda(k).versione, righe: modifiche[k] }, (extra && extra[k]) || {});
    });
    S.occupato = true;
    return chiama('salva', { schede: schede })
      .then(function (r) {
        if (r.ok) {
          Object.keys(r.schede).forEach(function (k) { S.dati.schede[k] = r.schede[k]; });
          var annulla = opz.annullabile ? { etichetta: 'Annulla', fn: function () {
            salva(prima, null, { messaggio: 'Annullato.' }).then(function () { disegna(); });
          } } : null;
          toast(opz.messaggio || 'Salvato: sul sito tra pochi secondi.', false, annulla);
          return true;
        }
        if (r.conflitto) {
          toast(r.errore, true);
          return carica(true).then(function () { return false; });
        }
        throw new Error(r.errore);
      })
      .catch(function (e) { if (!e.accesso) toast(testoErrore(e), true); return false; })
      .then(function (ok) { S.occupato = false; return ok; });
  }


  /* ==========================================================================
     Pannello di modifica
     ========================================================================== */
  var ultimoFocus = null;
  function apriPannello(titolo, prepara, occhiello) {
    ultimoFocus = document.activeElement;
    $('#pannello-titolo').textContent = titolo;
    $('#pannello-occhiello').textContent = occhiello || '';   // Figma A14: «In Antipasti» sopra «Nuovo piatto»
    $('#pannello-occhiello').hidden = !occhiello;
    var form = $('#pannello-form');
    form.onsubmit = null;
    form.innerHTML = '';
    prepara(form);
    $('#pannello-sfondo').hidden = false;
    $('#pannello').hidden = false;
    document.body.style.overflow = 'hidden';
    var primo = $('input:not([type="hidden"]), select, textarea, button[type="submit"]', form);
    setTimeout(function () { if (primo && window.matchMedia('(min-width: 768px)').matches) primo.focus(); else $('#pannello .foglio__chiudi').focus(); }, 30);
  }
  function chiudiPannello() {
    if ($('#pannello').hidden) return;
    $('#pannello').hidden = true;
    $('#pannello-sfondo').hidden = true;
    document.body.style.overflow = '';
    if (ultimoFocus && document.body.contains(ultimoFocus)) ultimoFocus.focus();
  }
  $('#pannello-sfondo').addEventListener('click', chiudiPannello);
  $('#pannello').addEventListener('click', function (ev) { if (ev.target.closest('[data-chiudi]')) chiudiPannello(); });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') chiudiPannello();
    if (ev.key === 'Tab' && !$('#pannello').hidden) { // il focus resta nel pannello
      var f = $$('#pannello button, #pannello input, #pannello select, #pannello textarea, #pannello a[href]').filter(function (x) { return !x.disabled && x.offsetParent !== null; });
      if (!f.length) return;
      if (ev.shiftKey && document.activeElement === f[0]) { ev.preventDefault(); f[f.length - 1].focus(); }
      else if (!ev.shiftKey && document.activeElement === f[f.length - 1]) { ev.preventDefault(); f[0].focus(); }
    }
  });

  /* ---------- Campi del pannello ---------- */
  var nCampo = 0;
  function campo(c, valore) {
    if (c.rivela && !valore) {
      return '<button class="btn btn--testo admin-rivela" type="button" data-rivela>' + icona('plus', 'icona--s') + esc(c.rivela) + '</button>' +
        '<div class="admin-rivelato" hidden>' + campo(Object.assign({}, c, { rivela: '' }), valore) + '</div>';
    }
    var id = 'c' + (++nCampo);
    var etichetta = '<label class="campo__etichetta" for="' + id + '">' + esc(c.etichetta) + (c.facoltativo ? ' <span class="opz">(facoltativo)</span>' : '') + '</label>';
    var aiuto = c.aiuto ? '<p class="campo__aiuto">' + esc(c.aiuto) + '</p>' : '';
    var errore = '<p class="campo__errore">' + icona('alert') + '<span></span></p>';
    if (c.tipo === 'si') {
      return '<div class="campo admin-campo-riga" data-campo="' + c.k + '"><span class="campo__etichetta" id="' + id + '-e">' + esc(c.etichetta) + '</span>' +
        interruttore(valore === true, c.testoSi || '', 'id="' + id + '" aria-labelledby="' + id + '-e"') + '</div>';
    }
    if (c.tipo === 'allergeni') return campoAllergeni(c, valore, id);
    var attr = 'class="campo__input" id="' + id + '" name="' + c.k + '"' + (c.facoltativo ? '' : ' required') + (c.max ? ' maxlength="' + c.max + '"' : '') + (c.prezzo ? ' data-prezzo-campo' : '');
    var input;
    if (c.tipo === 'testo-lungo') input = '<textarea ' + attr + ' rows="3">' + esc(valore) + '</textarea>';
    else if (c.tipo === 'scelta') {
      input = '<select ' + attr + '><option value="">' + esc(c.vuoto || 'Scegli…') + '</option>' + c.opzioni.map(function (o) {
        return '<option' + (o === valore ? ' selected' : '') + '>' + esc(o) + '</option>';
      }).join('') + (valore && c.opzioni.indexOf(valore) === -1 ? '<option selected>' + esc(valore) + '</option>' : '') + '</select>';
    } else {
      var tipo = c.tipo === 'data' ? 'date' : c.tipo === 'ora' ? 'time' : 'text';
      var lista = c.suggerimenti && c.suggerimenti.length ? ' list="' + id + '-l"' : '';
      input = '<input ' + attr + ' type="' + tipo + '" value="' + esc(valore) + '"' + lista + (c.esempio ? ' placeholder="' + esc(c.esempio) + '"' : '') +
        (c.tipo === 'ora' ? ' step="1800"' : '') + ' autocomplete="off">' +
        (lista ? '<datalist id="' + id + '-l">' + c.suggerimenti.map(function (s) { return '<option value="' + esc(s) + '">'; }).join('') + '</datalist>' : '');
    }
    return '<div class="campo" data-campo="' + c.k + '">' + etichetta + input + aiuto + errore + '</div>';
  }

  /* Campi affiancati (Figma AD02: Sezione e Prezzo sulla stessa riga) */
  function campiHtml(campi, riga) {
    var html = '', i = 0;
    while (i < campi.length) {
      if (campi[i].affianca && campi[i + 1] && campi[i + 1].affianca) {
        html += '<div class="riga-campi">' + campo(campi[i], riga[campi[i].k]) + campo(campi[i + 1], riga[campi[i + 1].k]) + '</div>';
        i += 2;
      } else { html += campo(campi[i], riga[campi[i].k]); i++; }
    }
    return html;
  }

  function interruttore(acceso, testo, attr) {
    return '<label class="interruttore"><input type="checkbox" role="switch"' + (acceso ? ' checked' : '') + ' ' + (attr || '') + '>' +
      '<span class="interruttore__binario" aria-hidden="true"></span>' + (testo ? '<span>' + esc(testo) + '</span>' : '') + '</label>';
  }

  /* Allergeni: chip per i 14 allergeni + precisazioni libere (es. «Latte (ai formaggi)», «Chiedi al personale») */
  function partiAllergeni(t) { return String(t || '').split(/[,;·\n]+/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function campoAllergeni(c, valore, id) {
    var elenco = S.dati.allergeni;
    var parti = partiAllergeni(valore);
    var scelti = parti.filter(function (p) { return elenco.indexOf(p) !== -1; });
    var altro = parti.filter(function (p) { return elenco.indexOf(p) === -1; }).join(', ');
    return '<fieldset class="campo" data-campo="' + c.k + '" data-allergeni><legend class="campo__etichetta">' + esc(c.etichetta) + ' <span class="opz">(facoltativo)</span></legend>' +
      '<div class="admin-chip-scelta">' + elenco.map(function (a) {
        return '<button type="button" class="chip admin-chip" data-allergene="' + esc(a) + '" aria-pressed="' + (scelti.indexOf(a) !== -1) + '">' + esc(a) + icona('x', 'icona--xs') + '</button>';
      }).join('') + '</div>' +
      (altro ? '' : '<button class="btn btn--testo admin-rivela" type="button" data-rivela>' + icona('plus', 'icona--s') + 'Aggiungi una precisazione (es. Latte ai formaggi)</button>') +
      '<div class="admin-rivelato"' + (altro ? '' : ' hidden') + '><label class="campo__etichetta" for="' + id + '">Precisazioni <span class="opz">(facoltativo)</span></label>' +
      '<input class="campo__input" id="' + id + '" type="text" value="' + esc(altro) + '" placeholder="Es. Latte (ai formaggi), Chiedi al personale" autocomplete="off">' +
      '<p class="campo__aiuto">Un allergene con una nota si scrive così: Latte (ai formaggi).</p></div></fieldset>';
  }

  /* Prezzi: «10» → «10,00 €», «7,5» o «7.5» → «7,50 €». Testi come «da 9,00 €» o «4,50 €/hg» restano come sono. */
  function formattaPrezzo(v) {
    var t = String(v || '').trim();
    var m = t.match(/^(?:€\s*)?(\d{1,6})(?:[.,](\d{1,2}))?\s*(?:€|eur|euro)?$/i);
    if (!m) return t;
    var intero = String(Number(m[1])).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return intero + ',' + ((m[2] || '') + '00').slice(0, 2) + ' €';
  }
  function collegaPrezzi(radice) {
    $$('[data-prezzo-campo]', radice).forEach(function (inp) {
      inp.addEventListener('blur', function () { inp.value = formattaPrezzo(inp.value); });
    });
  }

  function collegaCampi(form) {
    collegaPrezzi(form);
    $$('[data-rivela]', form).forEach(function (b) {
      b.addEventListener('click', function () {
        var box = b.nextElementSibling; box.hidden = false; b.remove();
        var inp = $('input, select, textarea', box); if (inp) inp.focus();
      });
    });
    $$('[data-allergene]', form).forEach(function (b) {
      b.addEventListener('click', function () { b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); });
    });
  }

  function leggiCampi(form, campi, base) {
    var r = Object.assign({}, base);
    var ok = true;
    campi.forEach(function (c) {
      var box = $('[data-campo="' + c.k + '"]', form);
      if (!box) return;
      box.classList.remove('is-errore');
      if (c.tipo === 'si') { r[c.k] = $('input', box).checked; return; }
      if (c.tipo === 'allergeni') {
        var scelti = $$('[data-allergene][aria-pressed="true"]', box).map(function (b) { return b.getAttribute('data-allergene'); });
        r[c.k] = scelti.concat(partiAllergeni($('input', box).value)).join(', ');
        return;
      }
      var el = $('input, select, textarea', box);
      if (c.prezzo) el.value = formattaPrezzo(el.value);
      var val = el.value.trim();
      var err = '';
      if (!val && !c.facoltativo) err = c.obbligatorio || 'Questo campo serve.';
      if (!err && c.controlla) err = c.controlla(val, r) || '';
      if (err) {
        box.classList.add('is-errore');
        $('.campo__errore span', box).textContent = err;
        if (ok) el.focus();
        ok = false;
      }
      r[c.k] = val;
    });
    return ok ? r : null;
  }

  /**
   * Pannello per aggiungere o modificare una riga di una scheda.
   * o: { k, titolo, campi, riga (null = nuova), indice, base, posizione(indice di inserimento), gruppo(fn riga→chiave per Sposta), dopo(righe)→modifiche }
   */
  function modificaRiga(o) {
    var righe = scheda(o.k).righe;
    var nuova = o.indice == null;
    var riga = nuova ? Object.assign({}, o.base) : righe[o.indice];
    var campi = o.campi;
    // Figma A14: aggiungendo da «Aggiungi in …» la sezione è già decisa: niente campo Sezione
    if (nuova && o.sezioneFissa) campi = campi.filter(function (c) { return c.k !== o.sezioneFissa; }).map(function (c) { return c.k === 'prezzo' ? Object.assign({}, c, { affianca: false }) : c; });
    o = Object.assign({}, o, { campi: campi });
    apriPannello(o.titolo, function (form) {
      var vicini = !nuova && o.gruppo ? righe.map(function (r, i) { return i; }).filter(function (i) { return o.gruppo(righe[i]) === o.gruppo(riga); }) : [];
      var pos = vicini.indexOf(o.indice);
      form.innerHTML = campiHtml(o.campi, riga) +
        '<div class="admin-pannello__azioni">' +
          '<button class="btn btn--primario" type="submit">' + (nuova ? 'Aggiungi' : 'Salva') + '</button>' +
          '<button class="btn btn--secondario" type="button" data-chiudi>Annulla</button>' +
        '</div>' +
        (nuova ? '' : '<div class="admin-pannello__secondarie">' +
          (vicini.length > 1 ? '<div class="admin-pannello__sposta">' +
            '<button class="btn btn--testo" type="button" data-sposta="-1"' + (pos <= 0 ? ' disabled' : '') + '>↑ Sposta su</button>' +
            '<button class="btn btn--testo" type="button" data-sposta="1"' + (pos >= vicini.length - 1 ? ' disabled' : '') + '>↓ Sposta giù</button></div>' : '<span></span>') +
          '<button class="btn btn--testo admin-elimina" type="button" data-elimina>Elimina</button></div>');
      collegaCampi(form);

      function invia(nuoveRighe, b, opz) {
        if (S.occupato) return;
        $$('button', form).forEach(function (x) { x.disabled = true; });
        if (b) b.classList.add('is-caricamento');
        var mod = o.dopo ? o.dopo(nuoveRighe, riga) : (function () { var m = {}; m[o.k] = nuoveRighe; return m; })();
        salva(mod, null, opz).then(function (ok) {
          if (ok) { chiudiPannello(); disegna(); } else { $$('button', form).forEach(function (x) { x.disabled = false; }); if (b) b.classList.remove('is-caricamento'); }
        });
      }

      form.onsubmit = function (ev) {
        ev.preventDefault();
        var r = leggiCampi(form, o.campi, riga);
        if (!r) return;
        var copiaRighe = righe.slice();
        if (nuova) copiaRighe.splice(o.posizione == null ? copiaRighe.length : o.posizione, 0, r);
        else copiaRighe[o.indice] = r;
        invia(copiaRighe, $('[type="submit"]', form), { messaggio: nuova ? 'Aggiunto: sul sito tra pochi secondi.' : 'Salvato: sul sito tra pochi secondi.' });
      };
      $$('[data-sposta]', form).forEach(function (b) {
        b.addEventListener('click', function () {
          var altro = vicini[pos + Number(b.getAttribute('data-sposta'))];
          var copiaRighe = righe.slice();
          copiaRighe[o.indice] = righe[altro]; copiaRighe[altro] = righe[o.indice];
          invia(copiaRighe, b);
        });
      });
      var el = $('[data-elimina]', form);
      if (el) el.addEventListener('click', function () {
        if (el.getAttribute('data-sicuro') !== '1') { el.setAttribute('data-sicuro', '1'); el.textContent = 'Tocca di nuovo per eliminare'; return; }
        // conferma con un secondo tocco; dopo si può comunque annullare dall'avviso in basso
        var copiaRighe = righe.slice(); copiaRighe.splice(o.indice, 1);
        invia(copiaRighe, el, { messaggio: 'Eliminato.', annullabile: true });
      });
    }, o.occhiello);
  }

  /* Interruttore Visibile direttamente nell'elenco: salva subito */
  function collegaInterruttori(v, k, campoK) {
    $$('[data-visibile]', v).forEach(function (inp) {
      inp.addEventListener('change', function () {
        var i = Number(inp.getAttribute('data-visibile'));
        var righe = scheda(k).righe.slice();
        righe[i] = Object.assign({}, righe[i]); righe[i][campoK || 'visibile'] = inp.checked;
        inp.disabled = true;
        var m = {}; m[k] = righe;
        var r = righe[i];
        var nome = r.piatto || r.menu || r.titolo || 'Riga';
        if (!r.piatto && r.dettaglio && k === 'menu') nome = 'La nota';
        salva(m, null, { messaggio: nome + (inp.checked ? ' di nuovo sul sito.' : ' nascosto dal sito.'), annullabile: true }).then(function () { disegna(); });
      });
    });
  }

  /* ==========================================================================
     Menù
     ========================================================================== */
  function vistaMenu(v) {
    var sotto = { carta: 'Alla carta', pranzo: 'Pranzo', feste: 'Feste', evidenza: 'In evidenza' };
    var html = testa('Menù', '', 'Le modifiche arrivano sul sito in pochi secondi. Inglese e tedesco si traducono da soli.');
    html += '<div class="admin-filtri"><div class="menu-tipi" role="group">' + Object.keys(sotto).map(function (k) {
      return '<button type="button" data-sotto="' + k + '" aria-pressed="' + (k === S.sotto) + '">' + sotto[k] + '</button>';
    }).join('') + '</div></div><div data-corpo></div>';
    v.innerHTML = html;
    $$('[data-sotto]', v).forEach(function (b) {
      b.addEventListener('click', function () { location.hash = 'menu/' + b.getAttribute('data-sotto'); });
    });
    var corpo = $('[data-corpo]', v);
    ({ carta: menuCarta, pranzo: menuPranzo, feste: menuFeste, evidenza: menuEvidenza })[S.sotto](corpo);
  }

  function valoriUnici(righe, k) {
    var visti = {};
    return righe.map(function (r) { return r[k]; }).filter(function (x) { if (!x || visti[x]) return false; visti[x] = true; return true; });
  }

  /** Righe raggruppate per sezione (ordine della prima comparsa) mantenendo l'indice nella scheda */
  function perSezione(righe, k, filtro) {
    var sezioni = [], mappa = {};
    righe.forEach(function (r, i) {
      if (filtro && !filtro(r)) return;
      var s = r[k] || '(senza sezione)';
      if (!mappa[s]) { mappa[s] = { titolo: s, righe: [] }; sezioni.push(mappa[s]); }
      mappa[s].righe.push(i);
    });
    return sezioni;
  }
  /** Dove inserire una riga nuova di una sezione: subito dopo l'ultima riga di quella sezione */
  function dopoUltima(righe, indici) { return indici.length ? indici[indici.length - 1] + 1 : righe.length; }

  /* Testa di una sezione (Figma: titolo Bricolage 24, conteggio, a destra un controllo facoltativo) */
  function testaSezione(titolo, conta, destra, contaSotto) {
    return '<div class="admin-sezione__testa' + (contaSotto ? ' admin-sezione__testa--colonna' : '') + '"><div class="admin-sezione__titoli"><h2 class="admin-sezione__titolo">' + esc(titolo) + '</h2>' +
      (conta ? '<span class="admin-sezione__conta">' + esc(conta) + '</span>' : '') + '</div>' + (destra || '') + '</div>';
  }
  function rigaAggiungi(attr, testo, senzaIcona) {
    return '<button class="admin-aggiungi" type="button" ' + attr + '>' + (senzaIcona ? '' : icona('plus', 'icona--s')) + esc(testo) + '</button>';
  }

  /* Figma Admin/Riga */
  function rigaElenco(i, nome, sotto, prezzo, visibile, conInterruttore) {
    return '<div class="admin-riga' + (visibile === false ? ' is-spenta' : '') + '">' +
      '<button class="admin-riga__apri" type="button" data-apri="' + i + '">' +
        '<span class="admin-riga__testo"><span class="admin-riga__nome">' + esc(nome) + '</span>' +
        (sotto ? '<span class="admin-riga__sotto">' + esc(sotto) + '</span>' : '') + '</span>' +
        (prezzo ? '<span class="admin-riga__prezzo">' + esc(prezzo) + '</span>' : '') +
      '</button>' +
      (conInterruttore ? interruttore(visibile !== false, '', 'data-visibile="' + i + '" aria-label="Visibile sul sito: ' + esc(nome) + '"') : '') +
    '</div>';
  }

  /* ---------- Alla carta ---------- */
  /* Figma A07 (telefono): Sezione, Piatto, Dettaglio, Prezzo · AD02 (computer): Sezione e Prezzo affiancati.
     «Gruppo» serve solo ai vini: si mostra quando la sezione ne usa, altrimenti si apre da un link. */
  function campiCarta(righe, sezione) {
    var telefono = window.matchMedia('(max-width: 767px)').matches;
    var conGruppi = righe.some(function (r) { return r.sezione === sezione && r.gruppo; });
    var sez = { k: 'sezione', etichetta: 'Sezione', suggerimenti: valoriUnici(righe, 'sezione'), max: 60, affianca: !telefono };
    var prezzo = { k: 'prezzo', etichetta: 'Prezzo', facoltativo: true, max: 30, esempio: '12,00 €', affianca: !telefono, prezzo: true, aiuto: 'Scrivi solo il numero: 10 diventa 10,00 €.' };
    var piatto = { k: 'piatto', etichetta: 'Piatto', max: 120, esempio: 'Tortellini di Valeggio burro e salvia' };
    var dettaglio = { k: 'dettaglio', etichetta: 'Dettaglio', facoltativo: true, max: 160, esempio: 'es. ingredienti, cantina…' };
    var gruppo = { k: 'gruppo', etichetta: 'Gruppo', facoltativo: true, suggerimenti: valoriUnici(righe, 'gruppo'), aiuto: 'Solo per dividere una sezione (es. Vini bianchi, Vini rossi).', max: 60, rivela: conGruppi ? '' : 'Dividi la sezione in gruppi (es. Vini bianchi)' };
    return (telefono ? [sez, piatto, dettaglio, prezzo] : [sez, prezzo, piatto, dettaglio]).concat([gruppo,
      { k: 'allergeni', etichetta: 'Allergeni', tipo: 'allergeni' },
      { k: 'visibile', etichetta: 'Visibile sul sito', tipo: 'si' }]);
  }
  function campiNota(righe) {
    return [
      { k: 'sezione', etichetta: 'Sezione', suggerimenti: valoriUnici(righe, 'sezione'), max: 60 },
      { k: 'dettaglio', etichetta: 'Nota', max: 160, esempio: 'Coperto 2,50 €', aiuto: 'Compare sotto il titolo della sezione.' },
      { k: 'visibile', etichetta: 'Visibile sul sito', tipo: 'si' }
    ];
  }

  function menuCarta(corpo) {
    var righe = scheda('menu').righe;
    var html = '';
    perSezione(righe, 'sezione').forEach(function (s) {
      var piatti = s.righe.filter(function (i) { return righe[i].piatto; });
      var visibili = piatti.filter(function (i) { return righe[i].visibile; }).length;
      html += '<section class="admin-sezione">' + testaSezione(s.titolo, visibili + ' di ' + piatti.length + ' sul sito');
      var gruppo = null;
      s.righe.forEach(function (i) {
        var r = righe[i];
        if (!r.piatto) { html += rigaElenco(i, 'Nota: ' + r.dettaglio, '', '', r.visibile, true); return; }
        if (r.gruppo !== gruppo && r.gruppo) html += '<p class="admin-gruppo">' + esc(r.gruppo) + '</p>';
        gruppo = r.gruppo;
        html += rigaElenco(i, r.piatto, [r.dettaglio, r.allergeni].filter(Boolean).join(' · '), r.prezzo, r.visibile, true);
      });
      html += rigaAggiungi('data-aggiungi="' + esc(s.titolo) + '"', 'Aggiungi in ' + s.titolo) + '</section>';
    });
    if (!righe.length) html += '<p class="admin-vuoto">Il menù è vuoto: aggiungi il primo piatto.</p>';
    html += '<div class="admin-azioni"><button class="btn btn--secondario" type="button" data-nuova-sezione>Nuova sezione</button>' +
      '<button class="btn btn--testo" type="button" data-nuova-nota>Aggiungi una nota di sezione</button></div>';
    corpo.innerHTML = html;

    var sezioni = perSezione(righe, 'sezione');
    $$('[data-apri]', corpo).forEach(function (b) {
      b.addEventListener('click', function () {
        var i = Number(b.getAttribute('data-apri'));
        var nota = !righe[i].piatto;
        modificaRiga({ k: 'menu', titolo: nota ? 'Nota di sezione' : 'Modifica piatto', campi: nota ? campiNota(righe) : campiCarta(righe, righe[i].sezione), indice: i,
          gruppo: function (r) { return r.sezione; } });
      });
    });
    $$('[data-aggiungi]', corpo).forEach(function (b) {
      b.addEventListener('click', function () {
        var nome = b.getAttribute('data-aggiungi');
        var s = sezioni.filter(function (x) { return x.titolo === nome; })[0];
        var ultimo = s.righe.length ? righe[s.righe[s.righe.length - 1]] : {};
        modificaRiga({ k: 'menu', titolo: 'Nuovo piatto', occhiello: 'In ' + nome, sezioneFissa: 'sezione', campi: campiCarta(righe, nome), base: { sezione: nome, gruppo: ultimo.gruppo || '', visibile: true }, posizione: dopoUltima(righe, s.righe) });
      });
    });
    $('[data-nuova-sezione]', corpo).addEventListener('click', function () {
      modificaRiga({ k: 'menu', titolo: 'Nuova sezione: primo piatto', campi: campiCarta(righe), base: { visibile: true } });
    });
    $('[data-nuova-nota]', corpo).addEventListener('click', function () {
      modificaRiga({ k: 'menu', titolo: 'Nota di sezione', campi: campiNota(righe), base: { visibile: true, piatto: '' },
        dopo: function (nuove) {
          // la nota va in testa alla sua sezione
          var r = nuove[nuove.length - 1];
          var resto = nuove.slice(0, -1);
          var prima = resto.map(function (x) { return x.sezione; }).indexOf(r.sezione);
          resto.splice(prima === -1 ? resto.length : prima, 0, r);
          return { menu: resto };
        } });
    });
    collegaInterruttori(corpo, 'menu');
  }

  /* ---------- Pausa pranzo ---------- */
  function campiPranzo(righe) {
    return [
      { k: 'sezione', etichetta: 'Sezione', suggerimenti: valoriUnici(righe, 'sezione').concat(['Primi', 'Secondi', 'Contorni']).filter(function (x, i, a) { return a.indexOf(x) === i; }), max: 60 },
      { k: 'piatto', etichetta: 'Piatto', max: 120 },
      { k: 'allergeni', etichetta: 'Allergeni', tipo: 'allergeni' },
      { k: 'visibile', etichetta: 'C’è oggi (visibile sul sito)', tipo: 'si' }
    ];
  }
  function menuPranzo(corpo) {
    var sch = scheda('pranzo');
    var righe = sch.righe;
    var html = '<form class="admin-card admin-prezzo" data-prezzo novalidate><div class="admin-sezione__titoli admin-sezione__titoli--colonna"><h2 class="admin-sezione__titolo">Prezzo del menù</h2>' +
      '<span class="admin-sezione__conta">Dal lunedì al venerdì, bevande escluse.</span></div>' +
      '<div class="admin-prezzo__riga">' + campo({ k: 'prezzo', etichetta: 'Prezzo', esempio: '15,00 €', max: 30, prezzo: true }, sch.prezzo) +
      '<button class="btn btn--secondario" type="submit">Salva</button></div></form>';
    perSezione(righe, 'sezione').forEach(function (s) {
      var oggiCi = s.righe.filter(function (i) { return righe[i].visibile; }).length;
      html += '<section class="admin-sezione">' + testaSezione(s.titolo, oggiCi + ' di ' + s.righe.length + ' sul sito oggi', '', true);
      s.righe.forEach(function (i) { html += rigaElenco(i, righe[i].piatto, righe[i].allergeni, '', righe[i].visibile, true); });
      html += rigaAggiungi('data-aggiungi="' + esc(s.titolo) + '"', 'Aggiungi in ' + s.titolo) + '</section>';
    });
    html += '<p class="admin-nota">Spegnete i piatti che oggi non ci sono invece di cancellarli: domani basta riaccenderli.</p>';
    html += '<div class="admin-azioni"><button class="btn btn--secondario" type="button" data-nuova-sezione>Nuova sezione</button></div>';
    corpo.innerHTML = html;

    var f = $('[data-prezzo]', corpo);
    collegaPrezzi(f);
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var val = formattaPrezzo($('input', f).value); $('input', f).value = val;
      var b = $('[type="submit"]', f);
      b.disabled = true; b.classList.add('is-caricamento');
      salva({ pranzo: righe }, { pranzo: { prezzo: val } }, { messaggio: 'Prezzo salvato: sul sito tra pochi secondi.' }).then(function () { disegna(); });
    });
    var sezioni = perSezione(righe, 'sezione');
    $$('[data-apri]', corpo).forEach(function (b) {
      b.addEventListener('click', function () {
        modificaRiga({ k: 'pranzo', titolo: 'Modifica piatto', campi: campiPranzo(righe), indice: Number(b.getAttribute('data-apri')), gruppo: function (r) { return r.sezione; } });
      });
    });
    $$('[data-aggiungi]', corpo).forEach(function (b) {
      b.addEventListener('click', function () {
        var nome = b.getAttribute('data-aggiungi');
        var s = sezioni.filter(function (x) { return x.titolo === nome; })[0];
        modificaRiga({ k: 'pranzo', titolo: 'Nuovo piatto', occhiello: 'In ' + nome, sezioneFissa: 'sezione', campi: campiPranzo(righe), base: { sezione: nome, visibile: true }, posizione: dopoUltima(righe, s.righe) });
      });
    });
    $('[data-nuova-sezione]', corpo).addEventListener('click', function () {
      modificaRiga({ k: 'pranzo', titolo: 'Nuova sezione: primo piatto', campi: campiPranzo(righe), base: { visibile: true } });
    });
    collegaInterruttori(corpo, 'pranzo');
  }

  /* ---------- Feste ---------- */
  function campiFesta() {
    return [
      { k: 'menu', etichetta: 'Nome della festa', max: 60, esempio: 'Natale', aiuto: 'Compare nel selettore dei menù e nel titolo: «Il menù di Natale».' },
      { k: 'giorno', etichetta: 'Giorno', tipo: 'data', facoltativo: true },
      { k: 'prezzo', etichetta: 'Prezzo', facoltativo: true, max: 30, esempio: '55,00 €', prezzo: true, aiuto: 'Scrivi solo il numero: 50 diventa 50,00 €.' },
      { k: 'nota', etichetta: 'Note sul prezzo', facoltativo: true, max: 120, esempio: 'Bevande escluse · bambini 25,00 €' },
      { k: 'descrizione', etichetta: 'Descrizione', tipo: 'testo-lungo', facoltativo: true, max: 400 },
      { k: 'visibile', etichetta: 'Visibile sul sito', tipo: 'si' }
    ];
  }
  function campiPiattoFesta(righe) {
    return [
      { k: 'portata', etichetta: 'Portata', suggerimenti: valoriUnici(righe, 'portata').concat(['Antipasto', 'Primi', 'Secondi', 'Contorni', 'Dolce']).filter(function (x, i, a) { return a.indexOf(x) === i; }), max: 60 },
      { k: 'piatto', etichetta: 'Piatto', max: 120 },
      { k: 'allergeni', etichetta: 'Allergeni', tipo: 'allergeni' }
    ];
  }
  function stessaFesta(a, b) { return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase(); }

  function menuFeste(corpo) {
    var feste = scheda('feste').righe;
    var piatti = scheda('menuFeste').righe;
    var html = '<p class="testo-m">Accendete un menù quando volete mostrarlo sul sito e spegnetelo dopo la festa: resta qui, pronto per l’anno dopo.</p>';
    if (!feste.length) html += '<p class="admin-vuoto">Nessun menù delle feste: createne uno.</p>';
    feste.forEach(function (f, fi) {
      var suoi = perSezione(piatti, 'portata', function (p) { return stessaFesta(p.menu, f.menu); });
      var interr = '<label class="admin-interruttore-verticale' + (f.visibile ? ' is-acceso' : '') + '"><input type="checkbox" role="switch"' + (f.visibile ? ' checked' : '') + ' data-visibile="' + fi + '" aria-label="Menù di ' + esc(f.menu) + ' visibile sul sito"><span class="interruttore__binario" aria-hidden="true"></span><span>' + (f.visibile ? 'Sul sito' : 'Spento') + '</span></label>';
      html += '<section class="admin-sezione">' + testaSezione(f.menu, [f.giorno ? maiuscola(giornoData(f.giorno)) : '', f.prezzo, f.nota].filter(Boolean).join(' · '), interr, true);
      suoi.forEach(function (s) {
        html += '<p class="admin-gruppo">' + esc(s.titolo) + '</p>';
        s.righe.forEach(function (i) { html += rigaElenco(i, piatti[i].piatto, piatti[i].allergeni, '', true, false).replace('data-apri=', 'data-apri-piatto='); });
      });
      if (!suoi.length) html += '<p class="admin-riga admin-riga--vuota">Ancora nessun piatto.</p>';
      html += rigaAggiungi('data-aggiungi-piatto="' + fi + '"', 'Aggiungi un piatto') +
        rigaAggiungi('data-modifica-festa="' + fi + '"', 'Modifica nome, giorno e prezzo', true) + '</section>';
    });
    html += '<div class="admin-azioni"><button class="btn btn--secondario" type="button" data-nuova-festa>Nuovo menù delle feste</button></div>';
    corpo.innerHTML = html;

    collegaInterruttori(corpo, 'feste');
    $$('[data-modifica-festa]', corpo).forEach(function (b) {
      b.addEventListener('click', function () {
        var fi = Number(b.getAttribute('data-modifica-festa'));
        modificaRiga({ k: 'feste', titolo: 'Menù di ' + feste[fi].menu, campi: campiFesta(), indice: fi, gruppo: function () { return 1; },
          dopo: function (nuove, vecchia) {
            var m = { feste: nuove };
            if (nuove.length < feste.length) { // festa eliminata
              var restano = piatti.filter(function (p) { return !stessaFesta(p.menu, vecchia.menu); });
              if (restano.length !== piatti.length && confirm('Eliminare anche i ' + (piatti.length - restano.length) + ' piatti di questo menù?')) m.menuFeste = restano;
            } else if (feste.indexOf(nuove[fi]) === -1 && !stessaFesta(nuove[fi].menu, vecchia.menu)) {
              // nome cambiato: i piatti seguono la festa
              m.menuFeste = piatti.map(function (p) { return stessaFesta(p.menu, vecchia.menu) ? Object.assign({}, p, { menu: nuove[fi].menu }) : p; });
            }
            return m;
          } });
      });
    });
    $$('[data-aggiungi-piatto]', corpo).forEach(function (b) {
      b.addEventListener('click', function () {
        var f = feste[Number(b.getAttribute('data-aggiungi-piatto'))];
        var suoi = piatti.map(function (p, i) { return i; }).filter(function (i) { return stessaFesta(piatti[i].menu, f.menu); });
        var ultimo = suoi.length ? piatti[suoi[suoi.length - 1]] : {};
        modificaRiga({ k: 'menuFeste', titolo: 'Nuovo piatto', occhiello: 'Menù di ' + f.menu, campi: campiPiattoFesta(piatti), base: { menu: f.menu, portata: ultimo.portata || '' }, posizione: dopoUltima(piatti, suoi) });
      });
    });
    $$('[data-apri-piatto]', corpo).forEach(function (b) {
      b.addEventListener('click', function () {
        var i = Number(b.getAttribute('data-apri-piatto'));
        modificaRiga({ k: 'menuFeste', titolo: 'Modifica piatto', occhiello: 'Menù di ' + piatti[i].menu, campi: campiPiattoFesta(piatti), indice: i,
          gruppo: function (r) { return String(r.menu).toLowerCase() + '|' + r.portata; } });
      });
    });
    $('[data-nuova-festa]', corpo).addEventListener('click', function () {
      modificaRiga({ k: 'feste', titolo: 'Nuovo menù delle feste', campi: campiFesta(), base: { visibile: false } });
    });
  }

  /* ---------- In evidenza ---------- */
  function menuEvidenza(corpo) {
    var righe = scheda('evidenza').righe;
    var piatti = valoriUnici(scheda('menu').righe.filter(function (r) { return r.piatto; }), 'piatto');
    var campi = [
      { k: 'titolo', etichetta: 'Titolo', max: 80, aiuto: 'Ogni specialità tiene la sua foto finché il titolo resta uguale.' },
      { k: 'piatto', etichetta: 'Piatto del menù (per il prezzo)', tipo: 'scelta', opzioni: piatti, facoltativo: true, vuoto: 'Nessuno', aiuto: 'Il prezzo si prende dal menù e si aggiorna da solo. Se il piatto è nascosto, sparisce anche dalla home.' },
      { k: 'prezzo', etichetta: 'Prezzo (se diverso)', facoltativo: true, max: 30, esempio: 'da 9,00 €', prezzo: true },
      { k: 'descrizione', etichetta: 'Descrizione', tipo: 'testo-lungo', facoltativo: true, max: 240 }
    ];
    var prezzoDi = function (nome) {
      var p = scheda('menu').righe.filter(function (r) { return stessaFesta(r.piatto, nome); })[0];
      return p ? p.prezzo : '';
    };
    var html = '<p class="testo-m">Le specialità nella home del sito, al massimo 3, nell’ordine qui sotto.</p><section class="admin-sezione">';
    righe.forEach(function (r, i) {
      html += rigaElenco(i, r.titolo, r.descrizione, r.prezzo || prezzoDi(r.piatto), i < 3, false);
    });
    if (!righe.length) html += '<p class="admin-riga admin-riga--vuota">Nessuna specialità.</p>';
    html += righe.length < 3 ? rigaAggiungi('data-aggiungi', 'Aggiungi una specialità') + '</section>'
      : '</section><p class="admin-nota">' + (righe.length > 3 ? 'Sul sito si vedono solo le prime 3.' : 'Sono già 3: per aggiungerne una, eliminane o modificane un’altra.') + '</p>';
    corpo.innerHTML = html;
    $$('[data-apri]', corpo).forEach(function (b) {
      b.addEventListener('click', function () {
        modificaRiga({ k: 'evidenza', titolo: 'Specialità', campi: campi, indice: Number(b.getAttribute('data-apri')), gruppo: function () { return 1; } });
      });
    });
    if ($('[data-aggiungi]', corpo)) $('[data-aggiungi]', corpo).addEventListener('click', function () {
      modificaRiga({ k: 'evidenza', titolo: 'Nuova specialità', campi: campi, base: {} });
    });
  }

  /* ==========================================================================
     Orari e chiusure
     ========================================================================== */
  function vistaOrari(v) {
    var originali = scheda('orari').righe;
    var bozza = S.orariBozza || copia(originali);
    var o = oggi();
    var chiusure = scheda('chiusure').righe;
    var future = chiusure.map(function (c, i) { return i; }).filter(function (i) { return (chiusure[i].al || chiusure[i].dal) >= o; });
    var passate = chiusure.map(function (c, i) { return i; }).filter(function (i) { return future.indexOf(i) === -1; });

    var html = testa('Orari', 'e chiusure', 'La settimana normale e i giorni di chiusura straordinaria (ferie, festività).');
    html += '<div class="admin-colonne admin-colonne--orari"><section class="admin-blocco"><div class="admin-sottotitolo"><h2>La settimana</h2>' +
      '<p class="testo-s">«Ultima» è l’ultimo orario prenotabile online: si prenota ogni mezz’ora da «Dalle».</p></div>' +
      '<div class="admin-orari">' + bozza.map(function (g, i) {
        return '<div class="admin-orario' + (g.aperto ? '' : ' is-chiuso') + '" data-giorno="' + i + '">' +
          '<div class="admin-orario__testa"><span class="admin-orario__giorno" id="g' + i + '">' + esc(g.giorno) + '</span>' +
          '<label class="interruttore interruttore--prima"><span class="admin-orario__stato">' + (g.aperto ? 'Aperto' : 'Chiuso') + '</span><input type="checkbox" role="switch"' + (g.aperto ? ' checked' : '') + ' data-campo-orario="aperto" aria-labelledby="g' + i + '"><span class="interruttore__binario" aria-hidden="true"></span></label></div>' +
          '<div class="admin-orario__ore">' +
            ['dalle', 'alle', 'ultima'].map(function (k) {
              var et = { dalle: 'Dalle', alle: 'Alle', ultima: 'Ultima' }[k];
              return '<label class="campo"><span class="campo__etichetta">' + et + '</span><select class="campo__input" data-campo-orario="' + k + '" aria-label="' + esc(g.giorno) + ', ' + et.toLowerCase() + '">' + opzioniOra(g[k]) + '</select></label>';
            }).join('') +
          '</div><p class="admin-orario__chiuso">Chiuso tutto il giorno</p></div>';
      }).join('') + '</div>' +
      '<div class="admin-salva" data-barra-salva' + (S.orariBozza ? '' : ' hidden') + '><span class="label">Orari modificati</span><div class="admin-salva__azioni">' +
        '<button class="admin-salva__annulla" type="button" data-annulla-orari>Annulla</button>' +
        '<button class="btn btn--su-scuro" type="button" data-salva-orari>Salva orari</button></div></div></section>';

    html += '<section class="admin-blocco admin-blocco--chiusure"><div class="admin-sottotitolo"><h2>Chiusure straordinarie</h2>' +
      '<p class="testo-s">Il sito mostra un avviso da 30 giorni prima e non accetta prenotazioni in quei giorni.</p></div>' +
      '<section class="admin-sezione">' +
      (future.length ? future.sort(function (a, b) { return String(chiusure[a].dal).localeCompare(String(chiusure[b].dal)); }).map(function (i) { return rigaChiusura(chiusure[i], i, o); }).join('') : '<p class="admin-riga admin-riga--vuota">Nessuna chiusura in programma.</p>') +
      rigaAggiungi('data-nuova-chiusura', 'Aggiungi una chiusura') + '</section>' +
      (passate.length ? '<details class="admin-passate"><summary>Chiusure passate (' + passate.length + ')</summary><section class="admin-sezione">' +
        passate.sort(function (a, b) { return String(chiusure[b].dal).localeCompare(String(chiusure[a].dal)); }).map(function (i) { return rigaChiusura(chiusure[i], i, o); }).join('') + '</section></details>' : '') +
      '</section></div>';
    v.innerHTML = html;

    var barra = $('[data-barra-salva]', v);
    function segnaModifica() { S.orariBozza = bozza; barra.hidden = false; }
    $$('[data-giorno]', v).forEach(function (riga) {
      var i = Number(riga.getAttribute('data-giorno'));
      $$('[data-campo-orario]', riga).forEach(function (inp) {
        inp.addEventListener('change', function () {
          var k = inp.getAttribute('data-campo-orario');
          if (k === 'aperto') {
            bozza[i].aperto = inp.checked;
            riga.classList.toggle('is-chiuso', !inp.checked);
            riga.querySelector('.admin-orario__stato').textContent = inp.checked ? 'Aperto' : 'Chiuso';
            if (inp.checked && !bozza[i].dalle) { bozza[i].dalle = '12:00'; bozza[i].alle = '14:00'; bozza[i].ultima = '13:30'; segnaModifica(); disegna(); return; }
          } else bozza[i][k] = inp.value;
          segnaModifica();
        });
      });
    });
    $('[data-annulla-orari]', v).addEventListener('click', function () { S.orariBozza = null; disegna(); });
    $('[data-salva-orari]', v).addEventListener('click', function () {
      var errore = '';
      bozza.forEach(function (g) {
        if (errore || !g.aperto) return;
        if (!g.dalle || !g.alle || g.dalle >= g.alle) errore = g.giorno + ': «Alle» deve venire dopo «Dalle».';
        else if (g.ultima && (g.ultima < g.dalle || g.ultima > g.alle)) errore = g.giorno + ': l’ultima prenotazione deve stare tra ' + g.dalle + ' e ' + g.alle + '.';
      });
      if (errore) return toast(errore, true);
      var b = this; b.disabled = true; b.classList.add('is-caricamento');
      salva({ orari: bozza }, null, { messaggio: 'Orari salvati: sul sito tra pochi secondi.' }).then(function (ok) { if (ok) S.orariBozza = null; disegna(); });
    });

    var campiChiusura = [
      { k: 'dal', etichetta: 'Dal', tipo: 'data' },
      { k: 'al', etichetta: 'Al', tipo: 'data', facoltativo: true, aiuto: 'Per un giorno solo lascialo vuoto.',
        controlla: function (val, r) { var dal = $('[data-campo="dal"] input').value; return val && dal && val < dal ? '«Al» deve venire dopo «Dal».' : ''; } },
      { k: 'motivo', etichetta: 'Motivo (si vede sul sito)', facoltativo: true, max: 80, esempio: 'Ferie estive' }
    ];
    $$('[data-apri]', v).forEach(function (b) {
      b.addEventListener('click', function () { modificaRiga({ k: 'chiusure', titolo: 'Chiusura', campi: campiChiusura, indice: Number(b.getAttribute('data-apri')) }); });
    });
    $('[data-nuova-chiusura]', v).addEventListener('click', function () {
      modificaRiga({ k: 'chiusure', titolo: 'Nuova chiusura', campi: campiChiusura, base: {} });
    });
  }

  /* Orari ogni mezz'ora in formato 24 ore (il campo «time» del browser segue la lingua del telefono) */
  function opzioniOra(valore) {
    var lista = [];
    for (var m = 7 * 60; m <= 23 * 60 + 30; m += 30) lista.push(String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'));
    if (valore && lista.indexOf(valore) === -1) { lista.push(valore); lista.sort(); }
    return lista.map(function (o) { return '<option' + (o === valore ? ' selected' : '') + '>' + o + '</option>'; }).join('');
  }

  function rigaChiusura(c, i, o) {
    var periodo = !c.al || c.al === c.dal ? maiuscola(giornoData(c.dal)) : 'Dal ' + dataBreve(c.dal) + ' al ' + dataBreve(c.al);
    var inCorso = c.dal <= o && (c.al || c.dal) >= o;
    return rigaElenco(i, periodo, (inCorso ? 'In corso · ' : '') + (c.motivo || 'Senza motivo'), '', (c.al || c.dal) >= o, false);
  }

  /* ==========================================================================
     Avvio
     ========================================================================== */
  leggiHash();
  S.sessione = leggiSessione();
  if (!window.MARA_SERVIZIO) { $('#stato').textContent = 'Manca l’indirizzo dello script (js/config.js).'; return; }
  if (S.sessione) carica(); else mostraAccesso();

  // Le prenotazioni nuove compaiono da sole: si ricarica ogni 2 minuti quando la pagina è in primo piano
  setInterval(function () {
    if (document.visibilityState !== 'visible' || !S.dati || S.occupato || !$('#pannello').hidden || S.orariBozza) return;
    chiama('carica').then(function (r) {
      if (!r.ok || S.occupato || !$('#pannello').hidden || S.orariBozza) return;
      var prima = S.dati.prenotazioni.length;
      S.dati = r; ultimoAggiornamento = new Date(); aggiornaConta();
      if (S.vista === 'prenotazioni' || S.vista === 'richieste') disegna();
      if (r.prenotazioni.length > prima) toast('È arrivata una nuova prenotazione.');
    }).catch(function () { /* riprova al prossimo giro */ });
  }, 120000);
})();
