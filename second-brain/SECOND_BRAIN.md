# CityRhythm — Second Brain

> Memoria condivisa del progetto. **Ogni agente la legge prima di iniziare.** Si aggiorna a fine sessione col comando `/second-brain` (vedi `.claude/skills/second-brain/SKILL.md`). Sintetico: decisioni e stato, non cronaca.

Ultimo aggiornamento: 2026-10-05 (undicesima sessione)

## 1. Progetto in breve
- **CityRhythm**: dashboard geospaziale (**MapLibre GL 6.12** + PMTiles, ECharts 5.5, Turf 7, D3 + d3-cloud, PapaParse, Litepicker) su affollamento, demografia, POI, LCZ/UHI. 3 dimensioni spaziali + 1 temporale (timeline).
- Codice: JavaScript vanilla, ES modules, **Vite 8** (`npm run dev` / `npm run build` → `dist/`). Librerie da `node_modules` con versioni esatte in `package.json`; **nessun CDN**. Dati in `public/data/` (23 MB: mappa 14 MB, celle LCZ 7,3 MB, meteo, bussola) e audio in `public/audio/` (17 MB).
- Stato: moduli con getter (`getCurrentHour()`, `getMapInstance()`, `getPoiData()`…). **Store centrale** `src/state/store.js` (contratto store Svelte: `subscribe`/`set`/`update`/`get`): `time` `{index, date}` (date = null nella settimana tipo), `viewport` `{bounds, zoom, center}`, `audioEnabled`, **`mood`** (stato della bussola: `stato` confermato, `proposto`, X, Y, UTCI, persone entro 50 m, cella), **`presence`** (puntini fuori casa dell'ora con il loro peso: lo scrive solo `map-layers.js`), **`cellMap`** (UTCI e stato di tutte le celle: lo scrive solo `src/compass/cell-map.js`, solo mentre una mappa oraria è visibile). Scrivono: `updateAppStateForHour` in `ui-timeline.js` (unico punto per l'ora; `setHour(i)` per il calendario) e `moveend`/`load` in `map-setup.js`. `mood` lo scrive solo `src/compass/compass.js`; `audioEnabled` solo l'interruttore in `src/ui/ui-compass.js`. Log `[store]` solo in `npm run dev`. Globali rimasti: `window.selectedDateRange`, `window._timelineMap` (null con ≥ 7 giorni), evento `dateRangeChanged`.
- Grafici: ECharts si importa **solo** in `src/charts/charts.js` (`createChart`); le opzioni dei grafici restano nel formato ECharts.
- Mappa (`src/map/map-setup.js`): stile costruito in codice (`buildMapStyle`): base Protomaps da `ascoli_base.pmtiles` in **stile Toner** (`TONER_FLAVOR`), edifici TUM `buildings-3d` (fill-extrusion bianca + contorno `buildings-outline`, in cima alla base); **nessuna etichetta** della base, sorgente `terrain-dem` per l'interruttore terreno. Nessun token.
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

