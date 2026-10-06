# CityRhythm — Presentazione del branch Music

> Parte del second brain di CityRhythm: **indice in `SECOND_BRAIN.md`**, da leggere per primo. Questo file si legge quando il lavoro tocca questo argomento e si aggiorna col comando `/second-brain`.

Presentazione del lavoro del branch Music alla collega: deck, scaletta, come raccontare ogni slide, demo in remoto, come modificare il deck.

## Decisioni valide
| Tema | Decisione |
|---|---|
| Pubblico e formato | **La collega** (una persona), in **videochiamata**: 10–15 minuti, al massimo 20. Spiegare **tutto il lavoro del branch**, con l'**accento sulla mappa sonora** (prime 11 slide), il resto dopo la demo come "cosa è servito per arrivarci". **Demo dal vivo in remoto**. Tutto in italiano. |
| Deck | Artifact **Slides** privato: **https://claude.ai/artifact/8wMEfrXxCtVTpSJe34nZ55**. 19 slide con id parlanti (tabella sotto), 6 sezioni. Ogni slide ha le **note del relatore** (`<aside>`): parole semplici, minuti indicativi (~15 min + 4–5 di demo). Si scarica come PDF o PPTX dal deck. |
| Materiale di partenza | **`presentazione/materiale-music.md`** (radice del progetto): 30 schede (in una frase, problema, come funziona, numeri e fonti, cosa mostrare, stato), branch in numeri, 15 storie "prima → dopo", copione della demo in 12 passi, foglio dei numeri chiave, limiti, crediti. Ricavato da tutto il second brain e dai 21 commit `main..Music`. È la fonte da cui prendere fatti e numeri: **niente numeri nuovi senza fonte**. |
| Chi non citare | **Simone non va citato** nella presentazione (l'utente: "non c'entra"). La fonte delle celle si scrive "progetto QGIS". |
| Aspetto | Base in bianco e nero come lo stile Toner: carta `#F6F5F1`, inchiostro `#16171A`, carte `#FDFCF9` con bordo `#DDD9D0`, fasce `#ECEAE4`, testo secondario `#4A4A52`, piè di pagina `#6B6A66`. Colori della Sound map presi dal codice (`SOUND_STATE_COLORS`, `UTCI_RAMP` in `src/data/config.js`): accento `#b33a0e` (Calca), verde `#17725c` (Festa), arancio `#f0803c` sugli sfondi scuri. Font **Space Grotesk** (titoli) + **IBM Plex Sans** (testo); scala 120/72/44/32/24 px. Copertina e "Metodo" su fondo scuro, "Demo" su fondo color Calca. Ogni slide di contenuto: occhiello maiuscolo color accento + titolo 72 px in alto, piè di pagina "CityRhythm · branch Music · la mappa sonora" + numero. |
| Ritocchi dell'utente (a mano nell'editor, 2026-10-06) | **Copertina**: solo titolo e data "6 ottobre 2026" (tolti il sottotitolo "Cosa ho fatto, come funziona, cosa resta da fare" e la riga col nome e Unicam). **Slide 2**: titolo "Far sentire la città" (prima "…, non solo vederla"). Preferenza: **titoli corti, copertina essenziale**. |
| Valori d'esempio | Solo nella slide 11 (pannello della bussola: "+0.52", "−0.61", "≈ 240 persone"), dichiarati "valori d'esempio": quelli veri si vedono nella demo. Nessun altro numero inventato. |
| Demo in remoto | `npm run dev` in locale (Music non è su GitHub Pages, che pubblica solo `main`). **Condividere anche l'audio**: Zoom "Condividi audio"; Google Meet una scheda di Chrome con "Condividi anche l'audio della scheda"; Teams "Includi audio". Condividere **solo la finestra del browser** (schermo 5K ultrawide). Nello streaming il Play può sembrare a scatti. **Provarla prima**: l'ascolto sopra la mappa non è mai stato giudicato e la gente in casa non è stata vista a schermo. Piano B: pagina di ascolto di `sound-lab/`. |
| Modificare il deck | L'utente ritocca le slide a mano nell'editor: **prima di cambiare una slide, rileggerla dall'artifact** (`Artifact` azione `read` con `path` `project/slides/<id>.html`; `project/deck.json` se cambiano ordine, sezioni, titolo o font). Copie locali in una cartella della scratchpad della sessione, alle stesse posizioni (`project/...`); poi `publish` con `url` del deck, `root` = quella cartella, solo i file cambiati. Formato: un solo `<section id="<id>">` per file, stili inline, testo ≥ 24 px, tela 1920×1080, margini 128 px (160 sotto, dove c'è il piè di pagina). L'agente **non ha controllato a schermo** come appaiono le slide: va chiesto all'utente. |

## Scaletta e come raccontare ogni slide
Colonna "Materiale" = sezione o scheda di `presentazione/materiale-music.md` con fatti, numeri e fonti.

