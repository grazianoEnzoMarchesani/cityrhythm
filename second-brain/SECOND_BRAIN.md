# CityRhythm — Second Brain

> Memoria condivisa del progetto. **Ogni agente legge questo indice prima di iniziare**, poi i file di argomento che servono al lavoro (elenco nella sezione 4). Si aggiorna a fine sessione col comando `/second-brain` (vedi `.claude/skills/second-brain/SKILL.md`). Sintetico: decisioni e stato, non cronaca.

Ultimo aggiornamento: 2026-10-11 (trentunesima sessione: Luoghi fuori dalla vista, commit)

## 1. Progetto in breve
- **CityRhythm**: dashboard geospaziale (**MapLibre GL 6.12** + PMTiles, ECharts 5.5, Turf 7, D3, PapaParse, Litepicker) su affollamento, demografia, POI, LCZ/UHI. 3 dimensioni spaziali + 1 temporale (timeline).
- Codice: JavaScript vanilla, ES modules, **Vite 8** (`npm run dev` / `npm run build` → `dist/`). Librerie da `node_modules` con versioni esatte in `package.json`; **nessun CDN**. Dati in `public/data/` (23 MB) e audio in `public/audio/` (loop IA, classica, effetti).
- **Store centrale** `src/state/store.js` (contratto Svelte: `subscribe`/`set`/`update`/`get`): `time`, `viewport`, `audioEnabled`, `musicMode` (parte da `sottotraccia`; poi `ia` · `classica` · `metronomi`), **`mood`** (stato della bussola: `stato` confermato, `proposto`, `X` energia, `Y` piacevolezza, `T` UTCI, `C` comfort, **`H` calore con segno**, persone entro 50 m, cella), **`presence`** (puntini fuori casa: lo scrive solo `map-layers.js`), **`cellMap`** (UTCI, stato, `x`, `y` di tutte le celle: lo scrive solo `cell-map.js`, solo mentre una mappa oraria è visibile). **`celleAccese`** (interruttore «Mostra le celle», lo scrive `ui-layer-controls.js`) e **`ispezioneCelle`** (tasto «Solo celle», lo scrive `ui-map-tools.js`; lo leggono `map-interaction.js` e `map-layers.js`). `mood` lo scrive solo `src/compass/compass.js`; `audioEnabled` e `musicMode` solo `src/ui/ui-compass.js`. Log `[store]` solo in `npm run dev`.
- Grafici: ECharts si importa **solo** in `src/charts/charts.js`. d3 si importa da `'d3'` (dipendenza diretta), non dai sotto-pacchetti.
- Mappa (`src/map/map-setup.js`): stile costruito in codice: base Protomaps da `ascoli_base.pmtiles` in **stile Nolli** (di partenza) o **Toner** (popover in alto a destra), edifici TUM `buildings-3d` e rilievo accesi dal tasto **3D** (spenti all'avvio), **nessuna etichetta**, sorgente `terrain-dem`. Nessun token.
- **Interfaccia** (ripinteggiata 2026-10-10, pubblicata su Pages da `main`): mappa a tutto schermo, Livelli in colonna a sinistra, comandi della mappa in alto a destra (zoom, bussola, stile, 3D, Solo celle, crediti), Mappa sonora come quadrante nella timeline (un tocco accende), scheda area solo con una selezione, tutto in italiano, telefono con timeline di 138 px. Dettagli in `interfaccia.md`.
- Trappole note col bundle: PapaParse **senza** `worker: true`; Litepicker come `{ Litepicker }`; MapLibre 6 come `import * as maplibregl`, worker `?worker&url` con `worker: { format: 'es' }`; URL di glyphs/sprite **assoluti**; dati GeoJSON con `getGeoJsonSourceData()`, mai `source._data.features`; per agire sulla mappa **mai `map.isStyleLoaded()` né `map.once('idle')`** (col brulichio non arrivano mai): si usa `isMapReady()` / `whenMapReady(fn)`; le persone si leggono con `getPresenceDots()` e dopo averle cambiate `redrawPresenceDots()`; `hash01` non è indipendente fra suffissi (usare il numero **prima** del suffisso); `import.meta.env` rende un file non importabile in Node: i dati puri vanno in file a parte (es. `src/data/sound-colors.js`). `localStorage`: non salvare un valore di default all'avvio (resta per sempre nel browser di chi visita): si salva solo la scelta dell'utente. Nei CSS i pulsanti dentro `.maplibregl-ctrl` vanno con prefisso `#map`, perché le regole di MapLibre pesano di più. iOS/Safari: `ctx.resume()` **solo dentro il clic**, come prima chiamata di `start()` (dopo un `await` non parte); `navigator.audioSession.type = 'playback'` prima di creare il contesto (`audio.md`).
- Autore: Graziano Enzo Marchesani (Unicam). Non ha competenze musicali: spiegare le scelte sonore con analogie semplici; le decisioni tecnico-musicali le prende l'agente. Non sa scegliere i volumi a orecchio in percentuale: i mix vanno **calcolati**. Lavora su un **M3 con 8 GB** e uno schermo 5K: niente animazioni che ridisegnano senza bisogno.

### Dati della piattaforma (verificati)
| Dati | Periodo | Zona |
|---|---|---|
| **Presenze POI** (11 quartieri KML, `presenze_0..23` orarie) | **2024-06-01 → 2025-02-01**, 246 giorni, 1 sola ora mancante | Ascoli |
| Affollamento luoghi (87 punti) | nessuna data: settimana tipo 168 h | Comune di Ascoli; **Outscraper**, non visibile (regole) |
| Spot (1.186 punti) | statici | Comune di Ascoli; **Outscraper**, non visibile (regole) |
| **LCZ** (`lcz_ascoli.geojson`, **12.496 celle vettoriali da 30 m**) | statici | rettangolo dei quartieri ∩ Comune: tutti gli 11 quartieri al 100% |
| Meteo (`meteo_ascoli.json`) | 5.904 ore, 2024-06-01 → 2025-02-01 | Open-Meteo, punto 42.847 N 13.6 E |
| Mappa (`public/data/mappa/`) | — | base Protomaps/OSM, terreno Mapterhorn (z ≤ 12), **11.356 edifici TUM** (`res` residenti Meta, `pub` interni pubblici OSM), font e icone |
| **Residenti Meta** (HRSL 2020, CC BY 4.0) | 2020 | Comune: **47.076 residenti** |
| **Quota in casa** (`quota_in_casa.json`) | diari ISTAT Uso del tempo 2008-09 | Italia, via IPUMS MTUS; solo la curva aggregata |
| Confini di disegno dei quartieri (`quartieri_disegno.geojson`) | 2021 | sezioni ISTAT, CC BY 4.0; solo estetica (`quartieri.md`) |
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
- **Interfaccia**: una lingua (italiano), numeri all'italiana, niente riquadri né fili intorno a grafici e sezioni; le spiegazioni secondarie in un blocco «Dettagli» chiuso all'avvio (richiesta dell'utente); Aree KML e affollamento solo in `DEBUG_MODE`; nessun framework; obiettivo Chrome 110+, Safari 16.4+, Firefox 115+ (`interfaccia.md`).
- **Pubblicazione**: Pages pubblica solo da `main` (`deploy.yml`). Unire su `main` vuol dire pubblicare: solo col sì dell'utente. I branch si vedono in locale con `npm run dev -- --host 0.0.0.0`.
- **Spot e affollamento (Outscraper, estratti dall'utente)**: non più visibili dal 2026-10-11, ma i dati restano nel repository e nel sito per decisione dell'utente («per ora»). **Non cancellare, non riscrivere la cronologia, non proporre la sostituzione con OSM** senza un motivo nuovo: l'utente l'ha rifiutata. Licenza non chiarita (`persone.md`).
- **Mai i paper nel repository**: i PDF (copyright degli editori) stanno fuori dal progetto, in `~/Documents/CityRhythm-paper/`. Non si aggiungono mai al repository né si committano, neanche per sbaglio: prima di ogni commit si controlla che non ci siano PDF. Anche le clip generate (`sound-lab/*/clip/`) e `sound-lab/metronomi/` restano fuori da git: si rigenerano con gli script.
- **Confini di disegno dei quartieri**: solo estetica. Presenze, km², celle, case, Spot, puntini e scheda leggono il KML originale (`getFullKmlGeoJson()`), mai il disegno (`quartieri.md`).

## 4. Dove trovare cosa
| File | Contenuto |
|---|---|
| `bussola-clima.md` | modello emotivo per cella, energia (X), piacevolezza (Y), calore con segno (H), catena UTCI e limiti, 9 stati, notte, settimana tipo, mappe orarie UTCI e **Sound map continua**, alberi |
| `audio.md` | strategia S2, **modi di musica**, motore audio, effetti e mix, IA, classica (Musopen), metronomi, post-produzione, **stato degli asset audio** |
| `sottotraccia.md` | **musica a regole** (quarto modo): ingressi X/Y/H, regole, livelli, pianificatore, stato, limiti, matrice estesa proposta |
| `mappa.md` | MapLibre + PMTiles, stili Nolli (di partenza) e Toner, vista 3D a tasto unico, interni pubblici, edifici TUM, terreno, celle LCZ e mappe dei parametri, hover con le celle, pubblicazione su Pages |
| `quartieri.md` | le 11 aree: calcoli sul KML, disegno da sezioni ISTAT 2021, quattro quartieri che coprono il KML, criteri, scartati, come si rigenera |
| `persone.md` | puntini (identità, formichine, gente in giro, colori), Synthetic Crowded Points, **gente in casa** (legenda e grafico «Chi sta a casa», in Dettagli), **licenze IPUMS/UCL/ISTAT/Meta** |
| `interfaccia.md` | layout a tutto schermo, Livelli, Celle della città (Cosa mostrare, legenda cliccabile), comandi della mappa in alto a destra, Mappa sonora, timeline e Periodo, scheda Area (statistiche, Chi frequenta, Tipi di luogo, Dettaglio), crediti, telefono, lingua, browser, accessibilità, nomi vecchi → nuovi, decisioni da prendere |
| `decisioni-superate.md` | tutte le decisioni non più valide, col perché |
| `strumenti.md` | script di `sound-lab/` (analisi, taratura, estrazioni, Sottotraccia, prove nel browser), avvio |
| `prompts.md` | prompt musicali per finetuning.ai |
| `presentazione.md` | presentazione del branch alla collega: deck, scaletta, aspetto, demo |

## 5. Prossimi passi
0. **A mano (utente)**: eliminare **entrambi** i token Mapbox (il token pubblico è nella cronologia pubblica: va revocato). Bibliografia IPUMS e copia al CTUR (UCL).
1. **Ascolto**: Sottotraccia nell'app e le clip; metronomi; classica (Fatica 0–68 s); clip di disagio alla cieca (`sound-lab/disagio/clip/`). Scrivere cosa si sente, con analogie.
2. **Licenza classica**: 10 registrazioni pubblicate dal 2026-10-10; verifica per registrazione su musopen.org ancora da fare (`audio.md`).
3. **Interfaccia** (`interfaccia.md`, «Da decidere» 1, 2, 5, 6, 8–11, 13–15). Scheda Area (sessione 27): committata il 2026-10-11, da mostrare all'utente. Rappresentazione delle celle: da discutere con l'utente prima del codice.
4. **Verifiche su iPhone e Safari reali** (finora Chromium e WebKit emulato): mappa sonora (prova in tre passi, `audio.md`); Livelli sul telefono (sessione 26); legenda cliccabile; Solo celle (chiedere se parte acceso); celle senza contorno; Chi sta a casa (`persone.md`); confini di disegno dei quartieri (`quartieri.md`).
5. **Commit del 2026-10-11** su `ui-redesign` (`git log`): tutte le modifiche pendenti delle sessioni 26–31, come chiesto dall'utente. **Non ancora su `main`** (Pages): unire solo col sì dell'utente. Da chiedere: di chi sono `src/map/map-layers.js`, `src/map/map-interaction.js` e il ramo LCZ tolto in `ui-layer-controls.js` (il commit li include).
0b. **Licenza di spot e affollamento** (Outscraper): tenerli per ora; soluzione alternativa da trovare più avanti (`persone.md`).
6. **Music**: il branch è indietro rispetto a `main`. Decidere se unirlo, solo col sì dell'utente.
7. **Decisioni aperte** (con l'utente): Notte come interruttore o stato; calore nel registro e nella Sound map; Festa e Afa nei metronomi; sincope; matrice estesa a 17 punti (`sottotraccia.md`); «Sulla mappa, adesso: X% in casa» (`persone.md`); Porta Maggiore −9% (`quartieri.md`).
8. **Verifiche tecniche**: livello di Sottotraccia contro −18 LUFS; `PeriodicWave`; presentazione: copertina e slide mappe ai nove colori.
9. **Presentazione alla collega**: ripartire dalla slide 16 (prompt in sezione 7).
10. **Ancora aperti**: puntini e gente in casa a schermo (`persone.md`); SOLWEIG e alberi (facoltativo); suoni urbani dai dati; ECharts 6 (`npm audit`); curva ISTAT; domanda aperta sulle presenze «blimp».

## 6. Diario delle sessioni
- **2026-10-04 → 10-10 (1–20)**: strategia S2, bussola UTCI, MapLibre + PMTiles con edifici TUM, regola **solo Ascoli**, LCZ a 30 m, motore audio, puntini, licenze, stile **Nolli**, metronomi, classica, **Sottotraccia**, Sound map.
- **2026-10-10 (21–28)**: interfaccia pubblicata su `main` (`32b0a93`), audio su iPhone (`3b28e09`); poi Livelli sul telefono, scheda Area, celle senza contorno e **Solo celle**, committati il 2026-10-11 (`interfaccia.md`).
- **2026-10-11 (29)**: **Chi sta a casa** nei Livelli, dentro «Dettagli» (`src/ui/ui-casa.js`). Prova 27/27 in Chromium. Committato il 2026-10-11.
- **2026-10-11 (30)**: **confini dei quartieri** per il disegno, da sezioni ISTAT 2021 (CC BY 4.0), calcoli sul KML originale; quattro quartieri coprono il loro KML; hover con le celle accese solo contorno. Approvato dall'utente in localhost. Committato il 2026-10-11 (`quartieri.md`, `mappa.md`).
- **2026-10-11 (31)**: gruppo **Luoghi** tolto dai Livelli (spot e affollamento non visibili; dati ancora pubblici per decisione dell'utente). I bar «in piazza» sono spot veri. Rettangolo LCZ: convergenza di 0,95°, non raddrizzato. Commit su `ui-redesign`, non su `main`.

## 7. Prompt per la prossima sessione
```
Riprendiamo CityRhythm. Pages pubblica da `main` (commit `32b0a93`). Leggi second-brain/SECOND_BRAIN.md; per i quartieri anche second-brain/quartieri.md.
Il commit del 2026-10-11 su `ui-redesign` contiene le modifiche delle sessioni 26–31 (punto 5 dell'indice). Chiedi all'utente di chi sono quelle in
`src/map/map-layers.js` e `src/map/map-interaction.js`, e di chi è il ramo LCZ tolto in `ui-layer-controls.js`.
Poi chiedi se gli utenti iPhone hanno risposto alla prova (`audio.md`), e se va bene il disegno dei quartieri (Porta Maggiore −9%).
Riassumimi in 3 righe dove siamo.

Presentazione alla collega (deck: https://claude.ai/artifact/8wMEfrXxCtVTpSJe34nZ55, non crearne un altro): ripartire dalla slide 16
"Chi sta a casa", poi 15, 17, 18. Una slide alla volta, pubblica solo quella, aspetta il sì. Bianco e nero, testi con /no-ai-slop,
niente numeri senza fonte, Simone non va citato.

A fine sessione: aggiorna il second brain (/second-brain). Commit e push solo su richiesta; unire su `main` o `Music` solo col sì dell'utente.
```
