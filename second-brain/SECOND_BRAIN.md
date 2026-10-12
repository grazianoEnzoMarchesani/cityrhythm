# CityRhythm — Second Brain

> Memoria condivisa del progetto. **Ogni agente legge questo indice prima di iniziare**, poi i file di argomento che servono al lavoro (elenco nella sezione 4). Si aggiorna a fine sessione col comando `/second-brain` (vedi `.claude/skills/second-brain/SKILL.md`). Sintetico: decisioni e stato, non cronaca.

Ultimo aggiornamento: 2026-10-12 (sessione 37: **sole e luna** sulla pallina del cerchio, raggio di partenza 100 m, zoom all'accensione; sessione 36: colori delle mappe dei parametri dalle rampe di FETCH; sessione 35: cerchio d'ascolto; sessioni 34–37 committate e pubblicate su `main`)

## 1. Progetto in breve
- **CityRhythm**: dashboard geospaziale (**MapLibre GL 6.12** + PMTiles, ECharts 5.5, Turf 7, D3, PapaParse, Litepicker) su affollamento, demografia, POI, LCZ/UHI. 3 dimensioni spaziali + 1 temporale (timeline).
- Codice: JavaScript vanilla, ES modules, **Vite 8** (`npm run dev` / `npm run build` → `dist/`). Librerie da `node_modules` con versioni esatte in `package.json`; **nessun CDN**. Dati in `public/data/` (23 MB) e audio in `public/audio/` (loop IA, classica, effetti).
- **Store centrale** `src/state/store.js` (contratto Svelte: `subscribe`/`set`/`update`/`get`): `time`, `viewport`, `audioEnabled`, `musicMode` (parte da `sottotraccia`; poi `ia` · `classica` · `metronomi`), **`mood`** (stato della bussola: `stato` confermato, `proposto`, `X` energia, `Y` piacevolezza, `T` UTCI, `C` comfort, **`H` calore con segno**, persone entro 50 m, cella), **`presence`** (puntini fuori casa: lo scrive solo `map-layers.js`), **`cellMap`** (UTCI, stato, `x`, `y` di tutte le celle: lo scrive solo `cell-map.js`, solo mentre una mappa oraria è visibile). **`celleAccese`** (interruttore «Mostra le celle», lo scrive `ui-layer-controls.js`) e **`ispezioneCelle`** (tasto «Solo celle», lo scrive `ui-map-tools.js`; lo leggono `map-interaction.js` e `map-layers.js`). **`raggioAscolto`** (parte da 100 m), **`puntoAscolto`** (cerchio d'ascolto, li scrive solo `ui-compass.js`) e **`celleVarco`** (celle sotto il cerchio, lo scrive `map-layers.js`, lo legge `cell-map.js`): `cerchio.md`. `mood` lo scrive solo `src/compass/compass.js`; `audioEnabled` e `musicMode` solo `src/ui/ui-compass.js`. Log `[store]` solo in `npm run dev`.
- Grafici: ECharts si importa **solo** in `src/charts/charts.js`. d3 si importa da `'d3'` (dipendenza diretta), non dai sotto-pacchetti.
- Mappa (`src/map/map-setup.js`): stile costruito in codice: base Protomaps da `ascoli_base.pmtiles` in **stile Nolli** (di partenza) o **Toner** (popover in alto a destra), edifici TUM `buildings-3d` e rilievo accesi dal tasto **3D** (spenti all'avvio), **nessuna etichetta**, sorgente `terrain-dem`. Nessun token.
- **Interfaccia** (ripinteggiata 2026-10-10, pubblicata su Pages da `main`): mappa a tutto schermo, Livelli in colonna a sinistra, comandi della mappa in alto a destra (zoom, bussola, stile, 3D, Solo celle, crediti), Mappa sonora come quadrante nella timeline (un tocco accende), scheda area solo con una selezione, tutto in italiano, telefono con timeline di 138 px. Dettagli in `interfaccia.md`.
- Trappole note col bundle: PapaParse **senza** `worker: true`; Litepicker come `{ Litepicker }`; MapLibre 6 come `import * as maplibregl`, worker `?worker&url` con `worker: { format: 'es' }`; URL di glyphs/sprite **assoluti**; dati GeoJSON con `getGeoJsonSourceData()`, mai `source._data.features`; per agire sulla mappa **mai `map.isStyleLoaded()` né `map.once('idle')`** (col brulichio non arrivano mai): si usa `isMapReady()` / `whenMapReady(fn)`; le persone si leggono con `getPresenceDots()` e dopo averle cambiate `redrawPresenceDots()`; `hash01` non è indipendente fra suffissi (usare il numero **prima** del suffisso); `import.meta.env` rende un file non importabile in Node: i dati puri vanno in file a parte (es. `src/data/sound-colors.js`). `localStorage`: non salvare un valore di default all'avvio (resta per sempre nel browser di chi visita): si salva solo la scelta dell'utente. Nei CSS i pulsanti dentro `.maplibregl-ctrl` vanno con prefisso `#map`, perché le regole di MapLibre pesano di più. iOS/Safari: `ctx.resume()` **solo dentro il clic**, come prima chiamata di `start()` (dopo un `await` non parte); `navigator.audioSession.type = 'playback'` prima di creare il contesto (`audio.md`).
- Autore: Graziano Enzo Marchesani (Unicam). Non ha competenze musicali: spiegare le scelte sonore con analogie semplici; le decisioni tecnico-musicali le prende l'agente. Non sa scegliere i volumi a orecchio in percentuale: i mix vanno **calcolati**. Lavora su un **M3 con 8 GB** e uno schermo 5K: niente animazioni che ridisegnano senza bisogno.

### Dati della piattaforma (verificati)
| Dati | Periodo | Zona |
|---|---|---|
| **Presenze POI** (11 quartieri KML, `presenze_0..23` orarie) | **2024-06-01 → 2025-02-01**, 246 giorni, 1 sola ora mancante | Ascoli |
| **Luoghi OSM** (1.469, `luoghi_osm.geojson`) e **profili per tipo di luogo** (`profili_luoghi.json`) | orari OSM al 2026-10-08; diari ISTAT 2008-09 | Comune di Ascoli; **in uso su `main` dal 2026-10-12**, sostituiscono spot e affollamento Outscraper (`dati-legali.md`) |
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
- **Privacy**: il sito non deve chiamare servizi esterni (font, tessere, statistiche). Se serve uno, prima consenso per funzione e prova di rete (`privacy.md`).
- **Pubblicazione**: Pages pubblica solo da `main` (`deploy.yml`). Unire su `main` vuol dire pubblicare: solo col sì dell'utente. I branch si vedono in locale con `npm run dev -- --host 0.0.0.0`.
- **Dati legali (dal 2026-10-12)**: nel repository solo dati con licenza chiara. Spot e affollamento Outscraper sono **stati tolti da tutta la cronologia** (riscrittura con force push, ordinata dall'utente) e sostituiti da luoghi OSM e diari ISTAT (`dati-legali.md`); copie solo in `~/Documents/CityRhythm-archivio-locale/` (anche backup completo della cronologia precedente), in `.gitignore`. Non rimetterli. Blimp (acquisto dell'Università) e LCZ (lavoro dell'autore) dichiarati utilizzabili dall'utente.
- **Mai i paper nel repository**: i PDF (copyright degli editori) stanno fuori dal progetto, in `~/Documents/CityRhythm-paper/`. Non si aggiungono mai al repository né si committano, neanche per sbaglio: prima di ogni commit si controlla che non ci siano PDF. Anche le clip generate (`sound-lab/*/clip/`) e `sound-lab/metronomi/` restano fuori da git: si rigenerano con gli script.
- **Confini di disegno dei quartieri**: solo estetica. Presenze, km², celle, case, Spot, puntini e scheda leggono il KML originale (`getFullKmlGeoJson()`), mai il disegno (`quartieri.md`).

## 4. Dove trovare cosa
| File | Contenuto |
|---|---|
| `bussola-clima.md` | modello emotivo per cella, energia (X), piacevolezza (Y), calore con segno (H), catena UTCI e limiti, 9 stati, notte, settimana tipo, mappe orarie UTCI e **Sound map continua**, alberi |
| `audio.md` | strategia S2, **modi di musica**, motore audio, effetti e mix, IA, classica (Musopen), metronomi, post-produzione, **stato degli asset audio** |
| `sottotraccia.md` | **musica a regole** (quarto modo): ingressi X/Y/H, regole, livelli, pianificatore, stato, limiti, matrice estesa proposta |
| `cerchio.md` | **cerchio d'ascolto** (raggio 50–250 m, spostabile a mano, indipendente dalla telecamera), **varco** con la mappa sonora, `pick_giorni.bin`, ottimizzazioni misurate e come misurare (GPU vera, `sourcedata`), cose da provare |
| `mappa.md` | MapLibre + PMTiles, stili Nolli (di partenza) e Toner, vista 3D a tasto unico, interni pubblici, edifici TUM, terreno, celle LCZ e mappe dei parametri, hover con le celle, pubblicazione su Pages |
| `quartieri.md` | le 11 aree: calcoli sul KML, disegno da sezioni ISTAT 2021, quattro quartieri che coprono il KML, criteri, scartati, come si rigenera |
| `persone.md` | puntini (identità, formichine, gente in giro, colori), Synthetic Crowded Points, **gente in casa** (legenda e grafico «Chi sta a casa», in Dettagli), **licenze IPUMS/UCL/ISTAT/Meta** |
| `interfaccia.md` | layout a tutto schermo, Livelli, Celle della città (Cosa mostrare, legenda cliccabile), comandi della mappa in alto a destra, Mappa sonora, timeline e Periodo, scheda Area (statistiche, Chi frequenta, Tipi di luogo, Dettaglio), crediti, telefono, lingua, browser, accessibilità, nomi vecchi → nuovi, decisioni da prendere |
| `decisioni-superate.md` | tutte le decisioni non più valide, col perché |
| `dati-legali.md` | **regola «solo dati legali»**: da dove vengono i dati (OSM, diari ISTAT/IPUMS, Blimp, Open-Meteo…), perché ci sono e come agiscono, calcolo dell'affluenza, copertura, confronto della bussola, **inventario delle licenze di `public/data/`**, pulizia della cronologia del 2026-10-12, limiti, cose da fare |
| `privacy.md` | **avviso e informativa privacy** (non è un banner del consenso), email offuscata, verifica di rete (nessuna richiesta esterna), cosa rifare se si aggiunge un servizio esterno |
| `strumenti.md` | script di `sound-lab/` (analisi, taratura, estrazioni, Sottotraccia, prove nel browser), avvio |
| `prompts.md` | prompt musicali per finetuning.ai |
| `presentazione.md` | presentazione del branch alla collega: deck, scaletta, aspetto, demo |

## 5. Prossimi passi
0. **A mano (utente)**: eliminare **entrambi** i token Mapbox (il token pubblico è nella cronologia pubblica: va revocato). Bibliografia IPUMS e copia al CTUR (UCL).
1. **Ascolto**: Sottotraccia nell'app e le clip (**soprattutto morbidezza e scala senza tasti neri nei tre stati in alto, tonica Do**, `sottotraccia.md` «Da ascoltare»); metronomi; classica (Fatica 0–68 s); clip di disagio alla cieca (`sound-lab/disagio/clip/`). Scrivere cosa si sente, con analogie.
2. **Licenza classica**: 10 registrazioni pubblicate dal 2026-10-10; verifica per registrazione su musopen.org ancora da fare (`audio.md`).
3. **Interfaccia** (`interfaccia.md`, «Da decidere» 1, 2, 5, 6, 8–11, 13–15). Scheda Area (sessione 27): committata il 2026-10-11, da mostrare all'utente. Rappresentazione delle celle: da discutere con l'utente prima del codice.
4. **Verifiche su iPhone e Safari reali** (finora Chromium e WebKit emulato): mappa sonora (prova in tre passi, `audio.md`); Livelli sul telefono (sessione 26); legenda cliccabile; Solo celle (chiedere se parte acceso); celle senza contorno; Chi sta a casa (`persone.md`); confini di disegno dei quartieri (`quartieri.md`).
5. **Commit del 2026-10-11** su `ui-redesign` (`git log`): tutte le modifiche pendenti delle sessioni 26–31, come chiesto dall'utente. **Non ancora su `main`** (Pages): unire solo col sì dell'utente. Da chiedere: di chi sono `src/map/map-layers.js`, `src/map/map-interaction.js` e il ramo LCZ tolto in `ui-layer-controls.js` (il commit li include).
0a. **Cerchio d'ascolto** (`cerchio.md`, «Da fare»): l'utente provi sul suo Mac il trascinamento a celle accese (300 ms vanno?) e **sul telefono sole/luna, zoom all'accensione (0,25) e raggio 100 m**, poi decidere clima mediato nel cerchio, colore per cella a 50 m, cerchio fuori schermo, telefono (dito, 3D).
0b. **Dati legali** (`dati-legali.md`, «Da fare»): citare Blimp nei crediti (`pick_giorni.bin` ora è nell'inventario); scrivere la licenza delle celle LCZ; testi OFL/MIT; **ascoltare** la mappa sonora con i luoghi OSM; chiedere a GitHub Support la pulizia dei vecchi commit.
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
- **2026-10-11 (32)**: branch **`dati-legali`** da `origin/main` (`27da705`), poi approvato e unito (vedi sotto): 1.469 luoghi OpenStreetMap (ODbL) con orari al posto degli spot, profili orari per tipo di luogo dai diari ISTAT via IPUMS MTUS al posto degli affollamenti Outscraper, regola della notte, taratura nuova (stesso stato nel 71,8% dei casi), CSV di spot e affollamento tolti dal branch, gist e pulsante di debug tolti, crediti con OSM e Open-Meteo. Prova Chromium 30/30. Tutto in `dati-legali.md`.
- **2026-10-12 (32, seguito)**: l'utente ha provato e approvato `dati-legali`: **unito su `main`** (`5f023d4`); sito pubblicato senza i CSV Outscraper (404). **Cronologia riscritta** su tutti i branch e il tag (tolti i 2 CSV e lo zip storico; force push fatto a mano dall'utente); gist con dati Outscraper cancellati; copie e backup in `~/Documents/CityRhythm-archivio-locale/`; gruppo Luoghi resta nascosto; Open-Meteo nei crediti. Tutto in `dati-legali.md`.

- **2026-10-12 (34)**: consiglio di una musicista (più note «pure» quando si sta bene) → **Sottotraccia**: tonica Do, accordi sulla scala, nei tre stati in alto un bemolle in meno alla volta e suono più tondo (morbidezza); tabella dei livelli rigenerata. Nei Dettagli il blocco **«Come suona»** (cosa dicono gli otto paper, cosa è scelta nostra); legenda della Mappa sonora a nove riquadri colorati; quadratini di colore nella guida degli stati. **Nessun commit**: modifiche insieme a quelle pendenti (volume, nomi degli stati, `scala-piano/`).
- **2026-10-12 (35)**: **cerchio d'ascolto** (idea dal Morphocode Explorer): raggio 50–250 m trascinando il bordo, posizione a mano indipendente dalla telecamera, mirino e quadratino tolti; **varco** con la mappa sonora dentro il cerchio (celle spente) o la vista a piena forza dentro e al 25% fuori (celle accese). Lentezza risolta: `pick_giorni.bin`, solo le celle sotto il cerchio, etichetta `dentro` al posto del filtro, 300 ms a celle accese. Quadrante spento con **nota musicale** (`interfaccia.md`). **Non committato** (`cerchio.md`).
- **2026-10-12 (36)**: grafico dell'età: **65+** da rosso a marrone `#795548` (era uguale al 18-24 arancione; `config.js`). Con la **mappa sonora accesa le aree KML non si selezionano** (`map-interaction.js`, come Solo celle). Non committato, non provato nel browser.
- **2026-10-12 (36)**: colori delle mappe di Forma della città, Superficie del suolo e Calore uniformati alle rampe QGIS del repo FETCH (`config.js`, `LCZ_DATA_VIEWS`); UTCI, Mappa sonora, LCZ, UHI intatti. Non committato (`mappa.md`).
- **2026-10-12 (37)**: pallina del cerchio = **sole/luna** che gira con l'ora (mezzogiorno a sud; alba e tramonto SunCalc, media del periodo con ≥ 7 giorni), raggio di partenza **100 m**, zoom all'accensione (raggio = 0,25 del lato corto). Sessioni 34–37 **committate e pubblicate su `main`** su richiesta dell'utente (`cerchio.md`).
- **2026-10-12 (33)**: **privacy**: avviso in basso a sinistra alla prima visita, poi tasto «Privacy» sempre visibile; informativa in un pannello; email offuscata come sul sito personale. Verificato che il sito non fa nessuna richiesta esterna. Pubblicato su `main` (`privacy.md`).

## 7. Prompt per la prossima sessione
```
Riprendiamo CityRhythm. Pages pubblica da `main` (sessioni 34–37 incluse, vedi `git log`). Leggi second-brain/SECOND_BRAIN.md; per i quartieri anche second-brain/quartieri.md.
Sessioni 34–37 committate e pubblicate (36: colori FETCH in `config.js`, da chiedere se gli estremi chiari vanno scuriti). Leggi anche second-brain/cerchio.md e chiedi com'è andata la prova sul telefono (sole/luna, zoom all'accensione, raggio 100 m) e a celle accese sul Mac (300 ms).
Il commit del 2026-10-11 su `ui-redesign` contiene le modifiche delle sessioni 26–31 (punto 5 dell'indice). Chiedi all'utente di chi sono quelle in
`src/map/map-layers.js` e `src/map/map-interaction.js`, e di chi è il ramo LCZ tolto in `ui-layer-controls.js`.
Poi chiedi se gli utenti iPhone hanno risposto alla prova (`audio.md`), e se va bene il disegno dei quartieri (Porta Maggiore −9%).
Riassumimi in 3 righe dove siamo.

Presentazione alla collega (deck: https://claude.ai/artifact/8wMEfrXxCtVTpSJe34nZ55, non crearne un altro): ripartire dalla slide 16
"Chi sta a casa", poi 15, 17, 18. Una slide alla volta, pubblica solo quella, aspetta il sì. Bianco e nero, testi con /no-ai-slop,
niente numeri senza fonte, Simone non va citato.

Dati legali (luoghi OSM e diari ISTAT, già su `main`): leggi second-brain/dati-legali.md («Da fare»); nel repository solo dati con licenza chiara, mai rimettere Outscraper/Google. Chiedi
all'utente se ha ascoltato la mappa sonora con i luoghi OSM e com'è andata.

A fine sessione: aggiorna il second brain (/second-brain). Commit e push solo su richiesta; unire su `main` o `Music` solo col sì dell'utente.
```