Timeline: con un intervallo **< 7 giorni** mostra i giorni reali (`window._timelineMap` ha le date); con **≥ 7 giorni** (anche all'avvio) mostra la settimana tipo 168 h filtrata per giorno della settimana, **senza date**. La posizione della timeline si legge **sempre** con `getDateTimeFromIndex` / `getWeekIndex` / `getTimelineDate` (`utils.js`) e la colonna dei luoghi affollati con `getTimelineCrowdednessColumn`: leggerla come settimana tipo con giorni veri era un errore (il 15 agosto diventava "lunedì").

## 2. Obiettivo in corso — branch `Music`
Aggiungere una **dimensione sonora** attivabile ("mappa sonora"). Scopo **divulgativo**: la musica deve trasmettere **emozioni** che le immagini da sole non danno. Densità e calore sono già visibili, quindi niente sonificazione "pitch che segue il dato".

## 3. Decisioni valide
| Tema | Decisione |
|---|---|
| Strategia | **S2 – musica adattiva pre-generata**: un brano principale alla volta, dissolvenza verso lo stato d'animo corrente, più un **livello di suoni urbani** sovrapposto. |
| Ambito geografico | **Regola permanente: solo il Comune di Ascoli Piceno** (confine OSM, relazione 42176, in `sound-lab/data/comune_ascoli.geojson`). Dati di Lucca, San Benedetto, Pagliare ecc. **cancellati**; non scaricare né aggiungere mai dati fuori dal Comune. |
| Ambito audio | **Solo Ascoli**, **tutti i 246 giorni** (2024-06-01 → 2025-02-01), dal caldo al freddo. Niente "settimana tipo" per il meteo. |
| Modello emotivo | **Bussola** (circomplesso di Russell) **per cella**: conta la cella LCZ **al centro della mappa** (mirino + contorno nero). **Niente medie per quartiere** ("si omogeneizza tutto troppo"). Parametri in **`public/data/bussola.json`**, letto sia da `sound-lab/compass.py`+`clima.py` (riferimento) sia da `src/compass/`. |
| Energia (X) | **Persone fuori casa entro 50 m dalla cella**, contate dai **puntini della mappa** (store `presence`; ogni puntino pesa persone vere del quartiere ÷ puntini del quartiere; chi dorme in casa non conta). Idea dell'utente: "le persone le abbiamo distribuite noi". Scala log tarata da `taratura_energia.mjs` (10°/90° percentile delle ore di luce, celle nei quartieri): **≈ 3 persone = poca gente, ≈ 18 = affollato** (`energia_cella` in `bussola.json`: raggio 50 m, `log_lo` 1,79, `log_hi` 4,16). Il riferimento Python resta per quartiere. |
| Piacevolezza (Y) | `0.75 × comfort + 0.25 × verde − 0.3 se piove (> 0,5 mm)`, valori della cella. **Verde come "bellezza"** (superficie permeabile) tenuto per scelta espressiva dell'utente, **non fisica**. Comfort dall'**UTCI** della cella: +1 senza stress (9–26 °C), −1 dove inizia lo **stress forte** (**32 °C** caldo, **−13 °C** freddo), lineare in mezzo. |
| Clima per cella (**UTCI**) | Richiesto dall'utente: niente "numeri a caso". Catena con basi pubblicate (`sound-lab/clima.py`, fonti anche in `bussola.json` → `fonti`): **1. aria** = Open-Meteo + isola di calore **solo di notte e solo celle costruite (LCZ 1–10)**: `15,27 − 13,88·SVF` (Oke 1981) con tetto `2,01·log10(46.000) − 4,06 ≈ 5,3 °C` (Oke 1973, città europee), × `min(1, U^−½)` (vento, Oke) × rapporto perdita infrarossa reale/sereno (nuvole). **2. Tmrt** di persona in piedi (RayMan/VDI 3787: ak 0,7, εp 0,97, Fi 0,06/0,22, fp di Jendritzky): sole diretto (DNI) × quota di strada al sole (canyon con H/W ricavato dallo SVF, mediato sulle orientazioni), diffuso × SVF, riflesso dal suolo con l'**albedo** della cella, infrarosso del cielo (Brutsaert; nuvole Crawford & Duchon), suolo e muri alla temperatura dell'aria. **3. vento** a 10 m riportato alla rugosità **z0** della cella (altezza di miscelamento 60 m, Wieringa/WMO). **4. UTCI** col polinomio ufficiale Bröde 2012 (211 termini estratti da pythermalcomfort). Nel pannello: "UTCI ≈ 35 °C · stress da caldo forte (stima)". |
| Limiti dichiarati del clima | Meteo unico per tutta la città; isola di calore da formule di letteratura, non tarata su misure di Ascoli; ombra stimata dallo SVF, non edificio per edificio; suolo e muri alla temperatura dell'aria (la pietra rovente al sole non è contata → stress in pieno sole sottostimato). È una **stima per confrontare celle**, non un termometro. |
| Soglie | ±1/3 su entrambi gli assi → 9 stati. |
| 9 stati (Y↓, X→) | Sereno: **Rifugio · Passeggiata · Festa** / Neutro: **Attesa · Routine · Corrente** / Opprimente: **Afa · Fatica · Calca** |
| Notte | Brano **Notte** + grilli solo se il sole è sotto −6° **e** c'è poca gente (X < −1/3). Le sere affollate restano Festa/Corrente/Calca. |
| Esito della formula (UTCI) | *(Calcolato con l'energia per quartiere di `compass.py`.)* Estate: **a mezzogiorno** Fatica/Calca (Centro, UTCI mediana ~35 °C), mattina e sera Passeggiata/Festa. Settembre–ottobre sereni. **Inverno: di giorno sereno** (UTCI 9–26 = nessuno stress, l'UTCI tiene conto dei vestiti), notti Notte. Celle nei quartieri: notte 32%, Festa 25%, Passeggiata 13%, Calca 8%, Rifugio 6%, Corrente 6%, Fatica 5%, Routine 3%, Afa 1,5%, Attesa 0,7%. **Per ora non servono brani invernali.** |
| Meteo | Open-Meteo archivio, Ascoli (42.854, 13.575), orario, fuso Europe/Rome, 5.904 ore, in **`public/data/meteo_ascoli.json`**: temperatura, percepita, umidità, radiazione globale **+ diretta, diffusa, DNI**, nuvole, vento (km/h), pioggia. Scaricato una volta, servito dal sito. |
| Fonte LCZ | **Solo** `Lcz_neurali 2/FETCH+simoneAP/unified/lcz_grid_30m_lcz_params.gpkg` (progetto QGIS di Simone, EPSG:3004, tabelle verificate dall'utente). **Celle native da 30 m, mai raggruppate; sempre vettoriale, mai raster**; ritaglio **solo sul rettangolo dei quartieri** (non tutto il Comune). Il resto del progetto (raster, xlsx, CSV, griglia 100 m vuota) non serve. La cartella (2,7 GB) è in `.gitignore`. |
| Campi LCZ | Bussola: `svf_mean` (0 = difetto → 0,4 di ripiego), `albedo`, `z0_value`, `pervious_frac`, `lcz_class`. Mappa: **tutti i campi di costruzione nel popup al clic** (scopo divulgativo, non per l'audio): classe in italiano, rischio (`lcz_vulnerability`, stessa tabella del vecchio "UHI risk"), parametri in accordo (su 10), correzione ESA, SVF, H/W, % edificata/impermeabile/permeabile, altezza, rugosità, z0, ammettenza, albedo, calore antropico e industriale. Il loader copia `lcz_class`→`LCZ` e `lcz_vulnerability`→`UHI risk` per i colori esistenti. |
| Mappe dei parametri LCZ | Menu **Show** sotto LCZ Vitality (al posto delle radio LCZ/UHI): LCZ types, UHI risk e 13 parametri delle celle (accordo della classificazione, SVF, H/W, altezza, % edificata/impermeabile/permeabile, albedo, ammettenza, calore antropico e industriale, classe di rugosità, z0). Scale continue in `LCZ_DATA_VIEWS` (`config.js`) con tinte **assenti da LCZ e UHI** (blu notte, ciano, turchese, viola, lavanda, magenta, ardesia), soglie sui percentili 5–95, colori con `to-color` (senza, MapLibre rifiuta l'espressione). Legenda per ogni mappa (categorie o barra + frase). Trasparenti: SVF = 0 (difetto) e celle senza calore industriale. "UHI Dynamic Visibility" visibile solo con UHI. Esclusi `lcz_rmsep` e `lcz_esa_fix` (tecnici, restano nel popup). Approvato dall'utente ("molto bene"). |
| Comportamento | **Isteresi 1 s** (`tenuta_s`) e **dissolvenza 1 s** a potenza costante (seno/coseno, ripresa dal volume attuale), legata a `PRESENCE_MOVE_MS`: musica, timeline e puntini si muovono insieme (col Play un'ora dura 1,3 s). Effetti urbani: rampa di 1 s. Centro della mappa fuori dalle celle LCZ: **silenzio**. |
| Motore audio | `src/audio/audio-engine.js`, legge solo `audioEnabled` e `mood`. Interruttore **"Attiva mappa sonora"** nel riquadro in basso a sinistra (mirino, contorno e valori visibili solo ad audio acceso). Parte il brano dello stato attuale, gli altri si caricano in sottofondo; spegnendo, sfuma in 1 s. Asset in **`public/audio/`** (loops, sfx, `mix.json`); in `sound-lab/` restano **collegamenti simbolici** per la pagina di ascolto e gli script. |
| Suoni urbani | Folla leggera/densa ↔ persone; traffico ↔ città; parco ↔ verde; cicale ↔ calore; grilli ↔ notte. |
| Riproduzione effetti | Niente loop cucito: ogni suono **alterna a caso le varianti** (mai la stessa due volte di fila), dissolvenza incrociata equal-power fino a 1,2 s, velocità casuale ±4%. |
| Mix effetti | **Calcolato** (`sound-lab/mix.json`): volume = musica (−18 LUFS) − `sotto_musica_db` + 20·log10(presenza). Tetti sotto la musica: folla densa 9 dB, grilli 11, folla leggera 12, parco 13, cicale 14, traffico 15. Somma degli effetti per scena 8–14 dB sotto la musica (Attesa ≈ 20). La presenza (0–1) per ora viene dalle scene per stato (anche nella piattaforma); in futuro dai dati. Se il mix non convince: cursori di volume nell'app. |
| Generazione musica | **finetuning.ai**, piano Plus, a mano. Scheda **Instrumental**; nessuno stile preset; nessun tag; **Enhance prompt OFF**; Length 2 min; seed fisso. Prompt in **inglese**. |
| Coerenza musicale | Tutti i brani in **re** (maggiore sereni, minore opprimenti), ambient-cinematografico. Ogni prompt termina con la "coda fissa" (vedi `prompts.md`). |
| Post-produzione musica | Taglio sfumature, loop su battuta con dissolvenza incrociata di 2 s, **−18 LUFS**, picco ≤ −1 dBFS, MP3 160k. |
| Post-produzione effetti | Taglio della sfumatura finale (tratto entro 3 dB dalla mediana), micro-fade 50 ms, **−20 LUFS**, limitatore sui picchi isolati, MP3 160k. |
| Settimana tipo e clima | Con ≥ 7 giorni, per ogni cella si calcola l'UTCI in tutti i giorni veri dell'intervallo con quel giorno della settimana e si usano meteo e sole del giorno al **90° percentile** (`percentile_utci_settimana_tipo` = 0,9: "una giornata calda, superata 1 volta su 10"); persone = puntini dell'ora (media dell'intervallo). Su tutto il periodo cade sempre a luglio; ottobre o inverno restano sereni (il percentile guarda solo il caldo). Il pannello indica il giorno scelto. |
| Mappe orarie | Menu **Show**, gruppo "Hour by hour (sound compass)": **UTCI heat stress (estimate)** con scala **continua** (`UTCI_RAMP`, `interpolate-lab`: blu −13, azzurro 0, verde 9–17,5, giallo 26, arancio 32, rosso 38, rosso scuro 46 °C) e **Sound map** a colori **netti** per stato (`SOUND_STATE_COLORS`: righe sereno verde-azzurro / neutro grigio-viola / opprimente arancio-rosso, colonne chiaro → scuro con la gente, Notte blu notte; legenda a mini-bussola 3×3). Stesso calcolo della bussola, senza isteresi, a ogni ora anche ad audio spento; colori dal **feature-state** delle celle; popup con UTCI, stato e persone dell'ora. Approvate dall'utente ("molto bello"). |
| Autosufficienza | **Il sito fornisce tutto da sé**, mappa compresa: nessuna libreria, dato, tessera o token da siti esterni (verificato sulla build). |
| Mappa | **MapLibre GL** + PMTiles locali. Base: estratto Protomaps (OSM) del riquadro 13.41–13.75 E, 42.77–42.94 N, z ≤ 15. Terreno: estratto Mapterhorn (terrarium, 512 px). Edifici: **GlobalBuildingAtlas del TUM** (scelti dall'utente dopo il confronto con OSM: "senza ombra di dubbio meglio"), GeoJSON con `height`. Crediti nella mappa: OSM, Protomaps, TUM (CC BY-NC 4.0, **solo uso non commerciale**), Mapterhorn. |
| Edifici TUM | Si scaricano **una volta** dal rilascio HuggingFace (`zhu-xlab/GBA.ODbLPolygon` + `GBA.LoD1`, tassello `europe/e010_n45_e015_n40`, ~4,4 GB temporanei) e si ritagliano sul Comune con `sound-lab/estrai_edifici_gba.py`. **Mai** il WFS del TUM: gli autori lo vietano per scaricamenti automatici. Altezze stimate da satellite (centro: mediana ~6,7 m, forse sottostimate). |
| Terreno 3D | Interruttore come prima: piatto dall'alto, rilievo inclinando la camera (`setTerrain` su `terrain-dem`). |
| Aspetto mappa | **Stile Toner** (Stamen/MapTiler, `openmaptiles/maptiler-toner-gl-style`), scelto dall'utente ("mi piace tantissimo"). Lo stile originale è per tessere OpenMapTiles: **rifatto sullo schema Protomaps** con una tavolozza personalizzata (`TONER_FLAVOR` in `map-setup.js`): bianco, acqua/strade/confini neri, **nessuna etichetta né icona** (richiesta dell'utente: tolte prima le strade, poi tutte; restano solo i nomi degli Spot, legati al loro livello). Verde nero con le **trame originali** (boschi a puntini, cimiteri a crocette, resto a trattini), sprite locale `sprites/toner` (licenza BSD, crediti in mappa; nel `@2x` scaricato le coordinate erano sbagliate, corrette). Sprite `light` non più usato (file ancora in `sprites/`). **Edifici bianchi, niente tratteggio** (richiesta dell'utente), con contorno nero a terra per non sparire dall'alto. |
| Framework | **Vite (vanilla)**, fatto. Svelte/React/Vue aggiungibili con un plugin in `vite.config.js` (`base: './'`). |
| Intercambiabilità | Tutto deve poter essere sostituito (UI in Svelte/React/Vue, libreria dei grafici). **Fatto**: store centrale compatibile Svelte (React via `useSyncExternalStore(store.subscribe, store.get)`), ECharts isolato in `src/charts/charts.js`. Bussola e motore audio comunicano solo tramite lo store. Formato neutro per le opzioni dei grafici: solo se si cambia davvero libreria. |
| Pubblicazione | **GitHub Pages** con `.github/workflows/deploy.yml` (build a ogni push su `main`). Serve Settings → Pages → Source: **GitHub Actions**. Nessun token da configurare. |
| Puntini delle persone (Presence Density) | Ogni persona ha un'**identità stabile** ricordata da un'ora all'altra (`presenceStates` in `map-layers.js`); niente rimescolamento a caso (faceva ammassare tutti al centro durante gli spostamenti). A ogni cambio d'ora: 1) dentro il quartiere chi è in più a uno spot va allo spot vicino che cresce; 2) **fra quartieri**: chi avanza in un quartiere che si svuota va allo spot che cresce più vicino in un quartiere che si riempie; 3) solo il resto **entra da fuori città** (fade in) o **esce verso l'esterno** (fade out), 600 m oltre la posizione in direzione opposta al centro (`PRESENCE_EXIT_METERS`). Animazione 1 s (`PRESENCE_MOVE_MS`); Play a 1,3 s per ora (prima ~0,3 s). Rispetta "riduci movimento". |
| Gente "in giro" (10% per quartiere) | Solo su celle LCZ **costruite (1–10) o pavimentate (E)** del quartiere (`getStreetCellsForFeature` in `map-layers.js`), cella fissa per persona: **mai fiume, boschi, prati** (A–D, F, G), a nessuna ora. Richiesto dall'utente ("improbabile che ci sia gente al fiume"). Gli spot reali in celle verdi (110 su 1.186) restano, con i puntini entro 10 m. |
| Notte delle persone | **95%** a casa (`NIGHT_HOME_SHARE`), rampa 22→24 e 6→8 (`NIGHT_GO_HOME_HOURS`, `NIGHT_WAKE_UP_HOURS`); il 5% resta ai locali. Casa = edificio TUM del quartiere scelto **in proporzione al volume** (area × altezza), sempre lo stesso per persona. I dati TUM non distinguono abitazioni da capannoni. Approvato dall'utente ("di notte va bene"). |
| Synthetic Crowded Points | Ogni spot (1.186) ha **5 "maestri" fissi** fra gli 87 luoghi reali (etichette simili, vicini); un maestro chiuso conta 0. Maestri calcolati una volta e messi in cache. Alle 3 di notte di sabato gli spot attivi scendono da 784 a ~460; fra mattina e sera cambia posto il 25–28% delle persone (prima 15%). Raggio massimo di 500 m scartato: 1/4 degli spot senza maestri e 3 quartieri (Porta Cartara, Borgo Chiaro, Tofare) senza luoghi reali. Resta una stima: 87 luoghi per 1.186 spot, 27 etichette generiche. |
| Colorazione dei puntini | Sezione **"Color dots by"** nel riquadro Map Layers (pulsanti **Off · Gender · Age · Nationality · Visits** + legenda), in `src/map/presence-colors.js`. Colora **tutti i quartieri**, ognuno con le **sue percentuali reali** (stessi giorni dei grafici: < 7 giorni = intervallo, altrimenti stesso giorno della settimana). Conteggi esatti (resti maggiori) e **stabili al cambio d'ora**: ogni persona ha un posto fisso in una "fila" per quartiere (`hash01(chiave)`), in prova 189/195 tengono il colore. Il clic sui grafici di genere/età/nazionalità/visite accende il pulsante corrispondente. Province, nazioni e interessi **esclusi** dal selettore (elenchi diversi per quartiere; gli interessi sono indici, non percentuali): il loro clic colora solo il quartiere selezionato, come prima. |
| Velocità UTCI | Polinomio con potenze precalcolate (`compass-core.js`): stesso risultato, ~30× più veloce. Tutte le celle: 0,15 s per un'ora vera, ~0,27 s in settimana tipo (giorni scelti in cache). |
| Puntini e giorni veri | Con giorni veri i puntini usano il dato di **quel giorno** e gli Spot il giorno della settimana giusto; in settimana tipo la media dei soli giorni dell'intervallo (come grafici e bussola). |
| Stem | Al momento non servono. Se servissero: StemDeck o UVR5 (locali), MVSEP (web). |

## 4. Decisioni superate
- ~~Energia = persone/km² del quartiere (1.730–9.882), sfumata entro 300 m fuori dai quartieri~~ → la mappa sonora era fatta di blocchi uguali per quartiere: ora gente entro 50 m dai puntini (`energia_svanisce_m` non più usato in JS).
- ~~Settimana tipo: piacevolezza fissa a Neutro~~ e poi ~~stato più frequente fra i giorni~~ → i giorni miti vincevano sempre ("quasi sempre Festa"): ora giorno al 90° percentile dell'UTCI.
- ~~Isteresi 2 s e dissolvenza 3 s lineare~~ → col Play (1,3 s per ora) la musica non cambiava mai: 1 s e 1 s a potenza costante.
- ~~Mappa UTCI a fasce (scalini)~~ → richiesta dell'utente: sfumatura continua.
- ~~Mapbox GL 2.15 con stile Mapbox Studio, token pubblico nel codice e token di sviluppo in `.env.local`~~ → MapLibre + PMTiles locali, nessun token. I token Mapbox vanno eliminati (quello di sviluppo è finito in chat).
- ~~Unica eccezione all'autosufficienza: tessere Mapbox~~ → ora nessuna eccezione.
- ~~Dati di Lucca, costa, San Benedetto, Pagliare~~ → regola "solo Comune di Ascoli Piceno".
- ~~Edifici scaricati al volo dal WFS del TUM~~ → vietato dagli autori e contrario all'autosufficienza; estrazione una tantum.
- ~~Etichette della mappa di base (strade, città, quartieri, fiumi) e icone POI~~ → tolte tutte, mappa muta.
- ~~Flavor Protomaps "light" provvisorio, edifici colorati per altezza (crema → bruno)~~ → stile Toner con edifici bianchi.
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
- ~~Spot che copiano solo dai luoghi reali aperti in quell'ora (anche a ~1 km)~~ → maestri fissi, i chiusi contano 0: di notte restava "aperto" il 66% degli spot.
- ~~Puntini rigenerati a caso a ogni ora, Play a 5 passi/s~~ → identità stabili e spostamenti animati; il Play interrompeva l'animazione e ammassava tutti al centro.
- ~~Colori dei puntini solo dal clic sui grafici, solo per il quartiere selezionato, persi al cambio d'ora~~ → selettore "Color dots by" su tutti i quartieri, stabile (per genere, età, nazionalità, visite).
- ~~Gente "in giro" in un punto a caso del quartiere~~ → finiva sul Tronto e nei prati; ora solo celle LCZ costruite o pavimentate.
- ~~Selettore LCZ a due radio (LCZ Types / UHI Risk)~~ → menu con tutte le mappe dei parametri delle celle.
- ~~Chi arriva esce di casa, chi se ne va rientra in casa~~ (passaggio intermedio) → si entra/esce dalla città con dissolvenza.

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
- `taratura_energia.mjs`: `node sound-lab/taratura_energia.mjs` dalla radice (~4 s); ricostruisce i puntini con le regole della mappa (3/4 agli Spot, 1/4 sulle strade, chi è a casa escluso) e riscrive `energia_cella` in `bussola.json`. Rilanciarlo se cambiano raggio, regole dei puntini o dati.
- `verifica_bussola.mjs`: `node sound-lab/verifica_bussola.mjs` dalla radice; confronta JS e Python su clima, UTCI e piacevolezza con l'energia per quartiere (oggi 220/220 stati; l'energia per cella non è coperta, UTCI entro 0,17 °C: SunCalc e la formula solare di Python differiscono fino a 0,9°; tollerati i casi a cavallo di −6°).
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
0. **A mano (utente)**: eliminare **entrambi** i token sul sito di Mapbox (file locali già cancellati; il token pubblico resta nella cronologia del repository, che è pubblico: va revocato).
2. **Ascolto sopra la mappa** con la Sound map accesa come guida: estate a mezzogiorno (Calca nelle piazze, Afa nei vicoli), mattina e sera, dicembre (sereno), notte (Notte + grilli), fuori dalle celle (silenzio). Giudicare volumi, cambi di 1 s col Play (frenetici? allora dissolvenza 1,5–2 s), musica che cambia spostando il mirino di 50–100 m.
3. **Suoni urbani dai dati**: presenza degli effetti da persone (X), verde, UTCI e notte invece che dalle scene fisse.
3b. **Ombra degli alberi** (proposta B, in attesa di ok perché riapre "solo il gpkg"): da `unified/tcd_10m.tif` (Copernicus) e `canopy_height_10m.tif` (ETH) un campo "quota coperta da alberi" per cella, che toglie sole diretto alla Tmrt (come RayMan). Celle sempre vettoriali; aggiornare anche `clima.py`.
3c. Da giudicare in mappa: raggio di 50 m (macchie più nette o più ampie), leggibilità di UTCI e Sound map al 70%, scatti dei puntini col Play in settimana tipo (se sì: calcolo in un Web Worker). Il riferimento Python non ha l'energia per cella: portarla solo se serve.
4. Clima più preciso (facoltativo): **SOLWEIG** (plugin UMEP di QGIS) con `dsm_10m`, terreno e chiome del progetto, su giorni tipo, per ombre vere e suolo caldo; oppure **tarare** l'isola di calore con stazioni in città (verificare la rete regionale delle Marche).
5. **Stile Toner da verificare a occhio** (non visto dall'agente: nessun browser per gli screenshot): resa del verde nero a vari zoom (se troppo scuro → grigio con trame), edifici bianchi dall'alto e inclinati, leggibilità di puntini, celle LCZ e quartieri sul bianco e nero; orientamento senza etichette; leggibilità delle scale chiare dei parametri LCZ sul bianco (se spariscono: più opacità o inizio scala più scuro). Facoltativo: cancellare `sprites/light.*`.
6. **Puntini delle persone**: l'utente verifica i flussi fra quartieri, l'entrata/uscita dalla città (600 m adatti?) e la velocità del Play. Possibili ritocchi: anche la gente "in giro" (10%) fra quartieri; chi cambia quartiere dorme nel quartiere dove si trova. Verificare in mappa che fiume e prati restino vuoti (Tronto, Tue 20:00 e ore 11); se disturbano anche i gruppetti agli spot in celle verdi: ridurli o toglierli di sera. Il vecchio `animatePresencePoints`/campo di forze in `map-layers.js` non è mai avviato (codice morto, da togliere).
7. Più avanti: ECharts 5.5 ha un avviso di sicurezza moderato (`npm audit`); valutare ECharts 6.

## 8. Diario delle sessioni
- **2026-10-04 (1–6)**: strategia S2, bussola a 9 stati, loop ed effetti, meteo 246 giorni; Vite locale, Pages, store, MapLibre + PMTiles (TUM), regola **solo Comune di Ascoli**. LCZ a 30 m, bussola per cella con **UTCI**, motore audio. Puntini con identità stabili, notte a casa, Synthetic Crowded Points con maestri fissi.
- **2026-10-05 (7–9)**: "Color dots by" su tutti i quartieri; gente in giro solo su celle costruite/pavimentate; mappa in **stile Toner** su Protomaps, edifici bianchi, nessuna etichetta.
- **2026-10-05 (10)**: menu **Show** con 15 mappe delle celle LCZ (13 parametri in tinte proprie + legenda); espressioni verificate col validatore MapLibre.
- **2026-10-05 (11)**: settimana tipo col clima (giorno al 90° percentile UTCI); dissolvenza e isteresi 1 s; mappe orarie **UTCI** (continua) e **Sound map**; puntini corretti sui giorni veri; **energia per cella** dalla gente dei puntini entro 50 m (nuova taratura). UTCI 30× più veloce.

## 9. Prompt per la prossima sessione
```
Riprendiamo la mappa sonora di CityRhythm, branch Music.
Leggi second-brain/SECOND_BRAIN.md e riassumimi in 3 righe dove siamo.
Ricorda la regola: solo il Comune di Ascoli Piceno.

Obiettivo 1 – Ascolto sopra la mappa (punto 2 dei "Prossimi passi").
Guidami prova per prova (luglio alle 13 nel Centro, luglio alle 9 e alle 21,
dicembre a mezzogiorno, mezzanotte, mirino fuori dalle celle): per ognuna dimmi
cosa dovrei vedere nel pannello e sentire, poi aspetta il mio giudizio.
Io non ho competenze musicali: fammi domande semplici (es. "la musica copre
le voci della folla?", "il cambio è troppo lento?") e traduci tu le mie
risposte in numeri (volumi in dB, isteresi, dissolvenza).

Obiettivo 2 – Suoni urbani guidati dai dati (punto 3): proponimi come legare
folla, traffico, parco, cicale e grilli a persone, verde, UTCI e notte della
cella, con il mix sempre calcolato. Niente codice prima del mio ok.

Prima di toccare ogni file della piattaforma dimmi cosa cambi. Un passo alla volta:
dopo ognuno mi dici cosa provare con npm run dev e aspetti il mio ok.
A fine sessione aggiorna il second brain e fai commit e push su Music.
```
