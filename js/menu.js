/* Menù: filtro allergeni, sezioni attive, pannello mobile.
   Il menù scritto nella pagina è quello di partenza; se nel Foglio del ristorante
   il menù è diverso, viene ridisegnato con i dati del Foglio. */
(function () {
  'use strict';

  var L = window.maraL; // lingua della pagina (js/lingua.js)
  var t = L.t;
  var esclusi = [];
  var chip = document.querySelectorAll('[data-allergene]');
  var stato = document.querySelector('[data-filtro-stato]');
  var attiviMobile = document.querySelector('[data-filtro-attivi]');
  var etichettaMobile = document.querySelector('[data-filtro-etichetta-mobile]');
  var bottoneScegli = document.querySelector('[data-apri-allergeni]');
  var boxSezioni = document.querySelector('[data-menu-sezioni]');
  var boxIndice = document.querySelector('[data-menu-indice]');
  var boxPillole = document.querySelector('[data-menu-pillole]');

  var META = {};
  try { META = JSON.parse(document.getElementById('menu-meta').textContent); } catch (e) { META = {}; }

  var NOMI = {};
  chip.forEach(function (c) { NOMI[c.dataset.allergene] = c.childNodes[0].textContent.trim(); });

  var SINGOLARE = {
    antipasti: t('Nessun antipasto'), primi: t('Nessun primo'), secondi: t('Nessun secondo'),
    freddi: t('Nessun piatto freddo'), 'contorni-dolci': t('Nessun contorno o dolce'),
    bevande: t('Nessuna bevanda'), vini: t('Nessun vino')
  };
  var ARTICOLI = {
    antipasti: t('gli antipasti'), primi: t('i primi'), secondi: t('i secondi'), freddi: t('i piatti freddi'),
    'contorni-dolci': t('contorni e dolci'), bevande: t('le bevande'), vini: t('i vini')
  };
  var VUOTO = t('Avvisaci quando prenoti: la cucina può proporti un’alternativa.');
  var ICONA = function (n) { return '<svg class="icona" aria-hidden="true"><use href="' + L.icona(n) + '"/></svg>'; };
  var ROMANI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'];

  function sezioni() { return document.querySelectorAll('[data-sezione]'); }

  /* ---------- Disegno dal Foglio ---------- */
  function slug(t) { return String(t).toLowerCase().replace(/à/g, 'a').replace(/[^a-z]+/g, '-').replace(/^-+|-+$/g, ''); }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function rigaPiatto(p, vino) {
    var allergeni = vino ? ['Solfiti'] : (p.allergeni || []);
    var testo = t(p.testo_allergeni || '') || allergeni.map(function (a) { return t(a); }).join(' · ');
    var sotto = p.sotto || (L.lingua !== 'it' ? t('piatto:' + p.nome) : '');
    if (sotto === 'piatto:' + p.nome) sotto = '';
    return '<li class="piatto" data-allergeni="' + esc(allergeni.map(slug).join(',')) + '">' +
      '<div class="piatto__testa"><h3 class="piatto-nome">' + esc(p.nome) + '</h3>' +
      '<span class="piatto__puntini" aria-hidden="true"></span><p class="prezzo">' + esc(p.prezzo || '') + '</p></div>' +
      (sotto ? '<p class="piatto__sotto">' + esc(sotto) + '</p>' : '') +
      (testo && !vino ? '<p class="piatto__allergeni"><span class="visually-hidden">' + t('Allergeni:') + ' </span>' + esc(testo) + '</p>' : '') +
      '</li>';
  }

  function disegnaMenu(menu) {
    var usati = {};
    var indice = [], pillole = [], corpo = [];
    menu.sezioni.forEach(function (s, i) {
      var m = META[s.titolo] || {};
      var id = m.id || slug(s.titolo) || 'sezione';
      while (usati[id]) id += '-2';
      usati[id] = true;
      var vino = m.vini || /vin/i.test(s.titolo);
      var totale = s.gruppi.reduce(function (n, g) { return n + g.piatti.length; }, 0);
      var numero = (ROMANI[i] || String(i + 1)) + '.';
      var titolo = t(s.titolo);
      indice.push('<li><a href="#' + id + '" data-indice="' + id + '"><span>' + esc(titolo) + '</span>' +
        '<span class="menu-indice__conta" data-conta="' + id + '">' + totale + '</span></a></li>');
      pillole.push('<a class="pillola" href="#' + id + '" data-indice="' + id + '">' + esc(titolo) + '</a>');
      var html = '<section class="menu-sezione" id="' + id + '" data-sezione="' + id + '"' + (vino ? ' data-vini' : '') + ' aria-labelledby="t-' + id + '">' +
        '<h2 class="menu-sezione__titolo h2" id="t-' + id + '"><span class="accento">' + numero + '</span> ' + esc(titolo) + '</h2>';
      if (s.nota) html += '<p class="testo-s menu-sezione__nota">' + esc(t(s.nota)) + '</p>';
      html += '<div class="avviso menu-sezione__vuoto" data-vuoto hidden>' + ICONA('info') +
        '<div><p class="label" data-vuoto-titolo></p><p class="testo-s">' + esc(m.vuoto ? t(m.vuoto) : VUOTO) + '</p>' +
        '<button class="btn btn--testo" type="button" data-mostra-comunque>' + esc(t('Mostra comunque')) + ICONA('arrow') + '</button></div></div>';
      var conGruppi = s.gruppi.some(function (g) { return g.titolo; });
      s.gruppi.forEach(function (g) {
        if (conGruppi) html += '<div class="menu-gruppo" data-gruppo>' + (g.titolo ? '<p class="occhiello">' + esc(t(g.titolo)) + '</p>' : '');
        html += '<ul class="menu-colonne">' + g.piatti.map(function (p) { return rigaPiatto(p, vino); }).join('') + '</ul>';
        if (conGruppi) html += '</div>';
      });
      corpo.push(html + '</section>');
    });
    boxSezioni.innerHTML = corpo.join('');
    if (boxIndice) boxIndice.innerHTML = indice.join('');
    if (boxPillole) boxPillole.innerHTML = pillole.join('');
    osserva();
    applica();
  }

  /* ---------- Filtro allergeni ---------- */
  function elenco(nomi) {
    // in tedesco i nomi restano maiuscoli
    if (L.lingua !== 'de') nomi = nomi.map(function (n) { return n.toLowerCase(); });
    return L.elenco(nomi);
  }

  function applica() {
    var nomiEsclusi = esclusi.map(function (a) { return NOMI[a]; });

    chip.forEach(function (c) {
      c.setAttribute('aria-pressed', esclusi.indexOf(c.dataset.allergene) !== -1 ? 'true' : 'false');
    });

    var visibiliCibo = 0, totaliCibo = 0;
    document.querySelectorAll('.piatto[data-allergeni]').forEach(function (p) {
      var lista = p.dataset.allergeni ? p.dataset.allergeni.split(',') : [];
      var nascosto = esclusi.some(function (a) { return lista.indexOf(a) !== -1; });
      p.classList.toggle('is-escluso', nascosto);
      if (!p.closest('[data-vini]')) {
        totaliCibo++;
        if (!nascosto) visibiliCibo++;
      }
    });

    sezioni().forEach(function (s) {
      var tutti = s.querySelectorAll('.piatto');
      var visibili = s.querySelectorAll('.piatto:not(.is-escluso)').length;
      document.querySelectorAll('[data-conta="' + s.dataset.sezione + '"]').forEach(function (c) { c.textContent = visibili; });
      document.querySelectorAll('[data-indice="' + s.dataset.sezione + '"]').forEach(function (a) {
        a.classList.toggle('is-vuota', visibili === 0);
      });
      s.querySelectorAll('[data-gruppo]').forEach(function (g) {
        g.hidden = g.querySelectorAll('.piatto:not(.is-escluso)').length === 0 && !s.classList.contains('mostra-tutto');
      });
      var vuoto = s.querySelector('[data-vuoto]');
      var mostraVuoto = esclusi.length > 0 && visibili === 0 && tutti.length > 0;
      if (!mostraVuoto) s.classList.remove('mostra-tutto');
      if (!vuoto) return;
      vuoto.hidden = !mostraVuoto;
      if (mostraVuoto) {
        vuoto.querySelector('[data-vuoto-titolo]').textContent =
          t('{s} della carta è senza {x}', { s: SINGOLARE[s.dataset.sezione] || t('Nessun piatto'), x: elenco(nomiEsclusi) });
        var cosa = s.hasAttribute('data-vini') ? ARTICOLI.vini : (ARTICOLI[s.dataset.sezione] || '');
        vuoto.querySelector('[data-mostra-comunque]').firstChild.textContent =
          (s.classList.contains('mostra-tutto') ? t('Nascondi di nuovo') : cosa ? t('Mostra comunque {c}', { c: cosa }) : t('Mostra comunque')) + ' ';
      }
    });

    if (stato) {
      if (!esclusi.length) {
        stato.textContent = t('Tocca un allergene per nascondere i piatti che lo contengono');
        stato.classList.remove('is-attivo');
      } else {
        stato.classList.add('is-attivo');
        stato.innerHTML = '';
        stato.appendChild(document.createTextNode(t('Senza {x}: {v} piatti su {n}', { x: elenco(nomiEsclusi), v: visibiliCibo, n: totaliCibo }) + '  ·  '));
        var azzera = document.createElement('button');
        azzera.type = 'button';
        azzera.className = 'link-azzera';
        azzera.textContent = t('Azzera filtri');
        azzera.addEventListener('click', function () { esclusi = []; applica(); });
        stato.appendChild(azzera);
      }
    }

    if (attiviMobile) {
      attiviMobile.innerHTML = '';
      esclusi.forEach(function (a) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip';
        b.setAttribute('aria-pressed', 'true');
        b.setAttribute('aria-label', t('Togli {x}', { x: NOMI[a] }));
        b.innerHTML = esc(NOMI[a]) + '<svg class="icona icona--xs" aria-hidden="true"><use href="' + L.icona('x') + '"/></svg>';
        b.addEventListener('click', function () { attiva(a); });
        attiviMobile.appendChild(b);
      });
      // su mobile, con un filtro attivo, l'etichetta lascia spazio agli allergeni scelti; su desktop resta uguale
      var suMobile = window.matchMedia && window.matchMedia('(max-width: 1023px)').matches;
      if (etichettaMobile) etichettaMobile.textContent = esclusi.length && suMobile ? t('Senza:') : t('Nascondi i piatti che contengono');
      bottoneScegli.textContent = esclusi.length ? t('Modifica') : t('Scegli');
    }
  }

  function attiva(a) {
    var i = esclusi.indexOf(a);
    if (i === -1) esclusi.push(a); else esclusi.splice(i, 1);
    applica();
  }

  chip.forEach(function (c) {
    c.addEventListener('click', function () { attiva(c.dataset.allergene); });
  });

  // "Mostra comunque": le sezioni possono essere ridisegnate, quindi un solo ascoltatore sul contenitore
  boxSezioni.addEventListener('click', function (e) {
    var b = e.target.closest('[data-mostra-comunque]');
    if (!b) return;
    b.closest('[data-sezione]').classList.toggle('mostra-tutto');
    applica();
  });

  document.querySelectorAll('[data-azzera]').forEach(function (b) {
    b.addEventListener('click', function () { esclusi = []; applica(); });
  });

  /* Pannello mobile */
  var foglio = document.querySelector('[data-foglio]');
  var sfondo = document.querySelector('[data-foglio-sfondo]');
  function apriFoglio() {
    foglio.hidden = false; sfondo.hidden = false;
    document.body.classList.add('menu-aperto');
    foglio.querySelector('[data-chiudi-allergeni]').focus();
  }
  function chiudiFoglio() {
    if (foglio.hidden) return;
    foglio.hidden = true; sfondo.hidden = true;
    document.body.classList.remove('menu-aperto');
    bottoneScegli.focus();
  }
  if (bottoneScegli) bottoneScegli.addEventListener('click', apriFoglio);
  document.querySelectorAll('[data-chiudi-allergeni]').forEach(function (b) { b.addEventListener('click', chiudiFoglio); });
  if (sfondo) sfondo.addEventListener('click', chiudiFoglio);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') chiudiFoglio(); });

  /* Sezione attiva nell'indice e nelle pillole */
  var osservatore = null;
  var visibili = {};
  function osserva() {
    if (!('IntersectionObserver' in window)) return;
    if (osservatore) osservatore.disconnect();
    visibili = {};
    osservatore = new IntersectionObserver(function (voci) {
      voci.forEach(function (v) { visibili[v.target.id] = v.isIntersecting; });
      var attiva = null;
      sezioni().forEach(function (s) { if (!attiva && visibili[s.id]) attiva = s.id; });
      if (!attiva) return;
      document.querySelectorAll('[data-indice]').forEach(function (a) {
        var on = a.dataset.indice === attiva;
        a.classList.toggle('is-attiva', on);
        if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        if (on && a.classList.contains('pillola') && a.parentElement.scrollWidth > a.parentElement.clientWidth) {
          a.parentElement.scrollTo({ left: a.offsetLeft - 20, behavior: 'smooth' });
        }
      });
    }, { rootMargin: '-35% 0px -55% 0px' });
    sezioni().forEach(function (s) { osservatore.observe(s); });
  }

  osserva();
  applica();

  // Menù dal Foglio: si ridisegna solo se ci sono dati (altrimenti resta quello della pagina)
  if (window.maraDati) {
    var ultimo = '';
    window.maraDati(function (dati) {
      if (!dati.menu || !dati.menu.sezioni || !dati.menu.sezioni.length) return;
      var firma = JSON.stringify(dati.menu);
      if (firma === ultimo) return;
      ultimo = firma;
      disegnaMenu(dati.menu);
      // se si è arrivati con un'ancora (#primi), riportiamo la sezione in vista
      try { var ancora = location.hash && document.querySelector(location.hash); if (ancora) ancora.scrollIntoView(); } catch (e) { /* ancora non valida */ }
    });
  }
})();
