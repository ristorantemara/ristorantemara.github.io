/* Ristorante Mara — comportamenti comuni del sito */
(function () {
  'use strict';

  /* ---------- Orari: aperto 12:00–14:00, martedì chiuso (ora di Roma) ---------- */
  var GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];

  function oraRoma() {
    try {
      var parti = new Intl.DateTimeFormat('it-IT', {
        timeZone: 'Europe/Rome', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
      }).formatToParts(new Date());
      var mappa = {};
      parti.forEach(function (p) { mappa[p.type] = p.value; });
      var giorniBrevi = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
      var g = giorniBrevi.indexOf(String(mappa.weekday).toLowerCase().slice(0, 3));
      return { giorno: g < 0 ? new Date().getDay() : g, minuti: parseInt(mappa.hour, 10) * 60 + parseInt(mappa.minute, 10) };
    } catch (e) {
      var d = new Date();
      return { giorno: d.getDay(), minuti: d.getHours() * 60 + d.getMinutes() };
    }
  }

  var adesso = oraRoma();
  var chiusoOggi = adesso.giorno === 2;
  var apertoOra = !chiusoOggi && adesso.minuti >= 720 && adesso.minuti < 840;

  function testoStato(tipo) {
    if (chiusoOggi) return tipo === 'breve' ? 'Oggi chiuso · ci vediamo domani' : 'Oggi chiuso · aperti da domani 12:00–14:00';
    if (apertoOra) return tipo === 'breve' ? 'Aperti ora · fino alle 14:00' : 'Aperti ora · fino alle 14:00 · martedì chiuso';
    if (adesso.minuti < 720) return tipo === 'breve' ? 'Aperti oggi · 12:00–14:00' : 'Aperti oggi dalle 12:00 alle 14:00 · martedì chiuso';
    var domani = (adesso.giorno + 1) % 7;
    return domani === 2
      ? (tipo === 'breve' ? 'Chiuso ora · riapriamo mercoledì' : 'Chiuso ora · riapriamo mercoledì alle 12:00')
      : (tipo === 'breve' ? 'Chiuso ora · domani 12:00–14:00' : 'Chiuso ora · riapriamo domani alle 12:00');
  }

  document.querySelectorAll('[data-stato-apertura]').forEach(function (el) {
    var tipo = el.getAttribute('data-stato-apertura');
    var testo = el.querySelector('[data-stato-testo]');
    if (testo) testo.textContent = testoStato(tipo);
    var pallino = el.querySelector('.pallino');
    if (pallino && !apertoOra && (chiusoOggi || adesso.minuti >= 840)) {
      pallino.classList.add('pallino--chiuso');
      el.classList.add('is-chiuso');
    }
  });

  document.querySelectorAll('[data-orari] [data-giorni]').forEach(function (riga) {
    var giorni = riga.getAttribute('data-giorni').split(',').map(Number);
    if (giorni.indexOf(adesso.giorno) !== -1) {
      riga.classList.add('is-oggi');
      var nome = riga.querySelector('.orari__giorno');
      if (nome && giorni.length > 1) nome.textContent = GIORNI[adesso.giorno].charAt(0).toUpperCase() + GIORNI[adesso.giorno].slice(1);
      if (nome) nome.textContent += ' · oggi';
    }
  });

  /* ---------- Navigazione mobile ---------- */
  var pannello = document.getElementById('pannello-menu');
  var apri = document.querySelector('[data-apri-menu]');
  var chiudi = document.querySelector('[data-chiudi-menu]');

  function apriMenu() {
    if (!pannello) return;
    pannello.hidden = false;
    document.body.classList.add('menu-aperto');
    if (apri) apri.setAttribute('aria-expanded', 'true');
    if (chiudi) chiudi.focus();
  }
  function chiudiMenu() {
    if (!pannello || pannello.hidden) return;
    pannello.hidden = true;
    document.body.classList.remove('menu-aperto');
    if (apri) { apri.setAttribute('aria-expanded', 'false'); apri.focus(); }
  }
  if (apri) apri.addEventListener('click', apriMenu);
  if (chiudi) chiudi.addEventListener('click', chiudiMenu);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') chiudiMenu(); });

  /* ---------- Lingue: per ora solo italiano ---------- */
  document.querySelectorAll('.lingue a').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      if (a.getAttribute('lang') !== 'it') alert('La versione in ' + (a.lang === 'en' ? 'inglese' : 'tedesco') + ' arriverà presto.');
    });
  });

  /* ---------- Banner cookie ---------- */
  var CHIAVE = 'mara-cookie';
  var banner = document.querySelector('[data-cookie]');
  function leggi() { try { return localStorage.getItem(CHIAVE); } catch (e) { return 'n/d'; } }
  function salva(v) { try { localStorage.setItem(CHIAVE, v); } catch (e) { /* storage non disponibile */ } }

  if (banner) {
    if (!leggi()) banner.hidden = false;
    var opzioni = banner.querySelector('[data-cookie-opzioni]');
    var statistici = banner.querySelector('[data-cookie-statistici]');
    var personalizza = banner.querySelector('[data-cookie-personalizza]');
    var rifiuta = banner.querySelector('[data-cookie-scelta="rifiuta"]');
    var accetta = banner.querySelector('[data-cookie-scelta="accetta"]');

    personalizza.addEventListener('click', function () {
      opzioni.hidden = false;
      statistici.checked = leggi() === 'accetta';
      personalizza.hidden = true;
      accetta.textContent = 'Salva le scelte';
      statistici.focus();
    });
    rifiuta.addEventListener('click', function () { salva('rifiuta'); banner.hidden = true; });
    accetta.addEventListener('click', function () {
      salva(opzioni.hidden || statistici.checked ? 'accetta' : 'rifiuta');
      banner.hidden = true;
    });
    document.querySelectorAll('[data-preferenze-cookie]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        banner.hidden = false;
        personalizza.click();
      });
    });
  }
})();
