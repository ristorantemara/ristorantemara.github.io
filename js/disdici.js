/* Cliente: disdice la propria prenotazione dal pulsante della mail di conferma */
(function () {
  'use strict';

  var q = new URLSearchParams(location.search);
  var id = q.get('id') || '';
  var chiave = q.get('chiave') || '';

  var titolo = document.getElementById('titolo');
  var sottotitolo = document.getElementById('sottotitolo');
  var dettagli = document.getElementById('dettagli');
  var azioni = document.getElementById('azioni');
  var dopo = document.getElementById('dopo');
  var pulsante = document.getElementById('disdici');
  var errore = document.getElementById('errore');
  var esito = document.getElementById('esito');
  var esitoTesto = document.getElementById('esito-testo');
  var telefonoTesto = document.getElementById('telefono-testo');
  var TELEFONO = 'Per qualsiasi cosa chiamaci al <a href="tel:+390454857283">045 485 7283</a>.';

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

  function mostraDisdetta(appena) {
    azioni.hidden = true;
    errore.hidden = true;
    esito.hidden = false;
    esito.classList.add('is-rifiutata');
    titolo.innerHTML = 'Prenotazione <span class="accento">disdetta</span>';
    sottotitolo.textContent = appena ? 'Grazie di averci avvisato: il tavolo torna libero per altri.' : '';
    esitoTesto.textContent = appena ? 'Fatto. Ti abbiamo mandato una mail di conferma.' : 'Questa prenotazione è già stata disdetta. Non serve fare altro.';
    dopo.hidden = false;
    telefonoTesto.innerHTML = TELEFONO;
    titolo.focus();
  }

  function nonDisdicibile(testo) {
    azioni.hidden = true;
    esito.hidden = false;
    esito.classList.add('is-rifiutata');
    esitoTesto.textContent = testo;
    telefonoTesto.innerHTML = TELEFONO;
  }

  function disdici() {
    pulsante.disabled = true;
    pulsante.classList.add('is-caricamento');
    errore.hidden = true;
    window.maraInvia({ tipo: 'disdici', id: id, chiave: chiave })
      .then(function (r) {
        if (r.ok) return mostraDisdetta(true);
        if (r.giaDisdetta) return mostraDisdetta(false);
        throw new Error(r.errore);
      })
      .catch(function (e) {
        if (!e.tecnico && !e.rete) {
          pulsante.disabled = false; pulsante.classList.remove('is-caricamento');
          return mostraErrore(testoErrore(e, 'Qualcosa è andato storto, riprova.'));
        }
        // risposta illeggibile: ricontrolliamo prima di dire che non ha funzionato
        return window.maraInvia({ tipo: 'cliente', id: id, chiave: chiave })
          .then(function (r) {
            if (r.ok && r.prenotazione.stato === 'Disdetta') return mostraDisdetta(true);
            throw new Error('non aggiornata');
          })
          .catch(function () {
            pulsante.disabled = false; pulsante.classList.remove('is-caricamento');
            mostraErrore('Non sono riuscito a disdire. Controlla la connessione e riprova, oppure chiamaci al 045 485 7283.');
          });
      });
  }

  pulsante.addEventListener('click', disdici);

  if (!id || !chiave) {
    titolo.textContent = 'Link non valido';
    mostraErrore('Apri di nuovo il pulsante “Disdici la prenotazione” dalla mail di conferma.');
    return;
  }

  window.maraInvia({ tipo: 'cliente', id: id, chiave: chiave })
    .then(function (r) {
      if (!r.ok) throw new Error(r.errore);
      var p = r.prenotazione;
      riga('Giorno', p.dataLeggibile.charAt(0).toUpperCase() + p.dataLeggibile.slice(1));
      riga('Orario', 'Ore ' + p.ora);
      riga('Persone', String(p.persone));
      riga('A nome di', p.nome);
      dettagli.hidden = false;

      if (p.stato === 'Disdetta') return mostraDisdetta(false);
      if (p.stato === 'Rifiutata') {
        titolo.innerHTML = 'Prenotazione <span class="accento">non confermata</span>';
        return nonDisdicibile('Questa richiesta non era stata confermata, quindi non serve disdirla.');
      }
      if (!p.disdicibile) {
        titolo.innerHTML = 'Prenotazione <span class="accento">passata</span>';
        return nonDisdicibile('L’orario di questa prenotazione è già passato.');
      }
      titolo.innerHTML = 'Vuoi disdire <span class="accento">la prenotazione?</span>';
      sottotitolo.textContent = 'Ciao ' + p.nome.split(/\s+/)[0] + ', se non riesci più a venire disdici qui: il tavolo torna libero e ti mandiamo una mail di conferma.';
      azioni.hidden = false;
    })
    .catch(function (e) {
      titolo.textContent = 'Non riesco ad aprire la prenotazione';
      mostraErrore(testoErrore(e, 'Connessione non riuscita, ricarica la pagina.'));
      telefonoTesto.innerHTML = TELEFONO;
    });
})();
