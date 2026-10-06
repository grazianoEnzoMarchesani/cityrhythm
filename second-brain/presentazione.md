# CityRhythm — Presentazione del branch Music

> Parte del second brain di CityRhythm: **indice in `SECOND_BRAIN.md`**, da leggere per primo. Questo file si legge quando il lavoro tocca questo argomento e si aggiorna col comando `/second-brain`.

Presentazione del lavoro del branch Music alla collega: deck, scaletta, come raccontare ogni slide, demo in remoto, come modificare il deck.

## Decisioni valide
| Tema | Decisione |
|---|---|
| Pubblico e formato | **La collega** (una persona), in **videochiamata** (per l'utente "fluidissima": i video nel deck vanno bene): 10–15 minuti, al massimo 20. Spiegare **tutto il lavoro del branch**, con l'**accento sulla mappa sonora** (slide 1–14), poi il resto. Tutto in italiano. La slide della demo l'ha tolta l'utente (2026-10-06): **da chiarire se la demo dal vivo resta**. |
| Deck | Artifact **Slides** privato: **https://claude.ai/artifact/8wMEfrXxCtVTpSJe34nZ55**. **18 slide** (tabella sotto). Ogni slide ha le **note del relatore** (`<aside>`): parole semplici, minuti indicativi. Si scarica come PDF o PPTX (i video diventano il loro fotogramma finale). |
| Materiale di partenza | **`presentazione/materiale-music.md`**: 30 schede, storie "prima → dopo", copione della demo, numeri chiave, limiti, crediti. Fonte di fatti e numeri: **niente numeri nuovi senza fonte**. Corretto il 2026-10-06: comfort −1 da **30 °C** di UTCI, non 32 (vedi `bussola-clima.md`). |
| Chi non citare | **Simone non va citato** nella presentazione (l'utente: "non c'entra"). La fonte delle celle si scrive "progetto QGIS". |
| Aspetto (2026-10-06: "sembra fatta da un'AI") | **Bianco e nero, minimale**: fondo `#FFFFFF`, inchiostro `#111111`, un solo grigio `#6E6E6E` (`#8A8A8A` sul nero). Copertina nera: titolo, "CityRhythm · 6 ottobre 2026", i 9 quadrati della Sound map a spigoli vivi. **Colore solo** per la matrice degli stati / Sound map (`SOUND_STATE_COLORS`), la scala UTCI (`UTCI_RAMP`) e i grafici con i colori degli stati. **Un argomento per slide**: titolo 72 px in alto e una sola cosa sotto (frase 44 px, figura, tabella o elenco breve); niente occhielli, riquadri, fasce grigie, ombre; il resto nelle note. Piè di pagina: solo il numero a destra, la fonte a sinistra se serve. Font Space Grotesk + IBM Plex Sans, scala 120/72/44/32/24 px. Testi riscritti con la skill `no-ai-slop`, grafica con `no-ai-design-slop`. |
| Ritocchi dell'utente (a mano, 2026-10-06) | Copertina essenziale; titoli corti ("Far sentire la città", "Chi sta a casa"). **Tolte 4 slide**: demo, "Come ci siamo arrivati", "Niente numeri a caso", "Cosa manca". **Appunti nei titoli** da trasformare in slide: `persone` ("…anche qui è poco chiaro, farò vedere forse un video direttamente dalla piattaforma"), `mappa` ("…inserirei le logiche aggiunte con la mappa del Nolli"; stile Nolli in `mappa.md`). |
| Russell (slide 4) | **Schema**, non video: cerchio con 8 emozioni di **Russell 1980, "A circumplex model of affect"** (citazione di letteratura aggiunta in sessione, anche nelle Fonti). Assi **scambiati** per allinearlo alla bussola (orizzontale attivazione = energia, verticale piacevolezza), dichiarato nel piè di pagina. Traduzioni: Attivazione, Eccitazione, Piacere, Contentezza, Sonnolenza, Depressione, Infelicità, Tensione (*distress*). Angoli come la matrice: Eccitazione–Festa, Tensione–Calca, Contentezza–Rifugio. |
| Video (slide 7 e 9) | `energia-video` e `utci-video`: **mp4 veri** (20 s e 23 s, 3328×1280, in loop quando la slide è presentata, clic = pausa) come `<img src="/_blob/<fotogramma>" data-video="/_blob/<clip>">`; asset energia `90b56236…` (clip) / `e219405b…` (fotogramma), piacevolezza `484e0921…` / `c8cd225d…`. 5 passi accesi uno alla volta a destra, animazione a sinistra, bianco e nero. Le slide statiche `energia` e `utci` restano ("male che va lo teniamo"): **decidere quale tenere** (insieme ~2 min). Sorgenti e comandi in `strumenti.md` → "Video del deck". |
| Esempi nei video | **Energia: esempio illustrativo**, scritto nel video: 18 persone entro 50 m → 18 ÷ 0,00785 km² = 2.292 persone/km² → energia +0,20, gente media; dalla formula del codice: poca gente sotto ≈ 5 persone entro 50 m, tanta sopra ≈ 24. **Piacevolezza: esempio vero** calcolato con `compass-core.js` (`presentazione/video/esempio.mjs`): cella 314284 del Centro Storico (LCZ 3, SVF 0,27, permeabile 0,4%), **21/7/2024 ore 13** (UTCI mediano di luglio alle 13 per quella cella): aria 33 °C, umidità 40%, vento 8,8 km/h, sole a 67°, temperatura radiante 43,8 °C, vento in cella 1,8 m/s, **UTCI 35,3 °C**, comfort −1, verde −0,99, **piacevolezza −1,00, opprimente**. Nessun altro valore d'esempio nel deck (il pannello della bussola con "+0.52 / −0.61 / ≈ 240" è stato tolto). |
| "Chi sta a casa" (slide 16) | **Grafico** della curva ISTAT `quota_in_casa.json` (aggregata, licenza ok): quota in casa ora per ora, martedì nero e domenica grigio, scritte "la mattina si esce" / "la sera si rientra"; a destra due frasi su come la si usa (resta in casa questa quota dei residenti, gli altri escono) e i residenti Meta. Disegnato in SVG con le etichette come `<p>` sopra (nell'SVG i font non si caricano). I numeri del risultato (3:00 100%, 7:00 11%, 13:00 8%, 21:00 22%, 0:00 36%) sono nelle note. |
| Demo in remoto | `npm run dev` in locale (Music non è su GitHub Pages, che pubblica solo `main`). **Condividere anche l'audio**: Zoom "Condividi audio"; Google Meet una scheda di Chrome con "Condividi anche l'audio della scheda"; Teams "Includi audio". Condividere **solo la finestra del browser** (schermo 5K ultrawide). **Provarla prima**: l'ascolto sopra la mappa non è mai stato giudicato. Piano B: pagina di ascolto di `sound-lab/`. |
| Modificare il deck | **Prima di cambiare una slide, rileggerla dall'artifact** (`read` con `path` `project/slides/<id>.html`; `project/deck.json` se cambiano ordine, sezioni, titolo o font). Copie locali in una cartella della scratchpad alle stesse posizioni (`project/...`), poi `publish` con `url` del deck, `root` = quella cartella, solo i file cambiati. Pubblicazione rifiutata = qualcuno ha salvato: rileggere e rifare la modifica sopra. Formato: un solo `<section id="<id>">` per file, stili inline, testo ≥ 24 px, tela 1920×1080, margini 128 px (160 sotto). Anteprima approssimata con `presentazione/video/preview.mjs`. |
| Trappole dell'editor | (1) Un **editor aperto su una versione vecchia salva sopra** una pubblicazione (la copertina nuova è stata sovrascritta dopo 9 s): l'utente deve **ricaricare la pagina** prima di ritoccare. (2) L'editor **toglie i `<div>` vuoti non dipinti**: nella matrice la casella in alto a sinistra spariva e la griglia si sfasava di una colonna → `<div style="background:#ffffff"></div>`. (3) I **numeri di pagina sono scritti a mano** nel piè di pagina: dopo slide aggiunte o tolte vanno rinumerate tutte. |

## Scaletta e come raccontare ogni slide
Colonna "Materiale" = sezione o scheda di `presentazione/materiale-music.md` con fatti, numeri e fonti.

| # | id | Titolo | Cosa c'è / cosa deve passare | Analogia o frase chiave | Materiale |
|---|---|---|---|---|---|
| 1 | `cover` | La mappa sonora di Ascoli Piceno | Titolo, data, 9 quadrati della Sound map | I 9 colori si ritrovano sulla mappa | — |
| 2 | `idea` | Far sentire la città | La mappa mostra gente e caldo, la musica aggiunge com'è starci; solo il Comune, 246 giorni; il branch in numeri a voce | "Una piazza piena d'estate suona come una festa, un vicolo deserto a mezzogiorno come afa" | 0, 1.2 |
| 3 | `catena` | Dalla città allo stato d'animo | Dati → energia + piacevolezza → bussola → musica, per cella e per ora | — | 1.3 |
| 4 | `russell` | Le emozioni su due assi | Cerchio di Russell girato come la bussola | "La gente fa l'attivazione, il clima la piacevolezza" | E1 |
| 5 | `bussola` | Due domande, nove stati d'animo | Matrice 3×3 + Notte (buio e poca gente) | "A dicembre alle 17 il Centro è pieno" | E1 |
| 6 | `energia` | Energia | 50 m, puntini della mappa, chi è in casa non conta | — | E2 |
| 7 | `energia-video` | Energia, passo per passo | Video: puntini, cerchio, conteggio, densità, scala tarata | Scala logaritmica "come quella dei terremoti" | E2 |
| 8 | `utci` | Piacevolezza | UTCI e formula; fonti nel piè di pagina | UTCI = "la temperatura percepita, ma per un pedone in quella strada" | C4, E3 |
| 9 | `utci-video` | Piacevolezza, passo per passo | Video: meteo, forma della strada, UTCI, comfort, somma (esempio vero) | Soglia a 30 °C: "una sera a 29 °C deve già pesare" | C4, E3 |
| 10 | `mappe` | Due mappe ora per ora | Legende di UTCI heat stress e Sound map | — | E4, E5 |
| 11 | `risultato` | Come suona Ascoli | Barre con la frequenza degli stati; avvertenza nel piè di pagina (energia per quartiere) | Inverno sereno: "l'UTCI conta anche i vestiti" | E7 |
| 12 | `brani` | Dieci brani, tutti in re | Tabella stato / carattere / tonalità / tempo | "Stessa tonalità, il cambio non stona"; maggiore luminoso, minore cupo | F2 |
| 13 | `suoni` | I suoni della città | Tetti in dB sotto la musica | "La musica è la voce, la città il pubblico in sala"; 10 dB in meno ≈ metà | F3, F4 |
| 14 | `motore` | Come si comporta la musica | Segue il mirino, isteresi 1 s, dissolvenza 1 s, silenzio fuori dalle celle | "Un DJ che abbassa un disco mentre alza l'altro" | F5, E6 |
| 15 | `persone` | Puntini che sembrano persone | 4 righe; **appunto dell'utente nel titolo**: forse un video dalla piattaforma | — | D1–D5, D7 |
| 16 | `casa` | Chi sta a casa | Grafico ISTAT + come lo si usa | I dati sono un campione: di notte vedono il 6–15% dei residenti | D6 |
| 17 | `mappa` | Una mappa nuova | 3 righe; **appunto dell'utente nel titolo**: le logiche dello stile Nolli | — | A1–A5, B, C1–C2 |
| 18 | `fonti` | Fonti | Dati e letteratura (con Russell 1980); citazioni IPUMS MTUS e UCL **obbligatorie** | — | 9 |

## Da fare
- **Prossima sessione**: continuare slide per slide da **"Chi sta a casa" (16)**, poi `persone` (video dalla piattaforma?) e `mappa` (stile Nolli), `fonti`.
- **Rinumerare** i piè di pagina: `persone`, `casa`, `mappa`, `fonti` dicono 16, 17, 18, 22 (devono essere 15–18). Sezioni del deck: "Demo" è rimasta vuota.
- Decidere fra slide statica e video per energia e piacevolezza; chiarire se la demo dal vivo resta e, se sì, provarla con l'audio.
- Controllare a schermo le slide non viste in anteprima (viste solo i due video e "Chi sta a casa").
- Licenza IPUMS: valutare se la presentazione conta come "materiale didattico" da comunicare alla loro bibliografia.
