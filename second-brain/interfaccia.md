# CityRhythm — Interfaccia

> Parte del second brain di CityRhythm: **indice in `SECOND_BRAIN.md`**, da leggere per primo. Questo file si legge quando il lavoro tocca l'interfaccia (pannelli, timeline, scheda, testi) e si aggiorna col comando `/second-brain`.

Ripinteggiatura del 2026-10-10 sul branch `ui-redesign` (da `Music`). Motivo: pannelli che si coprivano, colonna destra fissa, due lingue, stili sparsi. Files: `index.html`, `style.css`, `main.js`, `src/ui/*`.

## Decisioni valide
| Tema | Decisione |
|---|---|
| Layout desktop | **Mappa a tutto schermo.** Colonna a sinistra (296 px): **Livelli** in quattro gruppi a fisarmonica (Persone, Luoghi, Clima e celle, Mappa), che scorrono dentro la colonna; sotto, la **Mappa sonora**. La colonna finisce sopra la timeline: le sovrapposizioni non si producono. |
| Timeline | In basso al centro della mappa, massimo 640 px. Riga 1: Play, direzione, **etichetta del tempo**, pulsante **Periodo**. Riga 2: cursore. |
| Etichetta del tempo | Dichiara sempre il modo: "Settimana tipo · Lun 14:00" oppure la data vera ("sab 08/06 14:00"). |
| Periodo | Pannello con il calendario (Litepicker, `lang: 'it-IT'`), Reset "Tutto il periodo", frase su cosa cambia sotto 7 giorni. Il pulsante si attiva solo a dati caricati. |
| Soglia 7 giorni | **Una sola funzione**: `rangeDays` in `utils.js` (giorni estremi compresi), con `WEEK_TYPE_FROM_DAYS = 7`. Usata da timeline, scheda e colori dei puntini. |
| Scheda area | A destra (400 px), **solo con un'area selezionata**. × ed Esc la chiudono e deselezionano; il fuoco torna dove era. La mappa non si restringe. Titolo = nome dell'area. |
| Mirino | Al centro della mappa (`.crosshair`), visibile solo con la mappa sonora accesa (`audio.md`). |
| Mappa sonora | Scheda: interruttore a levetta (`role="switch"`, nome "Mappa sonora"), stato in parole con una frase, modi **IA · Classica · Metronomi · Sottotraccia** come pulsanti, "Dettagli" (persone, energia, piacevolezza, UTCI, cella, brano) in un `<details>`. Le frasi degli stati (`DESCRIZIONI` in `ui-compass.js`) le ha scritte l'agente: da leggere con l'utente. |
| Centro della mappa | Padding **simmetrico** in `fitMapToBounds`: la prima inquadratura non sposta il centro. Nessun padding persistente, nessun movimento di camera al clic: la cella letta dalla musica è quella sotto il mirino (`compass.js` legge `viewport.center`). |
| Crediti | Controllo MapLibre compatto in alto a destra (tasto "i"), **chiuso all'avvio**, con il testo completo (OSM, Protomaps, TUM, Meta, Mapterhorn, ISTAT/IPUMS/UCL: citazione obbligatoria). |
| Caricamento ed errori | Barra di stato in alto con il passo corrente; sparisce a fine caricamento. Errori in un messaggio `role="alert"`. Il sito segnala `document.documentElement.dataset.ready = '1'` a fine caricamento (lo usano le prove). |
| Telefono (sotto 720 px) | Livelli e Mappa sonora in fascia sopra la timeline; pulsante **Livelli** in alto a sinistra; scheda a tutto schermo con il resto della pagina `inert`. Campi a 16 px (iOS non ingrandisce). |
| Lingua | **Solo italiano**: interfaccia, popup, legende, date `it-IT` con fuso UTC, etichette MapLibre. Le sigle dei dati (UTCI, LCZ, SVF) restano, con una frase in italiano. |
| Aree KML e affollamento | Visibili **solo in modalità sviluppatore** (`DEBUG_MODE` in `config.js`), come prima. L'area KML resta sempre accesa e cliccabile: è lì che si apre la scheda. |
| Tecnologia | Vanilla JS, **nessun framework**, nessuna dipendenza nuova. Controlli nativi (`accent-color`, `details`/`summary`). |
| Browser | Obiettivo: **Chrome/Edge 110+, Safari 16.4+ (anche iOS), Firefox 115+**. Niente `:has()`, `color-mix()`, container queries. |
| Accessibilità | Focus visibile (`:focus-visible`), testo a contrasto ≥ 4,5:1, interruttori con nome, nessun `aria-live` sul tempo (cambia ogni 1,3 s durante il Play), `inert` sullo sfondo quando la scheda copre tutto. |
| Scorciatoie | Barra spaziatrice: avvia/ferma la timeline; frecce: un'ora. Solo a fuoco libero (o sul canvas per la barra), così non si scontrano con i comandi della mappa. |
| Pubblicazione | Il sito Pages si pubblica **solo da `main`** (`deploy.yml`). `ui-redesign` non è pubblicato: per vederlo dal telefono in locale, `npm run dev -- --host` sulla stessa rete Wi-Fi. |

