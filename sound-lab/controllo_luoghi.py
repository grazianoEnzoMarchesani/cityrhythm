"""Controllo incrociato dei luoghi OSM (public/data/luoghi_osm.geojson) con altre fonti aperte. Solo conteggi stampati:
nessun dato di queste fonti entra nel sito.

Fonti (da scaricare a parte, fuori dal repository; accesso del 2026-10-11):
  --overture  Overture Maps, tema places, rilascio 2026-09-23.1, riquadro del Comune (CDLA Permissive 2.0;
              record di Foursquare Apache 2.0; AllThePlaces CC0). Comando (pacchetto Python overturemaps, MIT):
              overturemaps download --bbox=13.4190,42.7718,13.7417,42.9304 -f geojson -t place -r 2026-09-23.1 -o places.geojson
  --farmacie  Ministero della Salute, dataset «Farmacie» (Italian Open Data License v2.0),
              https://www.dati.salute.gov.it/it/dataset/farmacie/ (CSV FRM_FARMA_5_AAAAMMGG.csv, separatore ';')
  --pdi       Regione Marche, «Comune di Ascoli Piceno punti di interesse» (licenza dichiarata CC BY 4.0 su dati.gov.it
              ma «Creative Commons Non-Commercial» sul portale regionale: solo controllo, mai pubblicato),
              https://dati.regione.marche.it/dataset/comune-di-ascoli-piceno-punti-interesse (shapefile nello ZIP)
  --edifici   Regione Marche, «Anagrafica edifici comunali ad uso pubblico» di Ascoli Piceno (IODL 2.0), GeoJSON

Uso (dalla cartella sound-lab):
  .venv/bin/python controllo_luoghi.py --overture places.geojson --farmacie FRM_FARMA_5_20261010.csv \
      --pdi pdi-comune-di-ascoli-piceno.shp --edifici edifici.geojson
"""
import argparse, collections, csv, json, math, os, subprocess, tempfile
from shapely.geometry import Point, shape
from shapely.prepared import prep

HERE = os.path.dirname(os.path.abspath(__file__))
LUOGHI = os.path.join(HERE, "..", "public", "data", "luoghi_osm.geojson")
COMUNE = os.path.join(HERE, "data", "comune_ascoli.geojson")
QGIS = "/Applications/QGIS-final-3_44_5.app/Contents"
LAT0 = 42.85
MX, MY = 111320 * math.cos(math.radians(LAT0)), 110570
VICINO_M = 75  # [S] stesso luogo se entro 75 m (punti di fonti diverse non coincidono)

# Categorie Overture (campo basic_category) -> categorie dei luoghi OSM [S]
OVERTURE = {
    "bar": "bar", "cafe": "bar", "coffee_shop": "bar", "pub": "bar", "ice_cream_shop": "bar", "dessert_shop": "bar",
    "restaurant": "ristoranti", "casual_eatery": "ristoranti", "pizza_restaurant": "ristoranti", "fast_food_restaurant": "ristoranti",
    "food_and_beverage_store": "alimentari", "grocery_store": "alimentari", "supermarket": "alimentari", "bakery": "alimentari",
    "fashion_and_apparel_store": "moda", "jewelry_store": "moda", "shoe_store": "moda",
    "personal_or_beauty_service": "persona", "pharmacy_and_drug_store": "farmacie",
    "dental_clinic": "salute", "specialized_health_care": "salute", "diagnostics_imaging_or_lab_service": "salute",
    "behavioral_or_mental_health_clinic": "salute", "doctor": "salute", "hospital": "salute", "clinic_or_treatment_center": "salute",
    "bank_or_credit_union": "servizi", "financial_service": "servizi", "attorney_or_law_firm": "servizi",
    "real_estate_service": "servizi", "professional_service": "servizi", "post_office": "servizi",
    "christian_place_of_worship": "culto", "place_of_worship": "culto",
    "sport_or_fitness_facility": "sport", "gym": "sport", "sports_and_recreation": "sport",
    "museum": "cultura", "theater": "cultura", "movie_theater": "cultura", "library": "cultura",
    "park": "verde", "historic_site": "monumenti", "landmark": "monumenti",
    "gas_station": "auto", "automotive_service": "auto",
    "school": "scuole", "specialty_school": "scuole", "college_or_university": "scuole",
}


