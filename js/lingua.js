/* Lingua della pagina (it, en, de): nomi di giorni e mesi, frasi che cambiano forma da lingua a lingua
   e traduzione dei testi scritti dagli script. Le traduzioni arrivano da js/lingua-en.js e js/lingua-de.js
   (generati da _sorgenti/build.py a partire da _sorgenti/lingue/testi.py). */
(function () {
  'use strict';

  var html = document.documentElement;
  var lingua = (html.getAttribute('lang') || 'it').slice(0, 2);
  var radice = html.getAttribute('data-radice') || '';
  var T = window.MARA_T || {};

  /** Traduce un testo italiano; {nome} viene sostituito con v.nome */
  function t(testo, v) {
    var r = lingua === 'it' || T[testo] == null ? testo : T[testo];
    if (v) r = r.replace(/\{(\w+)\}/g, function (m, k) { return v[k] != null ? v[k] : m; });
    return r;
  }
  function maiuscola(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  var LINGUE = {
    it: {
      GIORNI: ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'],
      GIORNI_BREVI: ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'],
      MESI: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
      e: ' e ',
      numero: function (d) { return String(d); },
      data: function (d, m, anno) { return d + ' ' + this.MESI[m] + (anno ? ' ' + anno : ''); },
      giornoData: function (g, data, breve) { return (breve ? this.GIORNI_BREVI : this.GIORNI)[g] + ' ' + data; },
      /** "martedì chiuso" · "lunedì e martedì chiusi" */
      chiusi: function (g) { return elenco(g.map(this.nome, this)) + (g.length > 1 ? ' chiusi' : ' chiuso'); },
      /** "di martedì" */
      diGiorni: function (g) { return 'di ' + elenco(g.map(this.nome, this)); },
      nome: function (g) { return this.GIORNI[g]; },
      frase: function (r, dalleAlle) {
        return 'Aperti ' + (r.tuttiAperti || r.nChiusi === 1 ? 'tutti i giorni ' : '') + dalleAlle +
          (r.chiusi ? ', ' + (r.nChiusi === 1 ? 'il ' : '') + r.elencoChiusi + ' siamo chiusi.' : '.');
      },
      footerChiusi: function (pezzi) { return maiuscola(elenco(pezzi)) + ' chiuso'; },
      notaCalendario: function (g) {
        var n = this.GIORNI[g];
        return ({ 6: 'I sabati', 0: 'Le domeniche' }[g] || 'I ' + n) + ' sono barrat' + (g === 0 ? 'e' : 'i') + ': siamo chiusi.';
      },
      notaRiepilogo: function (g) { return (g === 0 ? 'La domenica' : 'Il ' + this.GIORNI[g]) + ' siamo chiusi: quei giorni non sono selezionabili.'; },
      persone: function (n) { return n + (n === 1 ? ' persona' : ' persone'); }
    },
    en: {
      GIORNI: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      PLURALI: ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'],
      GIORNI_BREVI: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      MESI: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      e: ' and ',
      numero: function (d) { return String(d); },
      data: function (d, m, anno) { return d + ' ' + this.MESI[m] + (anno ? ' ' + anno : ''); },
      giornoData: function (g, data, breve) { return (breve ? this.GIORNI_BREVI : this.GIORNI)[g] + ' ' + data; },
      chiusi: function (g) { return 'closed on ' + elenco(g.map(function (x) { return this.PLURALI[x]; }, this)); },
      diGiorni: function (g) { return 'on ' + elenco(g.map(function (x) { return this.PLURALI[x]; }, this)); },
      nome: function (g) { return this.GIORNI[g]; },
      frase: function (r) {
        return 'Open ' + (r.tuttiAperti || r.nChiusi === 1 ? 'every day ' : '') +
          (r.fascia ? 'from ' + r.fascia.replace('–', ' to ') : 'at lunchtime') + (r.chiusi ? ', ' + r.chiusi + '.' : '.');
      },
      footerChiusi: function (pezzi, giorni) {
        return giorni ? 'Closed on ' + elenco(giorni.map(function (x) { return this.PLURALI[x]; }, this)) : 'Closed: ' + elenco(pezzi);
      },
      notaCalendario: function (g) { return this.PLURALI[g] + ' are crossed out: we are closed.'; },
      notaRiepilogo: function (g) { return 'We are closed on ' + this.PLURALI[g] + ': those days can’t be selected.'; },
      persone: function (n) { return n + (n === 1 ? ' person' : ' people'); }
    },
    de: {
      GIORNI: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
      PLURALI: ['Sonntage', 'Montage', 'Dienstage', 'Mittwoche', 'Donnerstage', 'Freitage', 'Samstage'],
      AVVERBI: ['sonntags', 'montags', 'dienstags', 'mittwochs', 'donnerstags', 'freitags', 'samstags'],
      GIORNI_BREVI: ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'],
      MESI: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
      e: ' und ',
      numero: function (d) { return d + '.'; },
      data: function (d, m, anno) { return d + '. ' + this.MESI[m] + (anno ? ' ' + anno : ''); },
      giornoData: function (g, data, breve) { return (breve ? this.GIORNI_BREVI : this.GIORNI)[g] + ', ' + data; },
      chiusi: function (g) { return elenco(g.map(function (x) { return this.AVVERBI[x]; }, this)) + ' Ruhetag'; },
      diGiorni: function (g) { return elenco(g.map(function (x) { return this.AVVERBI[x]; }, this)); },
      nome: function (g) { return this.GIORNI[g]; },
      frase: function (r) {
        return (r.tuttiAperti || r.nChiusi === 1 ? 'Täglich geöffnet ' : 'Geöffnet ') +
          (r.fascia ? 'von ' + r.fascia.replace('–', ' bis ') : 'mittags') + (r.chiusi ? ', ' + r.chiusi + '.' : '.');
      },
      footerChiusi: function (pezzi) { return elenco(pezzi) + ' Ruhetag'; },
      notaCalendario: function (g) { return this.PLURALI[g] + ' sind durchgestrichen: Ruhetag.'; },
      notaRiepilogo: function (g) { return maiuscola(this.AVVERBI[g]) + ' ist Ruhetag: Diese Tage sind nicht wählbar.'; },
      persone: function (n) { return n + (n === 1 ? ' Person' : ' Personen'); }
    }
  };
  var L = LINGUE[lingua] || LINGUE.it;

  function elenco(l) { return l.length < 2 ? l.join('') : l.slice(0, -1).join(', ') + L.e + l[l.length - 1]; }

  L.lingua = lingua;
  L.radice = radice;
  L.t = t;
  L.elenco = elenco;
  L.maiuscola = maiuscola;
  /** Percorso di un'icona dello sprite, valido anche dalle pagine in /en/ e /de/ */
  L.icona = function (nome) { return radice + 'assets/icons.svg#' + nome; };
  window.maraL = L;
})();
