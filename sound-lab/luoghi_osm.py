"""Luoghi della città da OpenStreetMap (ODbL): nome, tipo, posizione e orari di apertura.

Al posto dei vecchi spot di fonte commerciale (branch dati-legali, in prova, non ancora approvato). Ogni luogo del
Comune di Ascoli Piceno che attira persone (bar, negozi, chiese, scuole, parchi...) diventa un punto con:
  - categoria per la scheda Area («Tipi di luogo»), in italiano (CATEGORIE);
  - profilo dei diari ISTAT per il tipo di luogo (chiave di public/data/profili_luoghi.json, PROFILO) [H];
  - quota di ogni ora della settimana in cui il luogo è aperto, dal suo tag opening_hours; senza orari, la quota
    media dei luoghi dello stesso tipo nelle Marche che gli orari li hanno (APERTURE_TIPICHE).
L'affluenza per ora la calcola il sito (src/data/luoghi-core.js): profilo × apertura, 100 nell'ora più piena.

Fonte: estratto OpenStreetMap di Geofabrik per l'Italia centrale (centro-latest.osm.pbf, ODbL 1.0,
https://download.geofabrik.de/europe/italy.html), scaricato una volta. Licenza del risultato: ODbL 1.0,
attribuzione «© OpenStreetMap contributors» (https://www.openstreetmap.org/copyright). Il file prodotto è un
database derivato: resta pubblico con la stessa licenza (è nel repository).
Orari: libreria opening-hours-py 2.1.4 (MIT OR Apache-2.0, https://github.com/remi-dupre/opening-hours-rs),
specifica https://wiki.openstreetmap.org/wiki/Key:opening_hours/specification; festività italiane (country="IT").

Uso (dalla cartella sound-lab; serve QGIS per ogr2ogr, come estrai_lcz.py):
  curl -L -o /percorso/centro-latest.osm.pbf https://download.geofabrik.de/europe/italy/centro-latest.osm.pbf
  .venv/bin/python luoghi_osm.py /percorso/centro-latest.osm.pbf 2026-10-08T20:21:06Z ../public/data/luoghi_osm.geojson
Il secondo argomento è la data dei dati OSM dell'estratto (riga timestamp di
https://download.geofabrik.de/europe/italy/centro-updates/state.txt il giorno dello scaricamento).
"""
import collections, datetime as dt, json, math, os, re, subprocess, sys, tempfile, unicodedata
from shapely.geometry import MultiPoint, Point, shape
from shapely.prepared import prep
import opening_hours  # opening-hours-py (MIT OR Apache-2.0)

QGIS = "/Applications/QGIS-final-3_44_5.app/Contents"
OGR2OGR = os.path.join(QGIS, "MacOS", "ogr2ogr")
ENV = {**os.environ, "PROJ_DATA": os.path.join(QGIS, "Resources", "qgis", "proj"),
       "GDAL_DATA": os.path.join(QGIS, "Resources", "qgis", "gdal")}
HERE = os.path.dirname(os.path.abspath(__file__))
COMUNE = os.path.join(HERE, "data", "comune_ascoli.geojson")

# Riquadro che contiene le Marche (per gli orari tipici); i luoghi si filtrano poi col confine OSM della regione
MARCHE_BBOX = (12.15, 42.68, 13.95, 43.98)
# [S] Settimane su cui si fa la media degli orari: le 35 settimane intere del periodo dei dati (2024-06-01 -> 2025-02-01)
PRIMO_LUNEDI = dt.date(2024, 6, 3)
SETTIMANE = 35
# [S] Orari tipici di un tipo OSM solo se nelle Marche ci sono almeno 30 luoghi con orari leggibili
MIN_LUOGHI_TIPICI = 30
# [S] Lo stesso luogo disegnato due volte (punto e area, o due punti): stessa categoria, nome uguale o assente, entro 30 m
DOPPIONE_M = 30
# [S] Categorie con tipi troppo diversi per un orario medio comune: senza orari propri o del tipo, nessun orario
# (musei e biblioteche di giorno, cinema e teatri di sera: la media darebbe ai cinema gli orari dei musei)
SENZA_ORARIO_DI_CATEGORIA = {"cultura"}

