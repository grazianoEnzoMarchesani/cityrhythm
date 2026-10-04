# CityRhythm — Second Brain

> Memoria condivisa del progetto. **Ogni agente la legge prima di iniziare.** Si aggiorna a fine sessione col comando `/second-brain` (vedi `.claude/skills/second-brain/SKILL.md`). Sintetico: decisioni e stato, non cronaca.

Ultimo aggiornamento: 2026-10-04 (terza sessione)

## 1. Progetto in breve
- **CityRhythm**: dashboard geospaziale (Mapbox GL 2.15, ECharts 5.5, Turf 7, D3 + d3-cloud, PapaParse, Litepicker) su affollamento, demografia, POI, LCZ/UHI. 3 dimensioni spaziali + 1 temporale (timeline).
- Codice: JavaScript vanilla, ES modules, **Vite 8** (`npm run dev` / `npm run build` → `dist/`). Librerie da `node_modules` con versioni esatte in `package.json`; **nessun CDN**. Dati in `public/data/` (copie dei vecchi Gist, 2,8 MB). Circa 6.300 righe in `main.js` e `src/`.
- Stato: quasi tutto dentro i moduli con getter (`getCurrentHour()`, `getMapInstance()`, `getPoiData()`…). Globali rimasti: `window.selectedDateRange`, `window._timelineMap`, evento `dateRangeChanged`. L'ora che cambia oggi non emette eventi (punto unico: `updateAppStateForHour` in `src/ui/ui-timeline.js`). ECharts viene creato in **un solo punto** (`src/ui/ui-sidebar.js`, `echarts.init`).
- Trappole note col bundle: PapaParse **senza** `worker: true` (col bundle si blocca); Litepicker si importa come `{ Litepicker }`; KML con `@tmcw/togeojson` (stesse geometrie/nomi/ID del vecchio `@mapbox/togeojson`).
- Autore: Graziano Enzo Marchesani (Unicam). Non ha competenze musicali: spiegare le scelte sonore con analogie semplici, le decisioni tecnico-musicali le prende l'agente. Non sa scegliere i volumi a orecchio in percentuale: i mix vanno **calcolati**.

### Dati della piattaforma (verificati)
| Dati | Periodo | Zona |
|---|---|---|
| **Presenze POI** (11 quartieri KML, `presenze_0..23` orarie) | **2024-06-01 → 2025-02-01**, 246 giorni, 1 sola ora mancante | Ascoli |
| Affollamento luoghi (384 punti) | nessuna data: settimana tipo 168 h | Lucca, Ascoli, costa |
| Spot (4.083 punti) | statici | Lucca, Ascoli, costa |
| LCZ/UHI (5.020 celle) | statici | Ascoli e costa; **ad Ascoli copre solo il Centro Storico (97%)**, Porta Cartara 36%, Campo Parignano 18%, gli altri ≈ 0 |
| Simulazione locale (`cityrhythm_simulation_week.*`) | solo 3–9 giugno 2024 | Ascoli |

