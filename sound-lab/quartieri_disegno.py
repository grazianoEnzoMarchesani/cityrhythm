"""Confini di disegno dei quartieri: SOLO estetica, i calcoli restano sul KML originale.

Le sezioni di censimento ISTAT 2021 (CC BY 4.0) seguono strade e fiumi. Ogni sezione va al quartiere del KML
con cui si sovrappone di più; i buchi fra due quartieri vicini si chiudono. Porta Cartara resta sul KML; quattro
quartieri (COPERTURA) coprono la loro area con tutte le sezioni che la toccano, anche se escono da essa.

Input: sezioni del Comune di Ascoli Piceno (codice ISTAT 44007) in GeoJSON WGS84. Si ottengono da R11_21.zip
(https://www.istat.it/storage/cartografia/basi_territoriali/2021/R11_21.zip) con:
  ogr2ogr -f GeoJSON -t_srs EPSG:4326 -where "PRO_COM = 44007" sezioni_ascoli.geojson SHP/R11_21_WGS84.shp
Uscita: public/data/quartieri_disegno.geojson (stessi nomi del KML; campo `stato`: 'istat' o 'kml').

Uso: .venv/bin/python quartieri_disegno.py <sezioni_ascoli.geojson>
"""
import itertools
import json
import math
import os
import re
import sys

from shapely.geometry import Polygon, mapping, shape
from shapely.ops import transform, unary_union
from shapely.strtree import STRtree
from shapely import set_precision
from shapely.validation import make_valid

HERE = os.path.dirname(os.path.abspath(__file__))
KML_PATH = os.path.join(HERE, '..', 'public', 'data', 'cityrhythm_blimp_areas.kml')
USCITA = os.path.join(HERE, '..', 'public', 'data', 'quartieri_disegno.geojson')

# [S] scelte di metodo, da rivedere all'ascolto a schermo
SOGLIA = 0.5                 # quota minima della sezione dentro un quartiere per assegnarla
AREA_MAX_SEZIONE = 20000     # m²: solo sezioni di scala urbana si usano per chiudere i buchi
DISTANZA_GAP = 60            # m: spazi vuoti più stretti di così fra due quartieri si chiudono
AREA_MAX_GAP = 25000         # m²: pezzi vuoti chiusi (stretti, <60 m) che toccano due quartieri diversi si assegnano al vicino
SEMPLIFICA = 1.0             # m: tolleranza della semplificazione finale
DISTANZA_BORDO = 20          # m: due quartieri più vicini di così si toccano (la striscia fra i due si assegna)
# [S] Porta Cartara resta sul KML: il disegno originale va bene così
KML_FISSO = {'Ascoli - Porta Cartara'}
# [S] questi quattro si coprono con tutte le sezioni che toccano la loro area KML, anche se escono da essa:
# l'area in più non conta, i conteggi restano sul KML (sound-lab/estrai_lcz.py, compass.py, presenze)
COPERTURA = {'Ascoli - Borgo Chiaro', 'Ascoli - Stadio', 'Ascoli - Pennile di Sotto', 'Ascoli - Tofare'}
# [S] True: una sezione che tocca un quartiere da coprire va a lui anche se era di un vicino approvato.
# False: i vicini approvati tengono le loro sezioni, e resta scoperta un po' di area dei quattro.
PRIORITA_COPERTURA = True

K = math.cos(math.radians(42.85))
def a_metri(x, y, z=None):
    return (x * 111320 * K, y * 110574)
def a_gradi(x, y, z=None):
    return (x / (111320 * K), y / 110574)


def leggi_kml():
    testo = open(KML_PATH, encoding='utf-8').read()
    quartieri = {}
    for pm in re.findall(r'<Placemark[^>]*>(.*?)</Placemark>', testo, re.S):
        nome = re.search(r'<name>(.*?)</name>', pm).group(1).strip()
        coords = re.search(r'<coordinates>(.*?)</coordinates>', pm, re.S).group(1).split()
        pts = [tuple(map(float, c.split(',')[:2])) for c in coords]
        quartieri[nome] = transform(a_metri, Polygon(pts)).buffer(0)
    return quartieri


