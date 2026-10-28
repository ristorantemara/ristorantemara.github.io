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
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent / "lingue"))
import testi  # noqa: E402  traduzioni inglese e tedesco

LINGUE = ("it", "en", "de")
LOCALE = {"it": "it_IT", "en": "en_GB", "de": "de_DE"}


def tr(testo, lingua):
    """Traduzione di un testo breve (allergeni, note del menù); se manca resta l'italiano."""
    if not testo or lingua == "it":
        return testo
    v = testi.TESTI.get(testo)
    return v[LINGUE.index(lingua) - 1] if v else testo

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


def riga_piatto(p, vino=False, lingua="it"):
    # nelle lingue straniere il nome del piatto è tradotto; vini e produttori restano come sono
    nome, prezzo = p["nome"], p["prezzo"]
    if lingua != "it":
        if nome in testi.PIATTI:
            nome = testi.PIATTI[nome][LINGUE.index(lingua) - 1]
        prezzo = re.sub(r"/hg$", "/100 g", prezzo)
    allergeni = ["Solfiti"] if vino else p.get("allergeni", [])
    testo_all = tr(p.get("testo_allergeni"), lingua) or " · ".join(tr(a, lingua) for a in allergeni)
    html = [f'<li class="piatto" data-allergeni="{esc(",".join(slug(a) for a in allergeni))}">',
            '<div class="piatto__testa">',
            f'<h3 class="piatto-nome">{esc(nome)}</h3>',
            '<span class="piatto__puntini" aria-hidden="true"></span>',
            f'<p class="prezzo">{esc(prezzo)}</p></div>']
    sotto = p.get("sotto")
    if sotto:
        html.append(f'<p class="piatto__sotto">{esc(sotto)}</p>')
    if testo_all and not vino:
        html.append(f'<p class="piatto__allergeni"><span class="visually-hidden">Allergeni: </span>{esc(testo_all)}</p>')
    html.append("</li>")
    return "".join(html)


def blocchi_menu(lingua="it"):
    dati = json.loads((RADICE / "menu.json").read_text(encoding="utf-8"))
    # nomi dei piatti, dei vini e dei produttori restano in italiano
    for s_ in dati["sezioni"]:
        for p_ in s_.get("piatti", []) + [q for g in s_.get("gruppi", []) for q in g["piatti"]]:
            testi.NON_TRADURRE.add(p_["nome"])
            if p_.get("sotto"):
                testi.NON_TRADURRE.add(p_["sotto"])
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
                corpo.extend(riga_piatto(p, vino=True, lingua=lingua) for p in g["piatti"])
                corpo.append("</ul></div>")
        else:
            corpo.append('<ul class="menu-colonne">')
            corpo.extend(riga_piatto(p, lingua=lingua) for p in s["piatti"])
            corpo.append("</ul>")
        corpo.append("</section>")
        sezioni.append("".join(corpo))
    chip = "".join(f'<button class="chip" type="button" aria-pressed="false" data-allergene="{slug(a)}">{esc(tr(a, lingua))}'
                   f'<svg class="icona icona--xs" aria-hidden="true"><use href="assets/icons.svg#x"/></svg></button>'
                   for a in dati["allergeni"])
    # Dati delle sezioni note, usati da menu.js quando il menù arriva dal Foglio
    meta = {s["titolo"]: {"id": s["id"], "breve": s["breve"], "vini": bool(s.get("vini")),
                          "vuoto": s.get("vuoto", "")} for s in dati["sezioni"]}
    meta_json = json.dumps(meta, ensure_ascii=False).replace("</", "<\\/")
    return {"menu_indice": "".join(indice), "menu_pillole": "".join(pillole),
            "menu_sezioni": "".join(sezioni), "menu_chip": chip,
            "menu_meta": f'<script type="application/json" id="menu-meta">{meta_json}</script>'}


MENU = {l: blocchi_menu(l) for l in ("it", "en", "de")}


# ---------------------------------------------------------------- SEO e dati strutturati

