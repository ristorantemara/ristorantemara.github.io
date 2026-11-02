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
  function toast(testo, errore) {
    var t = $('#toast');
    t.className = 'admin-toast' + (errore ? ' is-errore' : '');
    t.innerHTML = icona(errore ? 'alert' : 'check') + '<span></span>';
    t.querySelector('span').textContent = testo;
    t.hidden = false;
    clearTimeout(timerToast);
    timerToast = setTimeout(function () { t.hidden = true; }, errore ? 6000 : 3200);
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
        S.dati = r;
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

  /* Intestazione di una vista con titolo, sottotitolo e (facoltativo) pulsante Aggiorna */
  function testa(titolo, accento, sotto, aggiorna) {
    var html = '<div class="admin-testa"><div class="admin-testa__testo"><h1 tabindex="-1">' + esc(titolo) +
      (accento ? ' <span class="accento">' + esc(accento) + '</span>' : '') + '</h1>' +
      (sotto ? '<p class="testo-m">' + esc(sotto) + '</p>' : '') + '</div>' +
      (aggiorna ? '<button class="btn btn--secondario" type="button" data-aggiorna>Aggiorna</button>' : '') + '</div>';
    return html;
  }
  function filtri(voci, attivo, attr) {
    return '<div class="admin-filtri"><div class="menu-tipi" role="group">' + voci.map(function (v) {
      return '<button type="button" ' + attr + '="' + v[0] + '" aria-pressed="' + (v[0] === attivo) + '">' + esc(v[1]) +
        (v[2] != null ? ' <span class="menu-tipi__giorni">' + v[2] + '</span>' : '') + '</button>';
    }).join('') + '</div></div>';
  }
  function collegaAggiorna(v) {
    var b = $('[data-aggiorna]', v);
    if (b) b.addEventListener('click', function () {
      b.classList.add('is-caricamento'); b.textContent = 'Aggiorno…';
      carica(true).then(function () { toast('Dati aggiornati.'); });
    });
  }

  /* ==========================================================================
     Prenotazioni
     ========================================================================== */
  function pillStato(stato) {
    var cls = stato === 'In attesa' ? 'attesa' : stato === 'Confermata' ? 'ok' : 'no';
    return '<span class="admin-stato-pill admin-stato-pill--' + cls + '">' + esc(stato === 'In attesa' ? 'Da confermare' : stato) + '</span>';
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

    var html = testa('Prenotazioni', '', attesa.length
      ? (attesa.length === 1 ? 'C’è 1 richiesta da confermare.' : 'Ci sono ' + attesa.length + ' richieste da confermare.')
      : 'Nessuna richiesta da confermare.', true);
    html += filtri([['attesa', 'Da confermare', attesa.length], ['arrivo', 'In arrivo', arrivo.length], ['altre', 'Archivio', null]], S.filtroPren, 'data-filtro');

    if (!lista.length) {
      html += '<p class="admin-vuoto">' + ({ attesa: 'Tutto fatto: nessuna prenotazione aspetta una risposta.', arrivo: 'Nessuna prenotazione confermata nei prossimi giorni.', altre: 'Ancora niente qui.' })[S.filtroPren] + '</p>';
    } else {
      html += '<div class="admin-elenco">';
      var giorno = null;
      lista.forEach(function (p) {
        if (p.data !== giorno) {
          if (giorno !== null) html += '</div>';
          giorno = p.data;
          var tot = S.filtroPren === 'arrivo' ? coperti(p.data) : 0;
          html += '<div class="admin-giorno"><h2 class="admin-giorno__titolo">' + esc(quandoGiorno(p.data)) + (tot ? ' · ' + tot + ' coperti' : '') + '</h2>';
        }
        html += cardPrenotazione(p);
      });
      html += '</div></div>';
    }
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
  }

  function cardPrenotazione(p) {
    var attesa = p.stato === 'In attesa';
    return '<article class="admin-card' + (attesa ? ' is-attesa' : '') + (p.stato === 'Rifiutata' || p.stato === 'Disdetta' ? ' is-spenta' : '') + '">' +
      '<div class="admin-card__testa"><h3 class="admin-card__titolo">' + esc(p.nome) + '</h3>' + pillStato(p.stato) + '</div>' +
      '<p class="admin-card__meta">' +
        '<span>' + icona('clock') + 'Ore ' + esc(p.ora) + '</span>' +
        '<span>' + icona('users') + esc(p.persone) + (p.persone === 1 ? ' persona' : ' persone') + '</span>' +
        (LINGUE[p.lingua] ? '<span>' + icona('globe') + esc(LINGUE[p.lingua]) + '</span>' : '') +
        (p.creata ? '<span>Arrivata ' + esc(oraDa(p.creata)) + '</span>' : '') +
      '</p>' +
      (p.note ? '<p class="admin-card__note">' + esc(p.note) + '</p>' : '') +
      '<div class="admin-card__contatti">' +
        (p.telefono ? '<a class="chip admin-contatto" href="' + esc(telefonoLink(p.telefono)) + '">' + icona('phone') + esc(p.telefono) + '</a>' : '') +
        (p.email ? '<a class="chip admin-contatto" href="mailto:' + esc(p.email) + '">' + icona('mail') + esc(p.email) + '</a>' : '') +
      '</div>' +
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

  function confermaRifiuto(p) {
    apriPannello('Rifiutare la prenotazione?', function (form) {
      form.innerHTML =
        '<p class="testo-m"><strong>' + esc(p.nome) + '</strong>, ' + esc(giornoData(p.data)) + ' ore ' + esc(p.ora) + ', ' + esc(p.persone) + ' pers.</p>' +
        '<p class="testo-s">Il cliente riceverà una mail che lo invita a chiamarvi per scegliere un’altra data.</p>' +
        '<div class="admin-pannello__azioni">' +
          '<button class="btn btn--rifiuta" type="submit">Rifiuta e avvisa il cliente' + icona('x') + '</button>' +
          '<button class="btn btn--secondario" type="button" data-chiudi>Annulla</button>' +
        '</div>';
      form.onsubmit = function (ev) {
        ev.preventDefault();
        var b = $('[type="submit"]', form);
        decidi(p, 'rifiuta', b).then(function (ok) { if (ok) chiudiPannello(); });
      };
    });
  }

  /* ==========================================================================
     Richieste (gruppi e cerimonie)
     ========================================================================== */
  function vistaRichieste(v) {
    var o = oggi();
    var tutte = S.dati.richieste;
    var prossime = tutte.filter(function (r) { return !r.data || r.data >= o; }).sort(function (a, b) { return String(a.data).localeCompare(String(b.data)); });
    var passate = tutte.filter(function (r) { return r.data && r.data < o; }).sort(function (a, b) { return String(b.data).localeCompare(String(a.data)); });
    var lista = S.filtroRich === 'prossime' ? prossime : passate;

    var html = testa('Richieste', '', 'Preventivi per gruppi e cerimonie arrivati dal sito. Rispondete per telefono o per mail.', true);
    html += filtri([['prossime', 'Prossime', prossime.length], ['passate', 'Passate', null]], S.filtroRich, 'data-filtro');
    if (!lista.length) {
      html += '<p class="admin-vuoto">' + (S.filtroRich === 'prossime' ? 'Nessuna richiesta per le prossime date.' : 'Ancora niente qui.') + '</p>';
    } else {
      html += '<div class="admin-elenco">' + lista.map(function (r) {
        var righe = [];
        if (r.referente) righe.push(['Referente', r.referente]);
        if (r.occasione) righe.push(['Occasione', r.occasione]);
        if (LINGUE[r.lingua]) righe.push(['Lingua', LINGUE[r.lingua] + ' — se potete rispondete in ' + LINGUE[r.lingua].toLowerCase()]);
        if (r.ricevuta) righe.push(['Ricevuta', oraDa(r.ricevuta)]);
        return '<article class="admin-card">' +
          '<div class="admin-card__testa"><h3 class="admin-card__titolo">' + esc(r.nome) + '</h3><span class="admin-stato-pill">' + esc(r.tipo) + '</span></div>' +
          '<p class="admin-card__meta"><span>' + icona('calendar') + esc(maiuscola(giornoData(r.data))) + '</span>' +
          (r.persone ? '<span>' + icona('users') + esc(r.persone) + ' persone</span>' : '') + '</p>' +
          (r.note ? '<p class="admin-card__note">' + esc(r.note) + '</p>' : '') +
          (righe.length ? '<dl>' + righe.map(function (x) { return '<dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd>'; }).join('') + '</dl>' : '') +
          '<div class="admin-card__contatti">' +
            (r.telefono ? '<a class="chip admin-contatto" href="' + esc(telefonoLink(r.telefono)) + '">' + icona('phone') + esc(r.telefono) + '</a>' : '') +
            (r.email ? '<a class="chip admin-contatto" href="mailto:' + esc(r.email) + '">' + icona('mail') + esc(r.email) + '</a>' : '') +
          '</div></article>';
      }).join('') + '</div>';
    }
    v.innerHTML = html;
    $$('[data-filtro]', v).forEach(function (b) {
      b.addEventListener('click', function () { S.filtroRich = b.getAttribute('data-filtro'); disegna(); });
    });
    collegaAggiorna(v);
  }

  /* ==========================================================================
     Salvataggio delle schede del Foglio
     ========================================================================== */
  function scheda(k) { return S.dati.schede[k]; }

  /** modifiche: { menu: righeNuove, ... } · extra: { pranzo: { prezzo } } */
  function salva(modifiche, extra) {
    var schede = {};
    Object.keys(modifiche).forEach(function (k) {
      schede[k] = Object.assign({ versione: scheda(k).versione, righe: modifiche[k] }, (extra && extra[k]) || {});
    });
    S.occupato = true;
    return chiama('salva', { schede: schede })
      .then(function (r) {
        if (r.ok) {
          Object.keys(r.schede).forEach(function (k) { S.dati.schede[k] = r.schede[k]; });
          toast('Salvato: sul sito tra pochi secondi.');
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
  function apriPannello(titolo, prepara) {
    ultimoFocus = document.activeElement;
    $('#pannello-titolo').textContent = titolo;
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
    var id = 'c' + (++nCampo);
    var etichetta = '<label class="campo__etichetta" for="' + id + '">' + esc(c.etichetta) + (c.facoltativo ? ' <span class="opz">(facoltativo)</span>' : '') + '</label>';
    var aiuto = c.aiuto ? '<p class="campo__aiuto">' + esc(c.aiuto) + '</p>' : '';
    var errore = '<p class="campo__errore">' + icona('alert') + '<span></span></p>';
    if (c.tipo === 'si') {
      return '<div class="campo admin-campo-riga" data-campo="' + c.k + '"><span class="campo__etichetta" id="' + id + '-e">' + esc(c.etichetta) + '</span>' +
        interruttore(valore === true, c.testoSi || '', 'id="' + id + '" aria-labelledby="' + id + '-e"') + '</div>';
    }
    if (c.tipo === 'allergeni') return campoAllergeni(c, valore, id);
    var attr = 'class="campo__input" id="' + id + '" name="' + c.k + '"' + (c.facoltativo ? '' : ' required') + (c.max ? ' maxlength="' + c.max + '"' : '');
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
        return '<button type="button" class="chip" data-allergene="' + esc(a) + '" aria-pressed="' + (scelti.indexOf(a) !== -1) + '">' + icona('check', 'icona--xs') + esc(a) + '</button>';
      }).join('') + '</div>' +
      '<label class="campo__etichetta" for="' + id + '">Precisazioni <span class="opz">(facoltativo)</span></label>' +
      '<input class="campo__input" id="' + id + '" type="text" value="' + esc(altro) + '" placeholder="Es. Latte (ai formaggi), Chiedi al personale" autocomplete="off">' +
      '<p class="campo__aiuto">Un allergene con una nota si scrive qui, così: Latte (ai formaggi).</p></fieldset>';
  }

  function collegaCampi(form) {
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
    apriPannello(o.titolo, function (form) {
      var vicini = !nuova && o.gruppo ? righe.map(function (r, i) { return i; }).filter(function (i) { return o.gruppo(righe[i]) === o.gruppo(riga); }) : [];
      var pos = vicini.indexOf(o.indice);
      form.innerHTML = o.campi.map(function (c) { return campo(c, riga[c.k]); }).join('') +
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

      function invia(nuoveRighe, b) {
        if (S.occupato) return;
        $$('button', form).forEach(function (x) { x.disabled = true; });
        if (b) b.classList.add('is-caricamento');
        var mod = o.dopo ? o.dopo(nuoveRighe, riga) : (function () { var m = {}; m[o.k] = nuoveRighe; return m; })();
        salva(mod).then(function (ok) {
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
        invia(copiaRighe, $('[type="submit"]', form));
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
        var copiaRighe = righe.slice(); copiaRighe.splice(o.indice, 1);
        invia(copiaRighe, el);
      });
    });
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
        salva(m).then(function () { disegna(); });
      });
    });
  }

  /* ==========================================================================
     Menù
     ========================================================================== */
  function vistaMenu(v) {
    var sotto = { carta: 'Alla carta', pranzo: 'Pausa pranzo', feste: 'Feste', evidenza: 'In evidenza' };
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
  function campiCarta(righe) {
    return [
      { k: 'sezione', etichetta: 'Sezione', suggerimenti: valoriUnici(righe, 'sezione'), aiuto: 'Scegline una o scrivi un nome nuovo per creare una sezione.', max: 60 },
      { k: 'gruppo', etichetta: 'Gruppo', facoltativo: true, suggerimenti: valoriUnici(righe, 'gruppo'), aiuto: 'Solo per dividere una sezione (es. Vini bianchi, Vini rossi).', max: 60 },
      { k: 'piatto', etichetta: 'Piatto', max: 120, esempio: 'Tortellini di Valeggio burro e salvia' },
      { k: 'dettaglio', etichetta: 'Dettaglio', facoltativo: true, max: 160, aiuto: 'Una riga sotto il nome (ingredienti, cantina…).' },
      { k: 'prezzo', etichetta: 'Prezzo', facoltativo: true, max: 30, esempio: '12,00 €' },
      { k: 'allergeni', etichetta: 'Allergeni', tipo: 'allergeni' },
      { k: 'visibile', etichetta: 'Visibile sul sito', tipo: 'si' }
    ];
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
      var visibili = s.righe.filter(function (i) { return righe[i].piatto && righe[i].visibile; }).length;
      html += '<section class="admin-sezione"><div class="admin-sezione__testa"><h2 class="admin-sezione__titolo">' + esc(s.titolo) +
        '<span class="accento">' + visibili + ' sul sito</span></h2></div>';
      var gruppo = null;
      s.righe.forEach(function (i) {
        var r = righe[i];
        if (!r.piatto) { html += rigaElenco(i, 'Nota: ' + r.dettaglio, '', '', r.visibile, true); return; }
        if (r.gruppo !== gruppo && r.gruppo) html += '<p class="admin-gruppo">' + esc(r.gruppo) + '</p>';
        gruppo = r.gruppo;
        html += rigaElenco(i, r.piatto, [r.dettaglio, r.allergeni].filter(Boolean).join(' · '), r.prezzo, r.visibile, true);
      });
      html += '<button class="btn btn--testo admin-aggiungi" type="button" data-aggiungi="' + esc(s.titolo) + '">' + icona('plus', 'icona--s') + 'Aggiungi in ' + esc(s.titolo) + '</button></section>';
    });
    if (!righe.length) html += '<p class="admin-vuoto">Il menù è vuoto: aggiungi il primo piatto.</p>';
    html += '<div class="admin-card__azioni"><button class="btn btn--secondario" type="button" data-nuova-sezione>' + icona('plus') + 'Nuova sezione</button>' +
      '<button class="btn btn--testo" type="button" data-nuova-nota>Aggiungi una nota di sezione</button></div>';
    corpo.innerHTML = html;

    var sezioni = perSezione(righe, 'sezione');
    $$('[data-apri]', corpo).forEach(function (b) {
      b.addEventListener('click', function () {
        var i = Number(b.getAttribute('data-apri'));
        var nota = !righe[i].piatto;
        modificaRiga({ k: 'menu', titolo: nota ? 'Nota di sezione' : 'Modifica piatto', campi: nota ? campiNota(righe) : campiCarta(righe), indice: i,
          gruppo: function (r) { return r.sezione; } });
      });
    });
    $$('[data-aggiungi]', corpo).forEach(function (b) {
      b.addEventListener('click', function () {
        var nome = b.getAttribute('data-aggiungi');
        var s = sezioni.filter(function (x) { return x.titolo === nome; })[0];
        var ultimo = s.righe.length ? righe[s.righe[s.righe.length - 1]] : {};
        modificaRiga({ k: 'menu', titolo: 'Nuovo piatto', campi: campiCarta(righe), base: { sezione: nome, gruppo: ultimo.gruppo || '', visibile: true }, posizione: dopoUltima(righe, s.righe) });
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
    var html = '<form class="admin-card" data-prezzo novalidate><div class="admin-sottotitolo"><h2>Prezzo del menù</h2>' +
      '<p class="testo-s">Dal lunedì al venerdì, bevande escluse. I piatti non hanno prezzo.</p></div>' +
      '<div class="riga-campi" style="align-items:flex-end">' + campo({ k: 'prezzo', etichetta: 'Prezzo', esempio: '15,00 €', max: 30 }, sch.prezzo) +
      '<button class="btn btn--primario" type="submit">Salva prezzo</button></div></form>';
    perSezione(righe, 'sezione').forEach(function (s) {
      var oggiCi = s.righe.filter(function (i) { return righe[i].visibile; }).length;
      html += '<section class="admin-sezione"><div class="admin-sezione__testa"><h2 class="admin-sezione__titolo">' + esc(s.titolo) +
        '<span class="accento">' + oggiCi + ' di ' + s.righe.length + ' sul sito</span></h2></div>';
      s.righe.forEach(function (i) { html += rigaElenco(i, righe[i].piatto, righe[i].allergeni, '', righe[i].visibile, true); });
      html += '<button class="btn btn--testo admin-aggiungi" type="button" data-aggiungi="' + esc(s.titolo) + '">' + icona('plus', 'icona--s') + 'Aggiungi in ' + esc(s.titolo) + '</button></section>';
    });
    html += '<p class="admin-nota">Spegnete i piatti che oggi non ci sono invece di cancellarli: domani basta riaccenderli.</p>';
    html += '<div class="admin-card__azioni"><button class="btn btn--secondario" type="button" data-nuova-sezione>' + icona('plus') + 'Nuova sezione</button></div>';
    corpo.innerHTML = html;

    var f = $('[data-prezzo]', corpo);
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var val = $('input', f).value.trim();
      var b = $('[type="submit"]', f);
      b.disabled = true; b.classList.add('is-caricamento');
      salva({ pranzo: righe }, { pranzo: { prezzo: val } }).then(function () { disegna(); });
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
        modificaRiga({ k: 'pranzo', titolo: 'Nuovo piatto', campi: campiPranzo(righe), base: { sezione: nome, visibile: true }, posizione: dopoUltima(righe, s.righe) });
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
      { k: 'prezzo', etichetta: 'Prezzo', facoltativo: true, max: 30, esempio: '55,00 €' },
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
      html += '<section class="admin-sezione' + '' + '"><div class="admin-sezione__testa">' +
        '<div><h2 class="admin-sezione__titolo">' + esc(f.menu) + '</h2><p class="admin-riga__sotto">' +
        esc([f.giorno ? maiuscola(giornoData(f.giorno)) : '', f.prezzo, f.nota].filter(Boolean).join(' · ')) + '</p></div>' +
        interruttore(f.visibile, f.visibile ? 'Sul sito' : 'Spento', 'data-visibile="' + fi + '" aria-label="Menù di ' + esc(f.menu) + ' visibile sul sito"') + '</div>';
      suoi.forEach(function (s) {
        html += '<p class="admin-gruppo">' + esc(s.titolo) + '</p>';
        s.righe.forEach(function (i) { html += rigaElenco(i, piatti[i].piatto, piatti[i].allergeni, '', true, false).replace('data-apri=', 'data-apri-piatto='); });
      });
      if (!suoi.length) html += '<p class="admin-riga admin-riga__sotto">Ancora nessun piatto.</p>';
      html += '<div class="admin-card__azioni" style="padding:6px 24px 16px">' +
        '<button class="btn btn--testo" type="button" data-aggiungi-piatto="' + fi + '">' + icona('plus', 'icona--s') + 'Aggiungi un piatto</button>' +
        '<button class="btn btn--testo" type="button" data-modifica-festa="' + fi + '">Modifica nome, giorno e prezzo</button></div></section>';
    });
    html += '<div class="admin-card__azioni"><button class="btn btn--secondario" type="button" data-nuova-festa>' + icona('plus') + 'Nuovo menù delle feste</button></div>';
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
        modificaRiga({ k: 'menuFeste', titolo: 'Nuovo piatto · ' + f.menu, campi: campiPiattoFesta(piatti), base: { menu: f.menu, portata: ultimo.portata || '' }, posizione: dopoUltima(piatti, suoi) });
      });
    });
    $$('[data-apri-piatto]', corpo).forEach(function (b) {
      b.addEventListener('click', function () {
        var i = Number(b.getAttribute('data-apri-piatto'));
        modificaRiga({ k: 'menuFeste', titolo: 'Modifica piatto · ' + piatti[i].menu, campi: campiPiattoFesta(piatti), indice: i,
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
      { k: 'prezzo', etichetta: 'Prezzo (se diverso)', facoltativo: true, max: 30, esempio: 'da 9,00 €' },
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
    if (!righe.length) html += '<p class="admin-riga admin-riga__sotto">Nessuna specialità.</p>';
    html += righe.length < 3 ? '<button class="btn btn--testo admin-aggiungi" type="button" data-aggiungi>' + icona('plus', 'icona--s') + 'Aggiungi una specialità</button></section>'
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
    html += '<section class="admin-vista" style="gap:16px"><div class="admin-sottotitolo"><h2>La settimana</h2>' +
      '<p class="testo-s">«Ultima prenotazione» è l’ultimo orario prenotabile online: si prenota ogni mezz’ora da «Dalle».</p></div>' +
      '<div class="admin-orari">' + bozza.map(function (g, i) {
        return '<div class="admin-orario' + (g.aperto ? '' : ' is-chiuso') + '" data-giorno="' + i + '">' +
          '<span class="admin-orario__giorno">' + esc(g.giorno) + '</span>' +
          interruttore(g.aperto, g.aperto ? 'Aperto' : 'Chiuso', 'data-campo-orario="aperto" aria-label="' + esc(g.giorno) + ' aperto"') +
          '<div class="admin-orario__ore">' +
            ['dalle', 'alle', 'ultima'].map(function (k) {
              var et = { dalle: 'Dalle', alle: 'Alle', ultima: 'Ultima prenotazione' }[k];
              return '<label class="campo"><span class="campo__etichetta">' + et + '</span><select class="campo__input" data-campo-orario="' + k + '">' + opzioniOra(g[k]) + '</select></label>';
            }).join('') +
          '</div><p class="admin-orario__chiuso">Chiuso tutto il giorno</p></div>';
      }).join('') + '</div>' +
      '<div class="admin-salva" data-barra-salva' + (S.orariBozza ? '' : ' hidden') + '><span class="label">Orari modificati</span><div class="admin-salva__azioni">' +
        '<button class="btn btn--testo" type="button" data-annulla-orari>Annulla</button>' +
        '<button class="btn btn--su-scuro" type="button" data-salva-orari>Salva orari</button></div></div></section>';

    html += '<section class="admin-vista" style="gap:16px"><div class="admin-sottotitolo"><h2>Chiusure straordinarie</h2>' +
      '<p class="testo-s">Il sito mostra un avviso da 30 giorni prima e non accetta prenotazioni in quei giorni.</p></div>' +
      '<section class="admin-sezione">' +
      (future.length ? future.sort(function (a, b) { return String(chiusure[a].dal).localeCompare(String(chiusure[b].dal)); }).map(function (i) { return rigaChiusura(chiusure[i], i, o); }).join('') : '<p class="admin-riga admin-riga__sotto">Nessuna chiusura in programma.</p>') +
      '<button class="btn btn--testo admin-aggiungi" type="button" data-nuova-chiusura>' + icona('plus', 'icona--s') + 'Aggiungi una chiusura</button></section>' +
      (passate.length ? '<details class="admin-nota"><summary style="cursor:pointer;min-height:44px;display:flex;align-items:center">Chiusure passate (' + passate.length + ')</summary><section class="admin-sezione" style="margin-top:8px">' +
        passate.sort(function (a, b) { return String(chiusure[b].dal).localeCompare(String(chiusure[a].dal)); }).map(function (i) { return rigaChiusura(chiusure[i], i, o); }).join('') + '</section></details>' : '') +
      '</section>';
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
            inp.parentNode.querySelector('span:last-child').textContent = inp.checked ? 'Aperto' : 'Chiuso';
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
      salva({ orari: bozza }).then(function (ok) { if (ok) S.orariBozza = null; disegna(); });
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
      S.dati = r; aggiornaConta();
      if (S.vista === 'prenotazioni' || S.vista === 'richieste') disegna();
      if (r.prenotazioni.length > prima) toast('È arrivata una nuova prenotazione.');
    }).catch(function () { /* riprova al prossimo giro */ });
  }, 120000);
})();