def pulisci(geom):
    """Geometria valida e solo poligoni (le operazioni di unione e differenza possono lasciare resti)."""
    geom = make_valid(geom)  # niente buffer(0) dopo: su alcune geometrie riapre gli autoincroci
    if geom.geom_type == 'GeometryCollection':
        geom = unary_union([g for g in geom.geoms if g.geom_type in ('Polygon', 'MultiPolygon')])
    # [S] precisione di 1 mm: coordinate quasi coincidenti diventano valide dopo il ritorno in gradi
    return set_precision(geom, 0.001, mode='valid_output')


def sistema_sovrapposizioni(disegno):
    for a, b in itertools.combinations(list(disegno), 2):
        ga, gb = disegno[a][1], disegno[b][1]
        comune = ga.intersection(gb)
        if comune.area > 0.01:  # m²: sotto il centimetro quadrato è rumore di calcolo
            if disegno[a][0] == 'copertura' or disegno[b][0] == 'copertura':
                # il quartiere da coprire cede il pezzo in comune; quelli approvati non cambiano
                if disegno[a][0] == 'copertura':
                    disegno[a] = ('copertura', pulisci(ga.difference(comune)))
                else:
                    disegno[b] = ('copertura', pulisci(gb.difference(comune)))
            elif disegno[a][0] == 'kml' and disegno[b][0] == 'istat':
                disegno[b] = ('istat', pulisci(gb.difference(comune)))
            else:
                disegno[a] = (disegno[a][0], pulisci(ga.difference(comune)))


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    kml = leggi_kml()
    sezioni = json.load(open(sys.argv[1], encoding='utf-8'))['features']
    sez = [transform(a_metri, shape(f['geometry'])).buffer(0) for f in sezioni]
    albero = STRtree(sez)

    # 1) ogni sezione va al quartiere con cui si sovrappone di più, se è dentro per almeno SOGLIA
    assegnata = [None] * len(sez)
    for i, s in enumerate(sez):
        migliore, area_migliore = None, 0
        for nome, p in kml.items():
            a = s.intersection(p).area
            if a > area_migliore:
                migliore, area_migliore = nome, a
        if migliore and area_migliore / s.area >= SOGLIA:
            assegnata[i] = migliore

    # 2) buchi fra due quartieri diversi: un solo passaggio, solo sezioni piccole che toccano l'area KML
    unione_kml = unary_union(list(kml.values()))
    for i, s in enumerate(sez):
        if assegnata[i] is not None or s.area > AREA_MAX_SEZIONE:
            continue
        if s.intersection(unione_kml).area <= 0:
            continue
        contatto = {}
        for j in albero.query(s):
            j = int(j)
            if j == i or assegnata[j] is None:
                continue
            c = s.boundary.intersection(sez[j].boundary).length
            if c > 0:
                contatto[assegnata[j]] = contatto.get(assegnata[j], 0) + c
        if len(contatto) >= 2:
            assegnata[i] = max(contatto, key=contatto.get)

    # 2b) quartieri da coprire: le sezioni che toccano la loro area KML vanno a loro (vedi sotto)
    # Priorità alla copertura: una sezione che tocca l'area di uno dei quattro va a lui, anche se era di un vicino
    # approvato; Porta Cartara (KML fisso) non si tocca.
    for i, s in enumerate(sez):
        if assegnata[i] in KML_FISSO or (not PRIORITA_COPERTURA and assegnata[i] is not None):
            continue
        migliore, area_migliore = None, 0
        for nome in COPERTURA:
            a = s.intersection(kml[nome]).area
            if a > area_migliore:
                migliore, area_migliore = nome, a
        if migliore:
            assegnata[i] = migliore

    # 3) unione per quartiere; Porta Cartara resta sul KML, i quattro coprono la loro area KML
    disegno = {}
    for nome in kml:
        if nome in KML_FISSO:
            disegno[nome] = ('kml', kml[nome])
            continue
        parti = [sez[i] for i in range(len(sez)) if assegnata[i] == nome]
        stato = 'copertura' if nome in COPERTURA else 'istat'
        disegno[nome] = (stato, unary_union(parti).buffer(0)) if parti else ('kml', kml[nome])
    for nome in COPERTURA:
        if disegno[nome][0] == 'copertura':
            rimasto = kml[nome].difference(disegno[nome][1]).area
            print(f"  copertura {nome[8:]:24} area KML non coperta: {rimasto/1e6:.4f} km² ({rimasto/kml[nome].area*100:.1f}%)")

    # 4) sovrapposizioni: il pezzo in comune va al quartiere ISTAT (il KML è il riferimento da rivedere)
    sistema_sovrapposizioni(disegno)

    # 5) spazi vuoti stretti fra quartieri: chiusura morfologica, poi ogni pezzo va al vicino con più contatto
    stato_geom = {n: g for n, (_, g) in disegno.items()}
    unione = unary_union(list(stato_geom.values()))
    chiusa = unione.buffer(DISTANZA_GAP / 2).buffer(-DISTANZA_GAP / 2)
    vuoti = chiusa.difference(unione)
    pezzi = list(vuoti.geoms) if hasattr(vuoti, 'geoms') else [vuoti]
    for pezzo in pezzi:
        if pezzo.area > AREA_MAX_GAP or pezzo.area < 1:
            continue
        contatto = {n: pezzo.buffer(1).intersection(g).area for n, g in stato_geom.items()}
        contatto = {n: c for n, c in contatto.items() if c > 0}
        if len(contatto) >= 2:
            vicino = max(contatto, key=contatto.get)
            stato_geom[vicino] = stato_geom[vicino].union(pezzo)
    # 5b) fessure residue fra due quartieri vicini: la striscia fra i due confini va al quartiere con più contatto
    for _ in range(3):  # [S] tre giri bastano: ogni giro chiude una fessura residua
        for a, b in itertools.combinations(list(stato_geom), 2):
            ga, gb = stato_geom[a], stato_geom[b]
            dist = ga.distance(gb)
            if not (0 < dist <= DISTANZA_BORDO):
                continue
            striscia = ga.buffer(dist + 0.5).intersection(gb.buffer(dist + 0.5)).difference(ga.union(gb))
            if striscia.area <= 0:
                continue
            vicino = a if ga.buffer(1).intersection(striscia).area >= gb.buffer(1).intersection(striscia).area else b
            stato_geom[vicino] = stato_geom[vicino].union(striscia)
    for n in disegno:
        disegno[n] = (disegno[n][0], stato_geom[n])

    # 6) pulizia: geometrie valide, nessuna sovrapposizione residua, lisciatura minima
    for n in disegno:
        disegno[n] = (disegno[n][0], pulisci(disegno[n][1]).simplify(SEMPLIFICA))
    for n in disegno:
        disegno[n] = (disegno[n][0], pulisci(disegno[n][1]))
    sistema_sovrapposizioni(disegno)

    feature = []
    for nome, (stato, geom) in disegno.items():
        feature.append({
            'type': 'Feature',
            'properties': {'name': nome, 'stato': stato},
            'geometry': mapping(transform(a_gradi, pulisci(geom))),
        })
    json.dump({'type': 'FeatureCollection', 'features': feature}, open(USCITA, 'w', encoding='utf-8'),
              ensure_ascii=False)
    print('scritto', os.path.normpath(USCITA), len(feature), 'quartieri')
    for nome, (stato, geom) in disegno.items():
        print(f'  {nome:32} {stato:5} {kml[nome].area/1e6:.4f} -> {geom.area/1e6:.4f} km²')


if __name__ == '__main__':
    main()
