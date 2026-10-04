# CityRhythm — Second Brain

> Memoria condivisa del progetto. **Ogni agente la legge prima di iniziare.** Si aggiorna a fine sessione col comando `/second-brain` (vedi `.claude/skills/second-brain/SKILL.md`). Sintetico: decisioni e stato, non cronaca.

Ultimo aggiornamento: 2026-10-04 (quinta sessione)

## 1. Progetto in breve
- **CityRhythm**: dashboard geospaziale (**MapLibre GL 6.12** + PMTiles, ECharts 5.5, Turf 7, D3 + d3-cloud, PapaParse, Litepicker) su affollamento, demografia, POI, LCZ/UHI. 3 dimensioni spaziali + 1 temporale (timeline).
- Codice: JavaScript vanilla, ES modules, **Vite 8** (`npm run dev` / `npm run build` → `dist/`). Librerie da `node_modules` con versioni esatte in `package.json`; **nessun CDN**. Dati in `public/data/` (23 MB: mappa 14 MB, celle LCZ 7,3 MB, meteo, bussola) e audio in `public/audio/` (17 MB).
- Stato: moduli con getter (`getCurrentHour()`, `getMapInstance()`, `getPoiData()`…). **Store centrale** `src/state/store.js` (contratto store Svelte: `subscribe`/`set`/`update`/`get`): `time` `{index, date}` (date = null nella settimana tipo), `viewport` `{bounds, zoom, center}`, `audioEnabled`, **`mood`** (stato della bussola: `stato` confermato, `proposto`, X, Y, UTCI, cella, quartiere). Scrivono: `updateAppStateForHour` in `ui-timeline.js` (unico punto per l'ora; `setHour(i)` per il calendario) e `moveend`/`load` in `map-setup.js`. `mood` lo scrive solo `src/compass/compass.js`; `audioEnabled` solo l'interruttore in `src/ui/ui-compass.js`. Log `[store]` solo in `npm run dev`. Globali rimasti: `window.selectedDateRange`, `window._timelineMap` (null con ≥ 7 giorni), evento `dateRangeChanged`.
- Grafici: ECharts si importa **solo** in `src/charts/charts.js` (`createChart`); le opzioni dei grafici restano nel formato ECharts.
- Mappa (`src/map/map-setup.js`): stile costruito in codice (`buildMapStyle`): base Protomaps "light" da `ascoli_base.pmtiles`, edifici TUM `buildings-3d` (fill-extrusion colorata per altezza, sotto le etichette), sorgente `terrain-dem` per l'interruttore terreno. Nessun token.
- Trappole note col bundle: PapaParse **senza** `worker: true`; Litepicker come `{ Litepicker }`; KML con `@tmcw/togeojson`; MapLibre 6 si importa come `import * as maplibregl` e il worker come `maplibre-gl-worker.mjs?worker&url` con `worker: { format: 'es' }` in `vite.config.js`; URL di glyphs/sprite/sorgenti **assoluti** (le graffe `{fontstack}` fuori da `new URL`); i dati di una sorgente GeoJSON si leggono con `getGeoJsonSourceData()` (campo interno `_data.geojson`), mai `source._data.features` (era Mapbox).
- Autore: Graziano Enzo Marchesani (Unicam). Non ha competenze musicali: spiegare le scelte sonore con analogie semplici, le decisioni tecnico-musicali le prende l'agente. Non sa scegliere i volumi a orecchio in percentuale: i mix vanno **calcolati**.

### Dati della piattaforma (verificati)
| Dati | Periodo | Zona |
|---|---|---|
| **Presenze POI** (11 quartieri KML, `presenze_0..23` orarie) | **2024-06-01 → 2025-02-01**, 246 giorni, 1 sola ora mancante | Ascoli |
| Affollamento luoghi (87 punti) | nessuna data: settimana tipo 168 h | Comune di Ascoli |
| Spot (1.186 punti) | statici | Comune di Ascoli |
| **LCZ** (`lcz_ascoli.geojson`, **12.496 celle vettoriali da 30 m**) | statici | rettangolo dei quartieri e dei punti (+150 m) ∩ Comune: **tutti gli 11 quartieri al 100%**. Ogni cella ha `quartiere` e `quartiere_dist_m` (65% delle celle è fuori dai quartieri) |
| Meteo (`meteo_ascoli.json`) | 5.904 ore, 2024-06-01 → 2025-02-01 | Open-Meteo, punto 42.847 N 13.6 E |
| Mappa (`public/data/mappa/`) | — | base Protomaps/OSM 5,2 MB, terreno Mapterhorn 4,7 MB (z ≤ 12), **11.341 edifici TUM** 3,6 MB, font Noto Sans e icone |
| Simulazione locale (`cityrhythm_simulation_week.*`) | solo 3–9 giugno 2024 | Ascoli |

Timeline: con un intervallo **< 7 giorni** mostra i giorni reali (`window._timelineMap` ha le date); con **≥ 7 giorni** (anche all'avvio) mostra la settimana tipo 168 h filtrata per giorno della settimana, **senza date**.

## 2. Obiettivo in corso — branch `Music`
Aggiungere una **dimensione sonora** attivabile ("mappa sonora"). Scopo **divulgativo**: la musica deve trasmettere **emozioni** che le immagini da sole non danno. Densità e calore sono già visibili, quindi niente sonificazione "pitch che segue il dato".

## 3. Decisioni valide
| Tema | Decisione |
|---|---|
| Strategia | **S2 – musica adattiva pre-generata**: un brano principale alla volta, dissolvenza verso lo stato d'animo corrente, più un **livello di suoni urbani** sovrapposto. |
| Ambito geografico | **Regola permanente: solo il Comune di Ascoli Piceno** (confine OSM, relazione 42176, in `sound-lab/data/comune_ascoli.geojson`). Dati di Lucca, San Benedetto, Pagliare ecc. **cancellati**; non scaricare né aggiungere mai dati fuori dal Comune. |
| Ambito audio | **Solo Ascoli**, **tutti i 246 giorni** (2024-06-01 → 2025-02-01), dal caldo al freddo. Niente "settimana tipo" per il meteo. |
| Modello emotivo | **Bussola** (circomplesso di Russell) **per cella**: conta la cella LCZ **al centro della mappa** (mirino + contorno nero). **Niente medie per quartiere** ("si omogeneizza tutto troppo"). Parametri in **`public/data/bussola.json`**, letto sia da `sound-lab/compass.py`+`clima.py` (riferimento) sia da `src/compass/`. |
| Energia (X) | Persone/km² del **quartiere della cella** nell'ora (le presenze esistono solo per quartiere), scala log, ancorata al 10° e 90° percentile delle ore di luce (1.730 e 9.882 persone/km²). Celle fuori dai quartieri: l'energia del più vicino **sfuma verso −1 entro 300 m** (`energia_svanisce_m`). |
| Piacevolezza (Y) | `0.75 × comfort + 0.25 × verde − 0.3 se piove (> 0,5 mm)`, valori della cella. **Verde come "bellezza"** (superficie permeabile) tenuto per scelta espressiva dell'utente, **non fisica**. Comfort dall'**UTCI** della cella: +1 senza stress (9–26 °C), −1 dove inizia lo **stress forte** (**32 °C** caldo, **−13 °C** freddo), lineare in mezzo. |
| Clima per cella (**UTCI**) | Richiesto dall'utente: niente "numeri a caso". Catena con basi pubblicate (`sound-lab/clima.py`, fonti anche in `bussola.json` → `fonti`): **1. aria** = Open-Meteo + isola di calore **solo di notte e solo celle costruite (LCZ 1–10)**: `15,27 − 13,88·SVF` (Oke 1981) con tetto `2,01·log10(46.000) − 4,06 ≈ 5,3 °C` (Oke 1973, città europee), × `min(1, U^−½)` (vento, Oke) × rapporto perdita infrarossa reale/sereno (nuvole). **2. Tmrt** di persona in piedi (RayMan/VDI 3787: ak 0,7, εp 0,97, Fi 0,06/0,22, fp di Jendritzky): sole diretto (DNI) × quota di strada al sole (canyon con H/W ricavato dallo SVF, mediato sulle orientazioni), diffuso × SVF, riflesso dal suolo con l'**albedo** della cella, infrarosso del cielo (Brutsaert; nuvole Crawford & Duchon), suolo e muri alla temperatura dell'aria. **3. vento** a 10 m riportato alla rugosità **z0** della cella (altezza di miscelamento 60 m, Wieringa/WMO). **4. UTCI** col polinomio ufficiale Bröde 2012 (211 termini estratti da pythermalcomfort). Nel pannello: "UTCI ≈ 35 °C · stress da caldo forte (stima)". |
| Limiti dichiarati del clima | Meteo unico per tutta la città; isola di calore da formule di letteratura, non tarata su misure di Ascoli; ombra stimata dallo SVF, non edificio per edificio; suolo e muri alla temperatura dell'aria (la pietra rovente al sole non è contata → stress in pieno sole sottostimato). È una **stima per confrontare celle**, non un termometro. |
| Soglie | ±1/3 su entrambi gli assi → 9 stati. |
| 9 stati (Y↓, X→) | Sereno: **Rifugio · Passeggiata · Festa** / Neutro: **Attesa · Routine · Corrente** / Opprimente: **Afa · Fatica · Calca** |
| Notte | Brano **Notte** + grilli solo se il sole è sotto −6° **e** c'è poca gente (X < −1/3). Le sere affollate restano Festa/Corrente/Calca. |
| Esito della formula (UTCI) | Estate: **a mezzogiorno** Fatica/Calca (Centro, UTCI mediana ~35 °C), mattina e sera Passeggiata/Festa. Settembre–ottobre sereni. **Inverno: di giorno sereno** (UTCI 9–26 = nessuno stress, l'UTCI tiene conto dei vestiti), notti Notte. Celle nei quartieri: notte 32%, Festa 25%, Passeggiata 13%, Calca 8%, Rifugio 6%, Corrente 6%, Fatica 5%, Routine 3%, Afa 1,5%, Attesa 0,7%. **Per ora non servono brani invernali.** |
| Meteo | Open-Meteo archivio, Ascoli (42.854, 13.575), orario, fuso Europe/Rome, 5.904 ore, in **`public/data/meteo_ascoli.json`**: temperatura, percepita, umidità, radiazione globale **+ diretta, diffusa, DNI**, nuvole, vento (km/h), pioggia. Scaricato una volta, servito dal sito. |
| Fonte LCZ | **Solo** `Lcz_neurali 2/FETCH+simoneAP/unified/lcz_grid_30m_lcz_params.gpkg` (progetto QGIS di Simone, EPSG:3004, tabelle verificate dall'utente). **Celle native da 30 m, mai raggruppate; sempre vettoriale, mai raster**; ritaglio **solo sul rettangolo dei quartieri** (non tutto il Comune). Il resto del progetto (raster, xlsx, CSV, griglia 100 m vuota) non serve. La cartella (2,7 GB) è in `.gitignore`. |
| Campi LCZ | Bussola: `svf_mean` (0 = difetto → 0,4 di ripiego), `albedo`, `z0_value`, `pervious_frac`, `lcz_class`. Mappa: **tutti i campi di costruzione nel popup al clic** (scopo divulgativo, non per l'audio): classe in italiano, rischio (`lcz_vulnerability`, stessa tabella del vecchio "UHI risk"), parametri in accordo (su 10), correzione ESA, SVF, H/W, % edificata/impermeabile/permeabile, altezza, rugosità, z0, ammettenza, albedo, calore antropico e industriale. Il loader copia `lcz_class`→`LCZ` e `lcz_vulnerability`→`UHI risk` per i colori esistenti. |
| Comportamento | **Isteresi**: lo stato cambia solo se il nuovo tiene **2 s** (`tenuta_s`; col Play della timeline la musica può restare ferma, è voluto). **Dissolvenza musica 3 s**. Centro della mappa fuori dalle celle LCZ: **silenzio**. |
| Motore audio | `src/audio/audio-engine.js`, legge solo `audioEnabled` e `mood`. Interruttore **"Attiva mappa sonora"** nel riquadro in basso a sinistra (mirino, contorno e valori visibili solo ad audio acceso). Parte il brano dello stato attuale, gli altri si caricano in sottofondo; spegnendo, sfuma in 1 s. Asset in **`public/audio/`** (loops, sfx, `mix.json`); in `sound-lab/` restano **collegamenti simbolici** per la pagina di ascolto e gli script. |
| Suoni urbani | Folla leggera/densa ↔ persone; traffico ↔ città; parco ↔ verde; cicale ↔ calore; grilli ↔ notte. |
| Riproduzione effetti | Niente loop cucito: ogni suono **alterna a caso le varianti** (mai la stessa due volte di fila), dissolvenza incrociata equal-power fino a 1,2 s, velocità casuale ±4%. |
| Mix effetti | **Calcolato** (`sound-lab/mix.json`): volume = musica (−18 LUFS) − `sotto_musica_db` + 20·log10(presenza). Tetti sotto la musica: folla densa 9 dB, grilli 11, folla leggera 12, parco 13, cicale 14, traffico 15. Somma degli effetti per scena 8–14 dB sotto la musica (Attesa ≈ 20). La presenza (0–1) per ora viene dalle scene per stato (anche nella piattaforma); in futuro dai dati. Se il mix non convince: cursori di volume nell'app. |
| Generazione musica | **finetuning.ai**, piano Plus, a mano. Scheda **Instrumental**; nessuno stile preset; nessun tag; **Enhance prompt OFF**; Length 2 min; seed fisso. Prompt in **inglese**. |
| Coerenza musicale | Tutti i brani in **re** (maggiore sereni, minore opprimenti), ambient-cinematografico. Ogni prompt termina con la "coda fissa" (vedi `prompts.md`). |
| Post-produzione musica | Taglio sfumature, loop su battuta con dissolvenza incrociata di 2 s, **−18 LUFS**, picco ≤ −1 dBFS, MP3 160k. |
| Post-produzione effetti | Taglio della sfumatura finale (tratto entro 3 dB dalla mediana), micro-fade 50 ms, **−20 LUFS**, limitatore sui picchi isolati, MP3 160k. |
| Settimana tipo e audio | Opzione **(a)**: con ≥ 7 giorni (nessuna data vera) la musica segue **solo l'energia**, piacevolezza fissa a Neutro (Attesa/Routine/Corrente), con avviso "scegli dei giorni per sentire il clima". |
| Autosufficienza | **Il sito fornisce tutto da sé**, mappa compresa: nessuna libreria, dato, tessera o token da siti esterni (verificato sulla build). |
| Mappa | **MapLibre GL** + PMTiles locali. Base: estratto Protomaps (OSM) del riquadro 13.41–13.75 E, 42.77–42.94 N, z ≤ 15. Terreno: estratto Mapterhorn (terrarium, 512 px). Edifici: **GlobalBuildingAtlas del TUM** (scelti dall'utente dopo il confronto con OSM: "senza ombra di dubbio meglio"), GeoJSON con `height`. Crediti nella mappa: OSM, Protomaps, TUM (CC BY-NC 4.0, **solo uso non commerciale**), Mapterhorn. |
| Edifici TUM | Si scaricano **una volta** dal rilascio HuggingFace (`zhu-xlab/GBA.ODbLPolygon` + `GBA.LoD1`, tassello `europe/e010_n45_e015_n40`, ~4,4 GB temporanei) e si ritagliano sul Comune con `sound-lab/estrai_edifici_gba.py`. **Mai** il WFS del TUM: gli autori lo vietano per scaricamenti automatici. Altezze stimate da satellite (centro: mediana ~6,7 m, forse sottostimate). |
| Terreno 3D | Interruttore come prima: piatto dall'alto, rilievo inclinando la camera (`setTerrain` su `terrain-dem`). |
| Aspetto mappa | Provvisorio: flavor Protomaps **"light"**. Lo stile Mapbox Studio non è portabile; l'utente darà indicazioni per rifarlo. |
| Framework | **Vite (vanilla)**, fatto. Svelte/React/Vue aggiungibili con un plugin in `vite.config.js` (`base: './'`). |
| Intercambiabilità | Tutto deve poter essere sostituito (UI in Svelte/React/Vue, libreria dei grafici). **Fatto**: store centrale compatibile Svelte (React via `useSyncExternalStore(store.subscribe, store.get)`), ECharts isolato in `src/charts/charts.js`. Bussola e motore audio comunicano solo tramite lo store. Formato neutro per le opzioni dei grafici: solo se si cambia davvero libreria. |
| Pubblicazione | **GitHub Pages** con `.github/workflows/deploy.yml` (build a ogni push su `main`). Serve Settings → Pages → Source: **GitHub Actions**. Nessun token da configurare. |
| Stem | Al momento non servono. Se servissero: StemDeck o UVR5 (locali), MVSEP (web). |

## 4. Decisioni superate
- ~~Mapbox GL 2.15 con stile Mapbox Studio, token pubblico nel codice e token di sviluppo in `.env.local`~~ → MapLibre + PMTiles locali, nessun token. I token Mapbox vanno eliminati (quello di sviluppo è finito in chat).
- ~~Unica eccezione all'autosufficienza: tessere Mapbox~~ → ora nessuna eccezione.
- ~~Dati di Lucca, costa, San Benedetto, Pagliare~~ → regola "solo Comune di Ascoli Piceno".
- ~~Edifici scaricati al volo dal WFS del TUM~~ → vietato dagli autori e contrario all'autosufficienza; estrazione una tantum.
- ~~Edifici 3D di OpenStreetMap~~ → altezze spesso mancanti; scelti quelli del TUM.
- ~~Pannello **Advanced** di finetuning.ai~~ → suona "a un solo strumento". Si resta su **Instrumental**.
- ~~Seed 2024~~ → il 2025 era migliore; per i rifacimenti 2026/2027.
- ~~Tag Mood/Energy~~ → solo testo aggiunto al prompt.
- ~~Meteo della "settimana simulata 3–9 giugno 2024"~~ → i dati reali coprono 246 giorni: si usa tutto il periodo 2024-06-01 → 2025-02-01.
- ~~Dissolvenze di 4–8 s~~ → scelta all'ascolto: **3 s**.
- ~~Calore locale da IMPER_PC, albedo, ANTHROPOGE, H_W~~ → campi sporchi o incompleti; si usano UHI risk, PER_PC, SVF.
- ~~Comfort 18–26 °C con freddo severo (−1 a 4 °C)~~ → l'inverno finiva tutto in Calca/Fatica (brani "di caldo"); ora 16–26 °C e −1 a −4 °C.
- ~~Notte = sole tramontato~~ → a dicembre alle 17 il Centro è pieno: notte solo se buio **e** poca gente.
- ~~Fondere le varianti degli effetti in un file~~ → alternanza casuale in tempo reale, meno ripetitiva.
- ~~Librerie da CDN come globali, dati su GitHub Gist~~ → tutto locale con Vite e `public/data/`. GPU.js tolto (caricato ma mai usato).
- ~~Store leggero senza Vite, Vite rimandato~~ (proposta intermedia di questa sessione) → i requisiti di autosufficienza e intercambiabilità giustificano Vite.
- ~~Svelte solo per la UI, React sconsigliato~~ → nessun framework escluso: l'architettura deve permettere di passare a uno qualsiasi.
- ~~`lcz_vitality.csv` (1.548 celle, solo centro, WKT con virgola decimale) e campi UHI risk/PER_PC/SVF~~ → `lcz_ascoli.geojson` a 30 m dal progetto QGIS, tutti i campi.
- ~~LCZ su tutto il Comune / blocchi da 90 m~~ (proposte dell'agente) → l'utente vuole celle native da 30 m e solo il rettangolo dei quartieri.
- ~~Bussola sull'area inquadrata, quartieri pesati per la frazione visibile; `aree_ascoli.json` con medie per quartiere~~ → bussola per **cella** al centro della mappa, nessuna media; file cancellato.
- ~~Temperatura locale = percepita + 4 °C sole × SVF − 2 °C verde + 1/2,5 °C × UHI risk; comfort 16–26 °C, −1 a 36 / −4 °C~~ → "numeri a caso" secondo l'utente: sostituiti dall'**UTCI** con fisica e fasce ufficiali.
- ~~Inverno → Attesa/Routine/Corrente~~ → con l'UTCI le giornate invernali sono senza stress: serene.
- ~~Fuori dalle aree coperte: brano neutro~~ → silenzio.

## 5. Stato degli asset audio
Grezzi in `music/` e `music/sfx/` (**non versionati**). Pronti in **`public/audio/loops/`** e **`public/audio/sfx/`** (collegati da `sound-lab/loops`, `sound-lab/sfx`).

| Stato | File scelto | Tonalità misurata | Note |
|---|---|---|---|
| Rifugio | rifugio 2025 | re magg. | |
| Passeggiata | passeggiata 2025 | re magg. | |
| Festa | festa 2025 | re magg., ~117 BPM | |
| Attesa | **attesa 2026** | re min., 70 BPM | 2027 riserva |
| Routine | Routine 2025 | re magg., 96 BPM | |
| Corrente | corrente 2025 | re magg., ~117 BPM | loop più pulito |
| Afa | afa 2025 | re (fra magg. e min.) | |
| Fatica | **fatica 2026** | re min., 81 BPM | 2027 riserva |
| Calca | Calca 2025 | re min. | 2024 riserva |
| Notte | notte 2025 | re magg. | |

| Effetto | Varianti (durata dopo il taglio) | Note |
|---|---|---|
| Folla leggera | **4** (2,5 / 4,2 / 5,8 / 6,0 s) | 1 e 2 si ripetevano troppo → generate 3 e 4. La 1 è timbricamente diversa (più cupa): toglierla se fa "scalino". 2 e 3 limitate sui picchi. |
| Folla densa | 2 (6,5 / 4,2 s) | |
| Traffico | 2 (4,3 / 6,5 s) | il grezzo Traffico1 saturava (+0,3 dBFS), corretto |
| Parco | 1 (6,6 s) | |
| Cicale | 1 (6,5 s) | vaga nota mi: verificare sopra i brani |
| Grilli | 1 (5,8 s) | vaga nota fa: verificare sopra i brani |

Giudizio dell'utente: i brani 2025 suonano "parenti"; la bussola di prova piace; gli effetti vanno bene. **Mix calcolato: "per ora suona bene"**. Bussola e LCZ in mappa provate ("funziona"); l'**ascolto sopra la mappa** non è ancora stato giudicato.

## 6. Strumenti (`sound-lab/`)
- `analyze.py <cartella>`: analisi dei brani (LUFS, BPM, tonalità, sfumature).
- `process.py <music/> loops`: loop musicali + `loops/manifest.json` (mappa in `SELECTION`).
- `analyze_sfx.py <cartella>`: analisi effetti (durata, LUFS, picco, stabilità, sfumature, nota dominante, distanza timbrica fra varianti).
- `process_sfx.py <music/sfx> sfx`: effetti pronti + `sfx/manifest.json`; raggruppa da solo le varianti dal nome (`Traffico1`, `Traffico2` → `traffico`).
- `mix.json` (→ `public/audio/mix.json`): regola del mix effetti e scene per stato.
- `compass.py [cartella dati]`: **riferimento** della bussola per cella su tutte le ore (~1 min). Legge `../public/data/` (presenze, KML, `lcz_ascoli.geojson`, `meteo_ascoli.json`, `bussola.json`), riscrive in `bussola.json` le ancore dell'energia e i km² dei quartieri, stampa la distribuzione degli stati e scrive `data/bussola_campioni.json` (220 casi di prova).
- `clima.py`: catena fisica UTCI per cella, con le fonti nel commento iniziale.
- `genera_utci.py`: estrae il polinomio UTCI dal **sorgente** di pythermalcomfort e scrive `src/compass/utci-coeff.js` (prova: 24,6 °C come nella documentazione). Installare con **`.venv/bin/pip install --no-deps pythermalcomfort`**: senza `--no-deps` abbassa numpy sotto la versione di pandas e i calcoli si **corrompono** in silenzio (successo: 881 °C su array grandi; numpy ripristinato a 2.5.3).
- `verifica_bussola.mjs`: `node sound-lab/verifica_bussola.mjs` dalla radice; confronta JS e Python (oggi 220/220 stati, UTCI entro 0,17 °C: SunCalc e la formula solare di Python differiscono fino a 0,9°; tollerati i casi a cavallo di −6°).
- `estrai_lcz.py "../Lcz_neurali 2" ../public/data/lcz_ascoli.geojson`: estrae le celle dal gpkg (usa `ogr2ogr` e `proj.db` di **QGIS 3.44** nell'app: il Python di QGIS non parte da solo), aggiunge quartiere e distanza.
- `estrai_edifici_gba.py <uscita.geojson>`: ritaglia gli edifici TUM sul Comune (istruzioni di scaricamento in testa al file; serve `ijson`). `data/comune_ascoli.geojson`: confine del Comune, da usare per **ogni** ritaglio.
- Mappa di base e terreno si rigenerano con la CLI `pmtiles` (brew): `pmtiles extract https://build.protomaps.com/AAAAMMGG.pmtiles ascoli_base.pmtiles --bbox=13.41,42.77,13.75,42.94 --maxzoom=15` e lo stesso da `https://download.mapterhorn.com/planet.pmtiles` con `--maxzoom=12`.
- `index.html` (pagina di ascolto): bussola 3×3 cliccabile, bottone Notte, dissolvenza (default 3 s), sezione "Suoni urbani" con 6 cursori e casella **"Mix calcolato per stato"**.
- Avvio:
  ```bash
  cd sound-lab && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
  .venv/bin/python process.py ../music loops && .venv/bin/python process_sfx.py ../music/sfx sfx
  python3 -m http.server 8765
  ```
  Poi http://localhost:8765. I file vanno caricati uno alla volta (il server di Python si inceppa con molte richieste parallele).
- **Piattaforma**: `npm install && npm run dev` dalla radice. Nessun token né `.env.local`.

## 7. Prossimi passi
0. **A mano (utente)**: cancellare `.env.local`, `prova-mappa.html`, `prova-mappa.js`; eliminare **entrambi** i token su Mapbox.
1. **Commit** del lavoro della quinta sessione (LCZ, bussola UTCI, motore audio): ancora da fare.
2. **Ascolto sopra la mappa**: luglio alle 13 nel Centro (UTCI ~35, Fatica/Calca), alle 9/21 (Passeggiata/Festa), dicembre a mezzogiorno (sereno), mezzanotte (Notte + grilli), fuori dalle celle (silenzio). Giudicare volumi, rapidità dei cambi (isteresi 2 s), scelta dei brani.
3. **Suoni urbani dai dati**: presenza degli effetti da persone (X), verde, UTCI e notte invece che dalle scene fisse.
4. Clima più preciso (facoltativo): **SOLWEIG** (plugin UMEP di QGIS) con `dsm_10m`, terreno e chiome del progetto, su giorni tipo, per ombre vere e suolo caldo; oppure **tarare** l'isola di calore con stazioni in città (verificare la rete regionale delle Marche).
5. **Grafica della mappa MapLibre** (più avanti): stile nuovo secondo le indicazioni dell'utente, al posto del "light" provvisorio.
5. Più avanti: ECharts 5.5 ha un avviso di sicurezza moderato (`npm audit`); valutare ECharts 6.

## 8. Diario delle sessioni
- **2026-10-04 (1)**: strategia S2, bussola a 9 stati, workflow finetuning.ai; 17 brani generati, 10 loop scelti; script di analisi/post-produzione, pagina di ascolto, second brain.
- **2026-10-04 (2)**: 6 effetti urbani (11 varianti) analizzati, puliti e in pagina con alternanza casuale e mix calcolato; dissolvenza 3 s. Scoperto che i dati coprono 246 giorni (non una settimana) e che LCZ copre solo il centro; scaricato il meteo e scritto il prototipo `compass.py` (stagioni → righe della bussola).
- **2026-10-04 (3)**: mix approvato "per ora". Migrazione a **Vite** con librerie e dati locali (nessun CDN), pubblicazione via GitHub Actions su Pages, token Mapbox di sviluppo solo in `.env.local`. Corretti PapaParse (worker) e Litepicker (import); verificato dall'utente che la piattaforma funziona. Scelta (a) per la settimana tipo.
- **2026-10-04 (4)**: store centrale e modulo grafici fatti (corretti 2 difetti di timeline/calendario). Mapbox sostituito da **MapLibre + PMTiles locali** (base OSM/Protomaps, edifici 3D **TUM GlobalBuildingAtlas**, terreno Mapterhorn): niente più token. Nuova regola **solo Comune di Ascoli**: dati tagliati sul confine (affollamento 87, spot 1.186, LCZ 1.548). Migrazione provata dall’utente; corretta la colorazione dei pallini dai grafici a ciambella.
- **2026-10-04 (5)**: LCZ dal progetto QGIS di Simone (12.496 celle da 30 m, popup con tutti i parametri). Bussola **per cella** in JS, verificata contro Python, con isteresi e mirino; **motore audio** con interruttore. Su richiesta dell'utente, i coefficienti inventati sostituiti dall'**UTCI** (Oke, RayMan, Bröde); verde tenuto come "bellezza".

## 9. Prompt per la prossima sessione
```
Riprendiamo la mappa sonora di CityRhythm, branch Music.
Leggi second-brain/SECOND_BRAIN.md e riassumimi in 3 righe dove siamo.
Ricorda la regola: solo il Comune di Ascoli Piceno.

1. Fai il commit del lavoro della quinta sessione (prima mostrami cosa includi).
2. Ascoltiamo la mappa sonora: guidami nelle prove del punto 2 dei "Prossimi passi"
   e correggi volumi, isteresi o brani in base a quello che ti dico.
3. Poi punto 3: suoni urbani guidati dai dati.

Prima di toccare ogni file della piattaforma dimmi cosa cambi. Un passo alla volta:
dopo ognuno mi dici cosa provare con npm run dev e aspetti il mio ok.
```
