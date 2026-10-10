# CityRhythm — Interfaccia

> Parte del second brain di CityRhythm: **indice in `SECOND_BRAIN.md`**, da leggere per primo. Questo file si legge quando il lavoro tocca l'interfaccia (pannelli, timeline, scheda, testi) e si aggiorna col comando `/second-brain`.

Ripinteggiatura del 2026-10-10 sul branch `ui-redesign` (da `Music`). Motivo: pannelli che si coprivano, colonna destra fissa, due lingue, stili sparsi. Files: `index.html`, `style.css`, `main.js`, `src/ui/*`.

## Decisioni valide
| Tema | Decisione |
|---|---|
| Layout desktop | **Mappa a tutto schermo.** Colonna a sinistra (296 px): **Livelli** in quattro gruppi a fisarmonica (Persone, Luoghi, Clima e celle, Mappa), che scorrono dentro la colonna. La colonna finisce sopra la timeline: le sovrapposizioni non si producono. La **Mappa sonora** sta nella timeline, a sinistra. |
| Timeline | In basso al centro della mappa, massimo 640 px. Riga 1: a sinistra il **quadrante** della Mappa sonora, poi Play, **etichetta del tempo**, pulsante **Periodo**. Riga 2: cursore. Il pulsante di direzione (avanti/indietro) è stato tolto da tutte le versioni (2026-10-10): il Play va sempre avanti. |
| Etichetta del tempo | Dichiara sempre il modo: "Settimana tipo · Lun 14:00" oppure la data vera ("sab 08/06 14:00"). |
| Periodo | Pannello con il calendario (Litepicker, `lang: 'it-IT'`), Reset "Tutto il periodo", frase su cosa cambia sotto 7 giorni. Il pulsante si attiva solo a dati caricati. |
| Soglia 7 giorni | **Una sola funzione**: `rangeDays` in `utils.js` (giorni estremi compresi), con `WEEK_TYPE_FROM_DAYS = 7`. Usata da timeline, scheda e colori dei puntini. |
| Scheda area | A destra (400 px), **solo con un'area selezionata**. × ed Esc la chiudono e deselezionano; il fuoco torna dove era. La mappa non si restringe. Titolo = nome dell'area. |
| Mirino | Al centro della mappa (`.crosshair`), visibile solo con la mappa sonora accesa (`audio.md`). Bianco con effetto differenza (`mix-blend-mode`): si vede sia sui puntini neri sia sul fondo chiaro. |
| Mappa sonora | **Quadrante** a sinistra della timeline: nove caselle con i colori degli stati e una **lancetta** che va dal centro al punto (energia a destra, piacevolezza in alto). Lancetta e punto stanno su un unico braccio che ruota in 600 ms, così il punto resta sulla punta. **Un tocco** (anche col dito) accende e spegne la musica. Il **pulsante sotto** (nome dello stato e freccia; sul telefono solo «Modi») apre il pannello: titolo, stato con una frase, «Musica» con i quattro modi in griglia 2×2 e una riga sul modo scelto, «Dettagli» come lista etichetta-valore (Persone, Temperatura percepita, Zona, Tipo di zona, Gente, Benessere, Meteo usato). Il tocco sul quadrante non chiude il pannello; Esc riporta il fuoco sul pulsante. Le frasi degli stati (`DESCRIZIONI` in `ui-compass.js`) restano da rileggere con l'utente (punto 5). |
| Centro della mappa | Padding **simmetrico** in `fitMapToBounds`: la prima inquadratura non sposta il centro. Nessun padding persistente, nessun movimento di camera al clic: la cella letta dalla musica è quella sotto il mirino (`compass.js` legge `viewport.center`). |
| Crediti | Controllo MapLibre compatto in alto a destra (tasto "i"), **chiuso all'avvio**, con il testo completo (OSM, Protomaps, TUM, Meta, Mapterhorn, ISTAT/IPUMS/UCL: citazione obbligatoria). |
| Caricamento ed errori | Barra di stato in alto con il passo corrente; sparisce a fine caricamento. Errori in un messaggio `role="alert"`. Il sito segnala `document.documentElement.dataset.ready = '1'` a fine caricamento (lo usano le prove). |
| Telefono | Condizione unica `PHONE_QUERY` (`config.js`): larghezza sotto 720 px **oppure** altezza sotto 500 px con puntatore grossolano (telefono in orizzontale). Timeline di 138 px: quadrante a sinistra con sotto «Modi», a destra Play, ora e Periodo su una riga, cursore sotto. Livelli scendono dall'alto (pulsante **Livelli** in alto a sinistra), chiusi all'avvio, gruppi chiusi, un gruppo alla volta. Un solo pannello della timeline alla volta. Pannello Mappa sonora sopra la timeline e per quanto possibile sotto il mirino (minimo 160 px: sui telefoni più bassi, 320×568, copre ancora un po' il centro; scelta dell'utente, 2026-10-10). Scheda area a tutto schermo con il resto della pagina `inert`. Campi a 16 px (iOS non ingrandisce). |
| Lingua | **Solo italiano**: interfaccia, popup, legende, date `it-IT` con fuso UTC, etichette MapLibre. Le sigle dei dati (UTCI, LCZ, SVF) restano, con una frase in italiano. |
| Aree KML e affollamento | Visibili **solo in modalità sviluppatore** (`DEBUG_MODE` in `config.js`), come prima. L'area KML resta sempre accesa e cliccabile: è lì che si apre la scheda. |
| Tecnologia | Vanilla JS, **nessun framework**, nessuna dipendenza nuova. Controlli nativi (`accent-color`, `details`/`summary`). |
| Browser | Obiettivo: **Chrome/Edge 110+, Safari 16.4+ (anche iOS), Firefox 115+**. Niente `:has()`, `color-mix()`, container queries. |
| Accessibilità | Focus visibile (`:focus-visible`), testo a contrasto ≥ 4,5:1, interruttori con nome, nessun `aria-live` sul tempo (cambia ogni 1,3 s durante il Play), `inert` sullo sfondo quando la scheda copre tutto. |
| Scorciatoie | Barra spaziatrice: avvia/ferma la timeline; frecce: un'ora. Solo a fuoco libero (o sul canvas per la barra), così non si scontrano con i comandi della mappa. |
| Pubblicazione | Il sito Pages si pubblica **solo da `main`** (`deploy.yml`). Dal 2026-10-10 `main` contiene `ui-redesign`, pubblicato su https://grazianoenzomarchesani.github.io/cityrhythm/. Per vedere le modifiche in locale dal telefono: `npm run dev -- --host 0.0.0.0` sulla stessa rete Wi-Fi. |

