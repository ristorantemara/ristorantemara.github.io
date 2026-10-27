/* Form "Gruppi" e "Cerimonie": validazione accanto al campo e invio allo script */
(function () {
  'use strict';

  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function valida(campo) {
    var spunta = campo.querySelector('input[type="checkbox"][required]');
    if (spunta) {
      campo.classList.toggle('is-errore', !spunta.checked);
      spunta.setAttribute('aria-invalid', spunta.checked ? 'false' : 'true');
      return spunta.checked;
    }
    var input = campo.querySelector('.campo__input');
    if (!input) return true;
    var v = input.value.trim();
    var ok = true;
    if (input.required && !v) ok = false;
    else if (v && input.type === 'number') {
      var n = Number(v);
      ok = n >= Number(input.min || 0) && n <= Number(input.max || 1e9);
    } else if (v && input.hasAttribute('data-data-futura')) {
      ok = v >= window.maraOggi();
    } else if (v && input.hasAttribute('data-nome-cognome')) {
      ok = /[a-zà-ú'’]{2,}\s+[a-zà-ú'’]{2,}/i.test(v); // almeno due parole
    } else if (v && input.hasAttribute('data-telefono')) {
      ok = v.replace(/\D/g, '').length >= 8 && /^[+\d\s./()-]+$/.test(v);
    } else if (v && input.hasAttribute('data-email')) {
      ok = EMAIL.test(v);
    }
    campo.classList.toggle('is-errore', !ok);
    input.setAttribute('aria-invalid', ok ? 'false' : 'true');
    var err = campo.querySelector('.campo__errore');
    if (err) {
      if (!err.id) err.id = input.id + '-errore';
      if (!ok) input.setAttribute('aria-describedby', err.id); else input.removeAttribute('aria-describedby');
    }
    return ok;
  }

  document.querySelectorAll('[data-form-richiesta]').forEach(function (form) {
    var campi = form.querySelectorAll('.campo');
    var erroreForm = form.querySelector('[data-form-errore]');
    var bottone = form.querySelector('button[type="submit"]');
    var testoBottone = bottone.innerHTML;

    form.querySelectorAll('[data-data-futura]').forEach(function (i) { i.min = window.maraOggi(); });

    campi.forEach(function (c) {
      var s = c.querySelector('input[type="checkbox"][required]');
      if (s) s.addEventListener('change', function () { valida(c); });
      var i = c.querySelector('.campo__input');
      if (!i) return;
      i.addEventListener('blur', function () { if (i.value.trim()) valida(c); });
      i.addEventListener('input', function () { if (c.classList.contains('is-errore')) valida(c); });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      erroreForm.hidden = true;
      var primoErrato = null;
      campi.forEach(function (c) { if (!valida(c) && !primoErrato) primoErrato = c; });
      if (primoErrato) { primoErrato.querySelector('.campo__input, input').focus(); return; }

      var dati = { tipo: form.getAttribute('data-form-richiesta') };
      new FormData(form).forEach(function (v, k) { dati[k] = String(v).trim(); });

      bottone.classList.add('is-caricamento');
      bottone.textContent = 'Invio in corso…';

      window.maraInvia(dati).then(function (r) {
        if (!r.ok) throw new Error(r.errore || 'Qualcosa è andato storto, riprova.');
        window.location.href = form.getAttribute('data-successo');
      }).catch(function (err) {
        erroreForm.innerHTML = '<svg class="icona" aria-hidden="true"><use href="assets/icons.svg#alert"/></svg><span></span>';
        erroreForm.querySelector('span').textContent = err.message + ' Oppure chiamaci allo 045 485 7283.';
        erroreForm.hidden = false;
        bottone.classList.remove('is-caricamento');
        bottone.innerHTML = testoBottone;
      });
    });
  });
})();
