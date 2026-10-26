/* Ristorante Mara — comportamenti comuni del sito */
(function () {
  'use strict';

  /* ---------- Orari, stato di apertura e chiusure (dati dal Foglio, ora di Roma) ---------- */
  var O = window.maraOrari;

  function oraRoma() {
    try {
      var t = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
      return O.minuti(t);
    } catch (e) { var d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
  }

  /** Testo e stato per la pillola "Aperti ora" (tipo breve) e per la barra in alto (tipo lungo) */
  function statoApertura(dati, tipo) {
    var oggi = window.maraOggi();
    var adesso = oraRoma();
    var o = O.giorno(dati, oggi);
    var r = O.riassunto(dati);
    var coda = tipo === 'lungo' && r.chiusi ? ' · ' + r.chiusi : '';

    function quandoRiapre(dopo) {
      var g = O.prossimaApertura(dati, O.piuGiorni(oggi, dopo));
      if (!g) return '';
      var og = O.giorno(dati, g);
      var nome = g === O.piuGiorni(oggi, 1) ? 'domani' : O.GIORNI[O.giornoSettimana(g)] + (g > O.piuGiorni(oggi, 6) ? ' ' + O.data(g, oggi) : '');
      return tipo === 'breve' ? nome + ' ' + O.fascia(og) : nome + ' alle ' + og.dalle;
    }

    if (!o.aperto) {
      var motivo = o.chiusura ? (o.chiusura.motivo || 'Chiusura straordinaria') : 'Oggi chiuso';
      var riapre = quandoRiapre(1);
      return { chiuso: true, testo: motivo + (riapre ? ' · riapriamo ' + riapre : '') };
    }
    if (adesso < O.minuti(o.dalle)) return { chiuso: false, testo: tipo === 'breve' ? 'Aperti oggi · ' + O.fascia(o) : 'Aperti oggi dalle ' + o.dalle + ' alle ' + o.alle + coda };
    if (adesso < O.minuti(o.alle)) return { chiuso: false, testo: 'Aperti ora · fino alle ' + o.alle + coda };
    var dopo = quandoRiapre(1);
    return { chiuso: true, testo: 'Chiuso ora' + (dopo ? ' · ' + (tipo === 'breve' ? '' : 'riapriamo ') + dopo : '') };
  }

  function disegnaOrari(dati) {
    var oggi = window.maraOggi();
    var giornoOggi = O.giornoSettimana(oggi);

    document.querySelectorAll('[data-stato-apertura]').forEach(function (el) {
      var st = statoApertura(dati, el.getAttribute('data-stato-apertura'));
      var testo = el.querySelector('[data-stato-testo]');
      if (testo) testo.textContent = st.testo;
      var pallino = el.querySelector('.pallino');
      if (pallino) pallino.classList.toggle('pallino--chiuso', st.chiuso);
      el.classList.toggle('is-chiuso', st.chiuso);
    });

    // Tabelle orari: data-orari="giorni" = un giorno per riga, altrimenti giorni uguali uniti
    document.querySelectorAll('[data-orari]').forEach(function (dl) {
      var separati = dl.getAttribute('data-orari') === 'giorni';
      dl.innerHTML = '';
      O.righe(dati, separati).forEach(function (r) {
        var riga = document.createElement('div');
        riga.className = 'orari__riga';
        riga.setAttribute('data-giorni', r.giorni.join(','));
        var dt = document.createElement('dt'); dt.className = 'orari__giorno'; dt.textContent = r.etichetta;
        var dd = document.createElement('dd'); dd.className = 'orari__ora' + (r.chiuso ? ' orari__ora--chiuso' : ''); dd.textContent = r.testo;
        if (r.giorni.indexOf(giornoOggi) !== -1) {
          riga.classList.add('is-oggi');
          if (r.giorni.length > 1) dt.textContent = O.maiuscola(O.GIORNI[giornoOggi]);
          dt.textContent += ' · oggi';
          var oggiVero = O.giorno(dati, oggi);
          if (oggiVero.chiusura) { dd.textContent = 'Chiuso'; dd.className = 'orari__ora orari__ora--chiuso'; }
        }
        riga.appendChild(dt); riga.appendChild(dd); dl.appendChild(riga);
      });
    });

    // Frasi sugli orari sparse nelle pagine
    var r = O.riassunto(dati);
    var fascia = r.fascia ? r.fascia : 'a pranzo';
    var dalleAlle = r.fascia ? 'dalle ' + r.fascia.replace('–', ' alle ') : 'a pranzo';
    var frasi = {
      fascia: r.fascia ? 'Aperti ' + r.fascia : 'Aperti a pranzo',
      giorni: r.tuttiAperti ? 'Tutti i giorni' : (r.nChiusi === 1 ? 'Tutti i giorni, ' + r.chiusi : r.chiusi.charAt(0).toUpperCase() + r.chiusi.slice(1)),
      frase: 'Aperti ' + (r.tuttiAperti ? 'tutti i giorni ' : '') + dalleAlle + (r.chiusi ? ', ' + (r.nChiusi === 1 ? 'il ' : '') + r.elencoChiusi + ' siamo chiusi.' : '.'),
      breve: 'Aperti ' + fascia + (r.chiusi ? ' · ' + r.chiusi : '')
    };
    document.querySelectorAll('[data-orari-testo]').forEach(function (el) {
      var t = frasi[el.getAttribute('data-orari-testo')];
      if (t) el.textContent = t;
    });

    // Footer: una riga per orario, poi i giorni di chiusura
    document.querySelectorAll('[data-orari-footer]').forEach(function (box) {
      box.innerHTML = '';
      O.righe(dati, false).forEach(function (riga) {
        var p = document.createElement('p');
        p.textContent = riga.etichetta + (riga.chiuso ? ' chiuso' : ', ' + riga.testo.replace(' – ', '–'));
        box.appendChild(p);
      });
    });

    // Avviso di chiusura (ferie, giorni straordinari) in cima alle pagine
    var c = O.chiusuraVicina(dati, oggi, 30);
    document.querySelectorAll('[data-avviso-chiusura]').forEach(function (box) {
      if (!c) { box.hidden = true; return; }
      var inCorso = c.dal <= oggi;
      var titolo = c.motivo || 'Chiusura straordinaria';
      var testo;
      if (inCorso) {
        var riapre = O.prossimaApertura(dati, O.piuGiorni(c.al, 1));
        testo = (c.dal === c.al ? 'oggi siamo chiusi' : 'siamo chiusi fino a ' + O.giornoData(c.al)) +
          (riapre ? '. Riapriamo ' + O.giornoData(riapre) + '.' : '.');
      } else {
        testo = 'saremo chiusi ' + O.periodo(c, oggi) + '.';
      }
      box.querySelector('[data-avviso-titolo]').textContent = titolo + ':';
      box.querySelector('[data-avviso-testo]').textContent = ' ' + testo;
      box.hidden = false;
    });
  }

  if (O && window.maraDati) window.maraDati(disegnaOrari);

  /* ---------- Specialità della home (scheda «In evidenza» del Foglio) ---------- */
  var griglia = document.querySelector('[data-evidenza]');
  if (griglia && window.maraDati) {
    // ogni specialità tiene la sua foto (per titolo); un titolo nuovo prende una foto rimasta libera
    var fotoPerTitolo = {}, fotoLibere = [];
    griglia.querySelectorAll('.specialita__piatto').forEach(function (a) {
      var f = a.querySelector('.foto'), t = a.querySelector('.h3');
      if (f && t) fotoPerTitolo[t.textContent.trim().toLowerCase()] = f.outerHTML;
    });
    var firmaEvidenza = '';
    window.maraDati(function (dati) {
      if (!Array.isArray(dati.evidenza) || !dati.evidenza.length) return;
      var firma = JSON.stringify(dati.evidenza);
      if (firma === firmaEvidenza) return;
      firmaEvidenza = firma;
      griglia.innerHTML = '';
      griglia.setAttribute('data-quanti', dati.evidenza.length);
      var usate = {};
      dati.evidenza.forEach(function (p) { if (fotoPerTitolo[p.titolo.toLowerCase()]) usate[p.titolo.toLowerCase()] = true; });
      fotoLibere = Object.keys(fotoPerTitolo).filter(function (t) { return !usate[t]; }).map(function (t) { return fotoPerTitolo[t]; });
      dati.evidenza.forEach(function (p) {
        var a = document.createElement('article');
        a.className = 'specialita__piatto';
        var html = fotoPerTitolo[p.titolo.toLowerCase()] || fotoLibere.shift() || '';
        a.innerHTML = html +
          '<div class="specialita__titolo"><h3 class="h3"></h3><p class="prezzo"></p></div><p class="testo-m"></p>';
        a.querySelector('.h3').textContent = p.titolo;
        a.querySelector('.prezzo').textContent = p.prezzo || '';
        a.querySelector('.testo-m').textContent = p.descrizione || '';
        if (!p.descrizione) a.querySelector('.testo-m').remove();
        griglia.appendChild(a);
      });
    });
  }

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

    var mappe = banner.querySelector('[data-cookie-mappe]');
    personalizza.addEventListener('click', function () {
      opzioni.hidden = false;
      statistici.checked = leggi() === 'accetta';
      mappe.checked = mappeConsentite();
      personalizza.hidden = true;
      accetta.textContent = 'Salva le scelte';
      statistici.focus();
    });
    rifiuta.addEventListener('click', function () { salva('rifiuta'); impostaMappe(false); banner.hidden = true; });
    accetta.addEventListener('click', function () {
      salva(opzioni.hidden || statistici.checked ? 'accetta' : 'rifiuta');
      impostaMappe(opzioni.hidden || mappe.checked);
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

  /* ---------- Mappa di Google: si carica solo con il consenso ---------- */
  function mappeConsentite() { try { return localStorage.getItem('mara-mappe') === 'si'; } catch (e) { return false; } }
  function caricaMappa(box) {
    if (box.querySelector('iframe') || !box.getClientRects().length) return; // già caricata o nascosta (es. home su mobile)
    var f = document.createElement('iframe');
    f.src = box.dataset.src;
    f.title = 'Mappa: Ristorante Mara, Via Mantovana 1180, Valeggio sul Mincio';
    f.loading = 'lazy';
    f.referrerPolicy = 'no-referrer-when-downgrade';
    f.allowFullscreen = true;
    box.appendChild(f);
    box.classList.add('is-caricata');
  }
  function togliMappa(box) {
    var f = box.querySelector('iframe');
    if (f) f.remove();
    box.classList.remove('is-caricata');
  }
  function impostaMappe(si) {
    try { localStorage.setItem('mara-mappe', si ? 'si' : 'no'); } catch (e) { /* storage non disponibile */ }
    document.querySelectorAll('[data-mappa]').forEach(function (b) { if (si) caricaMappa(b); else togliMappa(b); });
  }
  document.querySelectorAll('[data-mappa]').forEach(function (box) {
    if (mappeConsentite()) caricaMappa(box);
    box.querySelector('[data-mappa-carica]').addEventListener('click', function () { impostaMappe(true); });
  });
})();
