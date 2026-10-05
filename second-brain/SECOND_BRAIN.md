# CityRhythm — Second Brain

> Memoria condivisa del progetto. **Ogni agente legge questo indice prima di iniziare**, poi i file di argomento che servono al lavoro (elenco nella sezione 4). Si aggiorna a fine sessione col comando `/second-brain` (vedi `.claude/skills/second-brain/SKILL.md`). Sintetico: decisioni e stato, non cronaca.

Ultimo aggiornamento: 2026-10-05 (sedicesima sessione)

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
| Mappa (`public/data/mappa/`) | — | base Protomaps/OSM 5,2 MB, terreno Mapterhorn 4,7 MB (z ≤ 12), **11.341 edifici TUM** 3,7 MB (con `res` = residenti Meta), font Noto Sans e icone |
| **Residenti Meta** (HRSL 2020, quadratini ~30 m, CC BY 4.0) | 2020 | Comune intero: **47.076 residenti** (ISTAT ~46–47 mila); assegnati agli edifici in `gba_ascoli.geojson` → `res` |
| **Quota in casa** (`quota_in_casa.json`, 7 giorni × 24 ore) | diari ISTAT Uso del tempo 2008-09 (40.939) | Italia, via IPUMS MTUS; solo la curva aggregata, i microdati restano in `IPUMS/` |
| Simulazione locale (`cityrhythm_simulation_week.*`) | solo 3–9 giugno 2024 | Ascoli |