TAG = ["name", "amenity", "shop", "leisure", "tourism", "office", "craft", "healthcare", "historic",
       "railway", "public_transport", "opening_hours", "access"]

# Categorie della scheda Area («Tipi di luogo»): chiave -> nome in italiano
CATEGORIE = {
    "bar": "Bar e caffè",
    "ristoranti": "Ristoranti e pizzerie",
    "alimentari": "Alimentari e supermercati",
    "moda": "Abbigliamento e accessori",
    "negozi": "Altri negozi e botteghe",
    "persona": "Parrucchieri ed estetisti",
    "farmacie": "Farmacie",
    "salute": "Medici e cliniche",
    "servizi": "Banche, poste e uffici",
    "scuole": "Scuole e università",
    "culto": "Chiese e luoghi di culto",
    "cultura": "Musei, teatri e cinema",
    "sport": "Sport e palestre",
    "verde": "Parchi e giardini",
    "monumenti": "Monumenti e panorami",
    "auto": "Auto e carburante",
    "stazioni": "Stazioni",
}

# Profilo dei diari (public/data/profili_luoghi.json) per categoria [H]: la corrispondenza fra tipo di luogo e
# attività o luogo dei diari è un'ipotesi, i profili sono dati [F]. Le eccezioni per tipo stanno in classifica().
PROFILO = {
    "bar": "bar_ristoranti", "ristoranti": "bar_ristoranti", "alimentari": "acquisti", "moda": "acquisti",
    "negozi": "acquisti", "persona": "servizi_persona", "farmacie": "acquisti", "salute": "servizi_persona",
    "servizi": "servizi", "scuole": "scuola", "culto": "culto", "cultura": "spettacoli", "sport": "sport",
    "verde": "all_aperto", "monumenti": "all_aperto", "auto": "acquisti", "stazioni": "spostamenti",
}

# --- Classificazione dei tag OSM [S]: cosa attira persone e dove va ---
AMENITY = {
    **dict.fromkeys(["cafe", "bar", "pub", "biergarten", "ice_cream", "nightclub"], "bar"),
    **dict.fromkeys(["restaurant", "fast_food", "food_court"], "ristoranti"),
    "pharmacy": "farmacie",
    **dict.fromkeys(["doctors", "dentist", "clinic", "hospital"], "salute"),
    **dict.fromkeys(["bank", "post_office", "townhall", "courthouse", "police", "veterinary", "car_rental",
                     "bureau_de_change"], "servizi"),
    **dict.fromkeys(["school", "kindergarten", "college", "university", "childcare", "language_school",
                     "music_school", "driving_school", "dancing_school", "training"], "scuole"),
    **dict.fromkeys(["place_of_worship", "monastery"], "culto"),
    **dict.fromkeys(["theatre", "cinema", "arts_centre", "library", "community_centre", "conference_centre",
                     "events_venue", "exhibition_centre"], "cultura"),
    **dict.fromkeys(["fuel", "car_wash"], "auto"),
    "marketplace": "alimentari",
    "bus_station": "stazioni",
    "gambling": "negozi",
}
ALIMENTARI = {"supermarket", "convenience", "bakery", "pastry", "butcher", "greengrocer", "deli", "pasta", "seafood",
              "wine", "alcohol", "beverages", "cheese", "confectionery", "coffee", "tea", "frozen_food", "farm",
              "health_food", "dairy", "chocolate", "spices", "food", "nuts", "water", "cantina", "general"}
MODA = {"clothes", "shoes", "jewelry", "bag", "leather", "watches", "fashion_accessories", "boutique", "fashion"}
PERSONA = {"hairdresser", "beauty", "massage", "tattoo", "nail_salon"}
AUTO = {"car", "car_repair", "tyres", "car_parts", "motorcycle", "motorcycle_repair"}
SERVIZI_SHOP = {"travel_agency", "money_lender", "gold_buyer", "funeral_directors", "copyshop", "laundry",
                "dry_cleaning", "pawnbroker"}
