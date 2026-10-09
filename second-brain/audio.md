# CityRhythm — Musica ed effetti

> Parte del second brain di CityRhythm: **indice in `SECOND_BRAIN.md`**, da leggere per primo. Questo file si legge quando il lavoro tocca questo argomento e si aggiorna col comando `/second-brain`.

Strategia sonora, motore audio, mix, generazione e post-produzione, stato degli asset. Il modo generato a regole (Sottotraccia) ha il suo file: `sottotraccia.md`.

## Decisioni valide
| Tema | Decisione |
|---|---|
| Strategia | **S2 – musica adattiva pre-generata**: un brano principale alla volta, dissolvenza verso lo stato d'animo corrente, più un **livello di suoni urbani** sovrapposto. |
| Modi di musica | Selettore **"Da dove viene la musica"** in `ui-compass.js`: **Musica IA** (brani finetuning.ai), **Musica classica** (Musopen), **Metronomi** (generati, `src/audio/metronomi.js`), **Sottotraccia** (regole, `sottotraccia.md`). Nei modi generati i suoni urbani restano sopra. |
| Ambito audio | **Solo Ascoli**, **tutti i 246 giorni** (2024-06-01 → 2025-02-01), dal caldo al freddo. Niente "settimana tipo" per il meteo. |
| Comportamento | **Isteresi 1 s** (`tenuta_s`) e **dissolvenza 1 s** a potenza costante (seno/coseno, ripresa dal volume attuale), legata a `PRESENCE_MOVE_MS`: musica, timeline e puntini si muovono insieme. Effetti urbani: rampa di 1 s. Centro della mappa fuori dalle celle LCZ: **silenzio**. |
| Motore audio | `src/audio/audio-engine.js`, legge solo `audioEnabled`, `mood` e `musicMode`. Interruttore **"Attiva mappa sonora"** nel riquadro in basso a sinistra (mirino, contorno e valori visibili solo ad audio acceso). Parte il brano dello stato attuale; spegnendo, sfuma in 1 s. Asset in **`public/audio/`**. |
| Suoni urbani | Folla leggera/densa ↔ persone; traffico ↔ città; parco ↔ verde; cicale ↔ calore; grilli ↔ notte. |
| Riproduzione effetti | Niente loop cucito: ogni suono **alterna a caso le varianti** (mai la stessa due volte di fila), dissolvenza incrociata equal-power fino a 1,2 s, velocità casuale ±4%. |
| Mix effetti | **Calcolato** (`sound-lab/mix.json`): volume = musica (−18 LUFS) − `sotto_musica_db` + 20·log10(presenza). Tetti sotto la musica: folla densa 9 dB, grilli 11, folla leggera 12, parco 13, cicale 14, traffico 15. La presenza (0–1) per ora viene dalle scene per stato. Metronomi: `metronomi_db` −11. |
| Livello dei modi musicali | **−18 LUFS** per IA, classica e Sottotraccia (quest'ultima con una tabella per (X, Y, H), così il volume non cambia fra gli stati). **Metronomi** misurati a circa **−29 LUFS** (`metronomi_db` −11 nel mix). |
| Generazione musica IA | **finetuning.ai**, piano Plus, a mano. Scheda **Instrumental**; nessuno stile preset; nessun tag; **Enhance prompt OFF**; Length 2 min; seed fisso. Prompt in **inglese**. |
| Coerenza musicale IA | Tutti i brani in **re** (maggiore sereni, minore opprimenti), ambient-cinematografico. Ogni prompt termina con la "coda fissa" (`prompts.md`). |
| Post-produzione musica | Taglio sfumature, loop su battuta con dissolvenza incrociata di 2 s, **−18 LUFS**, picco ≤ −1 dBFS, MP3 160k. |
| Post-produzione effetti | Taglio della sfumatura finale, micro-fade 50 ms, **−20 LUFS**, limitatore sui picchi isolati, MP3 160k. |
| Classica | **10 loop** da **Musopen** (raccolta "Musopen Collection as FLAC" su Internet Archive), in `public/audio/classica/`, da `sound-lab/process_classica.py`: un segmento di 70–95 s per stato, dissolvenza di 2 s, −18 LUFS, MP3 160k. Mappa: Rifugio Grieg (Morgenstimmung), Passeggiata Mendelssohn (Andante, Italiana), Festa Mozart (Figaro), Attesa Haydn (Lark, Adagio), **Routine Haydn (Lark, Menuetto)**, Corrente Mendelssohn (Saltarello), Afa Borodin (Steppe), **Fatica Beethoven (Egmont, intro 0–68 s, taglio per attacchi, da giudicare all'orecchio)**, Calca Brahms (Sinf. 4, Allegro energico), Notte Schubert (D. 664, Andante). **Citazione obbligatoria nell'app** (`ui-compass.js`). Licenza dichiarata da chi ha caricato la raccolta: **Public Domain Mark**, da verificare su musopen.org per ogni registrazione prima della pubblicazione (aperto). |
| Metronomi | Cento metronomi a molla (`src/audio/metronomi.js`, ispirato a Pantaleone 2002): ognuno tirato verso una griglia comune; il **disagio** (0..1) = media 50/50 di energia (X) e comfort (C) (`discomfort`). Parametri nostri, da confermare all'ascolto: T0 1 s, RICHIAMO 1/12, KAPPA 0,6, CLICK 0,10. Traccia di prova: `sound-lab/metronomi.mjs`. **Punto aperto:** Festa e Afa danno lo stesso disagio (0,5), perché l'energia e il comfort si annullano: va deciso. |
| Stem | Al momento non servono. Se servissero: StemDeck o UVR5 (locali), MVSEP (web). |

## Stato degli asset audio
Grezzi in `music/` e `music/sfx/` (**non versionati**). Pronti in **`public/audio/loops/`** e **`public/audio/sfx/`** (collegati da `sound-lab/loops`, `sound-lab/sfx`). Classica in **`public/audio/classica/`** (10 MP3 + `manifest.json`, FLAC sorgente non versionati).

| Stato | File scelto (IA) | Tonalità misurata | Note |
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
| Folla leggera | **4** (2,5 / 4,2 / 5,8 / 6,0 s) | 1 e 2 si ripetevano troppo → generate 3 e 4. La 1 è timbricamente diversa (più cupa): toglierla se fa "scalino". |
| Folla densa | 2 (6,5 / 4,2 s) | |
| Traffico | 2 (4,3 / 6,5 s) | il grezzo Traffico1 saturava (+0,3 dBFS), corretto |
| Parco | 1 (6,6 s) | |
| Cicale | 1 (6,5 s) | vaga nota mi: verificare sopra i brani |
| Grilli | 1 (5,8 s) | vaga nota fa: verificare sopra i brani |

Giudizio dell'utente: i brani 2025 suonano "parenti"; la bussola di prova piace; gli effetti vanno bene. **Mix calcolato: "per ora suona bene"**. L'**ascolto sopra la mappa** non è ancora stato giudicato per i modi nuovi (metronomi, classica, Sottotraccia). Clip di prova di disagio (A/B, codici casuali, chiave in `sound-lab/disagio/clip/chiave.json`, non in git): da ascoltare alla cieca.
