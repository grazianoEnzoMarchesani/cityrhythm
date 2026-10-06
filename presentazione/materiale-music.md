# CityRhythm — branch `Music`: materiale per la presentazione

> Raccolta ordinata di **tutto** ciò che è stato fatto nel branch `Music`, ricavata dal second brain (`second-brain/*.md`) e dai 21 commit (`git log main..Music`). Non è ancora la presentazione: è la base da cui scriverla.
> Ogni funzione ha una scheda con: **in una frase** (pronta per una slide), **il problema**, **come funziona** (parole semplici), **numeri e fonti**, **cosa mostrare**, **stato**.
> Preparato il 2026-10-05 per la presentazione del 2026-10-06.
> **Il deck esiste**: https://claude.ai/artifact/8wMEfrXxCtVTpSJe34nZ55 (19 slide). Decisioni, scaletta reale e come raccontare ogni slide: `second-brain/presentazione.md`. Le sezioni 15 e 17 qui sotto sono la bozza di partenza, superata dal deck.

---

## Indice

0. [Il branch in numeri](#0-il-branch-in-numeri)
1. [Da dove partivamo e dove volevamo arrivare](#1-da-dove-partivamo-e-dove-volevamo-arrivare)
2. [Blocco A — Fondamenta: una piattaforma autosufficiente](#2-blocco-a--fondamenta-una-piattaforma-autosufficiente)
3. [Blocco B — Il nuovo volto della mappa](#3-blocco-b--il-nuovo-volto-della-mappa)
4. [Blocco C — Il clima cella per cella](#4-blocco-c--il-clima-cella-per-cella)
5. [Blocco D — Le persone](#5-blocco-d--le-persone)
6. [Blocco E — La bussola emotiva](#6-blocco-e--la-bussola-emotiva)
7. [Blocco F — La musica e i suoni della città](#7-blocco-f--la-musica-e-i-suoni-della-città)
8. [Blocco G — Il metodo di lavoro](#8-blocco-g--il-metodo-di-lavoro)
9. [Dati, fonti e licenze (slide dei crediti)](#9-dati-fonti-e-licenze-slide-dei-crediti)
10. [Limiti dichiarati](#10-limiti-dichiarati)
11. [Prossimi passi](#11-prossimi-passi)
12. [Storie di decisioni: "prima → dopo"](#12-storie-di-decisioni-prima--dopo)
13. [Copione per la demo dal vivo](#13-copione-per-la-demo-dal-vivo)
14. [Foglio dei numeri chiave](#14-foglio-dei-numeri-chiave)
15. [Proposta di scaletta](#15-proposta-di-scaletta)
16. [Cose da fare prima della presentazione](#16-cose-da-fare-prima-della-presentazione)
17. [Domande aperte per scrivere la presentazione](#17-domande-aperte-per-scrivere-la-presentazione)

---

## 0. Il branch in numeri

| Cosa | Valore |
|---|---|
| Periodo | 4–5 ottobre 2026, **16 sessioni** di lavoro |
| Commit | **21** (dal primo `b86d7eb` all'ultimo `d851338`) |
| File cambiati rispetto a `main` | **115** (+15.537 / −779 righe, dati testuali compresi) |
| Codice della piattaforma (`src/`, `index.html`, configurazione) | 26 file, **+2.656 / −693** righe |
| Nuove parti del codice | `src/audio/` (motore audio), `src/compass/` (bussola, clima, mappe orarie), `src/state/` (store), `home-share.js` (gente in casa), `presence-colors.js` (colori dei puntini), `ui-compass.js` (pannello della bussola) |
| Dati serviti dal sito | **23 MB** (mappa 14 MB, celle LCZ 7,3 MB, meteo, bussola) |
| Audio servito dal sito | **17 MB**: 10 brani + 6 suoni urbani (11 varianti) |
| Laboratorio sonoro (`sound-lab/`) | 13 script + una pagina di ascolto: analisi e preparazione audio, riferimento Python della bussola, catena del clima, estrazioni di dati, taratura, verifica |

---

## 1. Da dove partivamo e dove volevamo arrivare

### 1.1 CityRhythm prima del branch (su `main`)
- Dashboard geospaziale su affollamento, demografia, POI, LCZ/UHI, con timeline settimanale (168 ore), grafici ECharts nella barra laterale, filtri incrociati (clic su un grafico → colori dei puntini).
- **Mappa Mapbox** con stile di Mapbox Studio e **token** nel codice.
- Librerie caricate da **CDN** come variabili globali; dati su **GitHub Gist**; GPU.js caricato ma mai usato.
- LCZ da un CSV di **1.548 celle**, solo il centro; selettore a due voci (LCZ Types / UHI Risk).
- Puntini delle persone **rigenerati a caso a ogni ora**, brulichio con rumore di Perlin.
- Dati anche fuori Ascoli (Lucca, costa, San Benedetto, Pagliare).

### 1.2 L'obiettivo del branch
**In una frase:** aggiungere a CityRhythm una **mappa sonora**: una musica che cambia con la città e fa *sentire* come ci si sta, non solo vedere.

- Scopo **divulgativo**: la musica deve trasmettere **emozioni** che le immagini da sole non danno.
- Scelta di fondo: **niente sonificazione "il suono sale quando sale il dato"**. Densità e calore si vedono già sulla mappa; il suono aggiunge lo *stato d'animo* del luogo.
- Ambito: **solo il Comune di Ascoli Piceno**, **tutti i 246 giorni** di dati (1 giugno 2024 → 1 febbraio 2025), dal caldo estivo al freddo invernale.

### 1.3 La catena in una figura (utile come slide-mappa)
```
Dati reali (presenze, meteo, celle LCZ, edifici, diari ISTAT)
      ↓
Persone sulla mappa (puntini)      Clima di ogni cella (UTCI)
      ↓                                   ↓
  ENERGIA (quanta gente)          PIACEVOLEZZA (quanto si sta bene)
      └──────────────┬────────────────────┘
                     ↓
        BUSSOLA → uno di 9 stati d'animo (+ Notte)
                     ↓
        MUSICA (10 brani) + SUONI DELLA CITTÀ (6 effetti)
```

---

## 2. Blocco A — Fondamenta: una piattaforma autosufficiente

### A1. Vite, librerie locali, dati serviti dal sito
- **In una frase:** il sito ora contiene tutto ciò che gli serve: nessuna libreria, dato, tessera o token presi da servizi esterni.
- **Il problema:** librerie da CDN, dati su Gist e mappa Mapbox con token rendevano il sito dipendente da terzi (e il token era esposto).
- **Come funziona:** progetto **Vite 8** (`npm run dev` / `npm run build` → cartella `dist/`); librerie da `node_modules` con versioni esatte in `package.json`; dati in `public/data/`, audio in `public/audio/`. Verificato sulla build: nessuna richiesta esterna.
- **Pubblicazione:** **GitHub Pages** con GitHub Actions (`.github/workflows/deploy.yml`), build a ogni push su `main`, nessun token da configurare.
- **Cosa mostrare:** nulla di visivo; una slide "prima/dopo" (CDN + Gist + token → tutto locale).
- **Stato:** fatto.

### A2. Store centrale e intercambiabilità
- **In una frase:** le parti dell'applicazione (timeline, mappa, bussola, audio) si parlano tramite un'unica "bacheca" condivisa, così ognuna si può sostituire senza toccare le altre.
- **Come funziona:** `src/state/store.js`, compatibile con gli store di Svelte (e con React tramite `useSyncExternalStore`). Contiene: ora corrente (`time`), inquadratura (`viewport`), audio acceso (`audioEnabled`), stato della bussola (`mood`), persone fuori casa (`presence`), mappa delle celle (`cellMap`). Ogni voce ha **un solo scrittore**.
- ECharts si importa solo in `src/charts/charts.js`: la libreria dei grafici si può cambiare in un punto solo.
- **Analogia:** come una bacheca in ufficio: la timeline appende l'ora, la bussola appende lo stato d'animo, il motore audio legge e suona. Nessuno entra nell'ufficio dell'altro.
- **Stato:** fatto; Svelte/React/Vue aggiungibili con un plugin in `vite.config.js`.

### A3. Da Mapbox a MapLibre + PMTiles
- **In una frase:** mappa open source con tessere locali: niente più account, token o costi Mapbox.
- **Come funziona:** **MapLibre GL 6.12**; base **Protomaps** (OpenStreetMap) in un file PMTiles locale (riquadro 13,41–13,75 E, 42,77–42,94 N, zoom ≤ 15, 5,2 MB); terreno **Mapterhorn** (4,7 MB, zoom ≤ 12); edifici **GlobalBuildingAtlas del TUM** (11.341 edifici, 3,7 MB).
- **Edifici TUM vs OSM:** confrontati dall'utente → TUM "senza ombra di dubbio meglio" (OSM: altezze spesso mancanti). Scaricati **una volta** dal rilascio ufficiale e ritagliati sul Comune (mai il servizio WFS: gli autori ne vietano lo scaricamento automatico). Licenza CC BY-NC 4.0: **solo uso non commerciale**.
- **Stato:** fatto. Da fare a mano: revocare i vecchi token Mapbox sul sito di Mapbox.

### A4. Regola "solo Comune di Ascoli Piceno"
- **In una frase:** tutti i dati sono ritagliati sul confine ufficiale del Comune (OpenStreetMap, relazione 42176).
- **Cosa è cambiato:** cancellati i dati di Lucca, costa, San Benedetto, Pagliare; ogni nuovo ritaglio usa `sound-lab/data/comune_ascoli.geojson`.
- **Stato:** regola permanente.

### A5. Timeline: giorni veri e settimana tipo
- **In una frase:** la timeline mostra i giorni veri del calendario quando l'intervallo è breve, e una "settimana tipo" quando è lungo.
- **Come funziona:** intervallo **< 7 giorni** → giorni reali con le date; **≥ 7 giorni** (anche all'avvio) → settimana tipo di 168 ore, media dei soli giorni dell'intervallo con quel giorno della settimana.
- **Errore corretto:** la posizione della timeline veniva letta come settimana tipo anche con giorni veri: **il 15 agosto diventava "lunedì"**. Ora c'è un solo modo di leggerla.
- **Stato:** fatto.

---

## 3. Blocco B — Il nuovo volto della mappa

### B1. Stile Toner, mappa "muta"
- **In una frase:** una mappa in bianco e nero, senza scritte, che fa da tela neutra per dati, colori e musica.
- **Come funziona:** ricreato lo stile **Toner** (Stamen/MapTiler) sulle tessere Protomaps con una tavolozza propria: bianco, acqua/strade/confini neri, **nessuna etichetta né icona** (restano solo i nomi degli Spot). Verde nero con le **trame originali**: boschi a puntini, cimiteri a crocette, resto a trattini.
- **Giudizio dell'utente:** "mi piace tantissimo".
- **Cosa mostrare:** confronto prima (stile Mapbox colorato con etichette) / dopo (Toner).
- **Stato:** fatto; da verificare a occhio la resa del verde nero a vari zoom e la leggibilità delle scale chiare sul bianco.

### B2. Edifici bianchi in 3D e terreno
- **In una frase:** edifici bianchi estrusi con un contorno nero a terra, terreno in rilievo inclinando la camera.
- **Come funziona:** edifici TUM con la loro altezza, bianchi senza tratteggio, contorno nero per non sparire dall'alto. **3D Buildings e 3D Terrain spenti all'avvio**; la mappa segue sempre la casella, anche al ricaricamento.
- **Errore corretto:** il browser ricordava la casella vuota mentre gli edifici restavano in 3D.
- **Stato:** fatto.

---

## 4. Blocco C — Il clima cella per cella

### C1. Celle LCZ da 30 metri
- **In una frase:** la città divisa in **12.496 quadrati da 30 m**, ognuno con la sua "carta d'identità" climatica.
- **Il problema:** prima solo 1.548 celle del centro, da un CSV; le medie per quartiere "omogeneizzavano tutto".
- **Come funziona:** celle native dal progetto QGIS (`lcz_grid_30m_lcz_params.gpkg`), **sempre vettoriali, mai raggruppate**, ritagliate sul rettangolo dei quartieri (+150 m) dentro il Comune. **Tutti gli 11 quartieri coperti al 100%**; il 65% delle celle è fuori dai quartieri.
- **Popup al clic:** classe LCZ in italiano, rischio isola di calore, accordo della classificazione, SVF, H/W, % edificata/impermeabile/permeabile, altezza, rugosità, z0, ammettenza, albedo, calore antropico e industriale.
- **Stato:** fatto.

### C2. Menu "Show": 15 mappe delle celle (+ 2 orarie)
- **In una frase:** un menu per guardare la città attraverso ognuno dei suoi parametri fisici.
- **Contenuto del menu** (sotto "LCZ Vitality"):
  - *Hour by hour (sound compass)*: **UTCI heat stress (estimate)**, **Sound map** → vedi E5.
  - *Classification*: LCZ types, UHI risk, Classification agreement.
  - *Shape of the city*: Sky view factor, Street canyon (H/W), Height of buildings and trees.
  - *Ground cover*: Built surface, Sealed surface, Permeable surface.
  - *Heat*: Albedo, Thermal admittance, Human-made heat, Industrial heat.
  - *Wind*: Roughness class, Roughness length z0.
- **Come funziona:** scale continue con tinte che **non compaiono** in LCZ e UHI (blu notte, ciano, turchese, viola, lavanda, magenta, ardesia), soglie sui percentili 5–95, legenda per ogni mappa, opacità regolabile (70% di base).
- **Giudizio dell'utente:** "molto bene".
- **Stato:** fatto.

### C3. Il meteo
- **In una frase:** il tempo vero di Ascoli, ora per ora, per tutto il periodo dei dati.
- **Fonte:** **Open-Meteo** (archivio), 5.904 ore, 1 giugno 2024 → 1 febbraio 2025, fuso Europe/Rome: temperatura, percepita, umidità, radiazione globale, diretta, diffusa e DNI, nuvole, vento, pioggia. Scaricato una volta e servito dal sito.
- **Stato:** fatto.

### C4. UTCI: quanto si sta bene in strada, cella per cella
- **In una frase:** per ogni cella e ogni ora stimiamo la **temperatura che sente una persona in piedi in strada**, con sole, ombra, vento e umidità.
- **Il problema:** la prima formula ("percepita + 4 °C al sole − 2 °C nel verde…") era fatta di **"numeri a caso"** secondo l'utente → sostituita da fisica pubblicata.
- **Analogia:** l'UTCI è come la "temperatura percepita" del meteo, ma calcolata per un pedone in quella precisa strada: al sole o all'ombra, al riparo o nel vento, e tenendo conto di come ci si veste in quella stagione.
- **La catena in 4 passi** (ogni passo con la sua fonte):
  1. **Aria**: Open-Meteo + **isola di calore notturna** solo nelle celle costruite (LCZ 1–10), dalla forma della strada (SVF), con un tetto di ≈ 5,3 °C per città europee da 46.000 abitanti, ridotta dal vento e dalle nuvole (**Oke 1973, 1981**).
  2. **Temperatura media radiante** (quanto calore ci arriva da sole, cielo, suolo e muri): sole diretto × quota di strada al sole, diffuso × cielo visibile, riflesso dal suolo con l'albedo della cella, infrarosso del cielo (RayMan/VDI 3787, Jendritzky, Brutsaert, Crawford & Duchon).
  3. **Vento** a 10 m riportato all'altezza di una persona con la rugosità della cella (Wieringa/WMO).
  4. **UTCI** col polinomio ufficiale (**Bröde 2012**, 211 termini estratti da pythermalcomfort).
- **Nel pannello:** "UTCI ≈ 35 °C · stress da caldo forte (stima)".
- **Verifica:** il codice del sito (JavaScript) e il riferimento Python danno lo stesso stato in **220 casi su 220**, UTCI entro 0,17 °C.
- **Velocità:** polinomio riscritto con potenze precalcolate: **~30 volte più veloce**, stesso risultato. Tutte le celle in 0,15 s per un'ora vera.
- **Stato:** fatto; limiti nella sezione 10.

### C5. Gli alberi: analizzati, nessun cambio
- **In una frase:** abbiamo controllato se l'ombra degli alberi cambiava i risultati: no, ed è già contata.
- **Analisi:** copertura arborea Copernicus + altezza delle chiome ETH + terreno, a 2 m. Nelle celle dove sta la gente l'**88% non ha chiome**; togliere il sole sotto le chiome abbasserebbe l'UTCI di 0 °C lì e di ~1 °C (max 4) nel verde, **contando due volte** (le chiome sono già nel modello del cielo visibile). **Nessun cambio di stato.**
- **Decisione dell'utente:** "lascia tutto così".
- **Utile per la presentazione:** esempio di scelta *verificata e scartata* con i dati.

---

## 5. Blocco D — Le persone

### D1. Puntini con un'identità stabile
- **In una frase:** ogni puntino è una persona che si ricorda dove era l'ora prima e si sposta in modo credibile.
- **Il problema:** prima i puntini si rigeneravano a caso a ogni ora; col Play si ammassavano tutti al centro.
- **Come funziona:** a ogni cambio d'ora: 1) dentro il quartiere chi è in più va allo spot vicino che cresce; 2) **fra quartieri**: chi è in più dove ci si svuota va allo spot più vicino dove ci si riempie; 3) solo il resto **entra da fuori città** o **esce** (appare/sfuma 600 m oltre, in direzione opposta al centro). Animazione di 1 s; Play a **1,3 s per ora**. Rispetta l'impostazione "riduci movimento".
- **Con giorni veri:** i puntini usano il dato di **quel giorno**.
- **Stato:** fatto; da verificare a occhio i flussi e i 600 m.

### D2. Il movimento "a formichine"
- **In una frase:** i puntini brulicano attorno al loro posto e partono in tempi diversi, con percorsi curvi, così si *vede* la città svuotarsi e riempirsi.
- **Come funziona:** brulichio continuo (~3 pixel, ritmo proprio per persona; chi è a casa resta fermo); nei cambi d'ora **partenze sfalsate** (fino al 40% dell'animazione) e **percorsi curvi** (deviazione ≤ 60 m e ≤ 20% della distanza).
- **Giudizio dell'utente:** "fantastico".
- **Stato:** fatto.

### D3. Gente "in giro" solo dove si cammina
- **In una frase:** chi gira per il quartiere sta su strade ed edifici, mai nel fiume o nei prati.
- **Come funziona:** il 10% di ogni quartiere "in giro" è messo solo su celle LCZ **costruite (1–10) o pavimentate (E)**; mai acqua, boschi, prati. Gli spot reali in celle verdi (110 su 1.186) restano.
- **Origine:** osservazione dell'utente ("improbabile che ci sia gente al fiume").
- **Stato:** fatto.

### D4. Synthetic Crowded Points con "maestri" fissi
- **In una frase:** per stimare quanto è affollato uno dei 1.186 spot, lo si confronta con 5 luoghi reali simili e vicini, sempre gli stessi.
- **Il problema:** prima uno spot copiava dai luoghi aperti in quell'ora anche a ~1 km: di notte restava "aperto" il 66% degli spot.
- **Come funziona:** ogni spot ha **5 maestri fissi** fra gli 87 luoghi reali (etichette simili, vicini); un maestro chiuso conta 0.
- **Esito:** alle 3 di notte di sabato gli spot attivi scendono da 784 a ~460; fra mattina e sera cambia posto il **25–28%** delle persone (prima 15%).
- **Stato:** fatto; resta una stima (87 luoghi per 1.186 spot).

### D5. "Color dots by": colorare tutta la città
- **In una frase:** un pulsante colora i puntini di tutti i quartieri per genere, età, nazionalità o visite, con le percentuali vere di ogni quartiere.
- **Il problema:** prima i colori venivano solo dal clic sui grafici, solo per il quartiere selezionato, e si perdevano al cambio d'ora.
- **Come funziona:** pulsanti **Off · Gender · Age · Nationality · Visits** + legenda; ogni persona ha un posto fisso in una "fila" del quartiere, quindi **tiene il colore cambiando ora** (in prova 189 su 195). Il clic sui grafici accende il pulsante corrispondente.
- **Cosa mostrare:** Gender in una piazza affollata; poi Play.
- **Stato:** fatto.

### D6. Chi sta a casa: diari ISTAT e residenti Meta
- **In una frase:** a ogni ora una parte delle persone è in casa, secondo come vivono davvero gli italiani, e va a casa negli edifici dove abitano davvero.
- **Il problema:** prima "di notte il 95% a casa", con rampe scelte a mano e nessuno a casa di giorno; le case erano scelte per volume, così **i capannoni attiravano famiglie**.
- **Come funziona (3 ingredienti):**
  1. **Curva ISTAT** "quota di persone in casa" per giorno della settimana e ora, dai diari **ISTAT Uso del tempo 2008-09** (40.939 diari, via IPUMS MTUS). Feriali: 3:00 98%, 8:00 50%, 11:00 31%, 13:00 57%, 17:00 45%, 21:00 85%, 0:00 95%.
  2. **Residenti Meta** (HRSL 2020, quadratini da ~30 m): **47.076 residenti** nel Comune (ISTAT: ~46–47 mila), assegnati agli edifici TUM. 2.487 edifici su 11.341 senza residenti (capannoni, chiese, scuole).
  3. **Regola "prudente"**: residenti visti dai dati = presenze notturne ÷ quota ISTAT a quell'ora; a casa = il minimo fra presenti e residenti × quota ISTAT.
- **Perché "prudente":** di notte i dati vedono solo il **6–15% dei residenti**, ma ne seguono la distribuzione (correlazione **0,96**): i dati sono un *campione* che vede soprattutto chi è attivo. Applicare la curva a tutti spegnerebbe le serate estive che i dati mostrano piene.
- **Esito (tutta la città, martedì):** 3:00 100% a casa, 7:00 11%, 11:00 4%, 13:00 8%, 17:00 5%, 21:00 22%, 23:00 41%, 0:00 36%.
- **Sulla mappa:** puntini in casa al **50% di opacità**, neri da vicino; si attenuano solo nell'ultimo tratto verso casa. Giudizio dell'utente: "effetto bellissimo" (da lontano).
- **Stato:** fatto; **da verificare a schermo** (rientro dalle 19, mezzanotte, sabato notte).

### D7. Prestazioni dei puntini
- **In una frase:** lo stesso brulichio, con il computer che lavora fino al 90% in meno.
- **Il problema:** rispedire ogni puntino (4–10 mila) alla mappa ~30 volte al secondo teneva **2 core** occupati; il computer si rallentava.
- **Come funziona:** i puntini con lo stesso aspetto viaggiano a gruppi (**32 strati**, ordine dei colori alternato così nessun colore copre gli altri); da fermi si ridisegna solo quando un puntino si è mosso di **1 pixel** reale.
- **Esito misurato (M3):** da fermi **worker −90%, pagina −71%, GPU −68%**; durante il Play worker −57%, pagina −40%, nessuno scatto oltre 50 ms. Conteggi, colori e ordine verificati uguali a prima.
- **Errore collegato corretto:** col brulichio la mappa non era mai "ferma", così il menu Show, LCZ/UHI e gli interruttori 3D smettevano di funzionare → ora si aspetta solo il primo caricamento.
- **Stato:** fatto.

---

## 6. Blocco E — La bussola emotiva

### E1. Il modello: due assi, nove stati
- **In una frase:** ogni luogo, a ogni ora, ha uno stato d'animo deciso da due domande: *quanta vita c'è intorno?* e *quanto ci si sta bene?*
- **Fonte:** **circomplesso di Russell** (modello delle emozioni a due assi: attivazione e piacevolezza).
- **Gli assi:** **Energia (X)** = persone in giro; **Piacevolezza (Y)** = comfort climatico + verde − pioggia. Soglie a ±1/3 → griglia 3×3.

|  | poca gente | gente media | tanta gente |
|---|---|---|---|
| **Sereno** | Rifugio | Passeggiata | Festa |
| **Neutro** | Attesa | Routine | Corrente |
| **Opprimente** | Afa | Fatica | Calca |

- **Più la Notte:** brano Notte + grilli solo se il sole è sotto −6° (dopo il crepuscolo civile) **e** c'è poca gente. Le sere affollate restano Festa/Corrente/Calca (a dicembre alle 17 il Centro è pieno).
- **Per cella, non per quartiere:** conta la cella **al centro della mappa** (mirino + contorno nero). Niente medie per quartiere.

### E2. Energia: le persone entro 50 metri
- **In una frase:** l'energia di una cella è quanta gente fuori casa c'è entro 50 m, contata dai puntini della mappa.
- **Idea dell'utente:** "le persone le abbiamo distribuite noi" → si usano gli stessi puntini che si vedono. Chi è in casa non conta.
- **Taratura:** scala logaritmica dai percentili 10°/90° delle ore di luce: da 156 a 13.623 persone/km². Rifatta in automatico con `taratura_energia.mjs`.
- **Prima:** energia = densità del quartiere → la mappa sonora era fatta di **blocchi uguali per quartiere**.

### E3. Piacevolezza: clima, verde, pioggia
- **Formula:** `0,75 × comfort + 0,25 × verde − 0,3 se piove (> 0,5 mm)`.
- **Comfort dall'UTCI:** +1 senza stress (9–26 °C), −1 dove inizia lo stress forte (32 °C caldo, −13 °C freddo), lineare in mezzo.
- **Verde come "bellezza":** superficie permeabile della cella; **scelta espressiva dell'utente, non fisica** (va detto).

### E4. Settimana tipo: una giornata calda
- **In una frase:** con un intervallo lungo, ogni cella usa il meteo di "una giornata calda per quel giorno della settimana, superata solo 1 volta su 10".
- **Il problema:** con lo stato più frequente o la piacevolezza fissa vincevano sempre i giorni miti ("quasi sempre Festa").
- **Come funziona:** 90° percentile dell'UTCI; il pannello dice quale giorno è stato scelto. Su tutto il periodo cade sempre a luglio.

### E5. Le mappe orarie: "UTCI heat stress" e "Sound map"
- **In una frase:** due mappe che mostrano, ora per ora, il caldo percepito di ogni cella e lo stato d'animo musicale di ogni cella.
- **UTCI heat stress:** sfumatura **continua** (blu −13 °C → azzurro 0 → verde 9–17,5 → giallo 26 → arancio 32 → rosso 38 → rosso scuro 46 °C).
- **Sound map:** colori **netti** per stato (sereni verde-azzurro, neutri grigio-viola, opprimenti arancio-rosso, più scuri con più gente; Notte blu notte), legenda a mini-bussola 3×3.
- **Popup:** UTCI, stato e persone dell'ora. Funzionano anche ad audio spento.
- **Giudizio dell'utente:** "molto bello".
- **Cosa mostrare:** è il cuore visivo della demo: Play sulla Sound map d'estate, la città che passa da verde (mattina) a rosso (mezzogiorno) a blu (notte).

### E6. Il pannello della bussola (cosa si vede)
Ad audio acceso, in basso a sinistra:
```
Bussola: Calca  → Fatica?
Energia +0.52 · Piacevolezza −0.61
≈ 240 persone in giro entro 50 m
UTCI ≈ 35 °C · stress da caldo forte (stima)
Cella 1234 (LCZ 2) · Centro
```
(valori d'esempio; in settimana tipo aggiunge il giorno scelto). Fuori dalle celle: *"Il centro della mappa è fuori dalle celle LCZ: silenzio."*

### E7. Come si distribuiscono gli stati (risultato)
Celle nei quartieri, su tutte le ore (calcolo di riferimento, ancora con l'energia per quartiere): **Notte 32%**, Festa 25%, Passeggiata 13%, Calca 8%, Rifugio 6%, Corrente 6%, Fatica 5%, Routine 3%, Afa 1,5%, Attesa 0,7%.
- **Estate:** a mezzogiorno Fatica/Calca (Centro, UTCI mediana ~35 °C); mattina e sera Passeggiata/Festa.
- **Settembre–ottobre:** sereni. **Inverno:** di giorno sereno (l'UTCI tiene conto dei vestiti), notti Notte → per ora non servono brani invernali.

---

## 7. Blocco F — La musica e i suoni della città

### F1. Strategia: musica adattiva pre-generata
- **In una frase:** dieci brani, uno per stato d'animo, che sfumano l'uno nell'altro mentre ti muovi nella città e nel tempo, con sopra i suoni della città.
- **Analogia:** come la colonna sonora di un videogioco che cambia quando entri in una zona diversa.
- **Nome interno:** strategia **S2** (un brano principale alla volta + un livello di suoni urbani).

### F2. I dieci brani
- **Generati con** finetuning.ai (piano Plus, a mano): scheda *Instrumental*, nessuno stile, nessun tag, *Enhance prompt* spento, 2 minuti, seed fisso. Prompt in inglese (in `second-brain/prompts.md`).
- **Coerenza:** tutti in **re** (maggiore per i sereni, minore per gli opprimenti), stile ambient-cinematografico, stessa "coda" in ogni prompt ("loop senza inizio né fine, energia costante").
- **Analogia per la tonalità:** tutti i brani "parlano la stessa lingua", così passare dall'uno all'altro non stona; il maggiore suona luminoso, il minore cupo.

| Stato | Carattere (dal prompt) | Tonalità, tempo |
|---|---|---|
| Rifugio | mattina in un parco all'ombra: calmo, sicuro; piano ovattato, archi caldi | re magg., 70 BPM, senza batteria |
| Passeggiata | passeggiata in un viale alberato: rilassato, ottimista; piano, chitarra pizzicata | re magg., 90 BPM |
| Festa | sera d'estate in una piazza piena ma ventilata: gioioso, conviviale | re magg., ~117 BPM |
| Attesa | strade vuote, sospese: contemplativo, in attesa | re min., 70 BPM, senza batteria |
| Routine | ritmo quotidiano di una piccola città: regolare, mai frettoloso; marimba | re magg., 96 BPM |
| Corrente | flusso urbano in ogni direzione: energico, irrequieto | re magg., ~117 BPM |
| Afa | strade deserte sotto il sole di mezzogiorno: immobile, opprimente | re (fra magg. e min.), 60 BPM |
| Fatica | gente che cammina lenta nel caldo: pesante, stanca | re min., 81 BPM |
| Calca | folla stretta in un'isola di calore: teso, soffocante, tensione che non si risolve | re min., 110 BPM |
| Notte | notte d'estate in una città che dorme: tenero, sognante; piano solo | re magg., 65 BPM, senza batteria |

- **Post-produzione:** taglio delle sfumature, loop "sulla battuta" con dissolvenza incrociata di 2 s, volume uniforme a **−18 LUFS** (il volume percepito, misurato come fanno le piattaforme di streaming), picco ≤ −1 dBFS, MP3 160k.
- **Giudizio dell'utente:** i brani "suonano parenti".
- **Lezione appresa:** il pannello *Advanced* di finetuning.ai suonava "a un solo strumento" → si è tornati a *Instrumental*.

### F3. I suoni della città
- **In una frase:** sei suoni urbani che si sovrappongono alla musica: folla leggera, folla densa, traffico, parco, cicale, grilli.
- **Legame previsto con la città:** folla ↔ persone, traffico ↔ città, parco ↔ verde, cicale ↔ caldo, grilli ↔ notte. Oggi la loro presenza viene da **scene fisse per stato**; legarli ai dati di ogni cella è il prossimo passo.
- **Varianti:** folla leggera 4, folla densa 2, traffico 2, parco 1, cicale 1, grilli 1 (11 file).
- **Riproduzione:** niente loop "cucito": ogni suono **alterna a caso le sue varianti** (mai la stessa due volte di fila), con dissolvenza incrociata e velocità che varia di ±4% → meno ripetitivo.
- **Post-produzione:** −20 LUFS, micro-dissolvenze di 50 ms, limitatore sui picchi.

### F4. Il mix calcolato
- **In una frase:** i volumi non sono scelti "a orecchio", ma calcolati: ogni suono ha un tetto sotto la musica.
- **Regola:** volume = musica (−18 LUFS) − tetto + 20·log10(presenza 0–1).
- **Tetti sotto la musica:** folla densa 9 dB, grilli 11, folla leggera 12, parco 13, cicale 14, traffico 15. Somma degli effetti per scena 8–14 dB sotto la musica (Attesa ≈ 20).
- **Analogia:** la musica è la voce principale; i suoni della città sono il pubblico in sala: si sentono, ma non la coprono mai.
- **Giudizio dell'utente:** "per ora suona bene".

### F5. Il motore audio e il suo comportamento
- **In una frase:** un pulsante "Attiva mappa sonora"; la musica segue il mirino al centro della mappa e l'ora della timeline.
- **Come funziona:**
  - parte subito il brano dello stato attuale, gli altri si caricano in sottofondo; spegnendo, sfuma in 1 s;
  - **isteresi 1 s**: un nuovo stato deve durare 1 s prima di cambiare musica (evita cambi nervosi passando sopra una cella);
  - **dissolvenza 1 s a potenza costante**: come un DJ che abbassa un disco mentre alza l'altro, senza "buco" di volume;
  - tutto sincronizzato con puntini e timeline (col Play un'ora dura 1,3 s);
  - centro della mappa **fuori dalle celle → silenzio**.
- **Prima:** isteresi 2 s e dissolvenza 3 s → col Play la musica **non cambiava mai**.
- **Stato:** funziona ("funziona" sulla mappa); **l'ascolto sopra la mappa non è ancora stato giudicato** (vedi sezione 16).

### F6. Il laboratorio sonoro (`sound-lab/`)
- **Pagina di ascolto** separata: bussola 3×3 cliccabile, pulsante Notte, 6 cursori dei suoni urbani, casella "Mix calcolato per stato". Utile come **piano B** per la demo.
- **Strumenti:** analisi dei brani (volume, tempo, tonalità), preparazione dei loop e degli effetti, riferimento Python della bussola, catena del clima, estrazione di celle LCZ, edifici, residenti e curva in casa, taratura dell'energia, verifica JS ↔ Python.

---

## 8. Blocco G — Il metodo di lavoro

### G1. "Niente numeri a caso"
- **In una frase:** ogni parametro viene da dati o da letteratura con la fonte dichiarata; se una fonte non c'è, lo si dice e si sceglie insieme.
- **Esempi:** la formula del clima "a occhio" sostituita dall'UTCI; il "95% a casa di notte" sostituito dalla curva ISTAT; i volumi a orecchio sostituiti dal mix calcolato; l'energia tarata sui percentili dei dati.

### G2. Il second brain e il lavoro con gli agenti AI
- **In una frase:** una memoria condivisa del progetto, che ogni sessione di lavoro con l'AI legge all'inizio e aggiorna alla fine.
- **Struttura:** un indice (`SECOND_BRAIN.md`: progetto, regole, prossimi passi, diario) + file per argomento (bussola e clima, audio, mappa, persone, strumenti, prompt) + un file di **decisioni superate** col loro perché, per non riaprirle senza un motivo nuovo. Comando `/second-brain` a fine sessione.
- **Divisione dei ruoli:** l'autore decide e giudica (a occhio e a orecchio, senza competenze musicali); l'agente traduce i giudizi in numeri, spiega le scelte sonore con analogie e verifica (screenshot e misure con Chrome senza finestra).
- **Utile per la presentazione:** 16 sessioni in 2 giorni senza perdere il filo.

### G3. Verifiche
- Bussola JS ↔ Python: 220/220 stati.
- UTCI: prova sul valore della documentazione ufficiale (24,6 °C).
- Prestazioni misurate sulla GPU vera dell'M3 (sezione D7).
- Residenti Meta confrontati col dato ISTAT (47.076 vs ~46–47 mila).

---

## 9. Dati, fonti e licenze (slide dei crediti)

### Dati
| Dati | Periodo | Fonte / licenza |
|---|---|---|
| Presenze nei quartieri (11 quartieri, orarie) | 1/6/2024 → 1/2/2025, 246 giorni | dati CityRhythm |
| Affollamento luoghi (87 punti) | settimana tipo 168 h | dati CityRhythm |
| Spot (1.186 punti) | statici | dati CityRhythm |
| Celle LCZ (12.496 da 30 m) | statiche | progetto QGIS |
| Meteo orario | 5.904 ore | Open-Meteo |
| Mappa di base | — | © OpenStreetMap, Protomaps |
| Stile | — | Toner (Stamen/MapTiler), sprite con licenza BSD |
| Edifici (11.341) | — | GlobalBuildingAtlas, TUM — CC BY-NC 4.0, solo uso non commerciale |
| Terreno | — | Mapterhorn |
| Residenti (47.076) | 2020 | Meta HRSL — CC BY 4.0 |
| Quota in casa (7 giorni × 24 ore) | diari 2008-09 | ISTAT Uso del tempo via IPUMS MTUS (solo la curva aggregata) |

### Letteratura usata
Russell (circomplesso delle emozioni); Oke 1973 e 1981 (isola di calore); RayMan / VDI 3787 e Jendritzky (temperatura radiante); Brutsaert, Crawford & Duchon (infrarosso del cielo); Wieringa / WMO (vento e rugosità); Bröde et al. 2012 (UTCI) tramite pythermalcomfort.

### Citazioni obbligatorie (da mettere nella slide dei crediti)
- *Kimberly Fisher, Jonathan Gershuny, Sarah M. Flood, Juana Lamote, Liana C. Sayer, Daniel Backman, Etienne Breton, and Stephanie Richards. Multinational Time Use Study Extract System: Version 1.5 [dataset]. Minneapolis, MN: IPUMS, 2025. https://doi.org/10.18128/D062.V1.5*
- *"This document uses the Multinational Time Use Study, Centre for Time Use Research, University College London 2019, http://www.timeuse.org/mtus/reference.html"*

### Regole etiche e di licenza (anche questo è un contenuto da mostrare)
- Microdati **solo in locale**, mai su GitHub; nel sito solo la curva aggregata (168 valori, ognuno da ≥ 2.761 diari; la licenza vieta risultati da meno di 30 casi).
- Edifici TUM: solo uso non commerciale.

---

## 10. Limiti dichiarati

Da dire apertamente (rafforza la credibilità):
- **Il clima è una stima per confrontare celle, non un termometro.** Meteo unico per tutta la città; isola di calore da formule di letteratura, non tarata su misure di Ascoli; ombra stimata dalla forma della strada, non edificio per edificio; suolo e muri alla temperatura dell'aria (la pietra rovente al sole non è contata → caldo in pieno sole sottostimato); un bosco è trattato come una strada stretta.
- **Il verde nella piacevolezza** è una scelta espressiva, non fisica.
- **Le presenze sono un campione** (di notte vedono il 6–15% dei residenti): la gente in casa è stimata con la regola prudente.
- **Synthetic Crowded Points:** 87 luoghi reali per 1.186 spot; 27 etichette generiche.
- **Altezze degli edifici** stimate da satellite (centro: mediana ~6,7 m, forse sottostimate).
- **Diari ISTAT del 2008-09**: abitudini di oltre 15 anni fa, nazionali, senza distinzione estate/inverno.
- **Suoni urbani:** presenza ancora da scene fisse per stato, non dai dati della cella.
- **Distribuzione degli stati** (sezione E7) calcolata con l'energia per quartiere, non ancora per cella.

---

## 11. Prossimi passi

1. **Ascolto sopra la mappa** con la Sound map accesa: giudicare volumi, velocità dei cambi, musica che cambia spostando il mirino di 50–100 m.
2. **Suoni urbani guidati dai dati:** folla dalle persone, parco dal verde, cicale dall'UTCI, grilli dalla notte, sempre con mix calcolato.
3. Verifiche a occhio: raggio di 50 m, leggibilità delle mappe orarie, stile Toner a vari zoom, flussi dei puntini, gente in casa a mezzanotte.
4. **Clima più preciso** (facoltativo): SOLWEIG (QGIS/UMEP) per ombre vere e suolo caldo, oppure taratura con stazioni meteo in città.
5. Curva in casa estate/inverno; smart working dai dati ISTAT 2023.
6. Crediti della mappa compatti (oggi troppo lunghi).
7. Unione su `main` e pubblicazione su GitHub Pages; aggiornamento della bibliografia IPUMS e copia al CTUR (UCL) quando si pubblica.

---

## 12. Storie di decisioni: "prima → dopo"

Ottime per mostrare un percorso critico, non lineare. Ognuna è una mini-storia: *problema osservato → causa → soluzione*.

| Prima | Cosa non andava | Dopo |
|---|---|---|
| Formula del clima "a occhio" (+4 °C al sole, −2 °C nel verde…) | "numeri a caso" | UTCI con fisica e fasce ufficiali |
| Comfort con soglie di temperatura dell'aria | **l'inverno finiva tutto in Calca/Fatica** (brani "di caldo") | UTCI: d'inverno sereno, perché tiene conto dei vestiti |
| Notte = sole tramontato | **a dicembre alle 17 il Centro è pieno** | Notte solo se è buio **e** c'è poca gente |
| Bussola sulla media del quartiere | "si omogeneizza tutto troppo" | bussola per cella al centro della mappa |
| Energia = densità del quartiere | mappa sonora a blocchi uguali | gente entro 50 m dai puntini |
| Settimana tipo: stato più frequente | "quasi sempre Festa" | giornata al 90° percentile dell'UTCI |
| Puntini rigenerati a caso a ogni ora | col Play tutti ammassati al centro | identità stabili e spostamenti animati |
| Gente "in giro" in un punto a caso | finiva sul Tronto e nei prati | solo celle costruite o pavimentate |
| 95% a casa di notte, nessuno di giorno, case per volume | i capannoni attiravano famiglie; mezzanotte vuota | curva ISTAT + residenti Meta + regola prudente |
| Isteresi 2 s, dissolvenza 3 s | col Play la musica non cambiava mai | 1 s e 1 s a potenza costante |
| Fuori dalle celle: brano neutro | musica senza dati dietro | silenzio |
| Ombra degli alberi aggiunta al clima | effetto piccolo e contato due volte | analizzata e scartata |
| Mapbox con token | dipendenza esterna, token esposto | MapLibre + tessere locali |
| Brulichio ridisegnato 30 volte/s per ogni puntino | 2 core sempre occupati | gruppi a 32 strati, ridisegno a passi di 1 pixel |
| finetuning.ai *Advanced* | suonava "a un solo strumento" | *Instrumental* con prompt descrittivi |

---

## 13. Copione per la demo dal vivo

> ⚠️ Il branch `Music` **non è sul sito pubblico** (Pages pubblica solo `main`): la demo va fatta in locale con `npm run dev` (oppure `npm run build` + `npx vite preview`).

### Preparazione
1. `npm run dev` dalla radice del progetto, aprire l'indirizzo di Vite.
2. Casse o cuffie collegate; volume del computer provato.
3. Chiudere le altre applicazioni (M3 con 8 GB).
4. Aspettare il caricamento completo (mappa, puntini, celle).

### Sequenza proposta (risultati attesi dal second brain, **da provare stasera**)
| # | Cosa fare | Cosa si dovrebbe vedere | Cosa si dovrebbe sentire |
|---|---|---|---|
| 1 | Mappa all'avvio, Play | puntini a formichine, città che si svuota di notte e si riempie di giorno; puntini in casa attenuati | — |
| 2 | Color dots by → Gender, poi Age | tutti i quartieri colorati con le loro percentuali, colori stabili col Play | — |
| 3 | LCZ Vitality → Show → qualche parametro (SVF, Built surface); clic su una cella | mappe dei parametri con legenda; popup con la carta d'identità della cella | — |
| 4 | Show → **UTCI heat stress**, un giorno di luglio, Play | verde la mattina, rosso a mezzogiorno, blu di notte | — |
| 5 | Show → **Sound map**, stesso giorno | colori degli stati ora per ora | — |
| 6 | **Attiva mappa sonora**, mirino sul Centro, luglio ore 13 | pannello: Fatica o Calca, UTCI ~35 °C | brano teso/pesante in re minore + folla |
| 7 | Stesso giorno, ore 9 e ore 21 | Passeggiata / Festa | brani luminosi in re maggiore |
| 8 | Spostare il mirino verso un vicolo o un parco | cambio di cella e di stato | dissolvenza di 1 s verso un altro brano |
| 9 | Dicembre a mezzogiorno | stato sereno | brano sereno |
| 10 | Mezzanotte / notte fonda | Notte | piano notturno + grilli |
| 11 | Mirino fuori dalle celle | "fuori dalle celle LCZ: silenzio" | silenzio |
| 12 | Play con la mappa sonora attiva | musica, timeline e puntini che si muovono insieme | |

### Piano B
- Pagina di ascolto di `sound-lab/` (bussola 3×3 cliccabile) per far sentire i 10 brani e i suoni anche se la mappa dà problemi.
- Registrazione video della demo fatta prima (consigliata).

---

## 14. Foglio dei numeri chiave

| Numero | Cosa |
|---|---|
| 246 | giorni di presenze (1/6/2024 → 1/2/2025) |
| 5.904 | ore di meteo |
| 11 | quartieri |
| 12.496 | celle LCZ da 30 m |
| 15 + 2 | mappe delle celle nel menu Show + mappe orarie |
| 87 / 1.186 | luoghi reali / spot |
| 11.341 | edifici TUM |
| 47.076 | residenti Meta nel Comune |
| 40.939 | diari ISTAT usati |
| 4–10 mila | puntini sulla mappa |
| 50 m | raggio dell'energia |
| 9 + 1 | stati d'animo + Notte |
| 10 | brani, tutti in re |
| 6 / 11 | suoni urbani / varianti |
| −18 LUFS | volume della musica |
| 1 s / 1 s | isteresi / dissolvenza |
| 1,3 s | un'ora col Play |
| 220/220 | stati uguali fra JS e Python |
| ~30× | velocità del nuovo calcolo UTCI |
| −90% | carico dei puntini da fermi |
| 0,96 | correlazione presenze notturne / residenti |
| 21 / 16 | commit / sessioni in 2 giorni |

---

## 15. Proposta di scaletta

Bozza da adattare a durata e pubblico (vedi domande nella sezione 17). Circa 20 slide + demo.

| # | Slide | Blocco |
|---|---|---|
| 1 | Titolo: "CityRhythm suona: una mappa sonora di Ascoli Piceno" | — |
| 2 | Da dove partivamo | 1.1 |
| 3 | La domanda: far *sentire* la città (emozioni, non sonificazione) | 1.2 |
| 4 | La catena: dati → persone e clima → bussola → musica | 1.3 |
| 5 | Fondamenta: autosufficiente, MapLibre, solo Ascoli, store | A1–A4 |
| 6 | Il nuovo volto: stile Toner, edifici bianchi | B1–B2 |
| 7 | La città in 12.496 celle e 15 mappe | C1–C2 |
| 8 | UTCI: quanto si sta bene in strada | C3–C5 |
| 9 | Le persone: identità, formichine, colori | D1–D5 |
| 10 | Chi sta a casa: ISTAT + Meta | D6 |
| 11 | La bussola: 2 assi, 9 stati + Notte | E1–E3 |
| 12 | Settimana tipo e mappe orarie | E4–E5 |
| 13 | I 10 brani | F1–F2 |
| 14 | I suoni della città e il mix calcolato | F3–F4 |
| 15 | Il motore audio | F5 |
| 16 | **DEMO** | 13 |
| 17 | Come ci siamo arrivati: prima → dopo | 12 |
| 18 | Metodo: niente numeri a caso, second brain | G1–G3, D7 |
| 19 | Limiti | 10 |
| 20 | Prossimi passi | 11 |
| 21 | Fonti, licenze e citazioni | 9 |

**Versione corta (~10 minuti):** 1, 3, 4, 7, 8, 10, 11, 13, 16 (demo), 19–20, 21.

---

## 16. Cose da fare prima della presentazione

1. **Provare la demo stasera, con l'audio.** Il second brain dice che l'ascolto sopra la mappa **non è ancora stato giudicato** e che la gente in casa **non è stata vista a schermo**: i risultati attesi della sezione 13 vanno confermati.
2. **Crediti della mappa:** all'apertura sono lunghi e passano **sotto timeline e bussola**; controllare che non coprano il pannello durante la demo.
3. **Citazioni IPUMS e UCL** nella slide dei crediti (obbligatorie). La licenza chiede di comunicare titolo e citazione anche di rapporti e materiali didattici: valutare se la presentazione ci rientra.
4. **Edifici TUM: solo uso non commerciale** — va bene per una presentazione accademica.
5. (Indipendente dalla presentazione) **revocare i token Mapbox**: sono ancora nella cronologia del repository pubblico.

---

## 17. Domande per scrivere la presentazione (risposte dell'utente, 2026-10-05)

1. **Pubblico:** la collega (una persona).
2. **Durata:** 10–15 minuti, al massimo 20.
3. **Lingua:** italiano.
4. **Formato:** spiegare alla collega tutto il lavoro fatto; demo **dal vivo ma in remoto** (videochiamata con condivisione dello schermo).
5. **Persone da citare:** Simone **no** ("non c'entra"): la fonte delle celle è "progetto QGIS".
6. **Accento:** soprattutto la mappa sonora, raccontando anche il resto del lavoro del branch.
