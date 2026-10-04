# CityRhythm — Second Brain

> Memoria condivisa del progetto. **Ogni agente la legge prima di iniziare.** Si aggiorna a fine sessione col comando `/second-brain` (vedi `.claude/skills/second-brain/SKILL.md`). Sintetico: decisioni e stato, non cronaca.

Ultimo aggiornamento: 2026-10-04

## 1. Progetto in breve
- **CityRhythm**: dashboard geospaziale (Mapbox GL, ECharts, Turf, D3, GPU.js) su affollamento, demografia, POI, LCZ/UHI. 3 dimensioni spaziali + 1 temporale (timeline 168 ore, settimana simulata 3–9 giugno 2024, Ascoli Piceno).
- Codice: JavaScript vanilla, ES modules, librerie da CDN come globali, stato sparso tra `window.*` e `CustomEvent`. Circa 7.000 righe in `main.js` e `src/`.
- Autore: Graziano Enzo Marchesani (Unicam). Non ha competenze musicali: spiegare le scelte sonore con analogie semplici, le decisioni tecnico-musicali le prende l'agente.

## 2. Obiettivo in corso — branch `Music`
Aggiungere una **dimensione sonora** attivabile ("mappa sonora"). Scopo **divulgativo**: la musica deve trasmettere **emozioni** che le immagini da sole non danno. Densità e calore sono già visibili, quindi niente sonificazione "pitch che segue il dato".

## 3. Decisioni valide
| Tema | Decisione |
|---|---|
| Strategia | **S2 – musica adattiva pre-generata**: un brano principale alla volta, dissolvenza lenta verso lo stato d'animo corrente, più un **livello di suoni urbani** sovrapposto (i rumori non hanno tonalità, quindi non stonano). |
| Modello emotivo | **Bussola** (circomplesso di Russell) calcolata su **ciò che l'utente inquadra**. Asse X = **energia** (persone visibili / area inquadrata). Asse Y = **piacevolezza** (verde + ombra − stress termico). |
| 9 stati (Y↓, X→) | Sereno: **Rifugio · Passeggiata · Festa** / Neutro: **Attesa · Routine · Corrente** / Opprimente: **Afa · Fatica · Calca** |
| Notte | Niente stati notturni dedicati: **grilli** + un **brano "Notte"** calmo e melodico. |
| Temperatura | Dati **reali orari Open-Meteo** (archivio storico, settimana simulata) × calore locale (UHI risk, IMPER_PC, albedo, ANTHROPOGE) × esposizione solare (**SunCalc** + SVF e H_W del dataset LCZ). Presentarlo come *indicatore* di stress termico percepito, non come misura. |
| Comportamento | **Isteresi**: si cambia stato solo se il nuovo "tiene" qualche secondo. Dissolvenze di 4–8 s, durata finale da scegliere a orecchio. Con lo zoom molto largo, fuori dalle aree coperte dai dati: brano neutro o silenzio. |
| Suoni urbani | Folla leggera/densa ↔ persone; cicale ↔ calore; uccelli/foglie ↔ verde; grilli ↔ notte; traffico lontano. |
| Generazione musica | **finetuning.ai**, piano Plus (500 crediti/mese, 1 credito a generazione, WAV, diritti commerciali), senza API, a mano. Scheda **Instrumental**; **nessuno stile preset** (Cinematic aggiunge "epic, brass, choir, climax"); **nessun tag** (sono solo testo aggiunto in coda); **Enhance prompt OFF**; Length 2 min; seed fisso. Prompt in **inglese**. |
| Coerenza musicale | Tutti i brani in **re** (maggiore per i sereni, minore per gli opprimenti), estetica ambient-cinematografica (piano ovattato, archi, pad). Ogni prompt termina con la "coda fissa": `Seamless loop, no intro, no ending, no fade-out, steady tempo and constant energy throughout. Warm, clean, modern mix.` |
| Post-produzione | Script automatico: taglio delle sfumature, punto di loop su battuta con dissolvenza incrociata di 2 s, **−18 LUFS**, picco ≤ −1 dBFS, MP3 160k (circa 1,5 MB ciascuno). |
| Framework | **Proposta, non ancora decisa né eseguita**: migrare a **Vite (vanilla)** + **store centrale** di stato (ora, viewport, selezione, layer) a cui si iscrive il motore audio. Svelte eventualmente più avanti, solo per la UI. React sconsigliato. |
| Stem | Al momento non servono. Se servissero: StemDeck o UVR5 (locali, gratuiti), MVSEP (web). |

