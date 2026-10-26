/* Area ristorante: conferma o rifiuta una richiesta aperta dal pulsante della mail */
(function () {
  'use strict';

  var q = new URLSearchParams(location.search);
  var id = q.get('id') || '';
  var token = q.get('token') || '';
  var azione = q.get('azione') === 'rifiuta' ? 'rifiuta' : 'conferma';

  var titolo = document.getElementById('titolo');
  var sottotitolo = document.getElementById('sottotitolo');
  var dettagli = document.getElementById('dettagli');
  var azioni = document.getElementById('azioni');
  var principale = document.getElementById('principale');
  var alternativa = document.getElementById('alternativa');
  var errore = document.getElementById('errore');
  var esito = document.getElementById('esito');
  var esitoTesto = document.getElementById('esito-testo');

  function mostraErrore(testo) {
    errore.innerHTML = '<svg class="icona" aria-hidden="true"><use href="assets/icons.svg#alert"/></svg><span></span>';
    errore.querySelector('span').textContent = testo;
    errore.hidden = false;
  }
  function testoErrore(e, generico) { return e && !e.tecnico && !e.rete && e.message ? e.message : generico; }

  function riga(etichetta, valore) {
    var div = document.createElement('div');
    var dt = document.createElement('dt'); dt.textContent = etichetta;
    var dd = document.createElement('dd'); dd.textContent = valore;
    div.appendChild(dt); div.appendChild(dd); dettagli.appendChild(div);
  }

  function preparaPulsanti() {
    var conferma = azione === 'conferma';
    titolo.innerHTML = conferma ? 'Confermare <span class="accento">questa prenotazione?</span>' : 'Rifiutare <span class="accento">questa prenotazione?</span>';
    sottotitolo.textContent = conferma
      ? 'Il cliente riceverà subito una mail di conferma.'
      : 'Il cliente riceverà una mail che lo invita a chiamarvi per un’altra data.';
    principale.className = 'btn ' + (conferma ? 'btn--primario' : 'btn--rifiuta');
    principale.innerHTML = (conferma ? 'Conferma e avvisa il cliente' : 'Rifiuta e avvisa il cliente') + '<svg class="icona" aria-hidden="true"><use href="assets/icons.svg#' + (conferma ? 'check' : 'x') + '"/></svg>';
    alternativa.textContent = conferma ? 'No, voglio rifiutarla' : 'No, voglio confermarla';
  }

  function mostraEsito(stato, giaGestita) {
    azioni.hidden = true;
    errore.hidden = true;
    esito.hidden = false;
    esito.classList.toggle('is-rifiutata', stato === 'Rifiutata');
    if (giaGestita) {
      titolo.innerHTML = 'Prenotazione <span class="accento">già ' + String(stato).toLowerCase() + '</span>';
      esitoTesto.textContent = 'Era già stata gestita: non è stata inviata un’altra mail.';
    } else {
      titolo.innerHTML = stato === 'Confermata' ? 'Prenotazione <span class="accento">confermata</span>' : 'Prenotazione <span class="accento">rifiutata</span>';
      esitoTesto.textContent = 'Fatto: il cliente ha ricevuto una mail.';
    }
    sottotitolo.textContent = '';
  }

  function decidi() {
    principale.disabled = true; alternativa.disabled = true;
    principale.classList.add('is-caricamento');
    errore.hidden = true;
    window.maraInvia({ tipo: 'decidi', id: id, token: token, azione: azione })
      .then(function (r) {
        if (r.ok) return mostraEsito(r.stato, false);
        if (r.giaGestita) return mostraEsito(r.stato, true);
        throw new Error(r.errore);
      })
      .catch(function (e) {
        if (!e.tecnico && !e.rete) {
          principale.disabled = false; alternativa.disabled = false; principale.classList.remove('is-caricamento');
          return mostraErrore(testoErrore(e, 'Qualcosa è andato storto, riprova.'));
        }
        // risposta illeggibile: ricontrolliamo lo stato prima di dire che non ha funzionato
        return window.maraInvia({ tipo: 'leggi', id: id, token: token })
          .then(function (r) {
            if (r.ok && r.prenotazione.stato !== 'In attesa') return mostraEsito(r.prenotazione.stato, false);
            throw new Error('non aggiornata');
          })
          .catch(function () {
            principale.disabled = false; alternativa.disabled = false; principale.classList.remove('is-caricamento');
            mostraErrore('Non sono riuscito a completare l’operazione. Controlla la connessione e riprova.');
          });
      });
  }

  principale.addEventListener('click', decidi);
  alternativa.addEventListener('click', function () {
    azione = azione === 'conferma' ? 'rifiuta' : 'conferma';
    preparaPulsanti();
  });

  if (!id || !token) {
    titolo.textContent = 'Link non valido';
    mostraErrore('Apri di nuovo il pulsante dalla mail.');
    return;
  }

  window.maraInvia({ tipo: 'leggi', id: id, token: token })
    .then(function (r) {
      if (!r.ok) throw new Error(r.errore);
      var p = r.prenotazione;
      riga('Nome', p.nome);
      riga('Giorno', p.dataLeggibile.charAt(0).toUpperCase() + p.dataLeggibile.slice(1));
      riga('Orario', 'Ore ' + p.ora);
      riga('Persone', String(p.persone));
      riga('Telefono', p.telefono);
      riga('Email', p.email);
      if (p.note) riga('Richieste', p.note);
      dettagli.hidden = false;
      if (p.stato !== 'In attesa') {
        mostraEsito(p.stato, true);
        esitoTesto.textContent = 'Non serve fare altro.';
      } else {
        preparaPulsanti();
        azioni.hidden = false;
      }
    })
    .catch(function (e) {
      titolo.textContent = 'Non riesco ad aprire la prenotazione';
      mostraErrore(testoErrore(e, 'Connessione non riuscita, ricarica la pagina.'));
    });
})();