## Stato (2026-10-10)
- **Pubblicato su Pages**: `ui-redesign` unito in `main` (fast-forward) e pubblicato da `deploy.yml`. Non unito a `Music`, che è indietro.
- **Verifiche**: build passa. Prove Playwright su Chromium e WebKit: 388 controlli su 388 (desktop 1440×900 e 1366×768; telefono 390×844, 360×740 e in orizzontale 844×390). Nessun errore in console. Lancetta e punto restano uniti durante il movimento (scarto zero). Pannelli sul telefono: 24/24.
- **Non verificati**: Firefox (il suo eseguibile non si avvia nell'ambiente di prova), Safari reale, iPhone reale. Le prove sono fuori dal repository, nella cartella di lavoro della sessione.

## Da decidere con l'utente
1. Desktop: la scheda area copre l'attribuzione OSM e, fra 1100 e 1400 px, il lato destro del pannello Periodo.
2. Telefono: un tocco su un quartiere con una cella LCZ sotto apre la scheda invece del popup della cella.
3. La nuvola degli "Interessi" si disegna in un riquadro troppo piccolo.
4. Numeri nella scheda con il punto ("2717.0"): formato italiano su tutti i `toFixed`.
5. Frasi degli stati della Mappa sonora (`DESCRIZIONI` in `ui-compass.js`): da rileggere con l'utente.
6. "Notte" come interruttore nella Mappa sonora (decisione aperta, `sottotraccia.md`).
7. Unione di `ui-redesign` in `Music`: solo con il sì dell'utente. `Music` è indietro rispetto a `main`.

## Nomi vecchi → nuovi
| Prima | Ora |
|---|---|
| Map Layers | Livelli |
| Presence Density | Puntini delle persone |
| Color dots by (Off, Gender, Age, Nationality, Visits) | Colora i puntini per (Nessuno, Genere, Età, Nazionalità, Visite) |
| POI Spots | Luoghi della città (spot) |
| Synthetic Crowded Points | Punti di affollamento simulati |
| LCZ Vitality / Show | Mostra le celle LCZ / Cosa mostrare |
| UHI Dynamic Visibility | Mostra il rischio solo dove ci sono persone |
| 3D Terrain / 3D Buildings | Rilievo in 3D / Edifici in 3D |
| Map style: Toner · Nolli | Stile della mappa (gruppo Mappa) |
| "Attiva mappa sonora" + menu "Musica IA" | Mappa sonora: interruttore + quattro modi |
| Place Information | Scheda "Area", solo con una selezione |
| Direzione avanti/indietro (⇄) | tolta da tutte le versioni: il Play va sempre avanti (2026-10-10) |
| Mappa sonora: scheda con interruttore | quadrante nella timeline (un tocco accende) e pannello con modi e dettagli |
| Livelli: gruppi aperti all'avvio | sul telefono tutti chiusi, un gruppo alla volta |

## Verifica (per la prossima volta)
- Build: `npm run build`.
- Prova automatica con Playwright (pacchetto fuori dal repository): `reducedMotion: 'reduce'` (i puntini restano fermi), formati 1440×900, 1366×768 e 390×844 (anche WebKit con viewport di iPhone). Aspettare `document.documentElement.dataset.ready === '1'`.
- Regressione: mappa sonora on/off e i quattro modi; Play, direzione, cursore, frecce; calendario sotto/a/sopra 7 giorni e Reset; 3D spenti all'avvio; stile Toner/Nolli ricordato; le 17 voci di "Cosa mostrare"; "Colora i puntini per"; filtro spot; clic su un'area (scheda, grafici che cambiano con l'ora); popup della cella; errore di caricamento visibile.

## Prompt per la prossima sessione (interfaccia)
```
Riprendiamo CityRhythm, branch ui-redesign (pubblicato su Pages da `main`). Leggi
second-brain/SECOND_BRAIN.md e second-brain/interfaccia.md. Riassumimi in 3 righe dove siamo.

Regole di lavoro: italiano, spiegazioni semplici. Commit e push solo su richiesta. Unire su
`main` o `Music` solo col sì esplicito (su `main` si pubblica). Prima di modificare un file,
rileggilo. Sulla mappa mai isStyleLoaded() né l'attesa di 'idle'. La bussola legge il centro
della mappa: non spostarlo senza dirlo. Parametri sonori: ogni numero è [F], [S] o [H].
Prove: Playwright fuori dal repository, formati 1440×900, 1366×768, 390×844, 360×740 e
844×390, motori chromium e webkit, reducedMotion 'reduce'.
```
