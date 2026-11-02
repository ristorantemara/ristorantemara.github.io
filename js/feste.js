/* Menù delle feste (Natale, Pasqua…): li accende e li spegne il ristorante dal Foglio (schede «Feste» e
   «Menù delle feste»). Per ogni menù acceso compare una voce in più nel selettore dei menù; la pagina
   menu-feste.html mostra il menù scelto (?festa=natale) o il primo acceso.
   Dati da …/exec?dati=sito:  feste: [{ id, nome, giorno: "2026-12-25", prezzo, nota, descrizione,
   portate: [{ titolo, piatti: [{ nome, allergeni: [], testo_allergeni }] }] }]  (+ i campi _en e _de) */
(function () {
  'use strict';

  var L = window.maraL;
  var t = L.t;
  var pagina = document.querySelector('[data-festa-portate]') ? 'feste' : '';
  var selettori = document.querySelectorAll('.menu-tipi');
  if (!selettori.length || !window.maraDati) return;

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function slug(s) { return String(s).toLowerCase().replace(/à/g, 'a').replace(/[^a-z]+/g, '-').replace(/^-+|-+$/g, ''); }
  function data(iso) { var p = String(iso || '').split('-').map(Number); return p.length === 3 && !isNaN(p[0]) ? new Date(Date.UTC(p[0], p[1] - 1, p[2])) : null; }
  function breve(iso) { var d = data(iso); return d ? d.getUTCDate() + ' ' + L.MESI[d.getUTCMonth()].slice(0, 3) : ''; }
  function lungo(iso) {
    var d = data(iso);
    if (!d) return '';
    var s = L.giornoData(d.getUTCDay(), L.data(d.getUTCDate(), d.getUTCMonth(), ''));
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function prezzo(p) {
    var s = String(p == null ? '' : p).replace('€', '').trim().replace('.', ',');
    if (!s) return '';
    if (/^\d+$/.test(s)) s += ',00';
    return s.replace(/,00$/, '') + ' €';
  }
  function scelta(feste) {
    var q = (location.search.match(/[?&]festa=([^&]+)/) || [])[1];
    for (var i = 0; i < feste.length; i++) if (feste[i].id === q) return feste[i];
    return feste[0];
  }

  /* ---------- Voci nel selettore dei menù ---------- */
  function voci(feste, attiva) {
    selettori.forEach(function (nav) {
      nav.querySelectorAll('[data-voce-festa]').forEach(function (a) { a.remove(); });
      feste.forEach(function (f) {
        var a = document.createElement('a');
        a.href = 'menu-feste.html?festa=' + encodeURIComponent(f.id);
        a.setAttribute('data-voce-festa', '');
        if (attiva && attiva.id === f.id) a.setAttribute('aria-current', 'page');
        a.appendChild(document.createTextNode(L.dalFoglio(f, 'nome')));
        var g = document.createElement('span');
        g.className = 'menu-tipi__giorni';
        g.textContent = breve(f.giorno);
        if (g.textContent) a.appendChild(g);
        nav.appendChild(a);
      });
      nav.classList.toggle('menu-tipi--tre', feste.length > 0);
    });
  }

  /* ---------- Pagina del menù delle feste ---------- */
  var $ = function (s) { return document.querySelector(s); };
  function rigaPiatto(p) {
    var allergeni = p.allergeni || [];
    var testo = L.dalFoglio(p, 'testo_allergeni') || allergeni.map(function (a) { return t(a); }).join(' · ');
    return '<li class="piatto"><div class="piatto__testa"><h3 class="piatto-nome">' + esc(L.dalFoglio(p, 'nome', 'piatto:')) + '</h3></div>' +
      (testo ? '<p class="piatto__allergeni"><span class="visually-hidden">' + t('Allergeni:') + ' </span>' + esc(testo) + '</p>' : '') + '</li>';
  }
  function mostra(f) {
    var nome = L.dalFoglio(f, 'nome');
    var titolo = t('Il menù di {n}').split('{n}');
    $('[data-festa-titolo]').innerHTML = esc(titolo[0]) + '<span class="accento">' + esc(nome) + '</span>' + esc(titolo[1] || '');
    document.title = t('Il menù di {n}', { n: nome }) + ' · Ristorante Mara';
    var giorno = lungo(f.giorno);
    $('[data-festa-descrizione]').textContent = L.dalFoglio(f, 'descrizione') ||
      t('{g}, a pranzo. Un menù pensato per la festa, con i piatti della nostra tradizione: prenota per tempo, i posti sono limitati.', { g: giorno });
    var cifra = prezzo(f.prezzo);
    $('[data-festa-prezzo]').textContent = cifra;
    $('[data-festa-prezzo]').hidden = !cifra;
    $('[data-festa-giorno]').textContent = giorno;
    $('[data-festa-nota]').textContent = L.dalFoglio(f, 'nota');
    $('[data-festa-nota]').hidden = !f.nota;
    $('[data-festa-prezzo-box]').setAttribute('aria-label', t('Prezzo del menù di {n}', { n: nome }));
    $('[data-festa-prezzo-box]').hidden = !cifra && !giorno && !f.nota;
    $('[data-festa-portate]').innerHTML = (f.portate || []).map(function (p) {
      return '<section class="feste-portata" aria-labelledby="t-' + esc(slug(p.titolo)) + '">' +
        '<h2 class="h3 feste-portata__titolo" id="t-' + esc(slug(p.titolo)) + '">' + esc(L.dalFoglio(p, 'titolo')) + '</h2>' +
        '<ul class="feste-portata__piatti">' + (p.piatti || []).map(rigaPiatto).join('') + '</ul></section>';
    }).join('');
    $('[data-festa-cta-testo]').textContent = t('Per {n} i posti sono limitati: prenota online o chiamaci.', { n: nome });
    ['[data-festa-intro]', '[data-festa-portate]', '[data-festa-avviso]', '[data-festa-cta]'].forEach(function (s) { $(s).hidden = false; });
    $('[data-festa-attesa]').hidden = true;
    $('[data-festa-vuoto]').hidden = true;
  }
  function vuoto() {
    ['[data-festa-intro]', '[data-festa-portate]', '[data-festa-avviso]', '[data-festa-cta]'].forEach(function (s) { $(s).hidden = true; });
    $('[data-festa-attesa]').hidden = false;
    $('[data-festa-attesa-testo]').textContent = t('In questo momento non ci sono menù delle feste. Trovi i nostri menù di tutti i giorni qui sotto.');
    $('[data-festa-vuoto]').hidden = false;
  }

  var arrivati = false;
  var ultimo = null;
  function disegna(dati, origine) {
    var feste = (dati.feste || []).filter(function (f) { return f && f.id && f.nome; });
    var firma = JSON.stringify(feste);
    if (origine !== 'predefiniti') arrivati = true;
    if (firma === ultimo && origine !== 'rete') return;
    ultimo = firma;
    var attiva = pagina && feste.length ? scelta(feste) : null;
    voci(feste, attiva);
    if (!pagina) return;
    if (attiva) mostra(attiva);
    else if (arrivati) vuoto();
  }
  window.maraDati(disegna);
  // se il Foglio non risponde, dopo qualche secondo diciamo che non ci sono menù delle feste
  if (pagina) setTimeout(function () { if (!ultimo || ultimo === '[]') vuoto(); }, 5000);
})();
