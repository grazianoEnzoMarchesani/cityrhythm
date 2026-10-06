"""Segna gli edifici TUM che sono "interni pubblici" alla maniera di Nolli (campo `pub` in gba_ascoli.geojson).

Nella Pianta di Roma di G. B. Nolli (1748) le chiese e pochi altri edifici aperti a tutti sono disegnati come lo
spazio pubblico (vuoti), non come pieni. Qui: edifici che contengono un punto OSM di uno di questi tipi:
  place_of_worship (chiese, cappelle), museum, theatre, library.
Fonte: i punti di interesse OSM già nella mappa di base (ascoli_base.pmtiles, tessere z15, livello "pois").
La pianta interna (navate, colonne) in OSM non c'è: si disegna solo la sagoma dell'edificio.
Un edificio con più punti prende il tipo del primo nell'ordine sopra. Solo edifici nel Comune di Ascoli Piceno.

Uso (dalla cartella sound-lab; serve la CLI pmtiles di brew):
  .venv/bin/python interni_pubblici.py ../public/data/mappa/ascoli_base.pmtiles ../public/data/mappa/gba_ascoli.geojson
Va rilanciato dopo aggiorna_edifici_osm.py e residenti_meta.py (se si rigenera la mappa di base).
"""
import gzip, json, math, os, struct, subprocess, sys
from shapely import STRtree
from shapely.geometry import Point, shape

KINDS = ["place_of_worship", "museum", "theatre", "library"]
Z = 15
KX, KY = 111320 * math.cos(math.radians(42.85)), 110574

pm_path, gba_path = sys.argv[1], sys.argv[2]
comune = shape(json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "comune_ascoli.geojson")))["geometry"])


# --- Lettura minima delle tessere vettoriali (Mapbox Vector Tile, protobuf), come in aggiorna_edifici_osm.py ---
def varint(b, i):
    r = s = 0
    while True:
        c = b[i]; i += 1; r |= (c & 0x7f) << s; s += 7
        if c < 0x80: return r, i

def fields(b):
    i = 0
    while i < len(b):
        k, i = varint(b, i)
        f, t = k >> 3, k & 7
        if t == 0: v, i = varint(b, i)
        elif t == 2:
            n, i = varint(b, i); v = b[i:i + n]; i += n
        elif t == 1: v = b[i:i + 8]; i += 8
        elif t == 5: v = b[i:i + 4]; i += 4
        yield f, v

def packed(b):
    out, i = [], 0
    while i < len(b):
        v, i = varint(b, i); out.append(v)
    return out

zz = lambda n: (n >> 1) ^ -(n & 1)

def value(b):
    for f, v in fields(b):
        if f == 1: return v.decode()
        if f == 2: return struct.unpack("<f", v)[0]
        if f == 3: return struct.unpack("<d", v)[0]
        if f in (4, 5): return v
        if f == 6: return zz(v)
        if f == 7: return bool(v)

def tile_pois(tile):
    """(tag, x, y, estensione) dei punti di interesse di una tessera."""
    for f, layer in fields(tile):
        if f != 3: continue
        parts = list(fields(layer))
        if next(v for f2, v in parts if f2 == 1).decode() != "pois": continue
        keys = [v.decode() for f2, v in parts if f2 == 3]
        vals = [value(v) for f2, v in parts if f2 == 4]
        extent = next((v for f2, v in parts if f2 == 5), 4096)
        for f2, feat in parts:
            if f2 != 2: continue
            tags, geom, gtype = {}, [], None
            for f3, v in fields(feat):
                if f3 == 2:
                    t = packed(v); tags = {keys[t[j]]: vals[t[j + 1]] for j in range(0, len(t), 2)}
                elif f3 == 3: gtype = v
                elif f3 == 4: geom = packed(v)
            if gtype == 1 and geom:
                yield tags, zz(geom[1]), zz(geom[2]), extent

def tile_of(lon, lat):
    n = 2 ** Z
    return int((lon + 180) / 360 * n), int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)

def to_lonlat(tx, ty, px, py, extent):
    n = 2 ** Z
    lon = (tx + px / extent) / n * 360 - 180
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (ty + py / extent) / n))))
    return lon, lat


# --- Punti OSM dei tipi scelti nel Comune (le tessere ripetono i punti vicini ai bordi: si tengono una volta) ---
w, s, e, n = comune.bounds
(x0, y1), (x1, y0) = tile_of(w, s), tile_of(e, n)
pois = {}
for tx in range(x0, x1 + 1):
    for ty in range(y0, y1 + 1):
        raw = subprocess.run(["pmtiles", "tile", "-q", pm_path, str(Z), str(tx), str(ty)], capture_output=True, check=True).stdout
        if not raw: continue
        for tags, px, py, extent in tile_pois(gzip.decompress(raw)):
            if tags.get("kind") not in KINDS or not (0 <= px < extent and 0 <= py < extent): continue
            lon, lat = to_lonlat(tx, ty, px, py, extent)
            if comune.contains(Point(lon, lat)):
                pois[(tags["kind"], tags.get("name"), round(lon, 5), round(lat, 5))] = (lon, lat)

# --- Edificio TUM che contiene ogni punto ---
gba = json.load(open(gba_path))
feats = gba["features"]
geoms = [shape(f["geometry"]) for f in feats]
tree = STRtree(geoms)
for f in feats: f["properties"].pop("pub", None)
names, outside = {}, []
for (kind, name, _, _), (lon, lat) in sorted(pois.items(), key=lambda p: KINDS.index(p[0][0])):
    pt = Point(lon, lat)
    hit = next((i for i in tree.query(pt) if geoms[i].contains(pt)), None)
    if hit is None:
        outside.append(f"{kind} {name}"); continue
    feats[hit]["properties"].setdefault("pub", kind)
    names.setdefault(hit, []).append(name or kind)

json.dump(gba, open(gba_path, "w"), separators=(",", ":"))

area = lambda g: g.area * KX * KY
print(f"punti OSM: {len(pois)}, fuori dagli edifici: {len(outside)} {outside}")
for k in KINDS:
    print(f"  {k}: {sum(1 for f in feats if f['properties'].get('pub') == k)} edifici")
res = sum(f["properties"].get("res", 0) for f in feats if f["properties"].get("pub"))
print(f"residenti Meta assegnati a questi edifici: {res:.0f} (la mappa non ci mette nessuno a casa)")
print("edifici sopra i 2.000 m² (controllare che non siano complessi più grandi della chiesa):")
for i in sorted(names, key=lambda i: -area(geoms[i])):
    if area(geoms[i]) < 2000: break
    print(f"  {area(geoms[i]):6.0f} m²  {', '.join(names[i])}")