def url_pagina(nome, lingua="it"):
    cartella = "" if lingua == "it" else lingua + "/"
    return SITO_URL + "/" + cartella + ("" if nome == "index.html" else nome)


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


def blocco_seo(nome, meta, corpo, lingua="it"):
    indicizzabile = meta.get("robots") != "noindex" and nome != "404.html"
    titolo, descr = esc(meta.get("titolo", "Ristorante Mara")), esc(meta.get("descrizione", ""))
    righe = []
    if indicizzabile:
        righe.append(f'<link rel="canonical" href="{url_pagina(nome, lingua)}">')
        righe += [f'<link rel="alternate" hreflang="{l}" href="{url_pagina(nome, l)}">' for l in LINGUE]
        righe.append(f'<link rel="alternate" hreflang="x-default" href="{url_pagina(nome)}">')
    righe += [
        '<meta property="og:type" content="restaurant">' if nome == "index.html" else '<meta property="og:type" content="website">',
        '<meta property="og:site_name" content="Ristorante Mara">',
        f'<meta property="og:locale" content="{LOCALE[lingua]}">',
        *[f'<meta property="og:locale:alternate" content="{LOCALE[l]}">' for l in LINGUE if l != lingua],
        f'<meta property="og:title" content="{titolo}">',
        f'<meta property="og:description" content="{descr}">',
        f'<meta property="og:url" content="{url_pagina(nome, lingua)}">',
        '<meta name="twitter:card" content="summary">',
        '<meta name="geo.region" content="IT-VR">',
        '<meta name="geo.placename" content="Valeggio sul Mincio">',
    ]
    if nome in ("index.html", "dove-siamo.html", "prenota.html"):
        righe.append(json_ld(ristorante_ld()))
    if nome == "menu.html" and lingua == "it":
        righe.append(json_ld(menu_ld()))
    faq = faq_ld(corpo) if lingua == "it" else None
    if faq:
        righe.append(json_ld(faq))
    return "".join("  " + r + "\n" for r in righe)


def scrivi_mappa_sito(pagine):
    oggi = datetime.date.today().isoformat()
    priorita = {"index.html": "1.0", "menu.html": "0.9", "prenota.html": "0.8", "dove-siamo.html": "0.8"}
    voci = ""
    for n in pagine:
        alternative = "".join(f'<xhtml:link rel="alternate" hreflang="{l}" href="{url_pagina(n, l)}"/>' for l in LINGUE)
        alternative += f'<xhtml:link rel="alternate" hreflang="x-default" href="{url_pagina(n)}"/>'
        for l in LINGUE:
            voci += (f"  <url><loc>{url_pagina(n, l)}</loc><lastmod>{oggi}</lastmod>"
                     f"<priority>{priorita.get(n, '0.6')}</priority>{alternative}</url>\n")
    (SITO / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n'
                                      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
                                      + voci + "</urlset>\n", encoding="utf-8")
    (SITO / "robots.txt").write_text(
        "# Tutti i motori di ricerca e gli assistenti AI possono leggere il sito\n"
        "User-agent: *\nAllow: /\nDisallow: /gestisci.html\nDisallow: /disdici.html\n"
        "Disallow: /en/disdici.html\nDisallow: /de/disdici.html\n\n"
        f"Sitemap: {SITO_URL}/sitemap.xml\n", encoding="utf-8")
    llms = (RADICE / "llms.txt").read_text(encoding="utf-8").replace("{{sito}}", SITO_URL)
    (SITO / "llms.txt").write_text(llms, encoding="utf-8")


