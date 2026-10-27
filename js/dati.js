/* Orari, chiusure e menù gestiti dal Foglio Google del ristorante.
   Il sito parte dagli orari predefiniti (o dagli ultimi dati salvati nel browser),
   poi chiede allo script i dati aggiornati e avvisa le pagine se sono cambiati. */
(function () {
  'use strict';

  var CHIAVE = 'mara-dati';
  var VECCHI_DOPO = 20 * 1000; // a ogni pagina (al massimo ogni 20 secondi) si chiedono i dati aggiornati
  var L = window.maraL; // lingua della pagina (js/lingua.js)
  var GIORNI = L.GIORNI;
  var MESI = L.MESI;
  var ORDINE = [1, 2, 3, 4, 5, 6, 0];

  function orarioStandard(g) { return g === 2 ? { aperto: false } : { aperto: true, dalle: '12:00', alle: '14:00', ultima: '13:30' }; }
  var PREDEFINITI = { orari: [0, 1, 2, 3, 4, 5, 6].map(orarioStandard), chiusure: [], menu: null };

  /* ---------- Caricamento ---------- */
  function leggiSalvati() {
    try { var v = JSON.parse(localStorage.getItem(CHIAVE) || 'null'); return v && v.dati && v.dati.orari ? v : null; } catch (e) { return null; }
  }
  function salva(dati) {
    try { localStorage.setItem(CHIAVE, JSON.stringify({ t: Date.now(), dati: dati })); } catch (e) { /* storage non disponibile */ }
  }
  function valido(d) { return d && Array.isArray(d.orari) && d.orari.length === 7 && Array.isArray(d.chiusure); }

  var salvati = leggiSalvati();
  var attuali = salvati ? salvati.dati : PREDEFINITI;
  var ascoltatori = [];
  var richiesta = null;

  function scarica() {
    if (richiesta || !window.MARA_SERVIZIO || !window.fetch) return;
    if (salvati && Date.now() - salvati.t < VECCHI_DOPO) return;
    richiesta = fetch(window.MARA_SERVIZIO + '?dati=sito', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (r) {
        if (!r || !r.ok || !valido(r.dati)) return;
        var prima = JSON.stringify(Object.assign({}, attuali, { aggiornato: '' }));
        var dopo = JSON.stringify(Object.assign({}, r.dati, { aggiornato: '' }));
        salva(r.dati);
        if (prima === dopo) return;
        attuali = r.dati;
        ascoltatori.forEach(function (f) { try { f(attuali, 'rete'); } catch (e) { /* una pagina non blocca le altre */ } });
      })
      .catch(function () { /* restano i dati che abbiamo */ });
  }

  /** Chiama subito f con i dati disponibili e di nuovo se dal Foglio arrivano dati diversi */
  window.maraDati = function (f) {
    ascoltatori.push(f);
    f(attuali, salvati ? 'salvati' : 'predefiniti');
    scarica();
  };

  /* ---------- Utilità sulle date (stringhe aaaa-mm-gg) ---------- */
  function daISO(iso) { var p = iso.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])); }
  function piuGiorni(iso, n) { var d = daISO(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function giornoSettimana(iso) { return daISO(iso).getUTCDay(); }
  function minuti(o) { var p = String(o).split(':').map(Number); return p[0] * 60 + (p[1] || 0); }
  function ora(m) { return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
  function maiuscola(t) { return t.charAt(0).toUpperCase() + t.slice(1); }

  var O = {
    GIORNI: GIORNI,
    MESI: MESI,
    piuGiorni: piuGiorni,
    giornoSettimana: giornoSettimana,
    maiuscola: maiuscola,

    /** "10 agosto" (con l'anno se diverso da quello di riferimento) */
    data: function (iso, annoRif) {
      var d = daISO(iso);
      return L.data(d.getUTCDate(), d.getUTCMonth(), annoRif && String(d.getUTCFullYear()) !== String(annoRif).slice(0, 4) ? d.getUTCFullYear() : '');
    },
    /** "lunedì 25 agosto" */
    giornoData: function (iso, annoRif) { return L.giornoData(giornoSettimana(iso), O.data(iso, annoRif)); },

    chiusura: function (dati, iso) {
      for (var i = 0; i < dati.chiusure.length; i++) {
        var c = dati.chiusure[i];
        if (c.dal <= iso && iso <= c.al) return c;
      }
      return null;
    },
    /** Orario di un giorno preciso: tiene conto delle chiusure */
    giorno: function (dati, iso) {
      var c = O.chiusura(dati, iso);
      if (c) return { aperto: false, chiusura: c };
      return dati.orari[giornoSettimana(iso)] || { aperto: false };
    },
    /** Orari prenotabili: ogni mezz'ora da "dalle" a "ultima" */
    prenotabili: function (o) {
      if (!o || !o.aperto) return [];
      var lista = [];
      for (var m = minuti(o.dalle); m <= minuti(o.ultima); m += 30) lista.push(ora(m));
      return lista;
    },
    /** Primo giorno di apertura a partire da iso (incluso) */
    prossimaApertura: function (dati, iso) {
      for (var i = 0; i < 400; i++) {
        var g = piuGiorni(iso, i);
        if (O.giorno(dati, g).aperto) return g;
      }
      return null;
    },
    fascia: function (o) { return o.dalle + '–' + o.alle; },
    minuti: minuti,

    /** Righe per le tabelle orari: giorni consecutivi con lo stesso orario sono uniti */
    righe: function (dati, separati) {
      var righe = [];
      ORDINE.forEach(function (g) {
        var o = dati.orari[g];
        var testo = o.aperto ? o.dalle + ' – ' + o.alle : L.t('Chiuso');
        var ultima = righe[righe.length - 1];
        if (!separati && ultima && ultima.testo === testo) ultima.giorni.push(g);
        else righe.push({ giorni: [g], testo: testo, chiuso: !o.aperto });
      });
      righe.forEach(function (r) {
        var a = maiuscola(GIORNI[r.giorni[0]]);
        r.etichetta = r.giorni.length === 1 ? a : a + ' – ' + maiuscola(GIORNI[r.giorni[r.giorni.length - 1]]);
      });
      return righe;
    },

    /** Riassunto della settimana: fascia comune (se c'è) e giorni di chiusura */
    riassunto: function (dati) {
      var aperti = [], chiusi = [], fasce = {};
      ORDINE.forEach(function (g) {
        var o = dati.orari[g];
        if (o.aperto) { aperti.push(g); fasce[O.fascia(o)] = true; } else chiusi.push(g);
      });
      var lista = Object.keys(fasce);
      var elenco = L.elenco(chiusi.map(function (g) { return GIORNI[g]; }));
      return {
        fascia: lista.length === 1 ? lista[0] : '',               // "12:00–14:00"
        chiusi: chiusi.length ? L.chiusi(chiusi) : '',            // "martedì chiuso"
        tuttiAperti: !chiusi.length,
        elencoChiusi: elenco,
        giorniChiusi: chiusi,
        nChiusi: chiusi.length
      };
    },

    /** Chiusura in corso o in arrivo entro "giorni" giorni */
    chiusuraVicina: function (dati, oggi, giorni) {
      var limite = piuGiorni(oggi, giorni || 30);
      for (var i = 0; i < dati.chiusure.length; i++) {
        var c = dati.chiusure[i];
        if (c.al >= oggi && c.dal <= limite) return c;
      }
      return null;
    },
    /** "dal 10 al 24 agosto" · "sabato 15 agosto" */
    periodo: function (c, oggi) {
      if (c.dal === c.al) return O.giornoData(c.dal, oggi);
      var stessoMese = c.dal.slice(0, 7) === c.al.slice(0, 7);
      return L.t('dal {a} al {b}', { a: stessoMese ? L.numero(daISO(c.dal).getUTCDate()) : O.data(c.dal, c.al), b: O.data(c.al, oggi) });
    }
  };

  window.maraOrari = O;
})();
