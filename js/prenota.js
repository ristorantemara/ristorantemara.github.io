/* Prenotazione in tre passi: Quando → I tuoi dati → Conferma → Richiesta inviata */
(function () {
  'use strict';

  var form = document.querySelector('[data-prenota]');
  if (!form) return;

  var GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
  var GIORNI_BREVI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
  var MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  var GIORNI_MAX = 60;
  var MAX_PERSONE = 12;

  var stato = { passo: 1, data: '', ora: '', persone: 2 };

  /* ---------- Date (sempre come stringhe aaaa-mm-gg, ora di Roma) ---------- */
  var oggi = window.maraOggi();
  function daISO(iso) { var p = iso.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])); }
  function aISO(d) { return d.toISOString().slice(0, 10); }
  function piuGiorni(iso, n) { var d = daISO(iso); d.setUTCDate(d.getUTCDate() + n); return aISO(d); }
  var ultimo = piuGiorni(oggi, GIORNI_MAX);
  function giornoSettimana(iso) { return daISO(iso).getUTCDay(); }
  /* Orari e chiusure arrivano dal Foglio del ristorante (vedi dati.js) */
  var O = window.maraOrari;
  var dati = null;
  function giornoDi(iso) { return O.giorno(dati, iso); }
  function aperto(iso) { return iso >= oggi && iso <= ultimo && giornoDi(iso).aperto && orariLiberi(iso).length > 0; }
  function maiuscola(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  function giornoLungo(iso, conAnno) {
    var d = daISO(iso);
    return maiuscola(GIORNI[d.getUTCDay()]) + ' ' + d.getUTCDate() + ' ' + MESI[d.getUTCMonth()] + (conAnno ? ' ' + d.getUTCFullYear() : '');
  }
  function giornoBreve(iso) { var d = daISO(iso); return maiuscola(GIORNI_BREVI[d.getUTCDay()]) + ' ' + d.getUTCDate() + ' ' + MESI[d.getUTCMonth()]; }

  function oraAdesso() {
    try {
      var t = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
      return t;
    } catch (e) { var d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  }
  var listaOrari = form.querySelector('[data-orari-arrivo]');
  /** Tutti gli orari del giorno (o del primo giorno aperto, se non ne è scelto uno) */
  function orariDelGiorno(iso) {
    if (!iso) iso = O.prossimaApertura(dati, oggi) || oggi;
    return O.prenotabili(giornoDi(iso));
  }
  /** Orari ancora prenotabili: oggi solo quelli non passati */
  function orariLiberi(iso) {
    var tutti = O.prenotabili(giornoDi(iso));
    if (iso !== oggi) return tutti;
    var adesso = oraAdesso();
    return tutti.filter(function (o) { return o > adesso; });
  }

  /* ---------- Calendario mensile ---------- */
  var griglia = form.querySelector('[data-griglia]');
  var titoloMese = form.querySelector('[data-mese-titolo]');
  var meseVisto = oggi.slice(0, 7);

  function disegnaCalendario() {
    var p = meseVisto.split('-').map(Number);
    titoloMese.textContent = maiuscola(MESI[p[1] - 1]) + ' ' + p[0];
    griglia.innerHTML = '';
    var primo = new Date(Date.UTC(p[0], p[1] - 1, 1));
    var vuoti = (primo.getUTCDay() + 6) % 7;
    var giorniMese = new Date(Date.UTC(p[0], p[1], 0)).getUTCDate();
    for (var v = 0; v < vuoti; v++) griglia.appendChild(document.createElement('span'));
    for (var g = 1; g <= giorniMese; g++) {
      var iso = meseVisto + '-' + String(g).padStart(2, '0');
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'giorno';
      b.textContent = g;
      b.dataset.data = iso;
      var info = giornoDi(iso);
      var chiuso = !info.aperto;
      if (chiuso) b.classList.add('is-chiuso');
      if (iso === oggi) b.classList.add('is-oggi');
      if (!aperto(iso)) { b.disabled = true; }
      if (iso === stato.data) { b.classList.add('is-scelto'); b.setAttribute('aria-pressed', 'true'); } else b.setAttribute('aria-pressed', 'false');
      if (chiuso && info.chiusura && info.chiusura.motivo) b.title = info.chiusura.motivo;
      b.setAttribute('aria-label', giornoLungo(iso) + (chiuso ? ', chiuso' + (info.chiusura && info.chiusura.motivo ? ' (' + info.chiusura.motivo + ')' : '') : (b.disabled ? ', non disponibile' : '')));
      griglia.appendChild(b);
    }
    form.querySelector('[data-mese="-1"]').disabled = meseVisto <= oggi.slice(0, 7);
    form.querySelector('[data-mese="1"]').disabled = meseVisto >= ultimo.slice(0, 7);
  }
  griglia.addEventListener('click', function (e) {
    var b = e.target.closest('[data-data]');
    if (b && !b.disabled) scegliData(b.dataset.data);
  });
  form.querySelectorAll('[data-mese]').forEach(function (b) {
    b.addEventListener('click', function () {
      var p = meseVisto.split('-').map(Number);
      var d = new Date(Date.UTC(p[0], p[1] - 1 + Number(b.dataset.mese), 1));
      meseVisto = aISO(d).slice(0, 7);
      disegnaCalendario();
    });
  });

  /* ---------- Striscia giorni (mobile) ---------- */
  var striscia = form.querySelector('[data-striscia]');
  function disegnaStriscia() {
    striscia.innerHTML = '';
    var giorno = oggi, n = 0;
    while (n < 14 && giorno <= ultimo) {
      if (aperto(giorno)) {
        var d = daISO(giorno);
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'giorno-scheda';
        b.dataset.data = giorno;
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', giorno === stato.data ? 'true' : 'false');
        b.setAttribute('aria-label', giornoLungo(giorno));
        b.innerHTML = '<span class="giorno-scheda__nome">' + GIORNI_BREVI[d.getUTCDay()] + '</span><span class="giorno-scheda__numero">' + d.getUTCDate() + '</span>';
        striscia.appendChild(b);
        n++;
      }
      giorno = piuGiorni(giorno, 1);
    }
    var scelto = striscia.querySelector('[aria-checked="true"]');
    if (scelto) scelto.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
  striscia.addEventListener('click', function (e) {
    var b = e.target.closest('[data-data]');
    if (b) scegliData(b.dataset.data);
  });
  var apriCal = form.querySelector('[data-apri-calendario]');
  var calendario = form.querySelector('[data-calendario]');
  apriCal.addEventListener('click', function () {
    var aperto = calendario.classList.toggle('is-aperto');
    apriCal.setAttribute('aria-expanded', aperto ? 'true' : 'false');
    apriCal.textContent = aperto ? 'Chiudi il calendario' : 'Altri giorni › apri il calendario';
  });

  function scegliData(iso) {
    stato.data = iso;
    meseVisto = iso.slice(0, 7);
    // se l'orario scelto non è più disponibile (oggi), lo togliamo
    if (stato.ora && orariLiberi(iso).indexOf(stato.ora) === -1) stato.ora = '';
    nascondiErrore('data');
    aggiorna();
  }

  /* ---------- Persone e orario ---------- */
  var valorePersone = form.querySelector('[data-persone-valore]');
  function impostaPersone(n) {
    stato.persone = Math.min(MAX_PERSONE, Math.max(1, n));
    valorePersone.value = stato.persone;
    valorePersone.setAttribute('aria-invalid', 'false');
    aggiorna();
  }
  form.querySelectorAll('[data-persone]').forEach(function (b) {
    b.addEventListener('click', function () {
      nascondiErrore('persone');
      impostaPersone(stato.persone + Number(b.dataset.persone));
    });
  });
  // Il numero si può anche scrivere: solo cifre, da 1 a 12
  valorePersone.addEventListener('input', function () {
    var cifre = valorePersone.value.replace(/\D/g, '').slice(0, 2);
    if (cifre !== valorePersone.value) valorePersone.value = cifre;
    var n = Number(cifre);
    if (n > MAX_PERSONE) { valorePersone.setAttribute('aria-invalid', 'true'); return mostraErrore('persone'); }
    valorePersone.setAttribute('aria-invalid', 'false');
    nascondiErrore('persone');
    if (n >= 1) { stato.persone = n; aggiorna(); }
  });
  function confermaPersone() {
    var n = Number(valorePersone.value);
    if (!valorePersone.value || n < 1) n = stato.persone; // campo vuoto o 0: torna al valore di prima
    impostaPersone(n);
  }
  valorePersone.addEventListener('change', confermaPersone);
  valorePersone.addEventListener('blur', confermaPersone);
  valorePersone.addEventListener('focus', function () { valorePersone.select(); });
  valorePersone.addEventListener('keydown', function (e) {
    var tasti = { ArrowUp: 1, ArrowDown: -1, Home: 'min', End: 'max' };
    if (e.key === 'Enter') { e.preventDefault(); confermaPersone(); return; }
    if (!(e.key in tasti)) return;
    e.preventDefault();
    nascondiErrore('persone');
    var t = tasti[e.key];
    impostaPersone(t === 'min' ? 1 : t === 'max' ? MAX_PERSONE : stato.persone + t);
    valorePersone.select();
  });
  listaOrari.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ora]');
    if (!b || b.disabled) return;
    stato.ora = b.dataset.ora;
    nascondiErrore('ora');
    aggiorna();
    var nuovo = listaOrari.querySelector('[data-ora="' + stato.ora + '"]');
    if (nuovo) nuovo.focus();
  });

  /* ---------- Errori ---------- */
  function mostraErrore(chiave) { var e = form.querySelector('[data-errore="' + chiave + '"]'); if (e) e.classList.add('is-visibile'); }
  function nascondiErrore(chiave) { var e = form.querySelector('[data-errore="' + chiave + '"]'); if (e) e.classList.remove('is-visibile'); }

  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function validaCampo(campo) {
    var input = campo.querySelector('input, textarea');
    var v = input.type === 'checkbox' ? input.checked : input.value.trim();
    var ok = true;
    if (input.required && !v) ok = false;
    else if (input.name === 'telefono') ok = v.replace(/\D/g, '').length >= 8;
    else if (input.name === 'email') ok = EMAIL.test(v);
    else if (input.name === 'nome') ok = v.length >= 2;
    campo.classList.toggle('is-errore', !ok);
    input.setAttribute('aria-invalid', ok ? 'false' : 'true');
    return ok;
  }
  var campiDati = form.querySelectorAll('[data-passo="2"] .campo');
  campiDati.forEach(function (c) {
    var i = c.querySelector('input, textarea');
    i.addEventListener('blur', function () { if (i.type !== 'checkbox' && i.value.trim()) validaCampo(c); });
    i.addEventListener('input', function () { if (c.classList.contains('is-errore')) validaCampo(c); });
    i.addEventListener('change', function () { if (i.type === 'checkbox') validaCampo(c); });
  });

  /* ---------- Aggiornamento di tutto ciò che si vede ---------- */
  function scrivi(chiave, testo) {
    document.querySelectorAll('[data-r="' + chiave + '"]').forEach(function (el) { el.textContent = testo; });
  }
  function aggiorna() {
    disegnaCalendario();
    disegnaStriscia();
    if (document.activeElement !== valorePersone) valorePersone.value = stato.persone;
    valorePersone.setAttribute('aria-valuenow', stato.persone);
    valorePersone.setAttribute('aria-valuetext', stato.persone + (stato.persone === 1 ? ' persona' : ' persone'));
    form.querySelector('[data-persone="-1"]').disabled = stato.persone <= 1;
    form.querySelector('[data-persone="1"]').disabled = stato.persone >= MAX_PERSONE;

    disegnaOrariArrivo();

    var personeTesto = stato.persone + (stato.persone === 1 ? ' persona' : ' persone');
    scrivi('giorno', stato.data ? giornoLungo(stato.data) : 'Scegli il giorno');
    scrivi('persone-testo', personeTesto);
    scrivi('ora-testo', stato.ora ? 'Ore ' + stato.ora : 'Scegli l’orario');

    var mobile = form.querySelector('[data-continua-mobile]');
    if (stato.data && stato.ora) {
      var d = daISO(stato.data);
      mobile.textContent = 'Continua · ' + GIORNI_BREVI[d.getUTCDay()] + ' ' + d.getUTCDate() + ', ' + stato.ora + ', ' + stato.persone + ' pers.';
    } else mobile.textContent = 'Continua';
  }

  function disegnaOrariArrivo() {
    var tutti = orariDelGiorno(stato.data);
    var liberi = stato.data ? orariLiberi(stato.data) : tutti;
    listaOrari.innerHTML = '';
    tutti.forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'orario';
      b.setAttribute('role', 'radio');
      b.dataset.ora = o;
      b.textContent = o;
      b.disabled = liberi.indexOf(o) === -1;
      b.setAttribute('aria-checked', o === stato.ora ? 'true' : 'false');
      listaOrari.appendChild(b);
    });
    var g = giornoDi(stato.data || O.prossimaApertura(dati, oggi) || oggi);
    scrivi('nota-orari', g.aperto
      ? 'Siamo aperti dalle ' + g.dalle + ' alle ' + g.alle + ': l’ultimo tavolo si prenota alle ' + g.ultima + '.'
      : '');
    scrivi('nota-orari-breve', g.aperto ? 'Aperti ' + g.dalle + '–' + g.alle + ' · ultimo tavolo alle ' + g.ultima : '');
  }

  /** Solo il giorno di chiusura settimanale e nessuna chiusura straordinaria: le frasi del Figma */
  function soloChiusuraSettimanale() {
    var r = O.riassunto(dati);
    if (r.nChiusi !== 1) return null;
    var vicine = dati.chiusure.some(function (c) { return c.al >= oggi && c.dal <= ultimo; });
    return vicine ? null : r.elencoChiusi;
  }
  var PLURALI = { sabato: 'I sabati', domenica: 'Le domeniche' };
  var ARTICOLI = { domenica: 'La domenica' };
  /** Nota sotto il calendario: "I martedì sono barrati: siamo chiusi." */
  function notaCalendario() {
    var g = soloChiusuraSettimanale();
    return g ? (PLURALI[g] || 'I ' + g) + ' sono barrat' + (g === 'domenica' ? 'e' : 'i') + ': siamo chiusi.' : notaChiusure();
  }
  /** Nota nel riepilogo: "Il martedì siamo chiusi: quei giorni non sono selezionabili." */
  function notaRiepilogo() {
    var g = soloChiusuraSettimanale();
    return g ? (ARTICOLI[g] || 'Il ' + g) + ' siamo chiusi: quei giorni non sono selezionabili.' : notaChiusure();
  }

  /** "Nei giorni barrati siamo chiusi: di martedì e dal 10 al 24 agosto (ferie estive)." */
  function notaChiusure() {
    var parti = [];
    var r = O.riassunto(dati);
    if (r.elencoChiusi) parti.push('di ' + r.elencoChiusi);
    dati.chiusure.forEach(function (c) {
      if (c.al >= oggi && c.dal <= ultimo) parti.push(O.periodo(c, oggi) + (c.motivo ? ' (' + c.motivo.toLowerCase() + ')' : ''));
    });
    if (!parti.length) return 'Scegli il giorno: prenoti fino a due mesi prima.';
    var elenco = parti.length < 2 ? parti[0] : parti.slice(0, -1).join(', ') + ' e ' + parti[parti.length - 1];
    return 'Nei giorni barrati siamo chiusi: ' + elenco + '.';
  }

  /* ---------- Navigazione tra i passi ---------- */
  var NOTE = {
    1: '',
    2: 'La conferma arriva via email. Il telefono ci serve solo in caso di imprevisti.',
    3: 'È una richiesta: ti confermiamo il tavolo via email. Se quel giorno siamo al completo, ti proponiamo un’alternativa.'
  };

  var TITOLI_MOBILE = { 1: 'Prenota un tavolo', 2: 'I tuoi dati', 3: 'Conferma' };
  document.querySelector('[data-barra-indietro]').addEventListener('click', function () {
    if (stato.passo > 1) vaiA(stato.passo - 1);
  });

  function vaiA(passo, daStoria, iniziale) {
    stato.passo = passo;
    form.querySelectorAll('[data-passo]').forEach(function (s) { s.hidden = Number(s.dataset.passo) !== passo; });
    document.querySelectorAll('[data-passo-voce]').forEach(function (v) {
      var n = Number(v.dataset.passoVoce);
      v.classList.toggle('is-attivo', n === passo);
      v.classList.toggle('is-fatto', n < passo);
      if (n === passo) v.setAttribute('aria-current', 'step'); else v.removeAttribute('aria-current');
    });
    document.querySelectorAll('.passi-prenotazione__linea').forEach(function (l, i) { l.classList.toggle('is-fatto', i + 1 < passo); });
    document.querySelectorAll('[data-avanzamento] span').forEach(function (s, i) { s.classList.toggle('is-fatto', i < passo); });
    document.querySelector('[data-passo-mobile]').textContent = 'Passo ' + passo + ' di 3';
    // barra mobile (Figma): titolo del passo, ✕ al primo passo, freccia indietro dal secondo
    document.querySelector('[data-titolo-mobile]').textContent = TITOLI_MOBILE[passo];
    document.querySelector('[data-barra-esci]').hidden = passo > 1;
    document.querySelector('[data-barra-indietro]').hidden = passo === 1;
    document.querySelector('[data-nota-passo]').textContent = passo === 1 ? notaRiepilogo() : NOTE[passo];
    if (passo === 3) riempiRiepilogo();
    if (!daStoria) history.pushState({ passo: passo }, '', passo === 1 ? location.pathname : '#passo-' + passo);
    if (iniziale) return;
    window.scrollTo(0, 0);
    var titolo = document.getElementById('t-passo-' + passo);
    if (titolo) titolo.focus({ preventScroll: true });
  }

  function passoValido(passo) {
    if (passo === 1) {
      var ok = true;
      if (!stato.data) { mostraErrore('data'); ok = false; }
      if (!stato.ora) { mostraErrore('ora'); ok = false; }
      return ok;
    }
    if (passo === 2) {
      var primo = null;
      campiDati.forEach(function (c) { if (c.querySelector('[required]') && !validaCampo(c) && !primo) primo = c; });
      if (primo) primo.querySelector('input, textarea').focus();
      return !primo;
    }
    return true;
  }

  form.querySelectorAll('[data-avanti]').forEach(function (b) {
    b.addEventListener('click', function () {
      var da = Number(b.dataset.avanti) - 1;
      if (passoValido(da)) vaiA(da + 1);
    });
  });
  form.querySelectorAll('[data-indietro]').forEach(function (b) {
    b.addEventListener('click', function () { vaiA(Number(b.dataset.indietro)); });
  });
  window.addEventListener('popstate', function (e) {
    if (!e.state || !e.state.passo || e.state.passo > 3) return;
    var p = e.state.passo;
    if (p > 1 && !passoValido(1)) p = 1;
    vaiA(p, true);
  });

  /* ---------- Riepilogo e invio ---------- */
  function valore(nome) { return (form.elements[nome] && form.elements[nome].value || '').trim(); }
  function riempiRiepilogo() {
    scrivi('giorno-lungo', giornoLungo(stato.data, true));
    scrivi('giorno-breve', giornoBreve(stato.data));
    scrivi('ora-lunga', 'Ore ' + stato.ora);
    scrivi('ora', stato.ora);
    scrivi('persone', String(stato.persone));
    scrivi('nome', valore('nome'));
    scrivi('telefono', valore('telefono'));
    scrivi('email', valore('email'));
    scrivi('note', valore('note'));
    document.querySelectorAll('[data-r-riga="note"]').forEach(function (r) { r.hidden = !valore('note'); });
  }

  var bottoneInvia = form.querySelector('[data-invia]');
  var testoInvia = bottoneInvia.innerHTML;
  var erroreInvio = form.querySelector('[data-invio-errore]');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (stato.passo !== 3) return;
    erroreInvio.hidden = true;
    bottoneInvia.classList.add('is-caricamento');
    bottoneInvia.textContent = 'Invio in corso…';

    window.maraInvia({
      tipo: 'prenota',
      nome: valore('nome'), telefono: valore('telefono'), email: valore('email'),
      data: stato.data, ora: stato.ora, persone: stato.persone, note: valore('note'),
      sito: valore('sito'),
      consenso: form.querySelector('[name="consenso"]').checked
    }).then(function (r) {
      if (!r.ok) throw new Error(r.errore || 'Qualcosa è andato storto, riprova.');
      mostraInviata();
    }).catch(function (err) {
      erroreInvio.innerHTML = '<svg class="icona" aria-hidden="true"><use href="assets/icons.svg#alert"/></svg><span></span>';
      erroreInvio.querySelector('span').textContent = err.message + ' Se il problema continua, chiamaci allo 045 485 7283.';
      erroreInvio.hidden = false;
      bottoneInvia.classList.remove('is-caricamento');
      bottoneInvia.innerHTML = testoInvia;
    });
  });

  function mostraInviata() {
    var nome = valore('nome').split(/\s+/)[0];
    scrivi('nome-proprio', nome ? ', ' + nome : '');
    scrivi('frase-riepilogo', giornoLungo(stato.data) + ', ore ' + stato.ora + ', ' + stato.persone + (stato.persone === 1 ? ' persona.' : ' persone.'));
    form.hidden = true;
    document.querySelector('[data-inviata]').hidden = false;
    document.querySelector('[data-passi]').hidden = true;
    document.querySelector('[data-avanzamento]').hidden = true;
    document.querySelector('[data-titolo-mobile]').textContent = 'Richiesta inviata';
    document.querySelector('[data-passo-mobile]').hidden = true;
    document.body.classList.add('is-inviata');
    document.querySelector('[data-barra-esci]').hidden = false;
    document.querySelector('[data-barra-indietro]').hidden = true;
    history.replaceState({ passo: 4 }, '', location.pathname + '#inviata');
    window.scrollTo(0, 0);
    document.getElementById('t-inviata').focus({ preventScroll: true });
  }

  /* Aggiungi al calendario (.ics) */
  document.querySelector('[data-calendario-ics]').addEventListener('click', function () {
    var inizio = stato.data.replace(/-/g, '') + 'T' + stato.ora.replace(':', '') + '00';
    var minuti = Number(stato.ora.slice(0, 2)) * 60 + Number(stato.ora.slice(3)) + 90;
    var fine = stato.data.replace(/-/g, '') + 'T' + String(Math.floor(minuti / 60)).padStart(2, '0') + String(minuti % 60).padStart(2, '0') + '00';
    var ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ristorante Mara//Prenotazioni//IT',
      'BEGIN:VEVENT',
      'UID:' + Date.now() + '@ristorantemara',
      'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
      'DTSTART;TZID=Europe/Rome:' + inizio,
      'DTEND;TZID=Europe/Rome:' + fine,
      'SUMMARY:Pranzo al Ristorante Mara (' + stato.persone + ' pers.)',
      'LOCATION:Ristorante Mara\\, Via Mantovana 1180\\, 37067 Valeggio sul Mincio (VR)',
      'DESCRIPTION:Richiesta di prenotazione: attendi la mail di conferma. Tel. 045 485 7283',
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    a.download = 'pranzo-ristorante-mara.ics';
    document.body.appendChild(a); a.click(); a.remove();
  });

  /* ---------- Avvio ---------- */
  history.replaceState({ passo: 1 }, '', location.pathname);
  var avviato = false;
  window.maraDati(function (d) {
    dati = d;
    // se con i dati nuovi il giorno o l'orario scelto non sono più disponibili, li togliamo
    if (stato.data && !aperto(stato.data)) { stato.data = ''; stato.ora = ''; }
    if (stato.ora && (stato.data ? orariLiberi(stato.data) : orariDelGiorno('')).indexOf(stato.ora) === -1) stato.ora = '';
    scrivi('nota-calendario', notaCalendario());
    // su mobile la striscia salta i giorni di chiusura: diciamo perché
    var vicine = dati.chiusure.filter(function (c) { return c.al >= oggi && c.dal <= piuGiorni(oggi, 21); });
    var notaStriscia = form.querySelector('[data-nota-striscia]');
    notaStriscia.textContent = vicine.map(function (c) {
      return O.maiuscola(O.periodo(c, oggi)) + ' siamo chiusi' + (c.motivo ? ' (' + c.motivo.toLowerCase() + ')' : '') + '.';
    }).join(' ');
    notaStriscia.hidden = !vicine.length;
    if (stato.passo === 1) document.querySelector('[data-nota-passo]').textContent = notaRiepilogo();
    aggiorna();
    if (!avviato) { avviato = true; vaiA(1, true, true); }
  });
})();
