/* Menù: filtro allergeni, sezioni attive, pannello mobile */
(function () {
  'use strict';

  var esclusi = [];
  var chip = document.querySelectorAll('[data-allergene]');
  var piatti = document.querySelectorAll('.piatto[data-allergeni]');
  var sezioni = document.querySelectorAll('[data-sezione]');
  var stato = document.querySelector('[data-filtro-stato]');
  var attiviMobile = document.querySelector('[data-filtro-attivi]');
  var etichettaMobile = document.querySelector('[data-filtro-etichetta-mobile]');
  var bottoneScegli = document.querySelector('[data-apri-allergeni]');

  var NOMI = {};
  chip.forEach(function (c) { NOMI[c.dataset.allergene] = c.childNodes[0].textContent.trim(); });

  var SINGOLARE = {
    antipasti: 'Nessun antipasto', primi: 'Nessun primo', secondi: 'Nessun secondo',
    freddi: 'Nessun piatto freddo', 'contorni-dolci': 'Nessun contorno o dolce',
    bevande: 'Nessuna bevanda', vini: 'Nessun vino'
  };

  function elenco(nomi) {
    nomi = nomi.map(function (n) { return n.toLowerCase(); });
    if (nomi.length < 2) return nomi.join('');
    return nomi.slice(0, -1).join(', ') + ' e ' + nomi[nomi.length - 1];
  }

  function applica() {
    var nomiEsclusi = esclusi.map(function (a) { return NOMI[a]; });

    chip.forEach(function (c) {
      c.setAttribute('aria-pressed', esclusi.indexOf(c.dataset.allergene) !== -1 ? 'true' : 'false');
    });

    var visibiliCibo = 0, totaliCibo = 0;
    piatti.forEach(function (p) {
      var lista = p.dataset.allergeni ? p.dataset.allergeni.split(',') : [];
      var nascosto = esclusi.some(function (a) { return lista.indexOf(a) !== -1; });
      p.classList.toggle('is-escluso', nascosto);
      if (!p.closest('[data-vini]')) {
        totaliCibo++;
        if (!nascosto) visibiliCibo++;
      }
    });

    sezioni.forEach(function (s) {
      var tutti = s.querySelectorAll('.piatto');
      var visibili = s.querySelectorAll('.piatto:not(.is-escluso)').length;
      var conta = document.querySelectorAll('[data-conta="' + s.dataset.sezione + '"]');
      conta.forEach(function (c) { c.textContent = visibili; });
      document.querySelectorAll('[data-indice="' + s.dataset.sezione + '"]').forEach(function (a) {
        a.classList.toggle('is-vuota', visibili === 0);
      });
      s.querySelectorAll('[data-gruppo]').forEach(function (g) {
        g.hidden = g.querySelectorAll('.piatto:not(.is-escluso)').length === 0 && !s.classList.contains('mostra-tutto');
      });
      var vuoto = s.querySelector('[data-vuoto]');
      var mostraVuoto = esclusi.length > 0 && visibili === 0 && tutti.length > 0;
      if (!mostraVuoto) s.classList.remove('mostra-tutto');
      vuoto.hidden = !mostraVuoto;
      if (mostraVuoto) {
        vuoto.querySelector('[data-vuoto-titolo]').textContent =
          (SINGOLARE[s.dataset.sezione] || 'Nessun piatto') + ' della carta è senza ' + elenco(nomiEsclusi);
        var titoloSez = s.querySelector('.menu-sezione__titolo').textContent.replace(/^[ivx]+\.\s*/, '').toLowerCase();
        vuoto.querySelector('[data-mostra-comunque]').firstChild.textContent =
          s.classList.contains('mostra-tutto') ? 'Nascondi di nuovo ' : 'Mostra comunque ' + (s.dataset.sezione === 'vini' ? 'i vini' : 'i ' + titoloSez) + ' ';
      }
    });

    if (stato) {
      if (!esclusi.length) {
        stato.textContent = 'Tocca un allergene per nascondere i piatti che lo contengono';
        stato.classList.remove('is-attivo');
      } else {
        stato.classList.add('is-attivo');
        stato.innerHTML = '';
        stato.appendChild(document.createTextNode('Senza ' + elenco(nomiEsclusi) + ': ' + visibiliCibo + ' piatti su ' + totaliCibo + '  ·  '));
        var azzera = document.createElement('button');
        azzera.type = 'button';
        azzera.className = 'link-azzera';
        azzera.textContent = 'Azzera filtri';
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
        b.setAttribute('aria-label', 'Togli ' + NOMI[a]);
        b.innerHTML = NOMI[a] + '<svg class="icona icona--xs" aria-hidden="true"><use href="assets/icons.svg#x"/></svg>';
        b.addEventListener('click', function () { attiva(a); });
        attiviMobile.appendChild(b);
      });
      etichettaMobile.textContent = esclusi.length ? 'Senza:' : 'Filtra allergeni';
      bottoneScegli.textContent = esclusi.length ? 'Modifica' : 'Scegli';
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

  document.querySelectorAll('[data-mostra-comunque]').forEach(function (b) {
    b.addEventListener('click', function () {
      b.closest('[data-sezione]').classList.toggle('mostra-tutto');
      applica();
    });
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
  var link = document.querySelectorAll('[data-indice]');
  if ('IntersectionObserver' in window) {
    var visibili = {};
    var oss = new IntersectionObserver(function (voci) {
      voci.forEach(function (v) { visibili[v.target.id] = v.isIntersecting; });
      var attiva = null;
      sezioni.forEach(function (s) { if (!attiva && visibili[s.id]) attiva = s.id; });
      if (!attiva) return;
      link.forEach(function (a) {
        var on = a.dataset.indice === attiva;
        a.classList.toggle('is-attiva', on);
        if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        if (on && a.classList.contains('pillola') && a.parentElement.scrollWidth > a.parentElement.clientWidth) {
          a.parentElement.scrollTo({ left: a.offsetLeft - 20, behavior: 'smooth' });
        }
      });
    }, { rootMargin: '-35% 0px -55% 0px' });
    sezioni.forEach(function (s) { oss.observe(s); });
  }

  applica();
})();