def componi(meta, corpo, nome="", lingua="it"):
    attivo = meta.get("attivo", "")
    valori = {
        "titolo": meta.get("titolo", "Ristorante Mara"),
        "descrizione": meta.get("descrizione", ""),
        "robots": ('<meta name="robots" content="noindex">' if meta.get("robots") == "noindex" else "")
                  + (f'<base href="/{"" if lingua == "it" else lingua + "/"}">' if meta.get("base") else ""),
        "script_extra": "".join(f'<script src="{s.strip()}" defer></script>' for s in meta.get("script", "").split(",") if s.strip()),
        "script_lingua": f'  <script src="js/lingua-{lingua}.js" defer></script>\n' if lingua != "it" else "",
        "orari": PARTI["orari"],
        "nodo": PARTI["nodo"],
        "mappa": PARTI["mappa"],
        **MENU[lingua],
    }
    valori["seo"] = blocco_seo(nome, meta, corpo, lingua)
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
    html = selettore_lingue(html, nome, lingua)
    if nome == "404.html" and lingua == "it":
        # GitHub Pages mostra sempre il 404 italiano: per gli indirizzi in /en/ e /de/ passiamo alla pagina tradotta
        html = html.replace("</head>", "  <script>(function (m) { if (m) location.replace('/' + m[1] + '/404.html'); })"
                            "(location.pathname.match(/^\\/(en|de)\\/(?!404\\.html)/));</script>\n</head>", 1)
    if lingua != "it":
        html = traduci(html, lingua, nome)
        faq = faq_ld(html)
        if faq:
            html = html.replace("</head>", "  " + json_ld(faq) + "\n</head>", 1)
    return versiona(html, "" if lingua == "it" else "../")


def versiona(html, radice=""):
    """Aggiunge ?v=<impronta del file> a CSS e JS: a ogni modifica il browser scarica la versione nuova
    invece di usare quella in cache."""
    import hashlib, re as _re
    def impronta(m):
        attr, percorso = m.group(1), m.group(2)
        file = SITO / percorso
        if not file.exists():
            return m.group(0)
        v = hashlib.sha1(file.read_bytes()).hexdigest()[:8]
        return f'{attr}="{radice}{percorso}?v={v}"'
    return _re.sub(r'(href|src)="((?:css|js)/[\w.-]+\.(?:css|js))"', impronta, html)


# ---------------------------------------------------------------- Lingue

def selettore_lingue(html, nome, lingua):
    """Collega IT · EN · DE alla stessa pagina nelle altre lingue."""
    def link(l):
        dest = ("" if lingua == "it" else "../") + ("" if l == "it" else l + "/") + nome
        corrente = ' aria-current="true"' if l == lingua else ""
        return f'<a href="{dest}"{corrente} lang="{l}" hreflang="{l}">{l.upper()}</a>'
    return re.sub(r'<a href="#"[^>]*lang="it"[^>]*>IT</a><a href="#"[^>]*lang="en"[^>]*>EN</a><a href="#"[^>]*lang="de"[^>]*>DE</a>',
                  lambda m: link("it") + link("en") + link("de"), html)


MANCANTI = {"en": {}, "de": {}}
ATTRIBUTI = ("aria-label", "title", "placeholder", "alt", "content", "aria-valuetext")


_GIA = {}


def gia_tradotti(i):
    """Testi già nella lingua di arrivo (inseriti tradotti dalla build del menù o dai FRAMMENTI)."""
    if i not in _GIA:
        v = {t[i] for t in testi.TESTI.values()} | {t[i] for t in testi.PIATTI.values()}
        for f in testi.FRAMMENTI:
            v |= {re.sub(r"\s+", " ", x).strip() for x in re.split(r"<[^>]+>", f[1 + i])}
        _GIA[i] = v
    return _GIA[i]


def _traduci_testo(t, i, nome, lingua):
    chiave = re.sub(r"\s+", " ", t).strip()
    if (not chiave or len(chiave) < 2 or not re.search(r"[A-Za-zÀ-ÿ]", chiave)
            or chiave in testi.UGUALI or (chiave in testi.NON_TRADURRE and chiave not in testi.TESTI)):
        return t
    gia = gia_tradotti(i)
    if chiave not in testi.TESTI and (chiave in gia or all(x in gia for x in chiave.split(" · "))):
        return t
    v = testi.TESTI.get(chiave)
    if v is None:
        MANCANTI[lingua].setdefault(chiave, set()).add(nome)
        return t
    inizio = t[: len(t) - len(t.lstrip())]
    fine = t[len(t.rstrip()):]
    return inizio + v[i] + fine


