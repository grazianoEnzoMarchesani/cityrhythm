"""Estrae le Local Climate Zone (celle vettoriali da 30 m) dal progetto QGIS
`Lcz_neurali 2` e le ritaglia sull'area dei quartieri di Ascoli.

Fonte: FETCH+simoneAP/unified/lcz_grid_30m_lcz_params.gpkg (EPSG:3004).
Area: rettangolo che contiene i quartieri KML e i punti (spot, luoghi affollati)
+ 150 m di margine, intersecato col confine del Comune (regola: solo Ascoli).
Si tengono le celle intere col centro dentro l'area; nessun raggruppamento.
Uscita: GeoJSON in WGS84 con il quartiere di ogni cella (o il piu' vicino); campi vuoti (lcz_score, lcz_confidence, dist_*) e
tecnici (left, top, row_index, ...) esclusi.

Uso:  .venv/bin/python estrai_lcz.py "../Lcz_neurali 2" ../public/data/lcz_ascoli.geojson
Serve QGIS (usa ogr2ogr e proj.db del pacchetto; percorso in QGIS sotto).
"""
import json, math, os, re, sqlite3, subprocess, sys, tempfile
import pandas as pd
from shapely.geometry import Polygon, box, shape
from shapely.ops import transform, unary_union

QGIS = "/Applications/QGIS-final-3_44_5.app/Contents"
OGR2OGR = os.path.join(QGIS, "MacOS", "ogr2ogr")
ENV = {**os.environ, "PROJ_DATA": os.path.join(QGIS, "Resources", "qgis", "proj")}
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "public", "data")
MARGINE_M = 150

# campi pieni e significativi per spiegare come nasce la LCZ (arrotondati)
CAMPI = [
    "id", "lcz_class", "lcz_vulnerability", "round(lcz_rmsep, 4) AS lcz_rmsep", "lcz_matches",
    "lcz_esa_fix", "svf_mean", "building_frac", "impervious_frac", "pervious_frac", "aspect_ratio",
    "z_h", "terrain_rough", "admittance", "anthro_heat", "albedo", "z0_value", "industry_heat",
]


def ogr(*args):
    subprocess.run([OGR2OGR, *args], check=True, env=ENV)


def in_3004(geojson, tmp):
    """Riproietta un GeoJSON (WGS84) in EPSG:3004 e ne restituisce la geometria unita."""
    out = os.path.join(tmp, os.path.basename(geojson) + ".3004.geojson")
    ogr("-t_srs", "EPSG:3004", "-f", "GeoJSON", out, geojson)
    return unary_union([shape(f["geometry"]) for f in json.load(open(out))["features"]])


def main(progetto, uscita):
    gpkg = os.path.join(progetto, "FETCH+simoneAP", "unified", "lcz_grid_30m_lcz_params.gpkg")
    with tempfile.TemporaryDirectory() as tmp:
        # rettangolo: quartieri KML + spot + luoghi affollati
        kml = open(os.path.join(DATA, "cityrhythm_blimp_areas.kml")).read()
        pts = [tuple(map(float, p.split(",")[:2]))
               for c in re.findall(r"<coordinates>(.*?)</coordinates>", kml, re.S) for p in c.split()]
        spot = pd.read_csv(os.path.join(DATA, "cityrhythm_spotMapper.csv"))
        folla = pd.read_csv(os.path.join(DATA, "cityrhythm_crowded_data.csv"))
        pts += list(zip(spot.Longitudine, spot.Latitudine)) + list(zip(folla.longitude, folla.latitude))
        xs, ys = zip(*pts)
        r = os.path.join(tmp, "rett.geojson")
        json.dump({"type": "Feature", "properties": {},
                   "geometry": box(min(xs), min(ys), max(xs), max(ys)).__geo_interface__}, open(r, "w"))
        rett = in_3004(r, tmp).envelope.buffer(MARGINE_M, join_style=2)
        comune = in_3004(os.path.join(HERE, "data", "comune_ascoli.geojson"), tmp)
        area = rett.intersection(comune)

        # celle intere col centro nell'area
        db = sqlite3.connect(f"file:{gpkg}?mode=ro", uri=True)
        x0, y0, x1, y1 = area.bounds
        fids = [fid for fid, l, t, rr, b in db.execute(
            "SELECT fid, left, top, right, bottom FROM lcz_grid_30m "
            f"WHERE right > {x0} AND left < {x1} AND top > {y0} AND bottom < {y1}")
            if area.contains(box(l, b, rr, t).centroid)]
        db.close()

        sql = (f"SELECT {', '.join(CAMPI)}, geom FROM lcz_grid_30m "
               f"WHERE fid IN ({','.join(map(str, fids))})")
        if os.path.exists(uscita):
            os.remove(uscita)
        grezzo = os.path.join(tmp, "lcz.geojson")
        ogr("-f", "GeoJSON", "-t_srs", "EPSG:4326", "-dialect", "SQLite", "-sql", sql,
            "-lco", "RFC7946=YES", "-lco", "COORDINATE_PRECISION=6", "-nln", "lcz_ascoli", grezzo, gpkg)
        fc = json.load(open(grezzo))

    # quartiere di ogni cella (energia della bussola): quello che la contiene, altrimenti il piu' vicino
    quartieri = {}
    for pm in re.findall(r"<Placemark[^>]*>(.*?)</Placemark>", kml, re.S):
        nome = re.search(r"<name>(.*?)</name>", pm).group(1).strip()
        coords = re.search(r"<coordinates>(.*?)</coordinates>", pm, re.S).group(1)
        quartieri[nome] = locale(Polygon([tuple(map(float, c.split(",")[:2])) for c in coords.split()]))
    for f in fc["features"]:
        c = locale(shape(f["geometry"]).centroid)
        dist = {nome: q.distance(c) for nome, q in quartieri.items()}
        nome = min(dist, key=dist.get)
        f["properties"]["quartiere"] = nome
        f["properties"]["quartiere_dist_m"] = round(dist[nome])
    fc.pop("xy_coordinate_resolution", None)
    json.dump(fc, open(uscita, "w"), separators=(",", ":"), ensure_ascii=False)
    fuori = sum(1 for f in fc["features"] if f["properties"]["quartiere_dist_m"] > 0)
    print(f"{len(fids)} celle ({fuori} fuori dai quartieri) -> {uscita} ({os.path.getsize(uscita) / 1e6:.1f} MB)")


def locale(geom, lat0=42.854):
    """Coordinate in metri (equirettangolare locale), sufficiente su pochi km."""
    k = 111320 * math.cos(math.radians(lat0))
    return transform(lambda x, y: (x * k, y * 110570), geom)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
