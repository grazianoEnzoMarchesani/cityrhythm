"""Aggiorna i contorni degli edifici TUM di fonte OSM con quelli di OSM di oggi, tenendo le altezze del TUM.

Perché: il TUM (GlobalBuildingAtlas) ha copiato gli edifici di OSM qualche anno fa, mentre le strade della mappa
vengono da OSM recente (ascoli_base.pmtiles). Nel frattempo in OSM sono stati ridisegnati alcuni isolati (es. le Rue,
modifica "Fixed buildings" del 2025-08-12): coi contorni vecchi le strade passavano dentro le case.

Contorni nuovi: dagli edifici della mappa di base (tessere z15, precisione ~0,3 m), riuniti per identità OSM.
- Stesso edificio (stessa identità OSM) con forma cambiata: contorno nuovo, altezza TUM sua (campo osm_update = "shape").
  Cambiata = differenza oltre l'8% dell'area: fra edifici uguali lo scarto delle tessere è 1,3% (mediana), 3,1% (90°).
- Edificio ridisegnato con identità nuova sopra edifici TUM che cambiano o spariscono: altezza = media delle altezze
  TUM degli edifici vecchi che stavano lì, pesata sulla superficie in comune (osm_update = "redrawn"). Se il TUM
  copre meno del 20% dell'edificio, si esclude: tocca un edificio vecchio ma sta per lo più dove il TUM non aveva
  nulla, ridisegno dubbio (decisione dell'utente, 2026-10-06).
- Edificio vecchio la cui identità non c'è più in OSM: si toglie se edifici di oggi ne coprono la maggior parte
  (ridisegnato) o se è in SPARITI_VERIFICATI; altrimenti resta com'è, si elenca e lo si verifica a mano con la
  cronologia OSM (https://www.openstreetmap.org/way/<id>/history). Gli edifici nuovi sopra di lui aspettano.
Solo edifici nel Comune di Ascoli Piceno. Gli edifici Microsoft (source = "ms") non si toccano.

Uso (dalla cartella sound-lab; serve la CLI pmtiles di brew, la stessa che rigenera la mappa di base):
  .venv/bin/python aggiorna_edifici_osm.py ../public/data/mappa/ascoli_base.pmtiles ../public/data/mappa/gba_ascoli.geojson
Poi rilanciare residenti_meta.py: i residenti vanno ridistribuiti sui contorni nuovi.
"""
import collections, gzip, json, math, os, struct, subprocess, sys
from shapely import STRtree
from shapely.geometry import Polygon, mapping, shape
from shapely.ops import transform, unary_union

# Spariti da OSM e coperti per meno della metà da edifici di oggi, verificati uno per uno con la cronologia OSM
# e approvati dall'utente (2026-10-06): si tolgono.
SPARITI_VERIFICATI = {
    "518512413": "Porta Cartara: demolito (OSM 2024-12-03, demolished:building, fonte Cronache Picene)",
    "561377352": "zona delle Rue: era un muro disegnato come edificio (OSM 2025-08-12, ora barrier=wall)",
    "545649020": "Marino del Tronto: ridisegnato da foto aeree in 4 edifici più piccoli (OSM 2025-08-02)",
}

Z = 15
CHANGED = 0.08     # oltre lo scarto delle tessere (vedi sopra)
MIN_TUM = 0.20     # copertura TUM minima per dare l'altezza a un edificio ridisegnato
SLIVER_M2 = 1.0    # sotto 1 m² le sovrapposizioni sono sbavature fra vicini (precisione delle tessere 0,3 m)
KX, KY = 111320 * math.cos(math.radians(42.85)), 110574
to_m = lambda g: transform(lambda x, y, z=None: (x * KX, y * KY), g)

pm_path, gba_path = sys.argv[1], sys.argv[2]
comune = shape(json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "comune_ascoli.geojson")))["geometry"])


# --- Lettura minima delle tessere vettoriali (Mapbox Vector Tile, protobuf) ---
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

def tile_buildings(tile):
    """(id, [anelli in coordinate della tessera], estensione) degli edifici di una tessera."""
    for f, layer in fields(tile):
        if f != 3: continue
        parts = list(fields(layer))
        if next(v for f2, v in parts if f2 == 1).decode() != "buildings": continue
        extent = next((v for f2, v in parts if f2 == 5), 4096)
        for f2, feat in parts:
            if f2 != 2: continue
            fid, geom = None, []
            for f3, v in fields(feat):
                if f3 == 1: fid = v
                elif f3 == 4: geom = packed(v)
            rings, x, y, i = [], 0, 0, 0
            while i < len(geom):
                cmd, cnt = geom[i] & 7, geom[i] >> 3; i += 1
                if cmd == 7: continue
                for _ in range(cnt):
                    x += zz(geom[i]); y += zz(geom[i + 1]); i += 2
                    if cmd == 1: rings.append([(x, y)])
                    else: rings[-1].append((x, y))
            yield fid, rings, extent

def tile_of(lon, lat):
    n = 2 ** Z
    return int((lon + 180) / 360 * n), int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)

