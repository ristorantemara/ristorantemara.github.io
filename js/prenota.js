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
  function aperto(iso) { return iso >= oggi && iso <= ultimo && giornoSettimana(iso) !== 2 && orariLiberi(iso).length > 0; }
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
  var bottoniOra = form.querySelectorAll('[data-ora]');
  function orariLiberi(iso) {
    var tutti = Array.prototype.map.call(bottoniOra, function (b) { return b.dataset.ora; });
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
      var chiuso = giornoSettimana(iso) === 2;
      if (chiuso) b.classList.add('is-chiuso');
      if (iso === oggi) b.classList.add('is-oggi');
      if (!aperto(iso)) { b.disabled = true; }
      if (iso === stato.data) { b.classList.add('is-scelto'); b.setAttribute('aria-pressed', 'true'); } else b.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-label', giornoLungo(iso) + (chiuso ? ', chiuso' : (b.disabled ? ', non disponibile' : '')));
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
  form.querySelectorAll('[data-persone]').forEach(function (b) {
    b.addEventListener('click', function () {
      stato.persone = Math.min(MAX_PERSONE, Math.max(1, stato.persone + Number(b.dataset.persone)));
      aggiorna();
    });
  });
  bottoniOra.forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.disabled) return;
      stato.ora = b.dataset.ora;
      nascondiErrore('ora');
      aggiorna();
    });
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
    valorePersone.textContent = stato.persone;
    form.querySelector('[data-persone="-1"]').disabled = stato.persone <= 1;
    form.querySelector('[data-persone="1"]').disabled = stato.persone >= MAX_PERSONE;

    var liberi = stato.data ? orariLiberi(stato.data) : orariLiberi('x');
    bottoniOra.forEach(function (b) {
      b.disabled = liberi.indexOf(b.dataset.ora) === -1;
      b.setAttribute('aria-checked', b.dataset.ora === stato.ora ? 'true' : 'false');
    });

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

  /* ---------- Navigazione tra i passi ---------- */
  var NOTE = {
    1: 'Il martedì siamo chiusi: quei giorni non sono selezionabili.',
    2: 'La conferma arriva via email. Il telefono ci serve solo in caso di imprevisti.',
    3: 'È una richiesta: ti confermiamo il tavolo via email. Se quel giorno siamo al completo, ti proponiamo un’alternativa.'
  };

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
    document.querySelector('[data-nota-passo]').textContent = NOTE[passo];
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
      sito: valore('sito')
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
  aggiorna();
  vaiA(1, true, true);
})();