NIENTE_SHOP = {"vacant", "no", "disused"}
SPORT = {"sports_centre", "fitness_centre", "sports_hall", "swimming_pool", "track", "pitch", "bowling_alley",
         "ice_rink", "horse_riding", "dance", "indoor_play", "golf_course", "miniature_golf"}
SPORT_SOLO_CON_NOME = {"swimming_pool", "track", "pitch"}  # spesso privati o dentro un altro impianto: solo se hanno nome
VERDE = {"park", "playground", "dog_park"}
MONUMENTI_STORICI = {"castle", "city_gate", "monument", "fort", "archaeological_site", "ruins", "manor", "church",
                     "citywalls", "tower"}


def classifica(t):
    """(categoria, profilo) per i tag di un oggetto OSM, o None se non è un luogo che attira persone."""
    a, s, l, tu, h = t.get("amenity"), t.get("shop"), t.get("leisure"), t.get("tourism"), t.get("historic")
    privato = t.get("access") in ("private", "no")
    if a in AMENITY:
        c = AMENITY[a]
        if a == "veterinary":
            return c, "servizi"
        if a == "library":  # [H] biblioteche: servizio pubblico di giorno, come banche e uffici (i diari non le separano)
            return c, "servizi"
        return c, PROFILO[c]
    if s and s not in NIENTE_SHOP:
        if s == "ice_cream":
            return "bar", "bar_ristoranti"
        if s in ALIMENTARI: return "alimentari", "acquisti"
        if s in MODA: return "moda", "acquisti"
        if s in PERSONA: return "persona", "servizi_persona"
        if s in AUTO: return "auto", "acquisti"
        if s in SERVIZI_SHOP: return "servizi", "servizi"
        if s in ("chemist",): return "farmacie", "acquisti"
        return "negozi", "acquisti"
    if t.get("healthcare"):
        return ("farmacie", "acquisti") if t["healthcare"] == "pharmacy" else ("salute", "servizi_persona")
    if t.get("office"):
        return "servizi", "servizi"
    if t.get("craft"):
        return "negozi", "acquisti"
    if l == "stadium":
        return "sport", "partite"
    if l in SPORT and not privato:
        if l in SPORT_SOLO_CON_NOME and not t.get("name"):
            return None
        return "sport", "sport"
    if l in VERDE and not privato:
        return "verde", "all_aperto"
    if l == "garden" and not privato and t.get("name"):  # i giardini senza nome sono quasi sempre privati
        return "verde", "all_aperto"
    if tu in ("museum", "gallery"):  # [H] visite ai musei: svago di giorno; «spettacoli» ha dati solo di sera e nei weekend
        return "cultura", "all_aperto"
    if tu in ("attraction", "viewpoint"):
        return "monumenti", "all_aperto"
    if h in MONUMENTI_STORICI and t.get("name"):
        return "monumenti", "all_aperto"
    if t.get("railway") in ("station", "halt") or t.get("public_transport") == "station":
        return "stazioni", "spostamenti"
    return None


def tipo_osm(t):
    """Tipo OSM principale ('amenity=cafe'...), la chiave degli orari tipici."""
    for k in ("amenity", "shop", "healthcare", "office", "craft", "leisure", "tourism", "historic", "railway",
              "public_transport"):
        if t.get(k):
            return f"{k}={t[k]}"
    return ""


def ogr(*args):
    subprocess.run([OGR2OGR, *args], check=True, env=ENV, stderr=subprocess.DEVNULL)


def osmconf(cartella):
    """Configurazione del driver OSM di GDAL con i tag che servono come colonne."""
    p = os.path.join(cartella, "osmconf.ini")
    campi = ",".join(TAG)
    open(p, "w").write(f"""[general]
closed_ways_are_polygons=aeroway,amenity,boundary,building,craft,geological,historic,landuse,leisure,military,natural,office,place,shop,sport,tourism,healthcare,public_transport,railway=station
[points]
osm_id=yes
attributes={campi}
ignore=created_by,converted_by,source,time,ele,note,todo,openGeoDB:,fixme,FIXME
[lines]
osm_id=yes
attributes=name
[multipolygons]
osm_id=yes
attributes={campi},admin_level,boundary,type
ignore=area,created_by,converted_by,source,time,ele,note,todo,openGeoDB:,fixme,FIXME
[multilinestrings]
osm_id=yes
attributes=name
[other_relations]
osm_id=yes
attributes=name
""")
    return p


