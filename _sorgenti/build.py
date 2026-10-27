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

import datetime
import json

# Indirizzo pubblico del sito: cambialo qui quando il sito passa al dominio definitivo
# (es. https://www.ristorantemara.com) e rilancia la build.
SITO_URL = "https://ristorantemara.github.io"

RISTORANTE = {
    "nome": "Ristorante Mara",
    "telefono": "+39 045 485 7283",
    "email": "info@ristorantemara.com",
    "via": "Via Mantovana 1180",
    "cap": "37067",
    "citta": "Valeggio sul Mincio",
    "provincia": "VR",
    "regione": "Veneto",
    "mappa": "https://goo.gl/maps/pDuJnsKCG562",
}

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
        pillole.append(f'<a class="pillola" href="#{s["id"]}" data-indice="{s["id"]}">{esc(s["titolo"])}</a>')
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


# ---------------------------------------------------------------- SEO e dati strutturati

def url_pagina(nome):
    return SITO_URL + "/" + ("" if nome == "index.html" else nome)


def json_ld(dati):
    testo = json.dumps(dati, ensure_ascii=False, indent=1).replace("</", "<\\/")
    return f'<script type="application/ld+json">{testo}</script>'


def ristorante_ld():
    r = RISTORANTE
    giorni = ["Monday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    return {
        "@context": "https://schema.org",
        "@type": "Restaurant",
        "@id": SITO_URL + "/#ristorante",
        "name": r["nome"],
        "alternateName": "Mara",
        "description": "Ristorante di famiglia dal 1967 a Valeggio sul Mincio, a due passi da Borghetto: "
                       "tortellini nodo d’amore tirati a mano, pasta fresca, carni alla griglia e vini del territorio. "
                       "Aperto a pranzo, ampio parcheggio anche per pullman, pranzi per gruppi e cerimonie.",
        "url": SITO_URL + "/",
        "telephone": r["telefono"],
        "email": r["email"],
        "foundingDate": "1967",
        "address": {"@type": "PostalAddress", "streetAddress": r["via"], "postalCode": r["cap"],
                    "addressLocality": r["citta"], "addressRegion": r["provincia"], "addressCountry": "IT"},
        "hasMap": r["mappa"],
        "sameAs": ["https://www.facebook.com/ristorantealbergomara/",
                   "https://www.tripadvisor.it/Restaurant_Review-g1060110-d3532185-Reviews-Ristorante_Albergo_Mara-Valeggio_Sul_Mincio_Province_of_Verona_Veneto.html"],
        "areaServed": ["Valeggio sul Mincio", "Borghetto", "Lago di Garda", "Verona"],
        "servesCuisine": ["Italiana", "Veneta", "Veronese", "Tortellini di Valeggio", "Carne alla griglia"],
        "priceRange": "€€",
        "currenciesAccepted": "EUR",
        "acceptsReservations": True,
        "hasMenu": SITO_URL + "/menu.html",
        "menu": SITO_URL + "/menu.html",
        "openingHoursSpecification": [{"@type": "OpeningHoursSpecification", "dayOfWeek": giorni,
                                       "opens": "12:00", "closes": "14:00"}],
        "amenityFeature": [
            {"@type": "LocationFeatureSpecification", "name": "Parcheggio per auto e pullman", "value": True},
            {"@type": "LocationFeatureSpecification", "name": "Sala per gruppi e cerimonie", "value": True},
            {"@type": "LocationFeatureSpecification", "name": "Allergeni indicati sul menù", "value": True},
        ],
        "potentialAction": {"@type": "ReserveAction",
                            "target": {"@type": "EntryPoint", "urlTemplate": SITO_URL + "/prenota.html",
                                       "inLanguage": "it", "actionPlatform": ["http://schema.org/DesktopWebPlatform",
                                                                              "http://schema.org/MobileWebPlatform"]},
                            "result": {"@type": "FoodEstablishmentReservation", "name": "Prenota un tavolo"}},
    }


def prezzo_ld(prezzo):
    m = re.fullmatch(r"(\d+)(?:,(\d{2}))?\s*€", prezzo.strip())
    if not m:
        return None
    return {"@type": "Offer", "price": f"{m.group(1)}.{m.group(2) or '00'}", "priceCurrency": "EUR"}


def menu_ld():
    dati = json.loads((RADICE / "menu.json").read_text(encoding="utf-8"))
    sezioni = []
    for s in dati["sezioni"]:
        gruppi = s["gruppi"] if s.get("vini") else [{"titolo": "", "piatti": s["piatti"]}]
        voci = []
        for g in gruppi:
            for p in g["piatti"]:
                voce = {"@type": "MenuItem", "name": p["nome"]}
                descr = " · ".join(x for x in [g["titolo"], p.get("sotto", "")] if x)
                if not prezzo_ld(p["prezzo"]):
                    descr = (descr + " · " if descr else "") + p["prezzo"]
                if descr:
                    voce["description"] = descr
                offerta = prezzo_ld(p["prezzo"])
                if offerta:
                    voce["offers"] = offerta
                voci.append(voce)
        sezione = {"@type": "MenuSection", "name": s["titolo"], "hasMenuItem": voci}
        if s.get("nota"):
            sezione["description"] = s["nota"]
        sezioni.append(sezione)
    return {"@context": "https://schema.org", "@type": "Menu", "@id": SITO_URL + "/menu.html#menu",
            "name": "Menù alla carta del Ristorante Mara", "inLanguage": "it",
            "url": SITO_URL + "/menu.html", "hasMenuSection": sezioni,
            "isPartOf": {"@id": SITO_URL + "/#ristorante"}}


