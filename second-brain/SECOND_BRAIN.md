# CityRhythm — Second Brain

> Memoria condivisa del progetto. **Ogni agente legge questo indice prima di iniziare**, poi i file di argomento che servono al lavoro (elenco nella sezione 4). Si aggiorna a fine sessione col comando `/second-brain` (vedi `.claude/skills/second-brain/SKILL.md`). Sintetico: decisioni e stato, non cronaca.

Ultimo aggiornamento: 2026-10-06 (diciassettesima sessione)

## 1. Progetto in breve
- **CityRhythm**: dashboard geospaziale (**MapLibre GL 6.12** + PMTiles, ECharts 5.5, Turf 7, D3 + d3-cloud, PapaParse, Litepicker) su affollamento, demografia, POI, LCZ/UHI. 3 dimensioni spaziali + 1 temporale (timeline).
- Codice: JavaScript vanilla, ES modules, **Vite 8** (`npm run dev` / `npm run build` → `dist/`). Librerie da `node_modules` con versioni esatte in `package.json`; **nessun CDN**. Dati in `public/data/` (23 MB: mappa 14 MB, celle LCZ 7,3 MB, meteo, bussola) e audio in `public/audio/` (17 MB).
- Stato: moduli con getter (`getCurrentHour()`, `getMapInstance()`, `getPoiData()`…). **Store centrale** `src/state/store.js` (contratto store Svelte: `subscribe`/`set`/`update`/`get`): `time` `{index, date}` (date = null nella settimana tipo), `viewport` `{bounds, zoom, center}`, `audioEnabled`, **`mood`** (stato della bussola: `stato` confermato, `proposto`, X, Y, UTCI, persone entro 50 m, cella), **`presence`** (puntini fuori casa dell'ora con il loro peso: lo scrive solo `map-layers.js`), **`cellMap`** (UTCI e stato di tutte le celle: lo scrive solo `src/compass/cell-map.js`, solo mentre una mappa oraria è visibile). Scrivono: `updateAppStateForHour` in `ui-timeline.js` (unico punto per l'ora; `setHour(i)` per il calendario) e `moveend`/`load` in `map-setup.js`. `mood` lo scrive solo `src/compass/compass.js`; `audioEnabled` solo l'interruttore in `src/ui/ui-compass.js`. Log `[store]` solo in `npm run dev`. Globali rimasti: `window.selectedDateRange`, `window._timelineMap` (null con ≥ 7 giorni), evento `dateRangeChanged`.
- Grafici: ECharts si importa **solo** in `src/charts/charts.js` (`createChart`); le opzioni dei grafici restano nel formato ECharts.
- Mappa (`src/map/map-setup.js`): stile costruito in codice (`buildMapStyle`): base Protomaps da `ascoli_base.pmtiles` in **stile Toner** (`TONER_FLAVOR`), edifici TUM `buildings-3d` (fill-extrusion bianca, **spenta all'avvio** come il terreno, + contorno `buildings-outline`, in cima alla base); **nessuna etichetta** della base, sorgente `terrain-dem` per l'interruttore terreno. Nessun token.
- Trappole note col bundle: PapaParse **senza** `worker: true`; Litepicker come `{ Litepicker }`; KML con `@tmcw/togeojson`; MapLibre 6 si importa come `import * as maplibregl` e il worker come `maplibre-gl-worker.mjs?worker&url` con `worker: { format: 'es' }` in `vite.config.js`; URL di glyphs/sprite/sorgenti **assoluti** (le graffe `{fontstack}` fuori da `new URL`); i dati di una sorgente GeoJSON si leggono con `getGeoJsonSourceData()` (campo interno `_data.geojson`), mai `source._data.features` (era Mapbox); per sapere se si può agire sulla mappa **mai `map.isStyleLoaded()` né `map.once('idle')`**: col brulichio dei puntini sono falso / non arrivano mai (livelli e interruttori bloccati), si usa `isMapReady()` / `whenMapReady(fn)` di `map-setup.js`; la sorgente dei puntini contiene **gruppi MultiPoint**, non una feature per persona: le persone si leggono con `getPresenceDots()` di `map-layers.js` e dopo averle cambiate si chiama `redrawPresenceDots()`; `hash01` della stessa chiave con suffissi diversi **non è indipendente** (hash FNV debole): ciò che non deve dipendere dal colore non va preso da `hash01`.
- Autore: Graziano Enzo Marchesani (Unicam). Non ha competenze musicali: spiegare le scelte sonore con analogie semplici, le decisioni tecnico-musicali le prende l'agente. Non sa scegliere i volumi a orecchio in percentuale: i mix vanno **calcolati**. Lavora su un **M3 con 8 GB** collegato a uno schermo **5K ultrawide**: ogni ridisegno della mappa pesa, niente animazioni che ridisegnano senza bisogno.

### Dati della piattaforma (verificati)
| Dati | Periodo | Zona |
|---|---|---|
| **Presenze POI** (11 quartieri KML, `presenze_0..23` orarie) | **2024-06-01 → 2025-02-01**, 246 giorni, 1 sola ora mancante | Ascoli |
| Affollamento luoghi (87 punti) | nessuna data: settimana tipo 168 h | Comune di Ascoli |
| Spot (1.186 punti) | statici | Comune di Ascoli |
| **LCZ** (`lcz_ascoli.geojson`, **12.496 celle vettoriali da 30 m**) | statici | rettangolo dei quartieri e dei punti (+150 m) ∩ Comune: **tutti gli 11 quartieri al 100%**. Ogni cella ha `quartiere` e `quartiere_dist_m` (65% delle celle è fuori dai quartieri) |
| Meteo (`meteo_ascoli.json`) | 5.904 ore, 2024-06-01 → 2025-02-01 | Open-Meteo, punto 42.847 N 13.6 E |
| Mappa (`public/data/mappa/`) | — | base Protomaps/OSM 5,2 MB, terreno Mapterhorn 4,7 MB (z ≤ 12), **11.356 edifici TUM** 3,7 MB (con `res` = residenti Meta; contorni di fonte OSM aggiornati a OSM 2026), font Noto Sans e icone |
| **Residenti Meta** (HRSL 2020, quadratini ~30 m, CC BY 4.0) | 2020 | Comune intero: **47.076 residenti** (ISTAT ~46–47 mila); assegnati agli edifici in `gba_ascoli.geojson` → `res` |
| **Quota in casa** (`quota_in_casa.json`, 7 giorni × 24 ore) | diari ISTAT Uso del tempo 2008-09 (40.939) | Italia, via IPUMS MTUS; solo la curva aggregata, i microdati restano in `IPUMS/` |
| Simulazione locale (`cityrhythm_simulation_week.*`) | solo 3–9 giugno 2024 | Ascoli |

Timeline: con un intervallo **< 7 giorni** mostra i giorni reali (`window._timelineMap` ha le date); con **≥ 7 giorni** (anche all'avvio) mostra la settimana tipo 168 h filtrata per giorno della settimana, **senza date**. La posizione della timeline si legge **sempre** con `getDateTimeFromIndex` / `getWeekIndex` / `getTimelineDate` (`utils.js`) e la colonna dei luoghi affollati con `getTimelineCrowdednessColumn`: leggerla come settimana tipo con giorni veri era un errore (il 15 agosto diventava "lunedì").

## 2. Obiettivo in corso — branch `Music`
Aggiungere una **dimensione sonora** attivabile ("mappa sonora"). Scopo **divulgativo**: la musica deve trasmettere **emozioni** che le immagini da sole non danno. Densità e calore sono già visibili, quindi niente sonificazione "pitch che segue il dato". Il lavoro del branch si presenta alla collega con un deck Slides (`presentazione.md`).

## 3. Regole permanenti
- **Solo il Comune di Ascoli Piceno** (confine OSM, relazione 42176, in `sound-lab/data/comune_ascoli.geojson`). Dati di Lucca, San Benedetto, Pagliare ecc. **cancellati**; non scaricare né aggiungere mai dati fuori dal Comune.
- **Niente "numeri a caso"**: ogni parametro viene da dati o da letteratura con la fonte dichiarata; se una fonte non c'è, si dice e si sceglie con l'utente.
- **Autosufficienza**: il sito fornisce tutto da sé (librerie, dati, tessere), nessun token né servizio esterno.
- **Intercambiabilità**: UI e grafici sostituibili; bussola e audio parlano solo tramite lo store.
- **Microdati con licenza mai su GitHub** (`IPUMS/`, `UsoTempo_*/`, `Lcz_neurali 2/` in `.gitignore`); nel sito solo aggregati, con le citazioni (dettagli in `persone.md`).
- L'utente non ha competenze musicali: scelte sonore spiegate con analogie, **mix sempre calcolati**.

## 4. Dove trovare cosa
| File | Contenuto |
|---|---|
| `bussola-clima.md` | modello emotivo per cella, energia (X), piacevolezza (Y), catena UTCI e limiti, 9 stati, notte, settimana tipo, mappe orarie UTCI e Sound map, alberi |
| `audio.md` | strategia S2, motore audio, comportamento (isteresi/dissolvenza), effetti e mix, generazione su finetuning.ai, post-produzione, **stato degli asset audio** |
| `mappa.md` | MapLibre + PMTiles, stile Toner, edifici TUM, terreno, celle LCZ e mappe dei parametri, autosufficienza, framework, pubblicazione su Pages |
| `persone.md` | puntini (identità, formichine, gente in giro, colori), Synthetic Crowded Points, **gente in casa** (curva ISTAT, regola prudente, residenti Meta), **licenze IPUMS/UCL/ISTAT/Meta** |
| `decisioni-superate.md` | tutte le decisioni non più valide, col perché |
| `strumenti.md` | script di `sound-lab/` (analisi, taratura, estrazioni, curva in casa), pagina di ascolto, avvio |
| `prompts.md` | prompt musicali per finetuning.ai |
| `presentazione.md` | presentazione del branch alla collega: deck (link), scaletta, come raccontare ogni slide, aspetto, demo in remoto, come modificare il deck; materiale completo in `presentazione/materiale-music.md` |

## 5. Prossimi passi
0. **A mano (utente)**: eliminare **entrambi** i token sul sito di Mapbox (file locali già cancellati; il token pubblico resta nella cronologia del repository, che è pubblico: va revocato).
1. **Presentazione alla collega**: modifiche al deck slide per slide (prossima sessione) e prova della demo **con l'audio** prima di presentarla. Tutto in `presentazione.md`.
2. **Ascolto sopra la mappa** con la Sound map accesa come guida: estate a mezzogiorno (Calca nelle piazze, Afa nei vicoli), mattina e sera, dicembre (sereno), notte (Notte + grilli), fuori dalle celle (silenzio). Giudicare volumi, cambi di 1 s col Play (frenetici? allora dissolvenza 1,5–2 s), musica che cambia spostando il mirino di 50–100 m.
3. **Suoni urbani dai dati**: presenza degli effetti da persone (X), verde, UTCI e notte invece che dalle scene fisse.
3c. Da giudicare in mappa: raggio di 50 m (macchie più nette o più ampie), leggibilità di UTCI e Sound map al 70%. Il riferimento Python non ha l'energia per cella: portarla solo se serve.
4. Clima più preciso (facoltativo): **SOLWEIG** (plugin UMEP di QGIS) con `dsm_10m`, terreno e chiome del progetto, su giorni tipo, per ombre vere e suolo caldo. È anche la via giusta per gli **alberi** (oppure: SVF dei soli edifici + chiome trattate come chiome, trasmissività ~3%): cambierebbe soprattutto le celle verdi; oppure **tarare** l'isola di calore con stazioni in città (verificare la rete regionale delle Marche).
5. **Stile Toner da verificare a occhio** (elenco in `mappa.md` → "Da verificare"). Facoltativo: cancellare `sprites/light.*`.
6. **Puntini e gente in casa da verificare a schermo** (elenco in `persone.md` → "Da verificare"). Il vecchio `animatePresencePoints`/campo di forze in `map-layers.js` non è mai avviato (codice morto, da togliere).
6b. **Crediti della mappa** troppo lunghi (OSM, TUM, Meta, ISTAT/IPUMS, UCL): all'apertura passano sotto timeline e bussola. Proposta: tenerli chiusi dietro la "i" (`attributionControl` compatto). Da decidere con l'utente.
7. Più avanti: ECharts 5.5 ha un avviso di sicurezza moderato (`npm audit`); valutare ECharts 6.
8. Facoltativi sulla curva: estrarre anche `MONTH` da IPUMS per curve estate/inverno; correggere lo smart working con la domanda "lavora da casa" del file ISTAT 2023 (`UsoTempo_2023_IT`). Domanda aperta per l'utente: come sono misurate le presenze "blimp" (sensori, celle, app)?
9. **Quando si pubblica** un lavoro con questi dati: aggiungerlo alla bibliografia IPUMS (http://bibliography.ipums.org/) e mandarne copia al CTUR (UCL).

## 6. Diario delle sessioni
- **2026-10-04 (1–6)**: strategia S2, bussola a 9 stati, loop ed effetti, meteo 246 giorni; Vite locale, Pages, store, MapLibre + PMTiles (TUM), regola **solo Comune di Ascoli**. LCZ a 30 m, bussola per cella con **UTCI**, motore audio. Puntini con identità stabili, notte a casa, Synthetic Crowded Points con maestri fissi.
- **2026-10-05 (7–9)**: "Color dots by" su tutti i quartieri; gente in giro solo su celle costruite/pavimentate; mappa in **stile Toner** su Protomaps, edifici bianchi, nessuna etichetta.
- **2026-10-05 (10–12)**: menu **Show** con 15 mappe delle celle LCZ; settimana tipo col clima (90° percentile UTCI); dissolvenza e isteresi 1 s; mappe orarie **UTCI** e **Sound map**; **energia per cella** dai puntini entro 50 m; UTCI 30× più veloce; alberi già nello SVF; puntini "a formichine".
- **2026-10-05 (13)**: puntini in casa al 50%, neri anche da vicino, attenuati all'arrivo; case pesate coi **residenti Meta**; **curva ISTAT in casa** (IPUMS MTUS 2008) con regola prudente al posto del 95% e delle rampe a mano; nuova taratura dell'energia; licenze IPUMS/UCL lette e citazioni nei crediti.
- **2026-10-05 (14–15)**: riparati menu Show LCZ/UHI, terreno ed edifici 3D (`isStyleLoaded()` falso per il brulichio → `isMapReady`/`whenMapReady`); torna l'inquadratura sui quartieri. 3D Buildings e 3D Terrain **spenti all'avvio**, la mappa segue la casella anche al caricamento.
- **2026-10-05 (16)**: puntini molto più leggeri: a MapLibre **gruppi MultiPoint a 32 strati** con le sole proprietà dello stile, ridisegno da fermi a passi di 1 pixel fisico (~10/s a zoom 13), spostamenti ≤ 30/s. Da fermi worker −90%, pagina −71%, GPU −68%; Play worker −57%. Conteggi, colori e ordine di disegno verificati uguali.
- **2026-10-06 (17)**: presentazione del branch alla collega. Materiale completo (`presentazione/materiale-music.md`: 30 schede, storie prima → dopo, copione della demo) e **deck Slides** di 19 slide con note del relatore e colori della Sound map; l'utente ha ritoccato copertina e slide 2. Nuovo file `presentazione.md`.
- **2026-10-06 (17, in parallelo)**: strade dentro le case nel centro (Rue): il TUM aveva copiato edifici OSM vecchi. Contorni aggiornati a OSM della mappa di base **con le altezze TUM** (`aggiorna_edifici_osm.py`: 153 corretti, 100 tolti, 115 nuovi), residenti ricalcolati; scartato spegnere le strade.

## 7. Prompt per la prossima sessione
```
Riprendiamo CityRhythm, branch Music: oggi lavoriamo sulla presentazione.
Leggi second-brain/SECOND_BRAIN.md e second-brain/presentazione.md (scaletta,
come raccontare ogni slide, aspetto, regole del deck); fatti e numeri li prendi
da presentazione/materiale-music.md. Riassumimi in 3 righe dove siamo.

Base d'appoggio: il deck Slides già pubblicato
https://claude.ai/artifact/8wMEfrXxCtVTpSJe34nZ55
Lavoriamo su quello, non crearne un altro. Lo ritocco anche a mano:
prima di modificare una slide rileggila dall'artifact.

Obiettivo: modifiche slide per slide, una alla volta, dalla 1 alla 19.
Per ogni slide: ti dico cosa cambiare (o ti chiedo una proposta), tu mi dici
in 2-3 righe cosa cambi, pubblichi solo quella slide e aspetti il mio ok
prima di passare alla successiva.

Regole: pubblico = la mia collega, 10-15 minuti (max 20), demo dal vivo in
remoto; accento sulla mappa sonora; titoli corti; Simone non va citato;
niente numeri senza fonte (solo dal materiale o dal second brain).
Non ho competenze musicali: le parti sul suono spiegale con analogie.
A fine sessione aggiorna il second brain e fai commit e push su Music.
```
Dopo la presentazione: ascolto sopra la mappa e suoni urbani dai dati (prossimi passi 2–3).