def to_lonlat(tx, ty, px, py, extent):
    n = 2 ** Z
    lon = (tx + px / extent) / n * 360 - 180
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (ty + py / extent) / n))))
    return round(lon, 7), round(lat, 7)

def osm_id(fid):
    """Identità OSM dall'id della tessera (Planetiler: 2·2^44 + via, 3·2^44 + relazione)."""
    return str(fid - (2 << 44)) if fid >> 44 == 2 else "r" + str(fid - (3 << 44))


# --- Edifici TUM e edifici OSM di oggi ---
gba = json.load(open(gba_path))
feats = gba["features"]
old = [shape(f["geometry"]) for f in feats]
old_m = [to_m(g) for g in old]
tiles = {tile_of(*g.representative_point().coords[0]) for g in old}
tiles = {(x + dx, y + dy) for x, y in tiles for dx in (-1, 0, 1) for dy in (-1, 0, 1)}

pieces = collections.defaultdict(list)
for tx, ty in tiles:
    raw = subprocess.run(["pmtiles", "tile", "-q", pm_path, str(Z), str(tx), str(ty)], capture_output=True, check=True).stdout
    if not raw: continue
    for fid, rings, extent in tile_buildings(gzip.decompress(raw)):
        polys = []
        for r in rings:
            if len(r) < 3: continue
            area2 = sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(r, r[1:] + r[:1]))
            ll = [to_lonlat(tx, ty, px, py, extent) for px, py in r]
            if area2 > 0: polys.append([ll])        # anello esterno (y verso il basso)
            elif polys: polys[-1].append(ll)        # buco dell'ultimo anello esterno
        pieces[osm_id(fid)] += [Polygon(p[0], p[1:]).buffer(0) for p in polys]
now = {k: unary_union(v) for k, v in pieces.items()}   # un edificio a cavallo di più tessere torna intero
now_m = {k: to_m(g) for k, g in now.items()}
now_list = list(now_m.values())
now_tree = STRtree(now_list)

# --- Confronto ---
tum_osm = {f["properties"]["id"]: i for i, f in enumerate(feats) if f["properties"]["source"] == "osm"}
reshaped, gone, pending = {}, set(), set()
for oid, i in tum_osm.items():
    if oid in now_m:
        if old_m[i].symmetric_difference(now_m[oid]).area > CHANGED * old_m[i].area:
            reshaped[i] = oid
        continue
    covered = sum(old_m[i].intersection(now_list[k]).area for k in now_tree.query(old_m[i]))
    if covered > 0.5 * old_m[i].area or oid in SPARITI_VERIFICATI:
        gone.add(i)
    else:
        pending.add(i)

old_tree = STRtree(old_m)
touched = set(reshaped) | gone
added, excluded, waiting = [], [], []
for oid, g in now_m.items():
    if oid in tum_osm or not comune.contains(now[oid].representative_point()): continue
    under = [(j, g.intersection(old_m[j]).area) for j in old_tree.query(g)]
    under = [(j, a) for j, a in under if a > SLIVER_M2]
    if not any(j in touched or j in pending for j, _ in under): continue
    if any(j in pending for j, _ in under):
        waiting.append(oid); continue
    with_h = [(j, a) for j, a in under if (feats[j]["properties"].get("height") or 0) > 0]
    cover = sum(a for _, a in with_h)
    if cover < MIN_TUM * g.area:
        excluded.append((oid, round(g.area), [(feats[j]["properties"]["id"], round(a, 1)) for j, a in under])); continue
    mean = lambda key: round(sum((feats[j]["properties"].get(key) or 0) * a for j, a in with_h) / cover, 2)
    added.append({"type": "Feature", "geometry": mapping(now[oid]),
                  "properties": {"source": "osm", "id": oid, "region": "ITA", "height": mean("height"),
                                 "var": mean("var"), "res": 0.0, "osm_update": "redrawn"}})

for i, oid in reshaped.items():
    feats[i]["geometry"] = mapping(now[oid])
    feats[i]["properties"]["osm_update"] = "shape"
gba["features"] = [f for i, f in enumerate(feats) if i not in gone] + added
json.dump(gba, open(gba_path, "w"), separators=(",", ":"))

print(f"edifici TUM di fonte OSM: {len(tum_osm):,}  forma aggiornata: {len(reshaped)}  tolti: {len(gone)}  "
      f"aggiunti (ridisegnati): {len(added)}  totale edifici: {len(gba['features']):,}")
for oid, area, under in excluded:
    print(f"  escluso {oid} ({area} m²): il TUM ne copre meno del {MIN_TUM:.0%}; edifici vecchi toccati (m²): {under}")
for i in sorted(pending):
    p = feats[i]["properties"]
    print(f"  DA VERIFICARE: {p['id']} ({old_m[i].area:.0f} m², altezza {p.get('height')}) non c'è più in OSM: "
          f"https://www.openstreetmap.org/way/{p['id']}/history")
if waiting:
    print(f"  in attesa (sopra un edificio da verificare): {', '.join(waiting)}")
