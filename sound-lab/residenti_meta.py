"""Assegna a ogni edificio TUM i residenti stimati da Meta (campo `res` in gba_ascoli.geojson).

Fonte: Meta Data for Good, High Resolution Population Density Maps (HRSL) 2020, Italia,
quadratini di 1" (~30 x 23 m), CC BY 4.0. L'archivio nazionale è già nel progetto di Simone:
  Lcz_neurali 2/FETCH+simoneAP/meta_hrsl/cache/ita_population.zip  (ita_general_2020.tif)
Si legge solo il riquadro del Comune, senza estrarre i 17 GB.

Ogni quadratino divide i suoi residenti fra gli edifici che tocca, in proporzione al volume
toccato (area in comune x altezza). Se non tocca edifici, i residenti vanno all'edificio più
vicino entro 60 m, altrimenti si perdono (di solito case sparse non mappate). Edifici senza
residenti (capannoni, chiese, scuole...) restano a 0: di notte nessuno ci torna a casa.

Uso (dalla cartella sound-lab, serve QGIS per gdal_translate):
  .venv/bin/python residenti_meta.py "../Lcz_neurali 2" ../public/data/mappa/gba_ascoli.geojson
"""
import json, math, os, subprocess, sys, tempfile
import numpy as np
from shapely import STRtree, box, contains_xy
from shapely.geometry import shape
from shapely.ops import transform

QGIS = "/Applications/QGIS-final-3_44_5.app/Contents"
ENV = {**os.environ, "PROJ_DATA": os.path.join(QGIS, "Resources", "qgis", "proj")}
W, S, E, N = 13.41, 42.77, 13.75, 42.94  # riquadro della mappa (contiene il Comune)
PX = 1 / 3600                            # lato del quadratino Meta in gradi
NEAREST_M = 60
KX, KY = 111320 * math.cos(math.radians(42.85)), 111320

lcz_dir, gba_path = sys.argv[1], sys.argv[2]
zip_path = os.path.join(lcz_dir, "FETCH+simoneAP", "meta_hrsl", "cache", "ita_population.zip")

with tempfile.TemporaryDirectory() as tmp:
    tif, xyz = os.path.join(tmp, "hrsl.tif"), os.path.join(tmp, "hrsl.xyz")
    gdal = os.path.join(QGIS, "MacOS", "gdal_translate")
    subprocess.run([gdal, "-q", "-projwin", str(W), str(N), str(E), str(S),
                    f"/vsizip/{zip_path}/ita_general_2020.tif", tif], check=True, env=ENV)
    subprocess.run([gdal, "-q", "-of", "XYZ", tif, xyz], check=True, env=ENV)
    px = np.loadtxt(xyz)
px = px[np.isfinite(px[:, 2]) & (px[:, 2] > 0)]
# Solo il Comune di Ascoli Piceno (confine OSM, relazione 42176)
comune = shape(json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "comune_ascoli.geojson")))["geometry"])
px = px[contains_xy(comune, px[:, 0], px[:, 1])]

gba = json.load(open(gba_path))
to_m = lambda x, y: (x * KX, y * KY)
geoms = [shape(f["geometry"]) for f in gba["features"]]
heights = np.array([f["properties"]["height"] if (f["properties"].get("height") or 0) > 0 else 3 for f in gba["features"]])
tree = STRtree(geoms)
centroids_m = np.array([to_m(*g.centroid.coords[0]) for g in geoms])
res = np.zeros(len(geoms))
lost = near = 0.0

for lon, lat, r in px:
    cell = box(lon - PX / 2, lat - PX / 2, lon + PX / 2, lat + PX / 2)
    idx = tree.query(cell, predicate="intersects")
    if len(idx):
        w = np.array([transform(to_m, geoms[i].intersection(cell)).area for i in idx]) * heights[idx]
        if w.sum() > 0:
            res[idx] += r * w / w.sum()
            continue
    d = np.hypot(centroids_m[:, 0] - lon * KX, centroids_m[:, 1] - lat * KY)
    i = int(d.argmin())
    if d[i] <= NEAREST_M:
        res[i] += r
        near += r
    else:
        lost += r

for f, v in zip(gba["features"], res):
    f["properties"]["res"] = round(float(v), 2)
json.dump(gba, open(gba_path, "w"), separators=(",", ":"))

tot = px[:, 2].sum()
vol = np.array([transform(to_m, g).area for g in geoms]) * heights
print(f"residenti Meta nel Comune: {tot:,.0f}  assegnati: {res.sum():,.0f}  "
      f"(all'edificio più vicino: {near:,.0f}, persi: {lost:,.0f})")
print(f"edifici senza residenti: {(res == 0).sum():,} su {len(res):,} "
      f"({vol[res == 0].sum() / vol.sum():.0%} del volume costruito)")