def traduci(html, lingua, nome):
    i = LINGUE.index(lingua) - 1
    html = html.replace('<html lang="it">', f'<html lang="{lingua}" data-radice="../">', 1)
    for frammento in testi.FRAMMENTI:
        if frammento[0] in html:
            html = html.replace(frammento[0], frammento[1 + i])
    # percorsi: le pagine tradotte stanno in /en/ e /de/
    html = re.sub(r'(href|src)="(assets/)', r'\1="../\2', html)
    pezzi = re.split(r"(<[^>]+>)", html)
    dentro = None
    for k, pz in enumerate(pezzi):
        if pz.startswith("<"):
            m = re.match(r"<(/?)(script|style)\b", pz, re.I)
            if m:
                dentro = None if m.group(1) else m.group(2).lower()
            if pz == "<!--tradotto-->":
                dentro = "tradotto"
            elif pz == "<!--/tradotto-->":
                dentro = None
            if dentro == "tradotto":
                continue
            def attr(mm):
                return f'{mm.group(1)}="{esc_attr(_traduci_testo(mm.group(2), i, nome, lingua))}"'
            if not pz.startswith("<!") and not pz.startswith("</"):
                if not re.match(r"<(meta|link)\b", pz) or re.search(r'(name="description"|property="og:(title|description)")', pz):
                    pz = re.sub(r'\b(' + "|".join(ATTRIBUTI) + r')="([^"]*)"', attr, pz)
            pezzi[k] = pz
        elif dentro is None:
            pezzi[k] = _traduci_testo(pz, i, nome, lingua)
    return "".join(pezzi)


def esc_attr(t):
    return t.replace('"', "&quot;")



def scrivi_traduzioni_js():
    """js/lingua-en.js e js/lingua-de.js: i testi che servono agli script, presi da testi.py."""
    for i, lingua in enumerate(("en", "de")):
        voci = {k: v[i] for k, v in testi.JS.items()}
        voci.update({k: testi.TESTI[k][i] for k in testi.JS_DA_TESTI})
        voci.update({"piatto:" + k: v[i] for k, v in testi.PIATTI.items()})
        corpo = json.dumps(voci, ensure_ascii=False, indent=0, sort_keys=True)
        (SITO / "js" / f"lingua-{lingua}.js").write_text(
            "/* Generato da _sorgenti/build.py: non modificare qui, ma in _sorgenti/lingue/testi.py */\n"
            f"window.MARA_T = {corpo};\n", encoding="utf-8")


def main():
    scrivi_traduzioni_js()
    indicizzabili = []
    for percorso in sorted((RADICE / "pagine").glob("*.html")):
        meta, corpo = leggi_pagina(percorso)
        (SITO / percorso.name).write_text(componi(meta, corpo, percorso.name), encoding="utf-8")
        if meta.get("robots") != "noindex" and percorso.name != "404.html":
            indicizzabili.append(percorso.name)
        print("scritta", percorso.name)
        if percorso.name in testi.SOLO_ITALIANO:
            continue
        for lingua in ("en", "de"):
            (SITO / lingua).mkdir(exist_ok=True)
            proprio = RADICE / "lingue" / lingua / percorso.name
            corpo_l = ("<!--tradotto-->" + proprio.read_text(encoding="utf-8") + "<!--/tradotto-->") if proprio.exists() else corpo
            (SITO / lingua / percorso.name).write_text(componi(meta, corpo_l, percorso.name, lingua), encoding="utf-8")
    righe = []
    for lingua, voci in MANCANTI.items():
        for testo, pagine in sorted(voci.items()):
            righe.append(f"{lingua}\t{', '.join(sorted(pagine))}\t{testo}")
    (RADICE / "lingue" / "mancanti.txt").write_text("\n".join(righe) + "\n", encoding="utf-8")
    if righe:
        print(f"ATTENZIONE: {len(righe)} testi senza traduzione (vedi _sorgenti/lingue/mancanti.txt)")
    indicizzabili.sort(key=lambda n: (n != "index.html", n))
    scrivi_mappa_sito(indicizzabili)
    print("scritti sitemap.xml, robots.txt, llms.txt")


if __name__ == "__main__":
    main()
