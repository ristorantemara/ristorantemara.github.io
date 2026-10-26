#!/usr/bin/env python3
"""Compone le pagine del sito Mara.

Ogni file in _sorgenti/pagine ha un'intestazione tra due righe '---' con:
  titolo, descrizione, attivo (menu|gruppi|cerimonie|storia|dove|vuoto),
  layout (sito | flusso), classe_body, script, robots.
Il layout 'sito' aggiunge header, footer, barra azioni mobile e banner cookie;
'flusso' (prenotazione) usa solo testa e corpo.

Uso:  python3 _sorgenti/build.py      (scrive le pagine nella cartella del sito)
"""
import pathlib
import re

RADICE = pathlib.Path(__file__).resolve().parent
SITO = RADICE.parent
PARTI = {p.stem: p.read_text(encoding="utf-8") for p in (RADICE / "parti").glob("*.html")}


def leggi_pagina(percorso):
    testo = percorso.read_text(encoding="utf-8")
    meta = {}
    m = re.match(r"---\n(.*?)\n---\n", testo, re.S)
    if m:
        for riga in m.group(1).splitlines():
            if ":" in riga:
                k, v = riga.split(":", 1)
                meta[k.strip()] = v.strip()
        testo = testo[m.end():]
    return meta, testo


def sostituisci(modello, valori):
    return re.sub(r"\{\{(\w+)\}\}", lambda m: valori.get(m.group(1), ""), modello)


def esc(t):
    return (str(t).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;"))


def slug(t):
    return re.sub(r"[^a-z]+", "-", t.lower().replace("à", "a")).strip("-")


def riga_piatto(p, vino=False):
    allergeni = ["Solfiti"] if vino else p.get("allergeni", [])
    testo_all = p.get("testo_allergeni") or " · ".join(allergeni)
    html = [f'<li class="piatto" data-allergeni="{esc(",".join(slug(a) for a in allergeni))}">',
            '<div class="piatto__testa">',
            f'<h3 class="piatto-nome">{esc(p["nome"])}</h3>',
            '<span class="piatto__puntini" aria-hidden="true"></span>',
            f'<p class="prezzo">{esc(p["prezzo"])}</p></div>']
    if p.get("sotto"):
        html.append(f'<p class="piatto__sotto">{esc(p["sotto"])}</p>')
    if testo_all and not vino:
        html.append(f'<p class="piatto__allergeni"><span class="visually-hidden">Allergeni: </span>{esc(testo_all)}</p>')
    html.append("</li>")
    return "".join(html)


def blocchi_menu():
    import json
    dati = json.loads((RADICE / "menu.json").read_text(encoding="utf-8"))
    indice, pillole, sezioni = [], [], []
    for s in dati["sezioni"]:
        vino = bool(s.get("vini"))
        if vino:
            totale = sum(len(g["piatti"]) for g in s["gruppi"])
        else:
            totale = len(s["piatti"])
        indice.append(f'<li><a href="#{s["id"]}" data-indice="{s["id"]}"><span>{esc(s["titolo"])}</span>'
                      f'<span class="menu-indice__conta" data-conta="{s["id"]}">{totale}</span></a></li>')
        pillole.append(f'<a class="pillola" href="#{s["id"]}" data-indice="{s["id"]}">{esc(s["breve"])}</a>')
        corpo = [f'<section class="menu-sezione" id="{s["id"]}" data-sezione="{s["id"]}"{" data-vini" if vino else ""} aria-labelledby="t-{s["id"]}">',
                 f'<h2 class="menu-sezione__titolo h2" id="t-{s["id"]}"><span class="accento">{s["numero"]}</span> {esc(s["titolo"])}</h2>']
        if s.get("nota"):
            corpo.append(f'<p class="testo-s menu-sezione__nota">{esc(s["nota"])}</p>')
        vuoto = s.get("vuoto", "Avvisaci quando prenoti: la cucina può proporti un’alternativa.")
        corpo.append(f'<div class="avviso menu-sezione__vuoto" data-vuoto hidden><svg class="icona" aria-hidden="true"><use href="assets/icons.svg#info"/></svg>'
                     f'<div><p class="label" data-vuoto-titolo></p><p class="testo-s">{esc(vuoto)}</p>'
                     f'<button class="btn btn--testo" type="button" data-mostra-comunque>Mostra comunque<svg class="icona" aria-hidden="true"><use href="assets/icons.svg#arrow"/></svg></button></div></div>')
        if vino:
            for g in s["gruppi"]:
                corpo.append(f'<div class="menu-gruppo" data-gruppo><p class="occhiello">{esc(g["titolo"])}</p><ul class="menu-colonne">')
                corpo.extend(riga_piatto(p, vino=True) for p in g["piatti"])
                corpo.append("</ul></div>")
        else:
            corpo.append('<ul class="menu-colonne">')
            corpo.extend(riga_piatto(p) for p in s["piatti"])
            corpo.append("</ul>")
        corpo.append("</section>")
        sezioni.append("".join(corpo))
    chip = "".join(f'<button class="chip" type="button" aria-pressed="false" data-allergene="{slug(a)}">{esc(a)}'
                   f'<svg class="icona icona--xs" aria-hidden="true"><use href="assets/icons.svg#x"/></svg></button>'
                   for a in dati["allergeni"])
    # Dati delle sezioni note, usati da menu.js quando il menù arriva dal Foglio
    meta = {s["titolo"]: {"id": s["id"], "breve": s["breve"], "vini": bool(s.get("vini")),
                          "vuoto": s.get("vuoto", "")} for s in dati["sezioni"]}
    meta_json = json.dumps(meta, ensure_ascii=False).replace("</", "<\\/")
    return {"menu_indice": "".join(indice), "menu_pillole": "".join(pillole),
            "menu_sezioni": "".join(sezioni), "menu_chip": chip,
            "menu_meta": f'<script type="application/json" id="menu-meta">{meta_json}</script>'}


MENU = blocchi_menu()


def componi(meta, corpo):
    attivo = meta.get("attivo", "")
    valori = {
        "titolo": meta.get("titolo", "Ristorante Mara"),
        "descrizione": meta.get("descrizione", ""),
        "robots": ('<meta name="robots" content="noindex">' if meta.get("robots") == "noindex" else "")
                  + ('<base href="/">' if meta.get("base") else ""),
        "script_extra": "".join(f'<script src="{s.strip()}" defer></script>' for s in meta.get("script", "").split(",") if s.strip()),
        "orari": PARTI["orari"],
        "nodo": PARTI["nodo"],
        "mappa": PARTI["mappa"],
        **MENU,
    }
    for voce in ("menu", "gruppi", "cerimonie", "storia", "dove"):
        valori[f"attivo_{voce}"] = ' aria-current="page"' if voce == attivo else ""

    layout = meta.get("layout", "sito")
    classi = meta.get("classe_body", "")
    if layout == "sito":
        classi = (classi + " con-barra").strip()
    valori["classe_body"] = classi

    html = sostituisci(PARTI["testa"], valori)
    if layout == "sito":
        html += sostituisci(PARTI["header"], valori)
    html += sostituisci(corpo, valori)
    if layout == "sito":
        html += sostituisci(PARTI["footer"], valori)
        html += PARTI["cookie"]
    html += "</body>\n</html>\n"
    return html


def main():
    for percorso in sorted((RADICE / "pagine").glob("*.html")):
        meta, corpo = leggi_pagina(percorso)
        (SITO / percorso.name).write_text(componi(meta, corpo), encoding="utf-8")
        print("scritta", percorso.name)


if __name__ == "__main__":
    main()