## 4. Decisioni superate
- ~~Pannello **Advanced** di finetuning.ai (key/BPM/scala fissi)~~ → **scartato**: il risultato suona "a un solo strumento". Si resta su **Instrumental**.
- ~~Seed 2024~~ → il seed 2025 ha prodotto brani migliori. Per i brani da rifare si usano 2026/2027.
- ~~Usare i tag Mood/Energy~~ → sono solo testo aggiunto al prompt, non servono.

## 5. Stato degli asset audio
Grezzi in `music/` (WAV, **non versionati**). Loop finali in `sound-lab/loops/`.

| Stato | File scelto | Tonalità misurata | Note |
|---|---|---|---|
| Rifugio | rifugio 2025 | re magg. | |
| Passeggiata | passeggiata 2025 | re magg. | |
| Festa | festa 2025 | re magg., circa 117 BPM | |
| Attesa | **attesa 2026** | re min., 70 BPM | il 2025 era in sol min., scartato; il 2027 è una riserva |
| Routine | Routine 2025 | re magg., 96 BPM | il 2024 era in la♭, scartato |
| Corrente | corrente 2025 | re magg., circa 117 BPM | il loop più pulito |
| Afa | afa 2025 | re (fra magg. e min.) | |
| Fatica | **fatica 2026** | re min., 81 BPM | il 2025 era in mi♭, scartato; il 2027 è una riserva |
| Calca | Calca 2025 | re min. | il 2024 era in crescendo, riserva |
| Notte | notte 2025 | re magg. | |

Giudizio dell'utente: i brani 2025 trasmettono l'emozione giusta e suonano "parenti". La bussola di prova piace molto.

## 6. Strumenti (`sound-lab/`)
- `analyze.py <cartella>`: per ogni WAV misura durata, LUFS, picco, BPM, tonalità, energia ogni 10 s e sfumature. Serve a bocciare i brani nella tonalità sbagliata.
- `process.py <music/> <sound-lab/loops>`: crea i loop finali e `manifest.json`. La mappa stato → file è nel dizionario `SELECTION`.
- `index.html`: pagina di ascolto con la bussola 3×3 cliccabile, il bottone Notte e il cursore della dissolvenza.
- Avvio:
  ```bash
  cd sound-lab && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
  .venv/bin/python process.py ../music loops
  python3 -m http.server 8765
  ```
  Poi aprire http://localhost:8765. I file vanno caricati uno alla volta: con molte richieste parallele il server di Python si inceppa.

## 7. Prossimi passi
1. Ascolto: verificare le giunture dei loop e scegliere la durata della dissolvenza.
2. Generare i **6 effetti sonori** urbani nella scheda Sound FX di finetuning.ai (serve uno screenshot dell'interfaccia per adattare i prompt).
3. Scaricare le temperature orarie da Open-Meteo e progettare il calcolo energia/piacevolezza sul viewport.
4. Decidere e avviare la migrazione a Vite + store centrale, poi integrare il motore audio nella piattaforma (interruttore "Attiva mappa sonora": è obbligatorio per le regole di autoplay dei browser).

## 8. Diario delle sessioni
- **2026-10-04**: brainstorming della strategia (S1–S4, scelta S2), definizione della bussola a 9 stati, dati di temperatura e ombra, workflow e prompt per finetuning.ai. Generati e analizzati 17 brani; scelti 10 loop; creati gli script di analisi e post-produzione, la pagina di ascolto e questo second brain.
