/* Menù pausa pranzo: il menù scritto nella pagina è quello di partenza; se il Foglio del ristorante
   (scheda «Pausa pranzo») ha piatti o prezzo diversi, la pagina viene ridisegnata con i dati del Foglio.
   Dati attesi da …/exec?dati=sito:  pranzo: { prezzo: "15,00 €", sezioni: [{ titolo, titolo_en, titolo_de,
   piatti: [{ nome, nome_en, nome_de, allergeni: [], testo_allergeni, testo_allergeni_en, testo_allergeni_de }] }] }
   Le traduzioni _en/_de arrivano dal Foglio (colonne Inglese/Tedesco); se mancano si usa il dizionario del sito. */
(function () {
  'use strict';

  var L = window.maraL;
  var t = L.t;
  var box = document.querySelector('[data-pranzo-colonne]');
  var ROMANI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

  function slug(s) { return String(s).toLowerCase().replace(/à/g, 'a').replace(/[^a-z]+/g, '-').replace(/^-+|-+$/g, ''); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /** "15,00 €", "15" o 15 -> "15 €" (i centesimi restano se non sono zero) */
  function prezzo(p) {
    var s = String(p == null ? '' : p).replace('€', '').trim().replace('.', ',');
    if (!s) return '';
    if (/^\d+$/.test(s)) s += ',00';
    return s.replace(/,00$/, '') + ' €';
  }

  function rigaPiatto(p) {
    var allergeni = p.allergeni || [];
    var testo = L.dalFoglio(p, 'testo_allergeni') || allergeni.map(function (a) { return t(a); }).join(' · ');
    var nome = L.dalFoglio(p, 'nome', 'piatto:');
    return '<li class="piatto" data-allergeni="' + esc(allergeni.map(slug).join(',')) + '">' +
      '<div class="piatto__testa"><h3 class="piatto-nome">' + esc(nome) + '</h3></div>' +
      (testo ? '<p class="piatto__allergeni"><span class="visually-hidden">' + t('Allergeni:') + ' </span>' + esc(testo) + '</p>' : '') +
      '</li>';
  }

  function disegna(pranzo) {
    if (box) {
      box.innerHTML = pranzo.sezioni.map(function (s, i) {
        var id = 'pranzo-' + (slug(s.titolo) || 'sezione-' + (i + 1));
        var piatti = s.piatti || [].concat.apply([], (s.gruppi || []).map(function (g) { return g.piatti || []; }));
        return '<section class="pranzo-sezione" id="' + id + '" aria-labelledby="t-' + id + '">' +
          '<h2 class="menu-sezione__titolo h3" id="t-' + id + '"><span class="accento">' + (ROMANI[i] || i + 1) + '.</span> ' + esc(L.dalFoglio(s, 'titolo')) + '</h2>' +
          '<ul class="pranzo-piatti">' + piatti.map(rigaPiatto).join('') + '</ul></section>';
      }).join('');
    }
  }

  if (!window.maraDati) return;
  var ultimo = '';
  window.maraDati(function (dati) {
    var p = dati.pranzo;
    if (!p) return;
    var firma = JSON.stringify(p);
    if (firma === ultimo) return;
    ultimo = firma;
    var cifra = prezzo(p.prezzo);
    if (cifra) document.querySelectorAll('[data-pranzo-prezzo]').forEach(function (el) { el.textContent = cifra; });
    var sezioni = (p.sezioni || []).filter(function (s) {
      return (s.piatti && s.piatti.length) || (s.gruppi && s.gruppi.some(function (g) { return g.piatti && g.piatti.length; }));
    });
    if (sezioni.length) disegna({ sezioni: sezioni });
  });
})();