def punti_osm(categoria=None):
    fc = json.load(open(LUOGHI))
    return [(f["geometry"]["coordinates"], f["properties"]) for f in fc["features"]
            if categoria is None or f["properties"]["categoria"] == categoria]


def vicini(a, punti, m=VICINO_M):
    """Quanti punti di `a` hanno un punto di `punti` entro m metri."""
    return sum(1 for x in a if any(math.hypot((x[0] - y[0]) * MX, (x[1] - y[1]) * MY) <= m for y in punti))


def overture(percorso, comune):
    fc = json.load(open(percorso))
    per_cat, chiusi, aperti = collections.Counter(), 0, []
    fonti = collections.Counter()
    for f in fc["features"]:
        if not comune.contains(shape(f["geometry"])):
            continue
        p = f["properties"]
        if p.get("operating_status") == "permanently_closed":
            chiusi += 1
            continue
        s = p.get("sources")
        s = json.loads(s) if isinstance(s, str) else (s or [])
        fonti[tuple(sorted({x.get("dataset") for x in s} - {"Overture"}))] += 1
        c = OVERTURE.get(p.get("basic_category"))
        if c and (p.get("confidence") or 0) >= 0.7:  # [S] solo record abbastanza sicuri
            per_cat[c] += 1
            aperti.append((f["geometry"]["coordinates"], c))
    osm = collections.Counter(p["categoria"] for _, p in punti_osm())
    print(f"\nOverture (nel Comune): {sum(fonti.values())} luoghi non chiusi, {chiusi} chiusi per sempre; fonti: "
          + ", ".join(f"{'+'.join(k) or 'Overture'} {v}" for k, v in fonti.most_common()))
    print("categoria (confidenza ≥ 0,7)     OSM  Overture  OSM con un Overture della stessa categoria entro 75 m")
    for c in sorted(set(per_cat) | set(osm), key=lambda c: -osm[c]):
        o = [x for x, cc in aperti if cc == c]
        mio = [x for x, _ in punti_osm(c)]
        print(f"  {c:28s} {osm[c]:5d} {per_cat[c]:9d}   {vicini(mio, o):4d}")


PAROLE_VUOTE = {"farmacia", "dott", "dr", "dei", "dottori", "snc", "sas", "srl", "di", "del", "della", "eredi", "comunale", "n"}


def parole(t):
    return {w for w in "".join(c.lower() if c.isalnum() else " " for c in t or "").split() if len(w) > 2 and w not in PAROLE_VUOTE}


def farmacie(percorso):
    righe = list(csv.DictReader(open(percorso, encoding="latin-1"), delimiter=";"))
    attive = [r for r in righe if r["comune"].strip().upper() == "ASCOLI PICENO" and r["data_fine_validita"].strip() in ("-", "")]
    coord = collections.Counter((r["latitudine"], r["longitudine"]) for r in attive if r["latitudine"] not in ("-", ""))
    stesso_punto = max(coord.values()) if coord else 0
    osm = [p for _, p in punti_osm("farmacie") if p["tipo_osm"] == "amenity=pharmacy"]
    nomi_osm = [parole(p["nome"]) for p in osm]
    # Le coordinate del Ministero sono spesso tutte nello stesso punto: il confronto si fa per nome (cognome o via)
    trovate = sum(1 for r in attive if any(parole(r["descrizione_farmacia"]) & n for n in nomi_osm)
                  or (("comunale" in r["descrizione_farmacia"].lower()) and any("comunale" in (p["nome"] or "").lower() for p in osm)))
    print(f"\nFarmacie: Ministero della Salute {len(attive)} attive nel Comune, OSM {len(osm)}; "
          f"del Ministero con una farmacia OSM dello stesso nome: {trovate} su {len(attive)}; "
          f"coordinate del Ministero nello stesso punto: {stesso_punto} (non servono al confronto)")


