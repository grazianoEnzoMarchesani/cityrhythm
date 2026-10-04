# Estrae gli edifici GlobalBuildingAtlas (TUM, CC BY-NC 4.0) del solo Comune di Ascoli Piceno.
# Serve il tassello europe/e010_n45_e015_n40 (circa 4,4 GB): scaricare prima, nella cartella corrente,
#   odbl.geojson  <- GBA.ODbLPolygon/europe/e010_n45_e015_n40.geojson
#   lod1.json     <- GBA.LoD1/LoD1/europe/e010_n45_e015_n40.json
# (da https://huggingface.co/datasets/zhu-xlab; NON usare il WFS del TUM, gli autori lo vietano per gli scaricamenti).
# Uso: python estrai_edifici_gba.py ../public/data/mappa/gba_ascoli.geojson   (richiede ijson)
import sys, json, math, re, subprocess, ijson
BASE = 'https://huggingface.co/datasets/zhu-xlab/'
TILE = 'europe/e010_n45_e015_n40'
# Solo il Comune di Ascoli Piceno (confine OSM, relazione 42176).
COMUNE = json.load(open(__import__('os').path.join(__import__('os').path.dirname(__file__), 'data', 'comune_ascoli.geojson')))['geometry']['coordinates']
W, S_, E, N = 13.41, 42.77, 13.75, 42.94
def inring(x, y, r):
    c = False
    for i in range(len(r)):
        (x1, y1), (x2, y2) = r[i], r[i - 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: c = not c
    return c
def in_comune(lon, lat): return any(inring(lon, lat, p[0]) and not any(inring(lon, lat, h) for h in p[1:]) for p in COMUNE)
R = 20037508.342789244
def to_merc(lon, lat): return lon * R / 180, math.log(math.tan((90 + lat) * math.pi / 360)) * R / math.pi
def to_ll(x, y): return round(x * 180 / R, 7), round(math.degrees(2 * math.atan(math.exp(y * math.pi / R)) - math.pi / 2), 7)
X0, Y0 = to_merc(W, S_); X1, Y1 = to_merc(E, N)
first = re.compile(rb'"coordinates": [\[ ]+([\d.]+), ([\d.]+)')

def stream(url):
    local = {'GBA.ODbLPolygon': 'odbl.geojson', 'main/LoD1/': 'lod1.json'}
    for k, f in local.items():
        if k in url: return open(f, 'rb')
    return subprocess.Popen(['curl', '-sL', '--retry', '3', url], stdout=subprocess.PIPE).stdout

feats = {}
for url in [BASE + 'GBA.LoD1/resolve/main/Polygon/' + TILE + '.geojson',
            BASE + 'GBA.ODbLPolygon/resolve/main/' + TILE + '.geojson']:
    n = 0
    for line in stream(url):
        m = first.search(line)
        if not m: continue
        n += 1
        x, y = float(m[1]), float(m[2])
        if not (X0 <= x <= X1 and Y0 <= y <= Y1) or not in_comune(*to_ll(x, y)): continue
        f = json.loads(line.rstrip().rstrip(b','))
        p = f['properties']
        g = f['geometry']
        polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
        polys = [[[list(to_ll(*c)) for c in ring] for ring in poly] for poly in polys]
        g['coordinates'] = polys if g['type'] == 'MultiPolygon' else polys[0]
        feats[p['source'] + p['id'] + p['region']] = f
    print(url.split('/')[-1], 'letti', n, 'nella zona', len(feats), flush=True)

found = 0
for key, v in ijson.kvitems(stream(BASE + 'GBA.LoD1/resolve/main/LoD1/' + TILE + '.json'), ''):
    if key in feats:
        feats[key]['properties'].update(height=round(float(v['height']), 2) if v.get('height') is not None else None,
                                        var=round(float(v['var']), 2) if v.get('var') is not None else None)
        found += 1
print('altezze trovate', found, 'su', len(feats), flush=True)
json.dump({'type': 'FeatureCollection', 'features': list(feats.values())}, open(sys.argv[1], 'w'), separators=(',', ':'))