Timeline: con un intervallo **< 7 giorni** mostra i giorni reali (`window._timelineMap` ha le date); con **≥ 7 giorni** (anche all'avvio) mostra la settimana tipo 168 h filtrata per giorno della settimana, **senza date**.

## 2. Obiettivo in corso — branch `Music`
Aggiungere una **dimensione sonora** attivabile ("mappa sonora"). Scopo **divulgativo**: la musica deve trasmettere **emozioni** che le immagini da sole non danno. Densità e calore sono già visibili, quindi niente sonificazione "pitch che segue il dato".

## 3. Decisioni valide
| Tema | Decisione |
|---|---|
| Strategia | **S2 – musica adattiva pre-generata**: un brano principale alla volta, dissolvenza verso lo stato d'animo corrente, più un **livello di suoni urbani** sovrapposto. |
| Ambito | **Solo Ascoli**, **tutti i 246 giorni** (2024-06-01 → 2025-02-01), dal caldo al freddo. Niente "settimana tipo" per il meteo. |
| Modello emotivo | **Bussola** (circomplesso di Russell) calcolata su **ciò che l'utente inquadra**. Formula in `sound-lab/compass.py` (coefficienti tutti nel dizionario `P`). |
| Energia (X) | Persone/km² nell'ora (presenze POI ÷ area KML), scala log, ancorata al 10° e 90° percentile **delle sole ore di luce** (≈ 1.730 e 9.890 persone/km²). |
| Piacevolezza (Y) | `0.75 × comfort termico + 0.25 × verde − 0.3 se piove`. Temperatura locale = percepita Open-Meteo + sole diretto (radiazione × SVF) − fresco del verde (di giorno) + isola di calore (UHI risk, più forte di notte). Comfort +1 fra **16 e 26 °C**, −1 a 36 °C o a **−4 °C** (il freddo pesa meno: ci si copre). È un *indicatore*, non una misura. |
| Soglie | ±1/3 su entrambi gli assi → 9 stati. |
| 9 stati (Y↓, X→) | Sereno: **Rifugio · Passeggiata · Festa** / Neutro: **Attesa · Routine · Corrente** / Opprimente: **Afa · Fatica · Calca** |
| Notte | Brano **Notte** + grilli solo se il sole è sotto −6° **e** c'è poca gente (X < −1/3). Le sere affollate restano Festa/Corrente/Calca. |
| Esito della formula | Estate → Afa/Fatica/Calca; settembre–ottobre → Rifugio/Passeggiata/Festa; inverno → Attesa/Routine/Corrente. Tutti i 10 stati compaiono; notte ≈ 1/3 delle ore. **Per ora non servono brani invernali.** |
| Meteo | Open-Meteo archivio, Ascoli (42.854, 13.575), orario, fuso Europe/Rome, 5.904 ore: temperatura, percepita, umidità, radiazione, nuvole, vento, pioggia. |
| Campi LCZ usati | Solo **UHI risk**, **PER_PC** (verde), **SVF**. Scartati perché sporchi: albedo (`SURFACE_AL`, scale miste), `H_W` (fino a 993), sentinella −1 in `PER_PC`. Quartieri senza celle → valori medi di ripiego. |
| Comportamento | **Isteresi**: si cambia stato solo se il nuovo "tiene" qualche secondo. **Dissolvenza musica 3 s** (scelta all'ascolto). Fuori dalle aree coperte: brano neutro o silenzio. |
| Suoni urbani | Folla leggera/densa ↔ persone; traffico ↔ città; parco ↔ verde; cicale ↔ calore; grilli ↔ notte. |
| Riproduzione effetti | Niente loop cucito: ogni suono **alterna a caso le varianti** (mai la stessa due volte di fila), dissolvenza incrociata equal-power fino a 1,2 s, velocità casuale ±4%. |
| Mix effetti | **Calcolato** (`sound-lab/mix.json`): volume = musica (−18 LUFS) − `sotto_musica_db` + 20·log10(presenza). Tetti sotto la musica: folla densa 9 dB, grilli 11, folla leggera 12, parco 13, cicale 14, traffico 15. Somma degli effetti per scena 8–14 dB sotto la musica (Attesa ≈ 20). La presenza (0–1) per ora viene dalle scene per stato; nella piattaforma verrà dai dati. Se il mix non convince: cursori di volume nell'app. |
| Generazione musica | **finetuning.ai**, piano Plus, a mano. Scheda **Instrumental**; nessuno stile preset; nessun tag; **Enhance prompt OFF**; Length 2 min; seed fisso. Prompt in **inglese**. |
| Coerenza musicale | Tutti i brani in **re** (maggiore sereni, minore opprimenti), ambient-cinematografico. Ogni prompt termina con la "coda fissa" (vedi `prompts.md`). |
| Post-produzione musica | Taglio sfumature, loop su battuta con dissolvenza incrociata di 2 s, **−18 LUFS**, picco ≤ −1 dBFS, MP3 160k. |
| Post-produzione effetti | Taglio della sfumatura finale (tratto entro 3 dB dalla mediana), micro-fade 50 ms, **−20 LUFS**, limitatore sui picchi isolati, MP3 160k. |
| Settimana tipo e audio | Opzione **(a)**: con ≥ 7 giorni (nessuna data vera) la musica segue **solo l'energia**, piacevolezza fissa a Neutro (Attesa/Routine/Corrente), con avviso "scegli dei giorni per sentire il clima". |
| Autosufficienza | **Il sito fornisce tutto da sé**: niente librerie né dati da siti esterni (richiesta esplicita dell'utente). Unica eccezione inevitabile: le tessere della mappa da Mapbox. |
| Framework | **Vite (vanilla)**, fatto. Svelte/React/Vue aggiungibili con un plugin in `vite.config.js` (`base: './'`). |
| Intercambiabilità | Tutto deve poter essere sostituito (UI in Svelte/React/Vue, libreria dei grafici). Quindi: **store centrale** con contratto `subscribe` compatibile con gli store Svelte (React via `useSyncExternalStore`, Vue con poche righe); **modulo "grafici"** che isola ECharts; il motore audio legge solo dallo store. |
| Pubblicazione | **GitHub Pages** con `.github/workflows/deploy.yml` (build a ogni push su `main`). Serve Settings → Pages → Source: **GitHub Actions**. Se non c'è dominio proprio, aggiungere `https://<utente>.github.io` alle URL del token pubblico. |
| Token Mapbox | Pubblico (limitato a cityrhythm.it/altervista) nel codice. Quello di **sviluppo** (senza restrizioni) **solo** in `.env.local` (ignorato da git, modello in `.env.example`) e usato solo in `npm run dev`: la build non lo contiene (verificato). **Non deve mai andare online**: se capita, avvisare subito l'utente per eliminarlo su Mapbox. |
| Stem | Al momento non servono. Se servissero: StemDeck o UVR5 (locali), MVSEP (web). |

## 4. Decisioni superate
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

## 5. Stato degli asset audio
Grezzi in `music/` e `music/sfx/` (**non versionati**). Pronti in `sound-lab/loops/` e `sound-lab/sfx/`.

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

Giudizio dell'utente: i brani 2025 suonano "parenti"; la bussola di prova piace; gli effetti vanno bene. **Mix calcolato: "per ora suona bene"**, da rivalutare sopra la mappa.

## 6. Strumenti (`sound-lab/`)
- `analyze.py <cartella>`: analisi dei brani (LUFS, BPM, tonalità, sfumature).
- `process.py <music/> loops`: loop musicali + `loops/manifest.json` (mappa in `SELECTION`).
- `analyze_sfx.py <cartella>`: analisi effetti (durata, LUFS, picco, stabilità, sfumature, nota dominante, distanza timbrica fra varianti).
- `process_sfx.py <music/sfx> sfx`: effetti pronti + `sfx/manifest.json`; raggruppa da solo le varianti dal nome (`Traffico1`, `Traffico2` → `traffico`).
- `mix.json`: regola del mix effetti e scene per stato.
- `compass.py [cartella dati]`: prototipo della bussola su tutte le ore e quartieri. Di default legge `../public/data/` (`cityrhythm_blimp.csv`, `lcz_vitality.csv`, `cityrhythm_blimp_areas.kml`). È il **riferimento** per verificare la versione JS. Scrive `data/aree_ascoli.json` (km², uhi, svf, verde, copertura LCZ per quartiere) e `data/bussola_prova.csv` (non versionato, 6 MB).
- `data/meteo_ascoli_2024-06-01_2025-02-01.json`: meteo orario.
- `index.html`: bussola 3×3 cliccabile, bottone Notte, dissolvenza (default 3 s), sezione "Suoni urbani" con 6 cursori e casella **"Mix calcolato per stato"**.
- Avvio:
  ```bash
  cd sound-lab && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
  .venv/bin/python process.py ../music loops && .venv/bin/python process_sfx.py ../music/sfx sfx
  python3 -m http.server 8765
  ```
  Poi http://localhost:8765. I file vanno caricati uno alla volta (il server di Python si inceppa con molte richieste parallele).
- **Piattaforma**: `npm install && npm run dev` dalla radice (serve `.env.local` col token di sviluppo, altrimenti Mapbox rifiuta localhost).

## 7. Prossimi passi
1. **Store centrale** `src/state/store.js`: ora della timeline, data vera (se < 7 giorni), area inquadrata, interruttore audio. Collegarlo a `ui-timeline.js`, al calendario in `main.js` e a `map-setup.js` (evento `moveend`). Log in console per la verifica.
2. **Modulo "grafici"** che isola l'unico `echarts.init`.
3. **Bussola in JS** (da `compass.py`): energia/piacevolezza sull'area inquadrata (quartieri visibili pesati per la frazione visibile), SunCalc (già installato), meteo da `public/`, isteresi. Verificarla contro `compass.py` su ore campione.
4. **Motore audio** con interruttore "Attiva mappa sonora": loop e effetti copiati in `public/audio/`, dissolvenza 3 s, mix da `mix.json`. Poi ascolto sopra la mappa.
5. Colmare il buco LCZ nei quartieri scoperti (dataset più esteso o verde da OpenStreetMap).
6. Più avanti: ECharts 5.5 ha un avviso di sicurezza moderato (`npm audit`); valutare ECharts 6.

## 8. Diario delle sessioni
- **2026-10-04 (1)**: strategia S2, bussola a 9 stati, workflow finetuning.ai; 17 brani generati, 10 loop scelti; script di analisi/post-produzione, pagina di ascolto, second brain.
- **2026-10-04 (2)**: 6 effetti urbani (11 varianti) analizzati, puliti e in pagina con alternanza casuale e mix calcolato; dissolvenza 3 s. Scoperto che i dati coprono 246 giorni (non una settimana) e che LCZ copre solo il centro; scaricato il meteo e scritto il prototipo `compass.py` (stagioni → righe della bussola).
- **2026-10-04 (3)**: mix approvato "per ora". Migrazione a **Vite** con librerie e dati locali (nessun CDN), pubblicazione via GitHub Actions su Pages, token Mapbox di sviluppo solo in `.env.local`. Corretti PapaParse (worker) e Litepicker (import); verificato dall'utente che la piattaforma funziona. Scelta (a) per la settimana tipo.

## 9. Prompt per la prossima sessione
```
Riprendiamo la mappa sonora di CityRhythm, branch Music.
Leggi second-brain/SECOND_BRAIN.md e riassumimi in 3 righe dove siamo.

Obiettivo: punti 1 e 2 dei "Prossimi passi".
1. Crea lo store centrale src/state/store.js (ora, data vera, area inquadrata,
   interruttore audio), compatibile con gli store Svelte, e collegalo a timeline,
   calendario e mappa. Aggiungi un log in console così verifico io che i valori
   seguono quando muovo timeline e mappa.
2. Isola ECharts in un modulo "grafici", senza cambiare l'aspetto dei grafici.

Prima di toccare ogni file della piattaforma dimmi cosa cambi. Un passo alla volta:
dopo ognuno mi dici cosa provare con npm run dev e aspetti il mio ok.
Il token di sviluppo resta solo in .env.local: se lo vedi finire altrove, avvisami.
```