| # | id | Titolo | Cosa deve passare | Analogia o frase chiave | Materiale |
|---|---|---|---|---|---|
| 1 | `cover` | La mappa sonora di Ascoli Piceno | Cosa ho fatto, come funziona, cosa resta (detto a voce) | I 9 quadrati = colori della Sound map, li ritrova in mappa | — |
| 2 | `idea` | Far sentire la città | Emozioni, non sonificazione; solo Ascoli; 246 giorni; il branch in numeri (2 giorni, 16 sessioni, 21 commit, 10 + 6 suoni, 12.496 celle) | "Una piazza piena d'estate suona come una festa, un vicolo deserto a mezzogiorno come afa" | 0, 1.2 |
| 3 | `catena` | Dalla città allo stato d'animo | Dati → energia + piacevolezza → bussola → suono | — | 1.3 |
| 4 | `bussola` | Due domande, nove stati d'animo | 2 assi, soglie ±1/3, 9 stati + Notte, per cella sotto il mirino | Circomplesso di Russell; "a dicembre alle 17 il Centro è pieno" (perché la Notte vuole anche poca gente) | E1 |
| 5 | `energia` | Energia: la gente entro 50 metri | Puntini fuori casa entro 50 m, chi è in casa non conta, scala tarata sui percentili | "Le persone le avevamo già distribuite noi sulla mappa" | E2 |
| 6 | `utci` | Piacevolezza: come si sta in strada | UTCI in 4 passi con le fonti, formula della piacevolezza, verde = scelta espressiva | UTCI = "la temperatura percepita del meteo, ma per un pedone in quella strada" | C4, E3 |
| 7 | `mappe` | Due mappe ora per ora | UTCI a sfumatura continua, Sound map a colori netti, settimana tipo al 90° percentile | — | E4, E5 |
| 8 | `risultato` | Come suona Ascoli | Distribuzione degli stati e stagioni; avvertenza: calcolo con l'energia per quartiere | Inverno sereno: "l'UTCI conta anche i vestiti" | E7 |
| 9 | `brani` | Dieci brani, tutti in re | Tabella stato / carattere / tonalità / tempo; finetuning.ai, −18 LUFS | "Stessa tonalità = parlano la stessa lingua, il cambio non stona"; maggiore luminoso, minore cupo; LUFS = volume percepito delle piattaforme di streaming | F2 |
| 10 | `suoni` | I suoni della città, sotto la musica | 6 suoni, tetti in dB, varianti a caso, mix calcolato; oggi scene fisse per stato | "La musica è la voce, la città il pubblico in sala"; 10 dB in meno ≈ metà del volume percepito | F3, F4 |
| 11 | `motore` | Come si comporta la musica | Interruttore, isteresi 1 s, dissolvenza 1 s, silenzio fuori dalle celle, pannello, sincronia col Play (1,3 s per ora) | Dissolvenza = "un DJ che abbassa un disco mentre alza l'altro" | F5, E6 |
| 12 | `demo` | Proviamola insieme | 7 passi: Play, Color dots by, Show, UTCI e Sound map a luglio, mappa sonora nel Centro alle 13 / 9 / 21, dicembre e mezzanotte, fuori dalle celle | Nota in slide: condividere l'audio e solo la finestra | 13 |
| 13 | `persone` | Puntini che sembrano persone | Identità stabili, formichine, Color dots by, solo dove si cammina, maestri fissi, −90% di lavoro | — | D1–D5, D7 |
| 14 | `casa` | Chi sta a casa, ora per ora | Diari ISTAT + residenti Meta + regola prudente; quote del martedì (3:00 100%, 7:00 11%, 13:00 8%, 21:00 22%, 0:00 36%) | I dati sono un campione: di notte vedono il 6–15% dei residenti, correlazione 0,96 | D6 |
| 15 | `mappa` | Una mappa nuova, tutta in casa | Celle da 30 m e menu Show, Toner, autosufficienza, store; errori corretti (15 agosto "lunedì", menu bloccati) | Store = "una bacheca in ufficio: ognuno appende e legge, nessuno entra nell'ufficio dell'altro" | A1–A5, B, C1–C2 |
| 16 | `storie` | Come ci siamo arrivati | 8 righe prima → cosa non andava → ora | La notte di dicembre; l'inverno che finiva in Calca | 12 |
| 17 | `metodo` | Niente numeri a caso | Fonti dichiarate, second brain, verifiche (220/220, 24,6 °C, Meta vs ISTAT) | — | G1–G3 |
| 18 | `limiti` | Limiti e prossimi passi | 5 limiti, 5 passi | Il clima è "una stima per confrontare celle, non un termometro" | 10, 11 |
| 19 | `fonti` | Dati, fonti e citazioni | Fonti dei dati e della letteratura; citazioni IPUMS MTUS e UCL **obbligatorie** | — | 9 |

## Da fare
- **Modifiche slide per slide** con l'utente (prossima sessione): una slide alla volta, mostrare cosa cambia e aspettare l'ok.
- Verificare con l'utente che nessun testo sbordi o vada a capo male (non controllato a schermo).
- Facoltativo: screenshot veri della piattaforma (Chrome senza finestra, vedi `strumenti.md`) per le slide di mappe, persone e pannello, caricati come immagini del deck.
- Licenza IPUMS: valutare se la presentazione conta come "materiale didattico" da comunicare alla loro bibliografia.