## Stato (2026-10-10)
- Commit `7243afc` su `ui-redesign` (locale e su origin): ripinteggiatura completa. Non ancora unito a `Music`.
- **Verifiche**: build passa. Prove Playwright, 20–22 controlli funzionali per formato: Chromium desktop 21/21, Chromium telefono 22/22, WebKit (motore di Safari) desktop 21/21, WebKit telefono 22/22. Nessun errore in console. Sincronia dello slider con trascinamento veloce: verificata.
- **Non verificati**: Firefox (il suo eseguibile non si avvia nell'ambiente di prova), Safari reale, iPhone reale.
- Script di prova: fuori dal repository (cartella di lavoro della sessione), da ricreare con Playwright.

## Da decidere con l'utente
1. **Telefono con mappa sonora accesa**: la scheda (~264 px) copre il centro della mappa, dove sta il mirino (misurato: parte a 420 px su un telefono alto 844 px). Opzioni: (a) su telefono la Mappa sonora diventa una riga chiusa con il nome dello stato, **consigliata**; (b) il centro si sposta in alto con il padding, mirino compreso; (c) gesto per chiudere la scheda.
2. Desktop: la scheda area copre l'attribuzione OSM e, fra 1100 e 1400 px, il lato destro del pannello Periodo.
3. Telefono in orizzontale (844×390): si attiva il layout desktop e i livelli si schiacciano. Servirebbe `max-height` nel blocco telefono.
4. Telefono: un tocco su un quartiere con una cella LCZ sotto apre la scheda invece del popup della cella.
5. La nuvola degli "Interessi" si disegna in un riquadro troppo piccolo.
6. Numeri nella scheda con il punto ("2717.0"): formato italiano su tutti i `toFixed`.
7. Frasi degli stati della Mappa sonora (`DESCRIZIONI`): da rileggere.
8. Unione di `ui-redesign` in `Music` e poi in `main` (pubblicazione): solo con un sì esplicito.
9. "Notte" come interruttore dentro la Mappa sonora: slot previsto, decisione aperta (`sottotraccia.md`).

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

## Verifica (per la prossima volta)
- Build: `npm run build`.
- Prova automatica con Playwright (pacchetto fuori dal repository): `reducedMotion: 'reduce'` (i puntini restano fermi), formati 1440×900, 1366×768 e 390×844 (anche WebKit con viewport di iPhone). Aspettare `document.documentElement.dataset.ready === '1'`.
- Regressione: mappa sonora on/off e i quattro modi; Play, direzione, cursore, frecce; calendario sotto/a/sopra 7 giorni e Reset; 3D spenti all'avvio; stile Toner/Nolli ricordato; le 17 voci di "Cosa mostrare"; "Colora i puntini per"; filtro spot; clic su un'area (scheda, grafici che cambiano con l'ora); popup della cella; errore di caricamento visibile.
