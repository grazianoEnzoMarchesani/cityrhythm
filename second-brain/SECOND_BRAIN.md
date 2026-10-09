# CityRhythm — Second Brain

> Memoria condivisa del progetto. **Ogni agente legge questo indice prima di iniziare**, poi i file di argomento che servono al lavoro (elenco nella sezione 4). Si aggiorna a fine sessione col comando `/second-brain` (vedi `.claude/skills/second-brain/SKILL.md`). Sintetico: decisioni e stato, non cronaca.

Ultimo aggiornamento: 2026-10-10 (ventesima sessione)

## 1. Progetto in breve
- **CityRhythm**: dashboard geospaziale (**MapLibre GL 6.12** + PMTiles, ECharts 5.5, Turf 7, D3 + d3-cloud, PapaParse, Litepicker) su affollamento, demografia, POI, LCZ/UHI. 3 dimensioni spaziali + 1 temporale (timeline).
- Codice: JavaScript vanilla, ES modules, **Vite 8** (`npm run dev` / `npm run build` → `dist/`). Librerie da `node_modules` con versioni esatte in `package.json`; **nessun CDN**. Dati in `public/data/` (23 MB) e audio in `public/audio/` (loop IA, classica, effetti).
- **Store centrale** `src/state/store.js` (contratto Svelte: `subscribe`/`set`/`update`/`get`): `time`, `viewport`, `audioEnabled`, `musicMode` (`ia` · `classica` · `metronomi` · `sottotraccia`), **`mood`** (stato della bussola: `stato` confermato, `proposto`, `X` energia, `Y` piacevolezza, `T` UTCI, `C` comfort, **`H` calore con segno**, persone entro 50 m, cella), **`presence`** (puntini fuori casa: lo scrive solo `map-layers.js`), **`cellMap`** (UTCI, stato, `x`, `y` di tutte le celle: lo scrive solo `cell-map.js`, solo mentre una mappa oraria è visibile). `mood` lo scrive solo `src/compass/compass.js`; `audioEnabled` e `musicMode` solo `src/ui/ui-compass.js`. Log `[store]` solo in `npm run dev`.
- Grafici: ECharts si importa **solo** in `src/charts/charts.js`. d3 si importa da `'d3'` (dipendenza diretta), non dai sotto-pacchetti.
- Mappa (`src/map/map-setup.js`): stile costruito in codice: base Protomaps da `ascoli_base.pmtiles` in **stile Toner** o **Nolli** (selettore Map style), edifici TUM `buildings-3d` (spenti all'avvio), **nessuna etichetta**, sorgente `terrain-dem`. Nessun token.
- Trappole note col bundle: PapaParse **senza** `worker: true`; Litepicker come `{ Litepicker }`; MapLibre 6 come `import * as maplibregl`, worker `?worker&url` con `worker: { format: 'es' }`; URL di glyphs/sprite **assoluti**; dati GeoJSON con `getGeoJsonSourceData()`, mai `source._data.features`; per agire sulla mappa **mai `map.isStyleLoaded()` né `map.once('idle')`** (col brulichio non arrivano mai): si usa `isMapReady()` / `whenMapReady(fn)`; le persone si leggono con `getPresenceDots()` e dopo averle cambiate `redrawPresenceDots()`; `hash01` non è indipendente fra suffissi (usare il numero **prima** del suffisso); `import.meta.env` rende un file non importabile in Node: i dati puri vanno in file a parte (es. `src/data/sound-colors.js`).
- Autore: Graziano Enzo Marchesani (Unicam). Non ha competenze musicali: spiegare le scelte sonore con analogie semplici; le decisioni tecnico-musicali le prende l'agente. Non sa scegliere i volumi a orecchio in percentuale: i mix vanno **calcolati**. Lavora su un **M3 con 8 GB** e uno schermo 5K: niente animazioni che ridisegnano senza bisogno.

### Dati della piattaforma (verificati)
| Dati | Periodo | Zona |
|---|---|---|
| **Presenze POI** (11 quartieri KML, `presenze_0..23` orarie) | **2024-06-01 → 2025-02-01**, 246 giorni, 1 sola ora mancante | Ascoli |
| Affollamento luoghi (87 punti) | nessuna data: settimana tipo 168 h | Comune di Ascoli |
| Spot (1.186 punti) | statici | Comune di Ascoli |
| **LCZ** (`lcz_ascoli.geojson`, **12.496 celle vettoriali da 30 m**) | statici | rettangolo dei quartieri ∩ Comune: tutti gli 11 quartieri al 100% |
| Meteo (`meteo_ascoli.json`) | 5.904 ore, 2024-06-01 → 2025-02-01 | Open-Meteo, punto 42.847 N 13.6 E |
| Mappa (`public/data/mappa/`) | — | base Protomaps/OSM, terreno Mapterhorn (z ≤ 12), **11.356 edifici TUM** (`res` residenti Meta, `pub` interni pubblici OSM), font e icone |
| **Residenti Meta** (HRSL 2020, CC BY 4.0) | 2020 | Comune: **47.076 residenti** |
| **Quota in casa** (`quota_in_casa.json`) | diari ISTAT Uso del tempo 2008-09 | Italia, via IPUMS MTUS; solo la curva aggregata |
| Simulazione locale (`cityrhythm_simulation_week.*`) | solo 3–9 giugno 2024 | Ascoli |

Timeline: con un intervallo **< 7 giorni** mostra i giorni reali; con **≥ 7 giorni** mostra la settimana tipo 168 h **senza date**. La posizione della timeline si legge **sempre** con `getDateTimeFromIndex` / `getWeekIndex` / `getTimelineDate` (`utils.js`).

## 2. Obiettivo in corso — branch `Music`
Aggiungere una **dimensione sonora** attivabile ("mappa sonora") con quattro modi di musica (IA, classica, metronomi, **Sottotraccia**, musica a regole). Scopo **divulgativo**: la musica deve trasmettere **emozioni** che le immagini da sole non danno. Il lavoro del branch si presenta alla collega con un deck Slides (`presentazione.md`).

## 3. Regole permanenti
- **Solo il Comune di Ascoli Piceno** (confine OSM, relazione 42176, in `sound-lab/data/comune_ascoli.geojson`). Dati di altri comuni **cancellati**; non aggiungerne mai.
- **Niente "numeri a caso"**: ogni parametro è marcato **[F]** fonte (dalla letteratura in `paper/`, locale), **[S]** scelta nostra o **[H]** ipotesi senza fonte, e la marcatura va anche nel codice e nel file di argomento. Il calore nel suono è [H].
- **I pareri del consulente Opus** (`/advisor`) si verificano nei paper prima di usarli: la "sincope che dà groove" era un'affermazione non supportata.
- **Autosufficienza**: il sito fornisce tutto da sé, nessun token né servizio esterno.
- **Intercambiabilità**: UI e grafici sostituibili; bussola e audio parlano solo tramite lo store.
- **Microdati con licenza mai su GitHub** (`IPUMS/`, `UsoTempo_*/`, `Lcz_neurali 2/` in `.gitignore`); nel sito solo aggregati, con le citazioni (dettagli in `persone.md`).
- **Paper e clip generate fuori da git**: `paper/` (PDF con copyright), `sound-lab/*/clip/` e `sound-lab/metronomi/` (si rigenerano con gli script).

## 4. Dove trovare cosa
| File | Contenuto |
|---|---|
| `bussola-clima.md` | modello emotivo per cella, energia (X), piacevolezza (Y), calore con segno (H), catena UTCI e limiti, 9 stati, notte, settimana tipo, mappe orarie UTCI e **Sound map continua**, alberi |
| `audio.md` | strategia S2, **modi di musica**, motore audio, effetti e mix, IA, classica (Musopen), metronomi, post-produzione, **stato degli asset audio** |
| `sottotraccia.md` | **musica a regole** (quarto modo): ingressi X/Y/H, regole, livelli, pianificatore, stato, limiti, matrice estesa proposta |
| `mappa.md` | MapLibre + PMTiles, stili Toner e Nolli, interni pubblici, edifici TUM, terreno, celle LCZ e mappe dei parametri, pubblicazione su Pages |
| `persone.md` | puntini (identità, formichine, gente in giro, colori), Synthetic Crowded Points, **gente in casa**, **licenze IPUMS/UCL/ISTAT/Meta** |
| `decisioni-superate.md` | tutte le decisioni non più valide, col perché |
| `strumenti.md` | script di `sound-lab/` (analisi, taratura, estrazioni, Sottotraccia, prove nel browser), avvio |
| `prompts.md` | prompt musicali per finetuning.ai |
| `presentazione.md` | presentazione del branch alla collega: deck, scaletta, aspetto, demo |

## 5. Prossimi passi
0. **A mano (utente)**: eliminare **entrambi** i token Mapbox (il token pubblico resta nella cronologia del repository pubblico: va revocato).
1. **Ascolto, prima di tutto**: Sottotraccia nell'app (modo "Sottotraccia") e le clip in `sound-lab/sottotraccia/clip/` (rampe incluse); i metronomi; la classica (Fatica 0–68 s da giudicare); le clip di disagio alla cieca (`sound-lab/disagio/clip/`, chiave in `chiave.json`). Scrivere cosa si sente, con analogie.
2. **Decisioni aperte** (con l'utente): Notte come interruttore sopra la ruota o come stato; il calore nel registro e se entra nella Sound map; Festa e Afa danno lo stesso disagio nei metronomi; la sincope (non decisa); la matrice estesa a 17 punti (`sottotraccia.md`), solo dopo l'ascolto.
3. **Verifiche tecniche**: livello di Sottotraccia nel browser contro −18 LUFS (`OfflineAudioContext`); `PeriodicWave` per le note (3 oscillatori → 1); presentazione: copertina e slide "mappe" mostrano ancora i nove colori, da aggiornare alla sfumatura.
4. **Pubblicazione**: le 10 registrazioni classiche hanno la licenza **da verificare** su musopen.org (Public Domain Mark dichiarato da chi ha caricato). Dopo ogni modifica, `npm run build` e aggiornare Pages.
5. **Presentazione alla collega**: ripartire dalla slide 16 (prompt in sezione 7).
6. **Ancora aperti da prima**: stile Nolli all'avvio; puntini e gente in casa da verificare a schermo (`persone.md`); crediti della mappa troppo lunghi; SOLWEIG per clima più preciso e alberi (facoltativo); suoni urbani dai dati (presenza da X e verde); ECharts 6 (`npm audit`); curva ISTAT (`MONTH`, smart working); domanda aperta sulle presenze "blimp"; bibliografia IPUMS e copia al CTUR quando si pubblica.

## 6. Diario delle sessioni
- **2026-10-04 → 10-05 (1–12)**: strategia S2, bussola a 9 stati su UTCI per cella, MapLibre + PMTiles con edifici TUM, regola **solo Comune di Ascoli**, LCZ a 30 m, motore audio, puntini con identità stabili, Sound map, curva ISTAT in casa, licenze.
- **2026-10-06 (13–19)**: presentazione del branch (deck, `presentazione.md`), stile **Nolli**, interni pubblici, edifici TUM aggiornati a OSM, deck in bianco e nero, video di energia e piacevolezza.
- **2026-10-09 → 10-10 (20)**: modo **metronomi** e **classica** (10 loop Musopen) in app; clip di disagio A/B; lettura dei paper e consulti Opus; **Sottotraccia** (musica a regole, quarto modo) con rampe continue, fonte unica in JS, livello per evento, calore H in `compass-core`; **Sound map a colore continuo**; correzioni (modo che non partiva, NaN fuori cella, voci inudibili, rumore dell'hi-hat); prove nel browser.

## 7. Prompt per la prossima sessione
```
Riprendiamo CityRhythm, branch Music. Leggi second-brain/SECOND_BRAIN.md e
second-brain/sottotraccia.md (musica a regole: prima l'ascolto, poi le decisioni
aperte). Riassumimi in 3 righe dove siamo.

Prima di tutto: l'utente ascolta Sottotraccia nell'app e le clip. Non cambiare
parametri senza il suo ascolto. Ogni numero: [F], [S] o [H].

Presentazione alla collega (deck: https://claude.ai/artifact/8wMEfrXxCtVTpSJe34nZ55,
non crearne un altro): ripartire dalla slide 16 "Chi sta a casa", poi 15, 17, 18.
Una slide alla volta, pubblica solo quella, aspetta il sì. Bianco e nero, testi con
/no-ai-slop, niente numeri senza fonte, Simone non va citato.

A fine sessione: aggiorna il second brain (/second-brain), commit e push su Music.
```