def faq_ld(corpo):
    voci = re.findall(r'<details class="faq__voce"[^>]*>\s*<summary>(.*?)<svg.*?</summary>\s*<p[^>]*>(.*?)</p>', corpo, re.S)
    if not voci:
        return None
    pulito = lambda t: re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", t)).strip()
    return {"@context": "https://schema.org", "@type": "FAQPage",
            "mainEntity": [{"@type": "Question", "name": pulito(d),
                            "acceptedAnswer": {"@type": "Answer", "text": pulito(r)}} for d, r in voci]}


def blocco_seo(nome, meta, corpo):
    indicizzabile = meta.get("robots") != "noindex" and nome != "404.html"
    titolo, descr = esc(meta.get("titolo", "Ristorante Mara")), esc(meta.get("descrizione", ""))
    righe = []
    if indicizzabile:
        righe.append(f'<link rel="canonical" href="{url_pagina(nome)}">')
    righe += [
        '<meta property="og:type" content="restaurant">' if nome == "index.html" else '<meta property="og:type" content="website">',
        '<meta property="og:site_name" content="Ristorante Mara">',
        '<meta property="og:locale" content="it_IT">',
        f'<meta property="og:title" content="{titolo}">',
        f'<meta property="og:description" content="{descr}">',
        f'<meta property="og:url" content="{url_pagina(nome)}">',
        '<meta name="twitter:card" content="summary">',
        '<meta name="geo.region" content="IT-VR">',
        '<meta name="geo.placename" content="Valeggio sul Mincio">',
    ]
    if nome in ("index.html", "dove-siamo.html", "prenota.html"):
        righe.append(json_ld(ristorante_ld()))
    if nome == "menu.html":
        righe.append(json_ld(menu_ld()))
    faq = faq_ld(corpo)
    if faq:
        righe.append(json_ld(faq))
    return "".join("  " + r + "\n" for r in righe)


def scrivi_mappa_sito(pagine):
    oggi = datetime.date.today().isoformat()
    priorita = {"index.html": "1.0", "menu.html": "0.9", "prenota.html": "0.8", "dove-siamo.html": "0.8"}
    voci = "".join(f"  <url><loc>{url_pagina(n)}</loc><lastmod>{oggi}</lastmod>"
                   f"<priority>{priorita.get(n, '0.6')}</priority></url>\n" for n in pagine)
    (SITO / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n'
                                      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
                                      + voci + "</urlset>\n", encoding="utf-8")
    (SITO / "robots.txt").write_text(
        "# Tutti i motori di ricerca e gli assistenti AI possono leggere il sito\n"
        "User-agent: *\nAllow: /\nDisallow: /gestisci.html\nDisallow: /disdici.html\n\n"
        f"Sitemap: {SITO_URL}/sitemap.xml\n", encoding="utf-8")
    llms = (RADICE / "llms.txt").read_text(encoding="utf-8").replace("{{sito}}", SITO_URL)
    (SITO / "llms.txt").write_text(llms, encoding="utf-8")


def componi(meta, corpo, nome=""):
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
    valori["seo"] = blocco_seo(nome, meta, corpo)
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
    return versiona(html)


def versiona(html):
    """Aggiunge ?v=<impronta del file> a CSS e JS: a ogni modifica il browser scarica la versione nuova
    invece di usare quella in cache."""
    import hashlib, re as _re
    def impronta(m):
        attr, percorso = m.group(1), m.group(2)
        file = SITO / percorso
        if not file.exists():
            return m.group(0)
        v = hashlib.sha1(file.read_bytes()).hexdigest()[:8]
        return f'{attr}="{percorso}?v={v}"'
    return _re.sub(r'(href|src)="((?:css|js)/[\w.-]+\.(?:css|js))"', impronta, html)


def main():
    indicizzabili = []
    for percorso in sorted((RADICE / "pagine").glob("*.html")):
        meta, corpo = leggi_pagina(percorso)
        (SITO / percorso.name).write_text(componi(meta, corpo, percorso.name), encoding="utf-8")
        if meta.get("robots") != "noindex" and percorso.name != "404.html":
            indicizzabili.append(percorso.name)
        print("scritta", percorso.name)
    indicizzabili.sort(key=lambda n: (n != "index.html", n))
    scrivi_mappa_sito(indicizzabili)
    print("scritti sitemap.xml, robots.txt, llms.txt")


if __name__ == "__main__":
    main()
