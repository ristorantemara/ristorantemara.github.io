/* Indirizzo dello script Google che riceve prenotazioni e richieste.
   Se lo ripubblichi con un nuovo URL, cambialo solo qui. */
window.MARA_SERVIZIO = 'https://script.google.com/macros/s/AKfycbxaXMOKzb5O8Jcahcw9ja-_33KJNZ_npi7u2oEKxchhHECTZMTgPzfBJezPVzs88zqs/exec';

/* Invio comune: POST con testo JSON (evita il controllo CORS che Apps Script non gestisce).
   Restituisce sempre { ok, ... } oppure lancia un errore con un messaggio in italiano. */
window.maraInvia = function (dati) {
  return fetch(window.MARA_SERVIZIO, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(dati)
  }).then(function (r) { return r.text(); }, function () {
    var e = new Error(window.maraL ? window.maraL.t('Connessione non riuscita: controlla la rete e riprova.') : 'Connessione non riuscita: controlla la rete e riprova.'); e.rete = true; throw e;
  }).then(function (testo) {
    try { return JSON.parse(testo); } catch (err) {
      var e = new Error(window.maraL ? window.maraL.t('Qualcosa è andato storto, riprova tra poco.') : 'Qualcosa è andato storto, riprova tra poco.'); e.tecnico = true; throw e;
    }
  });
};

/* Data di oggi a Roma in formato aaaa-mm-gg */
window.maraOggi = function () {
  try {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date());
  } catch (e) {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
};