def pdi(percorso):
    with tempfile.TemporaryDirectory() as tmp:
        out = os.path.join(tmp, "pdi.geojson")
        env = {**os.environ, "PROJ_DATA": os.path.join(QGIS, "Resources", "qgis", "proj"), "GDAL_DATA": os.path.join(QGIS, "Resources", "qgis", "gdal")}
        subprocess.run([os.path.join(QGIS, "MacOS", "ogr2ogr"), "-f", "GeoJSON", "-t_srs", "EPSG:4326", out, percorso],
                       check=True, env=env, stderr=subprocess.DEVNULL)
        fc = json.load(open(out))
    tipi = collections.Counter(f["properties"]["TIPOLOGIA"] for f in fc["features"])
    buoni = [f for f in fc["features"] if 13.3 < f["geometry"]["coordinates"][0] < 13.9 and 42.6 < f["geometry"]["coordinates"][1] < 43.0]
    chiese = [f["geometry"]["coordinates"] for f in buoni if f["properties"]["TIPOLOGIA"] in ("Chiesa", "Convento")]
    musei = [f["geometry"]["coordinates"] for f in buoni if f["properties"]["TIPOLOGIA"] == "Museo"]
    altri = [f["geometry"]["coordinates"] for f in buoni if f["properties"]["TIPOLOGIA"] not in ("Chiesa", "Convento", "Museo")]
    con_orari = sum(1 for f in fc["features"] if (f["properties"].get("ORARIO_INV") or f["properties"].get("ORARIO_EST")))
    osm_culto = [x for x, _ in punti_osm("culto")]
    osm_cultura = [x for x, p in punti_osm("cultura")]
    osm_mon = [x for x, _ in punti_osm("monumenti")] + osm_culto + osm_cultura
    print(f"\nPunti di interesse della Regione: {len(fc['features'])} ({', '.join(f'{k} {v}' for k, v in tipi.most_common(6))}); "
          f"coordinate sbagliate: {len(fc['features']) - len(buoni)}; con orari: {con_orari}")
    print(f"  chiese e conventi {len(chiese)}, con un luogo di culto OSM entro 75 m: {vicini(chiese, osm_culto)} (OSM: {len(osm_culto)})")
    print(f"  musei {len(musei)}, con un luogo OSM della cultura entro 75 m: {vicini(musei, osm_cultura)} (OSM: {len(osm_cultura)})")
    print(f"  altri (fortificazioni, palazzi, monumenti…) {len(altri)}, con un luogo OSM entro 75 m: {vicini(altri, osm_mon)}")


def edifici(percorso):
    fc = json.load(open(percorso))
    usi = collections.Counter(f["properties"].get("Destinazione_uso_attuale") for f in fc["features"])
    # Nei campi Latitudine e Longitudine i valori sono scambiati: si usa la geometria dell'edificio
    scuole = [tuple(shape(f["geometry"]).representative_point().coords[0]) for f in fc["features"]
              if f["properties"].get("Destinazione_uso_attuale") == "Scuola" and f.get("geometry")]
    print(f"\nEdifici comunali ad uso pubblico: {len(fc['features'])} ({', '.join(f'{k} {v}' for k, v in usi.most_common(5))}); "
          f"scuole con una scuola OSM entro 75 m: {vicini(scuole, [x for x, _ in punti_osm('scuole')])} su {len(scuole)}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--overture"); ap.add_argument("--farmacie"); ap.add_argument("--pdi"); ap.add_argument("--edifici")
    a = ap.parse_args()
    comune = prep(shape(json.load(open(COMUNE))["geometry"]))
    print(f"Luoghi OSM: {len(punti_osm())}")
    if a.overture: overture(a.overture, comune)
    if a.farmacie: farmacie(a.farmacie)
    if a.pdi: pdi(a.pdi)
    if a.edifici: edifici(a.edifici)
