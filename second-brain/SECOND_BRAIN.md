# CityRhythm — Second Brain

> Memoria condivisa del progetto. **Ogni agente legge questo indice prima di iniziare**, poi i file di argomento che servono al lavoro (elenco nella sezione 4). Si aggiorna a fine sessione col comando `/second-brain` (vedi `.claude/skills/second-brain/SKILL.md`). Sintetico: decisioni e stato, non cronaca.

Ultimo aggiornamento: 2026-10-10 (venticinquesima sessione)

## 1. Progetto in breve
- **CityRhythm**: dashboard geospaziale (**MapLibre GL 6.12** + PMTiles, ECharts 5.5, Turf 7, D3 + d3-cloud, PapaParse, Litepicker) su affollamento, demografia, POI, LCZ/UHI. 3 dimensioni spaziali + 1 temporale (timeline).
- Codice: JavaScript vanilla, ES modules, **Vite 8** (`npm run dev` / `npm run build` → `dist/`). Librerie da `node_modules` con versioni esatte in `package.json`; **nessun CDN**. Dati in `public/data/` (23 MB) e audio in `public/audio/` (loop IA, classica, effetti).
- **Store centrale** `src/state/store.js` (contratto Svelte: `subscribe`/`set`/`update`/`get`): `time`, `viewport`, `audioEnabled`, `musicMode` (parte da `sottotraccia`; poi `ia` · `classica` · `metronomi`), **`mood`** (stato della bussola: `stato` confermato, `proposto`, `X` energia, `Y` piacevolezza, `T` UTCI, `C` comfort, **`H` calore con segno**, persone entro 50 m, cella), **`presence`** (puntini fuori casa: lo scrive solo `map-layers.js`), **`cellMap`** (UTCI, stato, `x`, `y` di tutte le celle: lo scrive solo `cell-map.js`, solo mentre una mappa oraria è visibile). `mood` lo scrive solo `src/compass/compass.js`; `audioEnabled` e `musicMode` solo `src/ui/ui-compass.js`. Log `[store]` solo in `npm run dev`.
- Grafici: ECharts si importa **solo** in `src/charts/charts.js`. d3 si importa da `'d3'` (dipendenza diretta), non dai sotto-pacchetti.
- Mappa (`src/map/map-setup.js`): stile costruito in codice: base Protomaps da `ascoli_base.pmtiles` in **stile Nolli** (di partenza) o **Toner** (popover in alto a destra), edifici TUM `buildings-3d` e rilievo accesi dal tasto **3D** (spenti all'avvio), **nessuna etichetta**, sorgente `terrain-dem`. Nessun token.
- **Interfaccia** (ripinteggiata 2026-10-10, pubblicata su Pages da `main`): mappa a tutto schermo, Livelli in colonna a sinistra, comandi della mappa in alto a destra (zoom, bussola, stile, 3D, crediti), Mappa sonora come quadrante nella timeline (un tocco accende), scheda area solo con una selezione, tutto in italiano, telefono con timeline di 138 px. Dettagli in `interfaccia.md`.
- Trappole note col bundle: PapaParse **senza** `worker: true`; Litepicker come `{ Litepicker }`; MapLibre 6 come `import * as maplibregl`, worker `?worker&url` con `worker: { format: 'es' }`; URL di glyphs/sprite **assoluti**; dati GeoJSON con `getGeoJsonSourceData()`, mai `source._data.features`; per agire sulla mappa **mai `map.isStyleLoaded()` né `map.once('idle')`** (col brulichio non arrivano mai): si usa `isMapReady()` / `whenMapReady(fn)`; le persone si leggono con `getPresenceDots()` e dopo averle cambiate `redrawPresenceDots()`; `hash01` non è indipendente fra suffissi (usare il numero **prima** del suffisso); `import.meta.env` rende un file non importabile in Node: i dati puri vanno in file a parte (es. `src/data/sound-colors.js`). `localStorage`: non salvare un valore di default all'avvio (resta per sempre nel browser di chi visita): si salva solo la scelta dell'utente. Nei CSS i pulsanti dentro `.maplibregl-ctrl` vanno con prefisso `#map`, perché le regole di MapLibre pesano di più. iOS/Safari: `ctx.resume()` **solo dentro il clic**, come prima chiamata di `start()` (dopo un `await` non parte); `navigator.audioSession.type = 'playback'` prima di creare il contesto (`audio.md`).
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
Aggiungere una **dimensione sonora** attivabile ("mappa sonora") con quattro modi di musica (IA, classica, metronomi, **Sottotraccia**, musica a regole). Scopo **divulgativo**: la musica deve trasmettere **emozioni** che le immagini da sole non danno. Il lavoro del branch si presenta alla collega con un deck Slides (`presentazione.md`). L'interfaccia è su `ui-redesign` (da `Music`): si unisce a `Music` solo con il sì dell'utente.

## 3. Regole permanenti
- **Solo il Comune di Ascoli Piceno** (confine OSM, relazione 42176, in `sound-lab/data/comune_ascoli.geojson`). Dati di altri comuni **cancellati**; non aggiungerne mai.
- **Niente "numeri a caso"**: ogni parametro è marcato **[F]** fonte (dalla letteratura, PDF fuori dal progetto), **[S]** scelta nostra o **[H]** ipotesi senza fonte, e la marcatura va anche nel codice e nel file di argomento. Il calore nel suono è [H].
- **I pareri del consulente Opus** (`/advisor`) si verificano nei paper prima di usarli: la "sincope che dà groove" era un'affermazione non supportata.
- **Autosufficienza**: il sito fornisce tutto da sé, nessun token né servizio esterno.
- **Intercambiabilità**: UI e grafici sostituibili; bussola e audio parlano solo tramite lo store.
- **Microdati con licenza mai su GitHub** (`IPUMS/`, `UsoTempo_*/`, `Lcz_neurali 2/` in `.gitignore`); nel sito solo aggregati, con le citazioni (dettagli in `persone.md`).
- **Interfaccia**: una lingua (italiano); Aree KML e affollamento solo in `DEBUG_MODE`; nessun framework; obiettivo Chrome 110+, Safari 16.4+, Firefox 115+ (`interfaccia.md`).
- **Pubblicazione**: Pages pubblica solo da `main` (`deploy.yml`). Unire su `main` vuol dire pubblicare: solo col sì dell'utente. I branch si vedono in locale con `npm run dev -- --host 0.0.0.0`.
- **Mai i paper nel repository**: i PDF (copyright degli editori) stanno fuori dal progetto, in `~/Documents/CityRhythm-paper/`. Non si aggiungono mai al repository né si committano, neanche per sbaglio: prima di ogni commit si controlla che non ci siano PDF. Anche le clip generate (`sound-lab/*/clip/`) e `sound-lab/metronomi/` restano fuori da git: si rigenerano con gli script.

## 4. Dove trovare cosa
| File | Contenuto |
|---|---|
| `bussola-clima.md` | modello emotivo per cella, energia (X), piacevolezza (Y), calore con segno (H), catena UTCI e limiti, 9 stati, notte, settimana tipo, mappe orarie UTCI e **Sound map continua**, alberi |
| `audio.md` | strategia S2, **modi di musica**, motore audio, effetti e mix, IA, classica (Musopen), metronomi, post-produzione, **stato degli asset audio** |
| `sottotraccia.md` | **musica a regole** (quarto modo): ingressi X/Y/H, regole, livelli, pianificatore, stato, limiti, matrice estesa proposta |
| `mappa.md` | MapLibre + PMTiles, stili Nolli (di partenza) e Toner, vista 3D a tasto unico, interni pubblici, edifici TUM, terreno, celle LCZ e mappe dei parametri, pubblicazione su Pages |
| `persone.md` | puntini (identità, formichine, gente in giro, colori), Synthetic Crowded Points, **gente in casa**, **licenze IPUMS/UCL/ISTAT/Meta** |
| `interfaccia.md` | layout a tutto schermo, Livelli, Celle della città (Cosa mostrare, legenda cliccabile), comandi della mappa in alto a destra, Mappa sonora, timeline e Periodo, scheda area, crediti, telefono, lingua, browser, accessibilità, nomi vecchi → nuovi, decisioni da prendere |
| `decisioni-superate.md` | tutte le decisioni non più valide, col perché |
| `strumenti.md` | script di `sound-lab/` (analisi, taratura, estrazioni, Sottotraccia, prove nel browser), avvio |
| `prompts.md` | prompt musicali per finetuning.ai |
| `presentazione.md` | presentazione del branch alla collega: deck, scaletta, aspetto, demo |

## 5. Prossimi passi
0. **A mano (utente)**: eliminare **entrambi** i token Mapbox (il token pubblico resta nella cronologia del repository pubblico: va revocato). Bibliografia IPUMS e copia al CTUR (UCL) per il lavoro pubblicato.
1. **Ascolto, prima di tutto**: Sottotraccia (ora il modo di partenza) nell'app e le clip; i metronomi; la classica (Fatica 0–68 s); le clip di disagio alla cieca (`sound-lab/disagio/clip/`). Scrivere cosa si sente, con analogie.
2. **Licenza classica**: le 10 registrazioni sono pubblicate dal 2026-10-10 con la verifica per registrazione su musopen.org ancora da fare (`audio.md`).
3. **Interfaccia** (`interfaccia.md`, "Da decidere", punti 1 (solo il Periodo) e 2–6, poi 8–11): LCZ sul telefono, nuvola Interessi, numeri con il punto, frasi degli stati, Notte; titolo «Celle della città», slider Intensità e campioni chiari a schermo.
3b. **Sessioni 23–25 su `main`, pubblicate il 2026-10-10 col sì dell'utente.** Verifica su iPhone e Safari reali ancora da fare: finora Chromium e WebKit emulato; la legenda cliccabile solo in Chromium. Mappa sonora su iPhone: mandare agli utenti la prova in tre passi (`audio.md`) e attendere la risposta; poi decidere se la riga `audioSession` resta.
3c. **Rappresentazione delle celle**: è il prossimo argomento chiesto dall'utente, dopo il pannello. Da discutere con lui prima di toccare il codice.
4. **Music**: il branch è indietro rispetto a `main`. Decidere se unirlo, solo col sì dell'utente.
5. **Decisioni aperte** (con l'utente): Notte come interruttore o stato; calore nel registro e nella Sound map; Festa e Afa nei metronomi; sincope; matrice estesa a 17 punti (`sottotraccia.md`).
6. **Verifiche tecniche**: livello di Sottotraccia nel browser contro −18 LUFS; `PeriodicWave`; presentazione: copertina e slide mappe ai nove colori.
7. **Presentazione alla collega**: ripartire dalla slide 16 (prompt in sezione 7).
8. **Ancora aperti da prima**: puntini e gente in casa da verificare a schermo (`persone.md`); SOLWEIG e alberi (facoltativo); suoni urbani dai dati; ECharts 6 (`npm audit`); curva ISTAT; domanda aperta sulle presenze "blimp".

## 6. Diario delle sessioni
- **2026-10-04 → 10-06 (1–19)**: strategia S2, bussola a 9 stati su UTCI per cella, MapLibre + PMTiles con edifici TUM, regola **solo Comune di Ascoli**, LCZ a 30 m, motore audio, puntini, Sound map, curva ISTAT in casa, licenze; presentazione del branch (`presentazione.md`), stile **Nolli**, interni pubblici.
- **2026-10-09 → 10-10 (20)**: modo **metronomi** e **classica** (10 loop Musopen) in app; clip di disagio A/B; lettura dei paper e consulti Opus; **Sottotraccia** (musica a regole, quarto modo) con rampe continue, fonte unica in JS, livello per evento, calore H in `compass-core`; **Sound map a colore continuo**; correzioni (modo che non partiva, NaN fuori cella, voci inudibili, rumore dell'hi-hat); prove nel browser.
- **2026-10-10 (21)**: interfaccia ripinteggiata su `ui-redesign` (mappa a tutto schermo, Livelli e Mappa sonora in colonna, timeline e Periodo, scheda solo con selezione, tutto in italiano, telefono in fascia); correzioni dalla revisione Opus; prove Playwright Chromium e WebKit. Commit `7243afc`, push su `origin/ui-redesign`.
- **2026-10-10 (22)**: quadrante della Mappa sonora con lancetta (un tocco accende), pannello con modi e dettagli; telefono ridisegnato (timeline di 138 px, Livelli dall'alto, orizzontale = telefono); mirino bianco; direzione tolta; **Sottotraccia** come modo di partenza. `ui-redesign` unito in `main` e pubblicato su Pages.
- **2026-10-10 (23)**: comandi della mappa in alto a destra (zoom, bussola che si inclina, stile in popover, un tasto **3D** che inclina a 55° e accende rilievo ed edifici); **Nolli** di partenza con chiave `cityrhythm.mapStyle.v2`; edifici grigi in Toner; correzioni dalla revisione Opus. Non committato su `ui-redesign`.
- **2026-10-10 (24)**: pannello «Celle della città»: griglia **Cosa mostrare** con sigla e campione di colore, legenda in colonna allineata, scale a fasce, clic che evidenzia una voce sulla mappa; tolte «Affidabilità» e z0 dalla vista; grafica senza riquadri. Pubblicato su `main` nella sessione 25. Parere Opus usato in parte, verificato nel codice.
- **2026-10-10 (25)**: mappa sonora su iPhone: `resume()` nel clic e sessione `playback` (scelta dell'utente); parere Opus due volte (probabilmente Safari, non WhatsApp; silenzioso come causa più probabile). Prove Playwright Chromium e WebKit, non iPhone. Commit e push su `main`: Pages.

## 7. Prompt per la prossima sessione
```
Riprendiamo CityRhythm. Il sito è pubblicato su Pages da `main` (unito da `ui-redesign`
il 2026-10-10). Leggi second-brain/SECOND_BRAIN.md e second-brain/interfaccia.md.
Il lavoro delle sessioni 23–25 (comandi della mappa, tasto 3D, Nolli, Celle della città, audio su iPhone) è su `main` e pubblicato. Prima chiedi se gli utenti iPhone hanno risposto alla prova (`audio.md`). Poi la rappresentazione delle celle.
Riassumimi in 3 righe dove siamo.

Presentazione alla collega (deck: https://claude.ai/artifact/8wMEfrXxCtVTpSJe34nZ55,
non crearne un altro): ripartire dalla slide 16 "Chi sta a casa", poi 15, 17, 18.
Una slide alla volta, pubblica solo quella, aspetta il sì. Bianco e nero, testi con
/no-ai-slop, niente numeri senza fonte, Simone non va citato.

A fine sessione: aggiorna il second brain (/second-brain). Commit e push solo su richiesta;
unire su `main` o `Music` solo col sì dell'utente.
```
