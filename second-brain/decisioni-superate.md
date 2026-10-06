# CityRhythm — Decisioni superate

> Parte del second brain di CityRhythm: **indice in `SECOND_BRAIN.md`**, da leggere per primo. Questo file si legge quando il lavoro tocca questo argomento e si aggiorna col comando `/second-brain`.

Decisioni che non valgono più, barrate, con il perché e cosa le sostituisce. Non riaprirle senza un motivo nuovo; non cancellarle.

- ~~Energia = persone/km² del quartiere (1.730–9.882), sfumata entro 300 m fuori dai quartieri~~ → la mappa sonora era fatta di blocchi uguali per quartiere: ora gente entro 50 m dai puntini (`energia_svanisce_m` non più usato in JS).
- ~~Settimana tipo: piacevolezza fissa a Neutro~~ e poi ~~stato più frequente fra i giorni~~ → i giorni miti vincevano sempre ("quasi sempre Festa"): ora giorno al 90° percentile dell'UTCI.
- ~~Ombra degli alberi da `tcd_10m` sopra lo SVF (proposta B)~~ → effetto piccolo e doppio conteggio (lo SVF contiene già le chiome): non fatta.
- ~~Isteresi 2 s e dissolvenza 3 s lineare~~ → col Play (1,3 s per ora) la musica non cambiava mai: 1 s e 1 s a potenza costante.
- ~~Mappa UTCI a fasce (scalini)~~ → richiesta dell'utente: sfumatura continua.
- ~~Mapbox GL 2.15 con stile Mapbox Studio, token nel codice e in `.env.local`; tessere Mapbox come unica eccezione all'autosufficienza~~ → MapLibre + PMTiles locali, nessun token né eccezione. I token Mapbox vanno eliminati (quello di sviluppo è finito in chat).
- ~~Dati di Lucca, costa, San Benedetto, Pagliare~~ → regola "solo Comune di Ascoli Piceno".
- ~~Edifici scaricati al volo dal WFS del TUM~~ → vietato dagli autori e contrario all'autosufficienza; estrazione una tantum.
- ~~Agire sulla mappa solo se `map.isStyleLoaded()`, altrimenti rimandare a `map.once('idle')`~~ → col brulichio dei puntini la mappa non è mai "ferma": LCZ, UHI e interruttori 3D smettevano di funzionare. Ora `isMapReady()` / `whenMapReady()` (dopo `load`).
- ~~Edifici 3D accesi all'avvio (casella spuntata) e interruttori 3D applicati solo al clic~~ → il browser ricordava la casella vuota mentre gli edifici restavano in 3D: ora spenti all'avvio e la mappa segue la casella anche al caricamento.
- ~~Etichette e icone della mappa di base; flavor Protomaps "light" con edifici colorati per altezza; edifici 3D di OpenStreetMap~~ → mappa muta in stile Toner con edifici bianchi del TUM (OSM: altezze spesso mancanti).
- ~~Contorni degli edifici TUM così come scaricati (copia di OSM di qualche anno fa)~~ → aggiornati a OSM della mappa di base con le altezze TUM (`aggiorna_edifici_osm.py`, 2026-10-06): le strade di OSM 2026 attraversavano gli edifici vecchi (Rue).
- ~~Pannello **Advanced** di finetuning.ai; seed 2024; tag Mood/Energy~~ → Advanced suona "a un solo strumento": si resta su **Instrumental**, seed 2025 (rifacimenti 2026/2027), solo testo aggiunto al prompt.
- ~~Meteo della "settimana simulata 3–9 giugno 2024"~~ → i dati reali coprono 246 giorni: si usa tutto il periodo 2024-06-01 → 2025-02-01.
- ~~Dissolvenze di 4–8 s~~ → scelta all'ascolto: **3 s**.
- ~~Calore locale da IMPER_PC, albedo, ANTHROPOGE, H_W~~ → campi sporchi o incompleti; si usano UHI risk, PER_PC, SVF.
- ~~Comfort 18–26 °C con freddo severo (−1 a 4 °C)~~ → l'inverno finiva tutto in Calca/Fatica (brani "di caldo"); ora 16–26 °C e −1 a −4 °C.
- ~~Notte = sole tramontato~~ → a dicembre alle 17 il Centro è pieno: notte solo se buio **e** poca gente.
- ~~Fondere le varianti degli effetti in un file~~ → alternanza casuale in tempo reale, meno ripetitiva.
- ~~Librerie da CDN come globali, dati su GitHub Gist~~ → tutto locale con Vite e `public/data/`. GPU.js tolto (caricato ma mai usato).
- ~~Store leggero senza Vite; Svelte solo per la UI, React sconsigliato~~ → Vite (autosufficienza e intercambiabilità); nessun framework escluso.
- ~~`lcz_vitality.csv` (1.548 celle, solo centro); LCZ su tutto il Comune o a blocchi da 90 m (proposte dell'agente)~~ → `lcz_ascoli.geojson`: celle native da 30 m del progetto QGIS, tutti i campi, solo il rettangolo dei quartieri.
- ~~Bussola sull'area inquadrata, quartieri pesati per la frazione visibile; `aree_ascoli.json` con medie per quartiere~~ → bussola per **cella** al centro della mappa, nessuna media; file cancellato.
- ~~Temperatura locale = percepita + 4 °C sole × SVF − 2 °C verde + 1/2,5 °C × UHI risk; comfort 16–26 °C, −1 a 36 / −4 °C~~ → "numeri a caso" secondo l'utente: sostituiti dall'**UTCI** con fisica e fasce ufficiali.
- ~~Inverno → Attesa/Routine/Corrente~~ → con l'UTCI le giornate invernali sono senza stress: serene.
- ~~Fuori dalle aree coperte: brano neutro~~ → silenzio.
- ~~Spot che copiano solo dai luoghi reali aperti in quell'ora (anche a ~1 km)~~ → maestri fissi, i chiusi contano 0: di notte restava "aperto" il 66% degli spot.
- ~~Brulichio a ~30 immagini/s rispedendo ogni puntino come feature singola con tutte le proprietà~~ → teneva 2 core occupati di continuo (computer sempre più lento): ora gruppi MultiPoint a 32 strati e ridisegno a passi di 1 pixel fisico (`persone.md`).
- ~~Puntini rigenerati a caso a ogni ora, Play a 5 passi/s~~ → identità stabili e spostamenti animati; il Play interrompeva l'animazione e ammassava tutti al centro.
- ~~Colori dei puntini solo dal clic sui grafici, solo per il quartiere selezionato, persi al cambio d'ora~~ → selettore "Color dots by" su tutti i quartieri, stabile (per genere, età, nazionalità, visite).
- ~~Gente "in giro" in un punto a caso del quartiere~~ → finiva sul Tronto e nei prati; ora solo celle LCZ costruite o pavimentate.
- ~~Selettore LCZ a due radio (LCZ Types / UHI Risk)~~ → menu con tutte le mappe dei parametri delle celle.
- ~~Chi arriva esce di casa, chi se ne va rientra in casa~~ (passaggio intermedio) → si entra/esce dalla città con dissolvenza.
- ~~Notte: 95% a casa (`NIGHT_HOME_SHARE`), rampe 22→24 e 6→8 scelte a mano, nessuno a casa di giorno; casa scelta per volume (area × altezza)~~ → curva ISTAT con regola prudente e case pesate coi residenti Meta (i capannoni attiravano famiglie). Costanti tolte da `config.js`.
- ~~Puntini in casa che si attenuano appena partono~~ → solo all'arrivo all'edificio (richiesta dell'utente).
- ~~Quota ISTAT in casa applicata a tutti i presenti ("versione larga", 85% a casa alle 21)~~ → scartata: i dati vedono soprattutto chi è attivo, le serate si sarebbero svuotate.
- ~~Fonti per la gente in casa di giorno: file pubblico ISTAT Uso del tempo 2023, nota metodologica, Annuario statistico 2025, Eurostat HETUS~~ → controllate e inutili: il file 2023 ha solo il questionario individuale (modulo volontariato, 298 colonne, nessun diario); la nota ha solo tabelle degli errori; l'Annuario non ha dati orari; HETUS (`tus_00startime`, Italia 2008-09 ogni 10 min) dà attività, non luoghi (alle 11 fra l'8% e il 62% in casa; utile solo come conferma della notte, 98,5% dorme alle 3). Il diario 2023 esiste nel file per la ricerca (MFR), su richiesta motivata.
- ~~Estratto IPUMS per persona (`mtus_00001`, minuti totali per attività)~~ → serve la struttura "activity" con `ELOC`, `CLOCKST`, `TIME`, `DAY`, `PROPWT` (`mtus_00003`).
- ~~Bozza di scaletta da 21 slide con domande aperte su pubblico, durata, formato (`presentazione/materiale-music.md`, sezioni 15 e 17)~~ → risposte dell'utente: la collega, 10–15 minuti, demo in remoto, accento sulla mappa sonora; deck da 19 slide (`presentazione.md`).
- ~~Copertina con sottotitolo e nome/Unicam; titolo della slide 2 "Far sentire la città, non solo vederla"~~ → ritoccati a mano dall'utente: copertina con solo titolo e data, titolo "Far sentire la città" (titoli corti).
- ~~"Progetto QGIS di Simone" come fonte delle celle nella presentazione~~ → l'utente: Simone non va citato; nella presentazione si scrive "progetto QGIS".
