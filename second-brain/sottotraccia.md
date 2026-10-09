# CityRhythm — Sottotraccia (musica a regole)

> Parte del second brain di CityRhythm: **indice in `SECOND_BRAIN.md`**, da leggere per primo. Questo file si legge quando il lavoro tocca questo argomento e si aggiorna col comando `/second-brain`.

Quarto modo della musica (accanto a IA, classica e metronomi): musica **generata da regole**, senza file, dagli ingressi della bussola. È il "layer sotto la coscienza": sotto i suoni riconoscibili (folla, traffico, natura) che restano nel mix degli effetti. Legende: **[F]** fonte in `paper/` (locale, non in git), **[S]** scelta nostra, **[I]** inferenza, **[H]** ipotesi senza fonte.

## Decisioni valide
| Tema | Decisione |
|---|---|
| Nome | **Sottotraccia** (proposto dal consulente Opus, accettato). |
| Ingressi | **X** energia (−1..+1), **Y** piacevolezza (−1..+1), **H** calore con segno (−1 freddo, +1 caldo), **I** irregolarità (0..1, solo nelle clip di prova; 0 nell'app). |
| Chi fa cosa | Ogni ingresso muove **un solo gruppo**: X → cassa, hi-hat, tempo, voci; Y → coppia stonata e brillantezza dell'hi-hat (solo Y < 0); H → registro; I → scostamento degli hi-hat. [S] |
| Tempo | **120 + 60·X bpm** (60 con X = −1, 180 con X = +1). A 180 i sedicesimi stanno a 12 Hz, sotto la soglia di ruvidezza (~15 Hz) [F Fastl cap. 10–11]. |
| Cassa e hi-hat | Salgono **in continuo** con `clamp(X / CUT)`, CUT = 1/3 (`cut` di `bussola.json`). [S] |
| Note | **Una per battito**: la densità è il tempo stesso (niente passo a X = 0). Motivo di 8 gradi su scala minore di re (tonalità dei brani, `audio.md`). [S] |
| Voci | Radice sempre; terza `clamp(X + 1)`; quinta `clamp(X)`. [S] |
| Ruvidezza | **Solo nella coppia stonata**: due toni a 1000 Hz e 1040 Hz, cioè 1/4 della banda critica a 1 kHz (~160 Hz) [F Plomp & Levelt 1965; Fastl cap. 6]. Livello `clamp(−Y/CUT)·10^((−12−6Y)/20)`: −10 dB a Y = −1/3, −6 dB a Y = −1. [S] |
| Niente AM sull'intero suono | La modulazione al 100% a 70 Hz su tutto il suono (clip 13) ha cancellato l'altezza: "rumore, non musica". La grana sta nelle note. |
| Brillantezza | Banda dell'hi-hat log-interpolata da 300–3000 Hz (Y ≥ 0) a 7000–12000 Hz (Y = −1), volume compensato con √(2700/larghezza): il rumore bianco guadagna con la larghezza [I]. Nitidezza cresce sopra ~3 kHz [F Fastl cap. 9]. |
| Registro | **440·2^(−H) Hz**: più grave col caldo. [H] Nessun paper lega caldo e altezza: da verificare all'ascolto. "Freddo = acuto" non adottato. |
| Calore H | Calcolato in `src/compass/compass-core.js` (`calore(T, cfg.fisica)`) con le soglie di `bussola.json` (26/30 caldo, 9/−13 freddo). Vale **C = 1 − 2|H|**, dove C resta il comfort della bussola. Va nel `mood` come `H`. Il suono non copia le soglie. |
| Movimento | Ogni ingresso scorre verso il valore richiesto con costante 1/3 s **a ogni battito** (≈ 1 s per arrivare): niente scatti. [S] |
| Livello | **Tabella misurata offline** (`src/audio/sottotraccia-livelli.json`, griglia 5×5×3 di X, Y, H): guadagno che porta la musica grezza a −18 LUFS, picco ≤ −1 dBFS. Interpolata in tre dimensioni (`sottotraccia-livelli.js`) e applicata **per evento**, dagli ingressi con cui l'evento è stato pianificato. Coerente con "tutti i brani a −18 LUFS" (`audio.md`). |
| Fonte unica | `src/audio/sottotraccia-eventi.js` (pianificatore puro, seme fisso): app e clip usano la stessa lista di eventi. `sound-lab/sottotraccia/genera.py` fa solo la sintesi, prendendo gli eventi da `eventi.mjs` (Node). |
| Scheduling (app) | Lookahead **0,5 s**, controllo ogni **100 ms**; **1,5 s** con la scheda nascosta. Un nodo di uscita nuovo a ogni avvio; stop con sfumatura lineare in 1 s. Gli eventi già passati si saltano. |
| Dove suona | Modo **"Sottotraccia"** nel selettore. Fuori dalle celle: silenzio in 1 s. Ingressi non finiti (per esempio fuori cella) non si accettano. I suoni urbani restano sopra, come negli altri modi. |
| Silenzio numerico | Guadagni sotto −60 dB sono zero: la coda della smorzatura non arriva mai a 0 e accenderebbe voci inudibili con i loro oscillatori. |
| Notte | Oggi è uno stato come gli altri (suona con X e Y). **Proposto** un interruttore sopra la ruota, non deciso. |
| Sincope | **Non decisa.** Janata 2012 confronta generi, non misura la sincope: l'affermazione "più sincopato = più groove" del consulente non regge. [F] |

## Stato
| Parte | File | Stato |
|---|---|---|
| Regole | `src/audio/sottotraccia-regole.js` | fatto |
| Pianificatore | `src/audio/sottotraccia-eventi.js` | fatto, deterministico |
| Player Web Audio | `src/audio/sottotraccia.js` | in app, provato nel browser |
| Livelli | `src/audio/sottotraccia-livelli.js` + `.json` | fatti; non confrontati con −18 LUFS nel browser |
| Calore | `src/compass/compass-core.js` (`calore`, `H` in `evaluate`) | fatto |
| Modo nell'app | `src/ui/ui-compass.js` (selettore), `src/audio/audio-engine.js` | fatto |
| Clip di prova | `sound-lab/sottotraccia/clip/` (6 statiche + 2 rampe), **non in git** | da ascoltare |
| Strumenti | `sound-lab/sottotraccia/`: `genera.py`, `eventi.mjs`, `prova_app.mjs`, `prova_stati.html/.mjs` | fatti |

## Prove fatte (2026-10-09/10)
- **Browser** (headless, puppeteer fuori dal progetto), oscillatori in 3 s: Festa 90, Calca 144, Calca calda 144 (registro più grave), Afa 30, Rifugio 9, Corrente 36. Fuori dalle celle 0. Tornando a IA 0. Nessun errore in console.
- **Node**: pianificatore deterministico; identità C = 1 − 2|H| su UTCI 0–35 °C; rampe misurate continue nelle clip.

## Limiti dichiarati
- Nessun paper parla del caldo nel suono né del calore nel registro: è la parte più ipotetica.
- Gli studi sono su urla, rumori, paesaggi sonori di 30 s, groove pop: il passaggio alla musica generata è un'inferenza.
- Quanti gradini di energia si sentono: da misurare all'ascolto.
- Costo: 3 oscillatori per nota. Una `PeriodicWave` ne userebbe uno (non fatto).

## Matrice estesa (proposta, non decisa)
Il consulente Opus propone 17 punti (8 direzioni di Axelsson × 2 intensità + centro), con test a 20 ascoltatori, soglia 75% sulle coppie vicine, Notte come interruttore e calore nel registro. Da decidere **dopo** l'ascolto dei modi attuali.
