# CityRhythm — Quartieri: calcoli, disegno e confini

> Parte del second brain di CityRhythm: **indice in `SECOND_BRAIN.md`**, da leggere per primo. Questo file si legge quando il lavoro tocca questo argomento e si aggiorna col comando `/second-brain`.

Le 11 aree del KML: chi le calcola, chi le disegna, con quali confini. Calcoli e disegno sono due cose diverse.

## Decisioni valide
| Tema | Decisione |
|---|---|
| Calcoli | Restano sul **KML originale** `public/data/cityrhythm_blimp_areas.kml`: presenze per quartiere (`cityrhythm_blimp.csv`, per nome: non dipendono dalla geometria), km² in `compass.py`, quartiere di ogni cella in `estrai_lcz.py` (`quartiere`, `quartiere_dist_m`), gente in giro, case, Spot, puntini, scheda. Il codice legge `getFullKmlGeoJson()`. Richiesta dell'utente (2026-10-11): il disegno è solo estetico, i conteggi non cambiano. |
| Disegno e clic | Mappa, hover e clic usano `public/data/quartieri_disegno.geojson` (campo `stato`: `istat`, `copertura`, `kml`). Caricato insieme al KML in `loadKMLLayer` (`data-loader.js`), applicato alla copia per la mappa in `addKmlLayer` (`map-layers.js`). Se il file manca, resta il KML. Il clic apre la scheda con il dato logico. |
| Fonte e licenza | Sezioni di censimento **ISTAT 2021**, Marche (`R11_21.zip`), filtro `PRO_COM = 44007` (Ascoli Piceno): 1.255 sezioni, 46.085 abitanti. **CC BY 4.0**: credito nei crediti della mappa (`QUARTIERI_CREDITO` in `config.js`). Nel repo va solo il risultato, non le sezioni. |
| Sei quartieri (`istat`) | Porta Romana, Borgo Solesta, Campo Parignano, Porta Maggiore, San Filippo, Centro Storico: ogni sezione va al quartiere con cui si sovrappone di più, se è dentro per almeno il 50%; i buchi fra due vicini si chiudono. Approvati dall'utente («perfetti»). |
| Porta Cartara (`kml`) | Resta il disegno del KML. Approvato dall'utente. |
| Quattro da coprire (`copertura`) | Borgo Chiaro, Stadio, Pennile di Sotto, Tofare: prendono **tutte** le sezioni che toccano la loro area KML, anche se escono (richiesta dell'utente: «coprire come minimo l'area; se è più grande chi se ne frega»). Risultato: Tofare 5,9 km², Stadio 5,1, Borgo Chiaro 3,4, Pennile 0,34 (prima 0,17–0,27). Priorità alla copertura (`PRIORITA_COPERTURA = True`): i quattro si coprono a vicenda; cambiano anche i vicini approvati: Porta Maggiore −9% (0,86 → 0,78 km²), San Filippo −10%, Centro Storico −3%, Campo Parignano +3%. |
| Conseguenza accettata | Passando sulla campagna si evidenziano anche Tofare, Stadio o Borgo Chiaro, e il clic apre la loro scheda. Un puntino vicino al confine può trovarsi in un quartiere disegnato e contato in un altro. Approvato alla visione in localhost. |
| Criteri | Proposti dal parere Opus e accettati dall'utente: area ±10% per quartiere (±15% sotto 0,2 km²), totale ±5%, IoU ≥ 0,80, Hausdorff ≤ 60 m, Spot e residenti ±10%, zero gap e sovrapposizioni. Per i sei l'area ci sta; IoU e Hausdorff no (Hausdorff 85–410 m), perché la forma ISTAT differisce dal KML di decine di metri. Per i quattro non valgono (copertura). |

## Scartati
| Strada | Perché |
|---|---|
| Isolati OSM (strade e fiumi dal tile Protomaps) | Aree fra −20% e −87%, San Filippo vuoto: le facce tagliate dalle strade stanno per metà fuori dal KML. |
| Vertici KML agganciati alla strada o al fiume entro 25 m | Forme quasi invariate (IoU 0,95–0,99). La prima versione aveva punte a zigzag; con un tratto minimo di 30 m sono sparite, ma il cambiamento resta minimo. |
| Sezioni con soglia 50% anche per i quattro | Borgo Chiaro −38%, Pennile −21%, Tofare −20%, Stadio −18%. |
| Voronoi con barriere, lisciatura Chaikin | Dal parere Opus: Voronoi allarga i quartieri a tutto il rettangolo; Chaikin allontana il bordo dalla strada. Non provati. |

OSM non è nel file finale (era solo nelle prove, fuori dal repo): per il file non serve l'ODbL.

## Dati da sapere
- 8.142 celle LCZ su 12.496 (65%) stanno fuori dai poligoni e vanno al quartiere più vicino (distanza mediana 229 m, massima 1.284 m).
- Il codice ISTAT di Ascoli Piceno è **44007**. Il 44001 è Acquasanta Terme; il 41044 non è Ascoli. Le sezioni 44007 coprono il Comune al 100%. Il file ASC1 (9 aree subcomunali di Ascoli) esiste, non è usato.
- Nel KML il nome «Ascoli - Porta Cartara » ha uno spazio finale: i confronti per nome fanno `trim()`.

## Come si rigenera
1. Scaricare `https://www.istat.it/storage/cartografia/basi_territoriali/2021/R11_21.zip` e scompattarlo in una cartella vuota.
2. Esportare le sezioni di Ascoli: `ogr2ogr -f GeoJSON -t_srs EPSG:4326 -where "PRO_COM = 44007" sezioni_ascoli.geojson SHP/R11_21_WGS84.shp`. Lo shapefile è in UTM 32N anche se il nome dice WGS84; con l'ogr2ogr di QGIS serve `PROJ_DATA` puntato a `Contents/Resources/qgis/proj`.
3. `cd sound-lab && .venv/bin/python quartieri_disegno.py <sezioni_ascoli.geojson>`. I parametri [S] sono in testa allo script.

## Da decidere e da verificare
- **Commit** fatto il 2026-10-11 su `ui-redesign` (vedi `git log`): file nuovi `sound-lab/quartieri_disegno.py` e `public/data/quartieri_disegno.geojson`; modifiche in `src/data/config.js`, `src/data/data-loader.js`, `src/map/map-layers.js`, `src/map/map-interaction.js`.
- **Porta Maggiore −9%**: se non va, `PRIORITA_COPERTURA = False` (i vicini approvati restano; i quattro tornano scoperti in parte).
- **Forma dei quattro grandi**: da rivedere se il disegno va pubblicato (hover e clic sulla campagna).
- **iPhone/Safari**: confine di disegno e credito ISTAT (in fondo alla colonna dei crediti).