Timeline: con un intervallo **< 7 giorni** mostra i giorni reali (`window._timelineMap` ha le date); con **≥ 7 giorni** (anche all'avvio) mostra la settimana tipo 168 h filtrata per giorno della settimana, **senza date**. La posizione della timeline si legge **sempre** con `getDateTimeFromIndex` / `getWeekIndex` / `getTimelineDate` (`utils.js`) e la colonna dei luoghi affollati con `getTimelineCrowdednessColumn`: leggerla come settimana tipo con giorni veri era un errore (il 15 agosto diventava "lunedì").

## 2. Obiettivo in corso — branch `Music`
Aggiungere una **dimensione sonora** attivabile ("mappa sonora"). Scopo **divulgativo**: la musica deve trasmettere **emozioni** che le immagini da sole non danno. Densità e calore sono già visibili, quindi niente sonificazione "pitch che segue il dato".

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

## 5. Prossimi passi
0. **A mano (utente)**: eliminare **entrambi** i token sul sito di Mapbox (file locali già cancellati; il token pubblico resta nella cronologia del repository, che è pubblico: va revocato).
2. **Ascolto sopra la mappa** con la Sound map accesa come guida: estate a mezzogiorno (Calca nelle piazze, Afa nei vicoli), mattina e sera, dicembre (sereno), notte (Notte + grilli), fuori dalle celle (silenzio). Giudicare volumi, cambi di 1 s col Play (frenetici? allora dissolvenza 1,5–2 s), musica che cambia spostando il mirino di 50–100 m.
3. **Suoni urbani dai dati**: presenza degli effetti da persone (X), verde, UTCI e notte invece che dalle scene fisse.
3c. Da giudicare in mappa: raggio di 50 m (macchie più nette o più ampie), leggibilità di UTCI e Sound map al 70%. Il riferimento Python non ha l'energia per cella: portarla solo se serve.
4. Clima più preciso (facoltativo): **SOLWEIG** (plugin UMEP di QGIS) con `dsm_10m`, terreno e chiome del progetto, su giorni tipo, per ombre vere e suolo caldo. È anche la via giusta per gli **alberi** (oppure: SVF dei soli edifici + chiome trattate come chiome, trasmissività ~3%): cambierebbe soprattutto le celle verdi; oppure **tarare** l'isola di calore con stazioni in città (verificare la rete regionale delle Marche).
5. **Stile Toner da verificare a occhio** (l'agente ora fa screenshot con Chrome senza finestra, vedi `strumenti.md`, ma il giudizio è dell'utente): resa del verde nero a vari zoom (se troppo scuro → grigio con trame), edifici bianchi dall'alto e inclinati, leggibilità di puntini, celle LCZ e quartieri sul bianco e nero; orientamento senza etichette; leggibilità delle scale chiare dei parametri LCZ sul bianco (se spariscono: più opacità o inizio scala più scuro). Facoltativo: cancellare `sprites/light.*`.
6. **Puntini delle persone**: l'utente verifica i flussi fra quartieri, l'entrata/uscita dalla città (600 m adatti?) e la velocità del Play; giudicare a occhio il brulichio ridisegnato a passi di 1 pixel (se sembra a scatti: `PRESENCE_WIGGLE_STEP_PX` a 0.5) e i colori mescolati negli assembramenti (Gender in una piazza); lo slider per ridurre i puntini solo se il computer resta affaticato. Possibili ritocchi: anche la gente "in giro" (10%) fra quartieri; chi cambia quartiere dorme nel quartiere dove si trova. Verificare in mappa che fiume e prati restino vuoti (Tronto, Tue 20:00 e ore 11); se disturbano anche i gruppetti agli spot in celle verdi: ridurli o toglierli di sera. Il vecchio `animatePresencePoints`/campo di forze in `map-layers.js` non è mai avviato (codice morto, da togliere).
6b. **Crediti della mappa** troppo lunghi (OSM, TUM, Meta, ISTAT/IPUMS, UCL): all'apertura passano sotto timeline e bussola. Proposta: tenerli chiusi dietro la "i" (`attributionControl` compatto). Da decidere con l'utente.
7. Più avanti: ECharts 5.5 ha un avviso di sicurezza moderato (`npm audit`); valutare ECharts 6.
8. **Gente in casa da verificare a schermo** (non vista dall'agente): puntini scuri attenuati di giorno nei quartieri residenziali, rientro graduale dalle 19, più gente in giro a mezzanotte (Sound map in "Notte" verso l'1–2: va bene?), sabato notte, case non più su capannoni (Stadio). Se mezzanotte sembra troppo viva: valutare una via di mezzo fra regola prudente e larga.
9. Facoltativi sulla curva: estrarre anche `MONTH` da IPUMS per curve estate/inverno; correggere lo smart working con la domanda "lavora da casa" del file ISTAT 2023 (`UsoTempo_2023_IT`). Domanda aperta per l'utente: come sono misurate le presenze "blimp" (sensori, celle, app)?
10. **Quando si pubblica** un lavoro con questi dati: aggiungerlo alla bibliografia IPUMS (http://bibliography.ipums.org/) e mandarne copia al CTUR (UCL).

## 6. Diario delle sessioni
- **2026-10-04 (1–6)**: strategia S2, bussola a 9 stati, loop ed effetti, meteo 246 giorni; Vite locale, Pages, store, MapLibre + PMTiles (TUM), regola **solo Comune di Ascoli**. LCZ a 30 m, bussola per cella con **UTCI**, motore audio. Puntini con identità stabili, notte a casa, Synthetic Crowded Points con maestri fissi.
- **2026-10-05 (7–9)**: "Color dots by" su tutti i quartieri; gente in giro solo su celle costruite/pavimentate; mappa in **stile Toner** su Protomaps, edifici bianchi, nessuna etichetta.
- **2026-10-05 (10–12)**: menu **Show** con 15 mappe delle celle LCZ; settimana tipo col clima (90° percentile UTCI); dissolvenza e isteresi 1 s; mappe orarie **UTCI** e **Sound map**; **energia per cella** dai puntini entro 50 m; UTCI 30× più veloce; alberi già nello SVF; puntini "a formichine".
- **2026-10-05 (13)**: puntini in casa al 50%, neri anche da vicino, attenuati all'arrivo; case pesate coi **residenti Meta**; **curva ISTAT in casa** (IPUMS MTUS 2008) con regola prudente al posto del 95% e delle rampe a mano; nuova taratura dell'energia; licenze IPUMS/UCL lette e citazioni nei crediti.
- **2026-10-05 (14–15)**: riparati menu Show LCZ/UHI, terreno ed edifici 3D (`isStyleLoaded()` falso per il brulichio → `isMapReady`/`whenMapReady`); torna l'inquadratura sui quartieri. 3D Buildings e 3D Terrain **spenti all'avvio**, la mappa segue la casella anche al caricamento.
- **2026-10-05 (16)**: puntini molto più leggeri: a MapLibre **gruppi MultiPoint a 32 strati** con le sole proprietà dello stile, ridisegno da fermi a passi di 1 pixel fisico (~10/s a zoom 13), spostamenti ≤ 30/s. Da fermi worker −90%, pagina −71%, GPU −68%; Play worker −57%. Conteggi, colori e ordine di disegno verificati uguali.

## 7. Prompt per la prossima sessione
```
Riprendiamo la mappa sonora di CityRhythm, branch Music.
Leggi second-brain/SECOND_BRAIN.md (più audio.md e bussola-clima.md per questo
lavoro) e riassumimi in 3 righe dove siamo.
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