def estrai(pbf, conf, bbox, dove, uscita, livelli=("points", "multipolygons")):
    """Punti e aree OSM nel riquadro che soddisfano `dove` (SQL), in un GeoJSON per livello.
    Con la variabile d'ambiente LUOGHI_OSM_CACHE (una cartella) gli estratti si riusano fra un lancio e l'altro."""
    cache = os.environ.get("LUOGHI_OSM_CACHE")
    if cache:
        uscita = os.path.join(cache, os.path.basename(uscita))
        os.makedirs(uscita, exist_ok=True)
    out = {}
    for livello in livelli:
        f = os.path.join(uscita, f"{livello}.geojson")
        if cache and os.path.exists(f):
            out[livello] = json.load(open(f))["features"]
            continue
        ogr("-f", "GeoJSON", f, pbf, livello, "-oo", f"CONFIG_FILE={conf}", "-spat", *map(str, bbox),
            "-where", dove, "-lco", "COORDINATE_PRECISION=7")
        out[livello] = json.load(open(f))["features"]
    return out


def punto(f):
    """Posizione di un oggetto: il punto, o un punto dentro l'area (geometrie tagliate: media dei vertici)."""
    try:
        g = shape(f["geometry"])
        return g if g.geom_type == "Point" else g.representative_point()
    except (ValueError, TypeError):
        cs = [c for poly in f["geometry"]["coordinates"] for ring in poly for c in ring]
        return MultiPoint(cs).centroid


def ident(p, livello):
    """Identificativo OSM stabile: n<nodo>, w<way>, r<relazione>."""
    if livello == "points":
        return f"n{p['osm_id']}"
    return f"w{p['osm_way_id']}" if p.get("osm_way_id") else f"r{p['osm_id']}"


