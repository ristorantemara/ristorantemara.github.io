# Ristorante Mara — sito di prova

Sito statico pubblicato con GitHub Pages su **https://ristorantemara.github.io**, costruito dal design Figma
"Ristorante Mara" (design system 2.0: colori di cucina, Bricolage Grotesque + Instrument Sans, motivo tenda, arco).

## Pagine

| File | Pagina |
| --- | --- |
| `index.html` | Home |
| `menu.html` | Menù alla carta con filtro allergeni |
| `gruppi.html` · `gruppi-grazie.html` | Gruppi e gite, preventivo e conferma di invio |
| `cerimonie.html` · `cerimonie-grazie.html` | Cerimonie, richiesta e conferma di invio |
| `storia.html` | La nostra storia |
| `dove-siamo.html` | Dove siamo e contatti |
| `prenota.html` | Prenotazione in 3 passi (Quando → I tuoi dati → Conferma → Richiesta inviata) |
| `gestisci.html` | Area ristorante: conferma o rifiuta una prenotazione (si apre dalla mail) |
| `disdici.html` | Area cliente: disdetta della prenotazione (si apre dal pulsante nella mail di conferma) |
| `privacy.html` | Privacy e cookie (testo provvisorio) |
| `404.html` | Pagina non trovata |

## Come si modifica

Le pagine **non vanno modificate direttamente**: si generano dai sorgenti in `_sorgenti/`.

- `_sorgenti/pagine/` — il contenuto di ogni pagina
- `_sorgenti/parti/` — parti comuni (header, footer, banner cookie, orari)
- `_sorgenti/menu.json` — piatti, prezzi e allergeni del menù

Dopo una modifica:

```
python3 _sorgenti/build.py
```

Stili in `css/styles.css`, comportamenti in `js/`. L'indirizzo dello script Google che riceve
prenotazioni e richieste è in `js/config.js`.

## Prenotazioni (test con Google Apps Script)

1. Il cliente prenota da `prenota.html` → lo script salva la richiesta nel Foglio e manda una mail al ristorante.
2. Nella mail, **Conferma** / **Rifiuta** aprono `gestisci.html` → un tocco e il cliente riceve la mail.
3. Nella mail di conferma il cliente trova **Disdici la prenotazione** → apre `disdici.html`, disdice con un tocco;
   il ristorante riceve una mail di disdetta. Il link del cliente ha una chiave sua: non permette di confermare.
   Le mail al cliente non invitano a rispondere: per modifiche c'è il telefono.
4. I form Gruppi e Cerimonie arrivano allo stesso script (foglio "Richieste") e al ristorante via mail.

## Orari, chiusure e menù dal Foglio Google

Il ristorante aggiorna il sito dal Foglio delle prenotazioni (anche dall'app Fogli), schede:

- **Chiusure** — Dal, Al, Motivo: avviso in cima al sito da 30 giorni prima, giorni barrati nel calendario, prenotazioni rifiutate.
- **Orari** — per ogni giorno Aperto, Dalle, Alle, Ultima prenotazione: stato "Aperti ora", tabelle orari, footer, orari prenotabili.
- **Menù** — Sezione, Gruppo, Piatto, Dettaglio, Prezzo, Allergeni, Visibile.

Il sito legge i dati con `GET …/exec?dati=sito` (`js/dati.js`, salvati nel browser e aggiornati ogni pochi minuti).
Se lo script non risponde restano gli orari standard e il menù scritto nella pagina (`_sorgenti/menu.json`).
Istruzioni per il ristorante nella scheda **Leggimi** del Foglio.

Foto: per ora segnaposto (sfumatura) con didascalia; vanno sostituite con foto vere in WebP.
