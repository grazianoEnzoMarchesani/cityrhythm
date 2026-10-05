# CityRhythm — Musica ed effetti

> Parte del second brain di CityRhythm: **indice in `SECOND_BRAIN.md`**, da leggere per primo. Questo file si legge quando il lavoro tocca questo argomento e si aggiorna col comando `/second-brain`.

Strategia sonora, motore audio, mix, generazione e post-produzione, stato degli asset.

## Decisioni valide
| Tema | Decisione |
|---|---|
| Strategia | **S2 – musica adattiva pre-generata**: un brano principale alla volta, dissolvenza verso lo stato d'animo corrente, più un **livello di suoni urbani** sovrapposto. |
| Ambito audio | **Solo Ascoli**, **tutti i 246 giorni** (2024-06-01 → 2025-02-01), dal caldo al freddo. Niente "settimana tipo" per il meteo. |
| Comportamento | **Isteresi 1 s** (`tenuta_s`) e **dissolvenza 1 s** a potenza costante (seno/coseno, ripresa dal volume attuale), legata a `PRESENCE_MOVE_MS`: musica, timeline e puntini si muovono insieme (col Play un'ora dura 1,3 s). Effetti urbani: rampa di 1 s. Centro della mappa fuori dalle celle LCZ: **silenzio**. |
| Motore audio | `src/audio/audio-engine.js`, legge solo `audioEnabled` e `mood`. Interruttore **"Attiva mappa sonora"** nel riquadro in basso a sinistra (mirino, contorno e valori visibili solo ad audio acceso). Parte il brano dello stato attuale, gli altri si caricano in sottofondo; spegnendo, sfuma in 1 s. Asset in **`public/audio/`** (loops, sfx, `mix.json`); in `sound-lab/` restano **collegamenti simbolici** per la pagina di ascolto e gli script. |
| Suoni urbani | Folla leggera/densa ↔ persone; traffico ↔ città; parco ↔ verde; cicale ↔ calore; grilli ↔ notte. |
| Riproduzione effetti | Niente loop cucito: ogni suono **alterna a caso le varianti** (mai la stessa due volte di fila), dissolvenza incrociata equal-power fino a 1,2 s, velocità casuale ±4%. |
| Mix effetti | **Calcolato** (`sound-lab/mix.json`): volume = musica (−18 LUFS) − `sotto_musica_db` + 20·log10(presenza). Tetti sotto la musica: folla densa 9 dB, grilli 11, folla leggera 12, parco 13, cicale 14, traffico 15. Somma degli effetti per scena 8–14 dB sotto la musica (Attesa ≈ 20). La presenza (0–1) per ora viene dalle scene per stato (anche nella piattaforma); in futuro dai dati. Se il mix non convince: cursori di volume nell'app. |
| Generazione musica | **finetuning.ai**, piano Plus, a mano. Scheda **Instrumental**; nessuno stile preset; nessun tag; **Enhance prompt OFF**; Length 2 min; seed fisso. Prompt in **inglese**. |
| Coerenza musicale | Tutti i brani in **re** (maggiore sereni, minore opprimenti), ambient-cinematografico. Ogni prompt termina con la "coda fissa" (vedi `prompts.md`). |
| Post-produzione musica | Taglio sfumature, loop su battuta con dissolvenza incrociata di 2 s, **−18 LUFS**, picco ≤ −1 dBFS, MP3 160k. |
| Post-produzione effetti | Taglio della sfumatura finale (tratto entro 3 dB dalla mediana), micro-fade 50 ms, **−20 LUFS**, limitatore sui picchi isolati, MP3 160k. |
| Stem | Al momento non servono. Se servissero: StemDeck o UVR5 (locali), MVSEP (web). |

## Stato degli asset audio
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