def nome_semplice(n):
    n = unicodedata.normalize("NFKD", n or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", n).strip()


ROMA = None


def aperture(testo, lon, lat):
    """Quota (0-1) di ogni ora della settimana (0 = lunedì 00:00) in cui il luogo è aperto, media sulle SETTIMANE.
    None se l'orario non si legge. Lo stato «sconosciuto» (es. "su appuntamento") conta come aperto [S]."""
    try:
        oh = opening_hours.OpeningHours(testo, country="IT", coords=(lat, lon))
    except Exception:  # opening_hours.ParserError e simili: orario scritto fuori specifica
        return None
    minuti = [0.0] * 168
    for s in range(SETTIMANE):
        inizio = dt.datetime.combine(PRIMO_LUNEDI + dt.timedelta(weeks=s), dt.time())
        fine = inizio + dt.timedelta(weeks=1)
        try:
            intervalli = oh.intervals(inizio.replace(tzinfo=ROMA), fine.replace(tzinfo=ROMA))
            for a, b, stato, _ in intervalli:
                if stato == opening_hours.State.CLOSED:
                    continue
                a = a.astimezone(ROMA).replace(tzinfo=None); b = b.astimezone(ROMA).replace(tzinfo=None)
                a, b = max(a, inizio), min(b, fine)
                while a < b:  # minuti per ora "da orologio" (il cambio d'ora di ottobre conta l'ora doppia una volta)
                    fine_ora = a.replace(minute=0, second=0, microsecond=0) + dt.timedelta(hours=1)
                    pezzo = (min(b, fine_ora) - a).total_seconds() / 60
                    h = (a - inizio).days * 24 + a.hour
                    minuti[h] = min(minuti[h] + pezzo, 60.0 * (s + 1))
                    a = fine_ora
        except (ValueError, OverflowError):
            return None
    return [m / (60 * SETTIMANE) for m in minuti]


def main(pbf, data_osm, uscita):
    global ROMA
    from zoneinfo import ZoneInfo
    ROMA = ZoneInfo("Europe/Rome")
    comune = shape(json.load(open(COMUNE))["geometry"])
    with tempfile.TemporaryDirectory() as tmp:
        conf = osmconf(tmp)
        os.makedirs(os.path.join(tmp, "comune")); os.makedirs(os.path.join(tmp, "marche")); os.makedirs(os.path.join(tmp, "confine"))
        chiavi = " OR ".join(f"{k} IS NOT NULL" for k in ("amenity", "shop", "leisure", "tourism", "office", "craft",
                                                           "healthcare", "historic", "railway", "public_transport"))
        x0, y0, x1, y1 = comune.bounds
        osm_comune = estrai(pbf, conf, (x0, y0, x1, y1), chiavi, os.path.join(tmp, "comune"))
        osm_marche = estrai(pbf, conf, MARCHE_BBOX, f"opening_hours IS NOT NULL AND ({chiavi})", os.path.join(tmp, "marche"))
        regioni = estrai(pbf, conf, MARCHE_BBOX, "boundary = 'administrative' AND admin_level = '4' AND name = 'Marche'",
                         os.path.join(tmp, "confine"), ("multipolygons",))["multipolygons"]
    marche = shape(regioni[0]["geometry"]) if regioni else None
    print(f"confine delle Marche da OSM: {'sì' if marche else 'no (si usa il riquadro)'}")

    # --- Orari tipici per tipo OSM, dai luoghi delle Marche con orari leggibili ---
    pm = prep(marche) if marche else None
    per_tipo, per_categoria = collections.defaultdict(list), collections.defaultdict(list)
    letti = illeggibili = 0
    for livello, feats in osm_marche.items():
        for f in feats:
            t = f["properties"]
            c = classifica(t)
            if not c:
                continue
            p = punto(f)
            if pm and not pm.contains(p):
                continue
            a = aperture(t["opening_hours"], p.x, p.y)
            if a is None:
                illeggibili += 1
                continue
            letti += 1
            if max(a) > 0:
                per_tipo[tipo_osm(t)].append(a)
                per_categoria[c[0]].append(a)
    media = lambda lista: [round(100 * sum(v[i] for v in lista) / len(lista)) for i in range(168)]
    tipiche = {k: media(v) for k, v in per_tipo.items() if len(v) >= MIN_LUOGHI_TIPICI}
    tipiche_cat = {k: media(v) for k, v in per_categoria.items() if len(v) >= MIN_LUOGHI_TIPICI}
    print(f"Marche: {letti} luoghi con orari leggibili, {illeggibili} illeggibili; "
          f"tipi con almeno {MIN_LUOGHI_TIPICI} luoghi: {len(tipiche)}; categorie: {len(tipiche_cat)}")

    # --- Luoghi del Comune ---
    pc = prep(comune)
    grezzi = []
    for livello, feats in osm_comune.items():
        for f in feats:
            t = f["properties"]
            c = classifica(t)
            if not c:
                continue
            p = punto(f)
            if not pc.contains(p):
                continue
            grezzi.append({"id": ident(t, livello), "livello": livello, "t": t, "categoria": c[0], "profilo": c[1],
                           "x": p.x, "y": p.y})
    # Doppioni: prima i punti con orari, poi i punti, poi le aree
    grezzi.sort(key=lambda g: (not g["t"].get("opening_hours"), g["livello"] != "points", g["id"]))
    LAT0 = 42.85
    MX, MY = 111320 * math.cos(math.radians(LAT0)), 110570
    tenuti, griglia, doppioni = [], collections.defaultdict(list), 0
    for g in grezzi:
        cx, cy = int(g["x"] * MX // DOPPIONE_M), int(g["y"] * MY // DOPPIONE_M)
        n = nome_semplice(g["t"].get("name"))
        doppio = None
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for k in griglia[(cx + dx, cy + dy)]:
                    o = tenuti[k]
                    if o["categoria"] != g["categoria"]:
                        continue
                    on = nome_semplice(o["t"].get("name"))
                    if (n and on and n != on) or math.hypot((o["x"] - g["x"]) * MX, (o["y"] - g["y"]) * MY) > DOPPIONE_M:
                        continue
                    doppio = o
        if doppio:
            doppioni += 1
            if not doppio["t"].get("name") and g["t"].get("name"):
                doppio["t"]["name"] = g["t"]["name"]
            continue
        griglia[(cx, cy)].append(len(tenuti))
        tenuti.append(g)
    print(f"Comune: {len(grezzi)} oggetti OSM che attirano persone, {doppioni} doppioni tolti, {len(tenuti)} luoghi")

    # --- Aperture: proprie, tipiche del tipo, tipiche della categoria, nessuna ---
    tabella, indice = [], {}

    def in_tabella(arr):
        k = tuple(arr)
        if k not in indice:
            indice[k] = len(tabella)
            tabella.append(arr)
        return indice[k]

    features, conta_fonte, sempre_chiusi = [], collections.Counter(), 0
    con_orari_illeggibili = 0
    for g in tenuti:
        t = g["t"]
        tipo = tipo_osm(t)
        a, fonte = None, "nessuna"
        if t.get("opening_hours"):
            a = aperture(t["opening_hours"], g["x"], g["y"])
            if a is not None:
                if max(a) == 0:
                    sempre_chiusi += 1  # orario che non apre mai nel periodo (es. "off", stagionale fuori periodo)
                    continue
                a, fonte = [round(100 * v) for v in a], "proprio"
            else:
                con_orari_illeggibili += 1
        if a is None and tipo in tipiche:
            a, fonte = tipiche[tipo], "tipico_tipo"
        if a is None and g["categoria"] in tipiche_cat and g["categoria"] not in SENZA_ORARIO_DI_CATEGORIA:
            a, fonte = tipiche_cat[g["categoria"]], "tipico_categoria"
        conta_fonte[fonte] += 1
        props = {"id": g["id"], "nome": t.get("name") or None, "categoria": g["categoria"], "profilo": g["profilo"],
                 "tipo_osm": tipo, "aperture": in_tabella(a) if a else -1, "orari_fonte": fonte}
        if fonte == "proprio":
            props["orari"] = t["opening_hours"]
        features.append({"type": "Feature", "id": g["id"], "properties": props,
                          "geometry": {"type": "Point", "coordinates": [round(g["x"], 6), round(g["y"], 6)]}})
    features.sort(key=lambda f: f["id"])
    print(f"orari: {dict(conta_fonte)}; illeggibili nel Comune: {con_orari_illeggibili}; "
          f"tolti perché sempre chiusi nel periodo: {sempre_chiusi}")
    cat = collections.Counter(f["properties"]["categoria"] for f in features)
    print("per categoria:", ", ".join(f"{CATEGORIE[k]} {v}" for k, v in cat.most_common()))

    json.dump({
        "type": "FeatureCollection",
        "descrizione": "Luoghi del Comune di Ascoli Piceno che attirano persone, da OpenStreetMap. 'aperture' = quota di "
                       "ogni ora della settimana (0 = lunedì 00:00 … 167 = domenica 23:00) in cui il luogo è aperto, in "
                       "%, media sulle 35 settimane dal 2024-06-03 al 2025-02-02 con le festività italiane; senza orari "
                       "propri, la media dei luoghi dello stesso tipo nelle Marche (orari_fonte). 'profilo' = chiave di "
                       "profili_luoghi.json (diari ISTAT). Preparato da sound-lab/luoghi_osm.py.",
        "licenza": "Open Database License (ODbL) 1.0, https://opendatacommons.org/licenses/odbl/1-0/",
        "attribuzione": "© OpenStreetMap contributors, https://www.openstreetmap.org/copyright",
        "fonte": f"OpenStreetMap, estratto Geofabrik centro-latest.osm.pbf (dati fino al {data_osm})",
        "categorie": CATEGORIE,
        "aperture_tipiche": {k: {"luoghi_marche": len(per_tipo[k])} for k in sorted(tipiche)},
        "aperture_tipiche_categoria": {k: {"luoghi_marche": len(per_categoria[k])} for k in sorted(tipiche_cat)},
        "aperture": tabella,
        "features": features,
    }, open(uscita, "w"), ensure_ascii=False, separators=(",", ":"))
    print("scritto", uscita, f"({os.path.getsize(uscita) / 1024:.0f} kB)")


if __name__ == "__main__":
    main(*sys.argv[1:4])
