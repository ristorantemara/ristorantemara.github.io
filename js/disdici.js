/* Cliente: disdice la propria prenotazione dal pulsante della mail di conferma */
(function () {
  'use strict';

  var L = window.maraL; // lingua della pagina (js/lingua.js)
  var t = L.t;
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
  var TELEFONO = t('Per qualsiasi cosa chiamaci al {tel}.', { tel: '<a href="tel:+390454857283">' + (L.lingua === 'it' ? '' : '+39 ') + '045 485 7283</a>' });

  function mostraErrore(testo) {
    errore.innerHTML = '<svg class="icona" aria-hidden="true"><use href="' + L.icona('alert') + '"/></svg><span></span>';
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
    titolo.innerHTML = t('Prenotazione <span class="accento">disdetta</span>');
    sottotitolo.textContent = appena ? t('Grazie di averci avvisato: il tavolo torna libero per altri.') : '';
    esitoTesto.textContent = appena ? t('Fatto. Ti abbiamo mandato una mail di conferma.') : t('Questa prenotazione è già stata disdetta. Non serve fare altro.');
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
    window.maraInvia({ tipo: 'disdici', id: id, chiave: chiave, lingua: L.lingua })
      .then(function (r) {
        if (r.ok) return mostraDisdetta(true);
        if (r.giaDisdetta) return mostraDisdetta(false);
        throw new Error(r.errore);
      })
      .catch(function (e) {
        if (!e.tecnico && !e.rete) {
          pulsante.disabled = false; pulsante.classList.remove('is-caricamento');
          return mostraErrore(testoErrore(e, t('Qualcosa è andato storto, riprova.')));
        }
        // risposta illeggibile: ricontrolliamo prima di dire che non ha funzionato
        return window.maraInvia({ tipo: 'cliente', id: id, chiave: chiave, lingua: L.lingua })
          .then(function (r) {
            if (r.ok && r.prenotazione.stato === 'Disdetta') return mostraDisdetta(true);
            throw new Error('non aggiornata');
          })
          .catch(function () {
            pulsante.disabled = false; pulsante.classList.remove('is-caricamento');
            mostraErrore(t('Non sono riuscito a disdire. Controlla la connessione e riprova, oppure chiamaci al 045 485 7283.'));
          });
      });
  }

  pulsante.addEventListener('click', disdici);

  if (!id || !chiave) {
    titolo.textContent = t('Link non valido');
    mostraErrore(t('Apri di nuovo il pulsante “Disdici la prenotazione” dalla mail di conferma.'));
    return;
  }

  window.maraInvia({ tipo: 'cliente', id: id, chiave: chiave, lingua: L.lingua })
    .then(function (r) {
      if (!r.ok) throw new Error(r.errore);
      var p = r.prenotazione;
      riga(t('Giorno'), p.dataLeggibile.charAt(0).toUpperCase() + p.dataLeggibile.slice(1));
      riga(t('Orario'), t('Ore {o}', { o: p.ora }));
      riga(t('Persone'), String(p.persone));
      riga(t('A nome di'), p.nome);
      dettagli.hidden = false;

      if (p.stato === 'Disdetta') return mostraDisdetta(false);
      if (p.stato === 'Rifiutata') {
        titolo.innerHTML = t('Prenotazione <span class="accento">non confermata</span>');
        return nonDisdicibile(t('Questa richiesta non era stata confermata, quindi non serve disdirla.'));
      }
      if (!p.disdicibile) {
        titolo.innerHTML = t('Prenotazione <span class="accento">passata</span>');
        return nonDisdicibile(t('L’orario di questa prenotazione è già passato.'));
      }
      titolo.innerHTML = t('Vuoi disdire <span class="accento">la prenotazione?</span>');
      sottotitolo.textContent = t('Ciao {nome}, se non riesci più a venire disdici qui: il tavolo torna libero e ti mandiamo una mail di conferma.', { nome: p.nome.split(/\s+/)[0] });
      azioni.hidden = false;
    })
    .catch(function (e) {
      titolo.textContent = t('Non riesco ad aprire la prenotazione');
      mostraErrore(testoErrore(e, t('Connessione non riuscita, ricarica la pagina.')));
      telefonoTesto.innerHTML = TELEFONO;
    });
})();
