# CityRhythm — Dati legali: luoghi e affluenza

> Parte del second brain di CityRhythm: **indice in `SECOND_BRAIN.md`**, da leggere per primo. Questo file si legge quando il lavoro tocca i luoghi della città, la loro affluenza o le licenze dei dati, e si aggiorna col comando `/second-brain`.

**Stato: in prova sul branch `dati-legali`, non ancora approvato.** `main` e `ui-redesign` usano ancora spot e affollamenti estratti con Outscraper (`persone.md`). Il branch parte da `origin/main` (`27da705`), sessione 32 del 2026-10-11.

## In breve
Gli spot (1.186 punti) e i 87 profili di affollamento tipo Popular Times, estratti con Outscraper da Google, sono sostituiti da dati che il progetto può pubblicare:
- **luoghi** da **OpenStreetMap** (ODbL): 1.469 luoghi nel Comune, in 17 categorie italiane, con gli orari di apertura (`opening_hours`);
- **profili orari per tipo di luogo** dai **diari ISTAT Uso del tempo 2008-09 via IPUMS MTUS** (già in licenza all'autore, solo aggregati, ogni valore da almeno 30 diari).

L'affluenza di un luogo in un'ora della settimana tipo = quota di persone che a quell'ora sta in quel tipo di luogo (diari) × quota dell'ora in cui il luogo è aperto (OSM) ÷ apertura media dei luoghi dello stesso tipo, riportata a 100 nell'ora più piena del luogo. Il sito la calcola da sé (`src/data/luoghi-core.js`); i puntini, la bussola e la scheda Area la leggono come prima leggevano lo spot sintetico.

## Fonti scelte
| Fonte | Cosa dà | Licenza e attribuzione | Accesso | Copertura del Comune |
|---|---|---|---|---|
| **OpenStreetMap**, estratto Geofabrik `centro-latest.osm.pbf` (https://download.geofabrik.de/europe/italy.html) | nome, tipo, posizione, `opening_hours` | **ODbL 1.0** («License: ODbL 1.0» sulla pagina Geofabrik). Attribuzione: «© OpenStreetMap contributors», https://www.openstreetmap.org/copyright. `luoghi_osm.geojson` è un database derivato: resta pubblico con la stessa licenza (è nel repository). | 2026-10-11; dati OSM fino al 2026-10-08T20:21:06Z; 384.857.630 byte, sha256 `9fcfe51b…4ec5` | 1.499 oggetti che attirano persone, 30 doppioni tolti, **1.469 luoghi**; orari propri 332 (22,6%) |
| Orari tipici per tipo, dagli stessi dati OSM delle **Marche** (confine OSM della regione) | quota di luoghi aperti ora per ora, per i luoghi senza orari | ODbL, come sopra | come sopra | 3.635 luoghi con orari leggibili (12 illeggibili); 25 tipi OSM e 12 categorie con almeno 30 luoghi |
| **IPUMS MTUS**, campione Italy 2008 (ISTAT Uso del tempo 2008-09), estratto `mtus_00003` (struttura «activity») | quota di persone per tipo di luogo (`ELOC`) o attività (`MAIN`), ora per ora | Licenza dell'autore (`persone.md`): microdati mai pubblicati, aggregati sì, **nessun valore da meno di 30 casi**, due citazioni obbligatorie (nel file, nei crediti, nel README). Codici: MTUS User Guide, Chapter 3 (https://www.timeuse.org/sites/default/files/9727/chapter-3-activity-codes.pdf), tabelle 3.1 e 3.4. | microdati già in `IPUMS/`; profili calcolati il 2026-10-11 | 40.939 diari (feriali 14.786, sabato 13.283, domenica 12.870), 1.027.724 attività |
| Libreria **opening-hours-py 2.1.4** (https://github.com/remi-dupre/opening-hours-rs) | lettura del tag `opening_hours`, festività italiane | MIT OR Apache-2.0; solo negli script (`.venv` di `sound-lab`), non nel sito | 2026-10-11 | 1 orario illeggibile su 333 nel Comune |

Precedente di metodo (nessun numero ripreso): nel progetto Population 24/7 la popolazione oraria dei luoghi di destinazione segue profili temporali per tipo di luogo; nelle presentazioni del gruppo il profilo del commercio viene dall'UK Time Use Survey 2000. Martin, D., Cockings, S., Leung, S. (2015). *Developing a flexible framework for spatiotemporal population modelling*. Annals of the Association of American Geographers. https://doi.org/10.1080/00045608.2015.1022089 (manoscritto CC BY).

## Alternative scartate
| Fonte | Perché no |
|---|---|
| **Overture Maps Places** (rilascio 2026-09-23.1; CDLA Permissive 2.0, record Foursquare Apache 2.0 con NOTICE, AllThePlaces CC0) | **Nessun orario di apertura** nello schema; nel Comune 4.583 record, di cui 182 chiusi per sempre e 2.409 da BrightQuery (registri d'impresa: uffici e società, non luoghi aperti al pubblico). Mescolarlo con OSM chiederebbe doppioni da togliere a mano e tre licenze nello stesso file. Usato **solo come controllo**. |
| **Foursquare Open Source Places** (Apache 2.0) | Su Hugging Face è un dataset «gated»: serve un account e la condivisione dei propri contatti, cioè un accesso personale dell'utente. Circa 106 suoi record nel Comune arrivano già dentro Overture. Nessun orario utile. |
| **opening_hours.js** (libreria di riferimento della specifica) | Licenza LGPL-3.0-only: usabile negli script, ma opening-hours-py (MIT/Apache) è più semplice da tenere in `sound-lab` (Python) e regge la specifica. |
| Punti di interesse del Comune sul portale della Regione Marche | **Licenza incerta**: «CC BY 4.0» su dati.gov.it, «Creative Commons Non-Commercial» sul portale regionale. 106 punti (64 chiese, 12 fortificazioni, 6 musei), campi orario vuoti. Solo controllo, mai pubblicato. |
| Impianti sportivi e edifici comunali ad uso pubblico (Regione Marche, IODL 2.0) | Un solo impianto; 42 edifici con latitudine e longitudine scambiate nei campi. Solo controllo. |
| Farmacie del Ministero della Salute (IODL 2.0) | 16 farmacie attive nel Comune, ma 8 hanno le stesse coordinate (il centro città). Solo controllo, per nome. |
| Popular Times, Outscraper, librerie che leggono le pagine Google, API con chiave personale | **Vietati** dalle regole del branch. |
| Eurostat HETUS (stessa indagine ISTAT 2008-09, dati aperti) | Dà le attività per ora, non i luoghi; i diari IPUMS hanno anche il luogo (`ELOC`). Possibile controllo futuro, non fatto. |

## Come si calcola
| Passo | Regola | Marca |
|---|---|---|
| Luoghi | Oggetti OSM con `amenity`, `shop`, `leisure`, `tourism`, `office`, `craft`, `healthcare`, `historic`, `railway`, `public_transport` che attirano persone, dentro il confine del Comune (punto o punto interno dell'area). Esclusi: parcheggi, panchine, bacheche, fontanelle, alberghi e B&B, monumenti ai caduti, campi e piscine senza nome, giardini senza nome o privati. Tabelle `AMENITY`, `ALIMENTARI`… in `sound-lab/luoghi_osm.py`. | [S] |
| Doppioni | Stessa categoria, nome uguale o mancante, entro 30 m: si tiene il punto con orari, poi il punto, poi l'area. | [S] |
| Categorie | 17 nomi italiani (`CATEGORIE` in `luoghi_osm.py`): Bar e caffè, Ristoranti e pizzerie, Alimentari e supermercati, Abbigliamento e accessori, Altri negozi e botteghe, Parrucchieri ed estetisti, Farmacie, Medici e cliniche, Banche poste e uffici, Scuole e università, Chiese e luoghi di culto, Musei teatri e cinema, Sport e palestre, Parchi e giardini, Monumenti e panorami, Auto e carburante, Stazioni. | [S] |
| Profili dei diari | 11 profili (`sound-lab/profili_mtus.py`): bar e ristoranti = `ELOC` 6; acquisti = `MAIN` 24; servizi alla persona = 25; banche e uffici = 26; culto = `ELOC` 7; scuola = `ELOC` 4; sport = 42 fuori casa; partite = 36; spettacoli = 37 e 38; svago di giorno = 43, 45, 47 in `ELOC` 9; spostamenti = 63 e 64. Quota = minuti pesati (`PROPWT`) nell'ora ÷ (60 × peso dei diari del tipo di giorno). | dati [F] |
| Giorni | Feriali insieme, sabato e domenica a parte; le ore 0-3 dal diario del giorno prima (il diario parte alle 4:00), quindi il venerdì notte usa i feriali. | [S] |
| Regola dei 30 casi | Ogni valore pubblicato viene da almeno 30 diari distinti con tempo in quel luogo in quell'ora; sotto i 30 il valore è `null` e vale 0 (notti dei feriali, domenica per scuola e servizi). | [F] termini UCL |
| Abbinamento categoria → profilo | Bar, ristoranti, gelaterie → bar e ristoranti; negozi, farmacie, auto e carburante → acquisti; parrucchieri, medici e cliniche → servizi alla persona; banche, poste, uffici, biblioteche → servizi; chiese → culto; scuole → scuola; palestre e impianti → sport; stadio → partite; cinema, teatri, centri civici → spettacoli; musei, parchi, monumenti → svago di giorno; stazioni → spostamenti. Le visite mediche nel codice 25 per analogia con la lista HETUS («servizi alla persona»): il file di conversione italiano non l'ho trovato. | **[H]** |
| Orari | Media di 35 settimane (dal 2024-06-03 al 2025-02-02, il periodo dei dati), con le festività italiane; lo stato «sconosciuto» (es. «su appuntamento») conta come aperto. Senza orari propri: media dei luoghi dello stesso tipo nelle Marche se sono almeno 30, altrimenti della stessa categoria (non per musei, teatri e cinema, troppo diversi), altrimenti nessun orario (vale 1). | [S]; orari [F] OSM |
| Affluenza | `q_L(t) × a_p(t) ÷ Ā_L(t)`, poi 100 nell'ora più piena del luogo (`src/data/luoghi-core.js`). La divisione per l'apertura media dice che la gente di quel tipo di luogo si divide fra i luoghi aperti. Il 100 per luogo è la scala dei dati di prima: un bar e una farmacia al loro massimo pesano uguale (nessuna capienza). | [S] |
| Puntini | Come prima: 30% delle presenze del quartiere ai luoghi in proporzione all'affluenza, 10% in giro, entro 10 m dal luogo (`JITTER_METERS`), stesse identità e spostamenti. **Nuovo**: se nessun luogo del quartiere attira gente (notti dei feriali), la gente resta divisa come nell'ultima ora; prima, senza luoghi attivi, il quartiere restava senza puntini (anche quelli a casa). | [S] |

## Copertura
- **Comune**: 1.469 luoghi (prima 1.186 spot); nei quartieri 977 (prima 1.089). Tutti hanno un'affluenza non nulla in qualche ora.
- **Orari**: propri 332 (22,6%), tipici del tipo 480, tipici della categoria 424, nessuno 233 (chiese, scuole, monumenti, impianti sportivi, stazioni).
- **Categorie mappate**: 17 su 17; profili: acquisti 550 luoghi, bar e ristoranti 290, servizi 182, svago di giorno 146, servizi alla persona 119, culto 66, scuola 46, sport 42, spettacoli 19, spostamenti 6, partite 3.
- **Per categoria**: Altri negozi 214, Banche poste e uffici 180, Bar 155, Ristoranti 135, Abbigliamento 126, Alimentari 122, Parchi 82, Parrucchieri 71, Chiese 66, Auto 62, Monumenti 57, Medici 48, Scuole 46, Sport 45, Musei teatri cinema 28, Farmacie 26, Stazioni 6.
- **Per quartiere (prima → dopo)**: Centro Storico 433 → 467, Porta Maggiore 302 → 273, Borgo Solestà 94 → 77, Campo Parignano 91 → 59, Porta Romana 46 → 30, Tofare 27 → 11, Pennile di Sotto 25 → 18, Borgo Chiaro 24 → 12, San Filippo 21 → 8, Stadio 15 → 18, Porta Cartara 11 → 4.
- **Luoghi attivi nei quartieri** (prima → dopo): martedì 10:00 1.079 → 910; martedì 21:00 881 → 331; sabato 21:00 660 → 612; domenica 11:00 1.079 → 705; martedì 03:00 566 → 0 (regola della notte).
- **Puntini** (Chromium, settimana tipo, prima → dopo): stessi totali per costruzione; martedì 10:00 10.356 → 10.349; martedì 03:00 1.161 → 1.193, tutti a casa; sabato 22:00 5.908 → 5.910.

## Controllo incrociato (`sound-lab/controllo_luoghi.py`)
- **Overture** (confidenza ≥ 0,7, record non chiusi), OSM / Overture / OSM con un Overture della stessa categoria entro 75 m: bar 155 / 115 / 113; ristoranti 135 / 201 / 122; abbigliamento 126 / 175 / 119; alimentari 122 / 88 / 77; parrucchieri 71 / 115 / 55; banche e uffici 180 / 194 / 115; chiese 66 / 31 / 25; auto 62 / 85 / 44; medici 48 / 61 / 16; scuole 46 / 25 / 14; sport 45 / 47 / 12; farmacie 26 / 21 / 16. OSM ha meno ristoranti, negozi di moda e parrucchieri di Overture; più chiese, parchi, monumenti e alimentari.
- **Farmacie del Ministero**: 16 attive; 15 hanno una farmacia OSM con lo stesso nome (OSM ne ha 21).
- **Punti di interesse della Regione**: chiese e conventi 67, di cui 46 con un luogo di culto OSM entro 75 m; musei 6 su 6; fortificazioni, palazzi e monumenti 25 su 32.
- **Edifici comunali**: le 4 «scuole» sono palazzi del centro (es. l'Annunziata, sede universitaria): nessuna ha una scuola OSM entro 75 m.

## Bussola: prima e dopo (`sound-lab/confronto_bussola.mjs`)
Settimana tipo, tutte le 4.354 celle dei quartieri × 168 ore (731.472 casi), meteo del giorno al 90° percentile dell'UTCI, ognuno con la sua taratura. Taratura nuova (`taratura_energia.mjs`, ore di luce): 10° percentile 124 persone/km² (prima 156), 90° 15.113 (prima 13.623): `log_lo` 2,09694, `log_hi` 4,17939 (prima 2,19474 e 4,13431). La taratura nuova, data in pasto ai vecchi attrattori, ridà esattamente i valori di prima.

| Stato | Prima | Dopo |
|---|---|---|
| Notte | 25,4% | 26,8% |
| Afa | 8,6% | 9,0% |
| Fatica | 18,0% | 21,5% |
| Calca | 26,3% | 22,3% |
| Attesa | 1,0% | 1,1% |
| Routine | 2,7% | 2,4% |
| Corrente | 2,0% | 1,8% |
| Rifugio | 4,6% | 5,4% |
| Passeggiata | 7,1% | 5,9% |
| Festa | 4,3% | 3,9% |

Energia X: media −0,10 → −0,15; mediana −0,03 → −0,12; 75° percentile 0,51 → 0,42; poca gente (sotto −1/3) 39,6% → 42,3%; tanta (sopra 1/3) 32,6% → 27,9%. Per ora del giorno la curva media ha la stessa forma, circa 0,05 più bassa (picco 0,31 → 0,26 alle 17). **Stesso stato nel 71,8% dei casi.**

Perché: i luoghi OSM sono più concentrati nel centro e più radi nei quartieri esterni (San Filippo, Tofare, Borgo Chiaro, Porta Cartara): lì la gente si raccoglie attorno a meno punti, quindi più celle vuote e qualche cella più piena. Per la musica: il ritmo della giornata resta (curve parallele), la differenza centro/periferia resta; cambia soprattutto una parte di **Calca** che diventa **Fatica** (stessa riga «opprimente», una colonna meno affollata) e un po' di **Passeggiata/Festa** che diventa **Rifugio**: musica un po' più calma fuori dal centro. Accettabile per la prova; il giudizio è dell'utente, all'ascolto.

## Inventario delle licenze di `public/data/`
Data di accesso: quella scritta nel second brain; se manca, il giorno in cui il file è entrato nel repository (`git log`).

| File | Contenuto | Fonte | Licenza | Accesso | Attribuzione |
|---|---|---|---|---|---|
| `luoghi_osm.geojson` | 1.469 luoghi con categoria, profilo, orari | OpenStreetMap (Geofabrik, dati fino al 2026-10-08) | **ODbL 1.0** (database derivato, stessa licenza) | 2026-10-11 | «© OpenStreetMap contributors» nei crediti della mappa (`LUOGHI_CREDITO`) e nel file |
| `profili_luoghi.json` | 11 profili orari per tipo di luogo | ISTAT Uso del tempo 2008-09 via IPUMS MTUS v1.5 | licenza IPUMS dell'autore: aggregati con citazione, ≥ 30 casi | 2026-10-11 | due citazioni nel file, nei crediti della mappa e nel README |
| `quota_in_casa.json` | curva in casa per giorno e ora | come sopra (`casa_mtus.py`) | come sopra | 2026-10-05 | come sopra (`persone.md`) |
| `bussola.json` | parametri della bussola | lavoro del progetto, fonti nel campo `fonti` | del repository (GPL-3.0) | 2026-10-04; `energia_cella` riscritta il 2026-10-11 su questo branch | — |
| `meteo_ascoli.json` | meteo orario 2024-06-01 → 2025-02-01 | Open-Meteo, archivio storico | **CC BY 4.0** | 2026-10-04 | **mancava**: aggiunta su questo branch nei crediti («Meteo: Open-Meteo.com, CC BY 4.0») |
| `cityrhythm_blimp.csv` | presenze per quartiere e ora | **non scritta** | **non scritta** | 2026-10-04 (nel repository) | — (domanda all'utente) |
| `cityrhythm_blimp_areas.kml` | 11 aree | **non scritta** | **non scritta** | 2026-10-04 (nel repository) | — (domanda all'utente) |
| `lcz_ascoli.geojson` | 12.496 celle LCZ da 30 m | progetto QGIS di terzi (`Lcz_neurali 2`, non nel repository) | **non scritta** | 2026-10-04 | — (domanda all'utente) |
| `quartieri_disegno.geojson` | confini di disegno | in parte sezioni ISTAT 2021, in parte disegno originale | CC BY 4.0 (parte ISTAT) | 2026-10-11 | `QUARTIERI_CREDITO` nei crediti (`quartieri.md`) |
| `mappa/ascoli_base.pmtiles` | mappa di base | Protomaps Basemap 4.15.2 (OSM fino al 2026-10-04, Natural Earth) | ODbL (OSM); Natural Earth pubblico dominio | 2026-10-04 | «© OpenStreetMap · Protomaps» |
| `mappa/ascoli_terreno.pmtiles` | rilievo | Mapterhorn | licenze per fonte (pagina https://mapterhorn.com/attribution) | 2026-10-04 | «© Mapterhorn» con il link |
| `mappa/gba_ascoli.geojson` | 11.356 edifici con altezza, residenti, interni pubblici | GlobalBuildingAtlas TUM; contorni OSM; residenti Meta HRSL 2020; `pub` da OSM | **CC BY-NC 4.0** (solo uso non commerciale) + ODbL + CC BY 4.0 | 2026-10-04, aggiornato il 2026-10-06 | nei crediti (TUM, Meta, OSM) |
| `mappa/fonts/*/*.pbf` (9 file) | glifi Noto Sans | protomaps/basemaps-assets | **SIL Open Font License 1.1** | 2026-10-04 | non serve in mappa; il testo della licenza OFL non è nel repository (da aggiungere) |
| `mappa/sprites/light*` | icone (non usate) | protomaps/basemaps-assets, da tangrams/icons | MIT | 2026-10-04 | avviso MIT non nel repository (da aggiungere o togliere i file) |
| `mappa/sprites/toner*` | trame del verde | openmaptiles/maptiler-toner-gl-style | BSD (da `mappa.md`) | 2026-10-05 | «Stile Toner: Stamen, MapTiler» |
| `mappa/sprites/tinta*` | trame ricavate da toner (`tinta_sprite.py`) | come toner | come toner | 2026-10-11 | come toner |

Tolti su questo branch (restano nella storia di `main` e `ui-redesign`): `cityrhythm_spotMapper.csv`, `cityrhythm_crowded_data.csv`.

## Interfacce dei moduli cambiate
- `data-loader.js`: `loadLuoghi()` e `getLuoghi()` al posto di `loadCrowdedData`/`getCrowdedData` e `loadSpotMapperData`/`getSpotMapperData`.
- `src/data/luoghi-core.js` (nuovo, puro): `preparaLuoghi(luoghiGeojson, profili)` → luoghi con `affluenza` (168 valori 0–100).
- `map-layers.js`: `getAttrattoriGeoJson(oraSettimana)` al posto di `generateSyntheticCrowdedPointsGeoJson(spot, affollamenti, colonna)`; tolte `getTimelineCrowdednessColumn`, `getCrowdednessColumnName`, i «maestri», il livello dei punti sintetici e `fullSyntheticCrowdedGeoJson`. `updateAllPresencePoints(indice, visibile)` senza la mappa degli affollamenti; `addCrowdedPointsLayer(indice, visibile)` e `updateCrowdedPointsLayerStyle(indice)` (solo `DEBUG_MODE`) mostrano i luoghi con l'affluenza dell'ora. La proprietà interna `syntheticId` dei puntini ora si chiama `attrattoreId`.
- `tipi-luogo.js`: `getTipiDiLuogo(indice, area)` restituisce le categorie italiane dei soli luoghi aperti in quell'ora; la scheda conta «luoghi», non «punti», e di notte scrive «In quest'ora nessun luogo dell'area attira gente.»
- `ui-sidebar.js`: tolti il pulsante di debug che scaricava il CSV dei punti sintetici e il link al gist.
- `sound-lab/taratura_energia.mjs`: non importa più `map-layers.js` (su `main` si ferma in Node perché `ui-sidebar.js` chiama `window.matchMedia` al caricamento); opzioni `--prova` e `--attrattori`.

## Verifiche (2026-10-11)
- `npm run build` passa; `npm run dev -- --host 0.0.0.0` parte.
- Playwright con Chromium (headless shell 1248, fuori dal repository), desktop 1440×900 e telefono 390×844: **30/30** — mappa caricata, 1.469 luoghi con affluenza, puntini, freccia, Play, cambio giorno, notte feriale (martedì 03:00: tutti a casa), scheda Area aperta col clic sul Centro Storico, «Tipi di luogo» con le categorie nuove e che cambiano con l'ora (domenica 11:00: Chiese in testa), frase della notte, crediti, nessun errore in console, nessuna richiesta fallita. Gli avvisi di MapLibre sul livello KML (`Expected value to be of type number, but found null`) ci sono uguali su `main`.
- Puntini alla stessa ora su `main` e sul branch: stessi totali (es. martedì 10:00 10.356 e 10.349); cambiano solo i posti.
- Nessun riferimento a `cityrhythm_spotMapper`, `cityrhythm_crowded_data`, Outscraper, populartimes o `gist.githubusercontent` nel codice, nei dati e nella build; restano nel second brain (la storia delle decisioni) e dentro `cityrhythm1.0.zip` (compresso, vedi domande).
- Ogni file di `public/data/` (33) ha una riga nell'inventario qui sopra.
- Nessun PDF, microdato o clip in git (`git ls-files | grep -i -E "\.pdf$|IPUMS|UsoTempo|clip/"` vuoto).
- **Non verificato**: Safari, Firefox, iPhone reale; ascolto della musica con i dati nuovi.

## Limiti
- I diari sono **nazionali e del 2008-09**, non di Ascoli: dicono quando gli italiani vanno in quel tipo di luogo, non quanta gente va in quel bar.
- **Nessuna capienza**: ogni luogo vale 100 nella sua ora di punta, come prima; il Duomo e una cappella pesano uguale.
- Bar e ristoranti hanno **lo stesso profilo** (il luogo 6 dei diari li mette insieme): li separano solo gli orari. Il picco di tutti è il sabato sera: un caffè vale in mediana circa 30 su 100 il lunedì alle 10, 59 il martedì alle 13, 100 il sabato alle 21 (un negozio di abbigliamento: 61 il lunedì alle 10, 92 il sabato alle 11).
- La **scuola** dei diari comprende i bambini (dai 3 anni): l'estratto non ha l'età.
- **Notti dei feriali** (2–5), sabato 2–5 e domenica 2–3: meno di 30 diari, nessun luogo attivo; vale la regola della notte [S]. Domenica nessuno spostamento per lavoro: le stazioni sono vuote.
- Solo il **22,6%** dei luoghi ha orari propri; gli altri prendono gli orari medi delle Marche; gli orari OSM possono essere vecchi.
- **Esclusi** alberghi e B&B (i diari non hanno abbastanza notti fuori casa), parcheggi e fermate dell'autobus: non attirano più puntini.
- **Copertura OSM** più bassa nei quartieri esterni (Porta Cartara 4 luoghi, San Filippo 8, Tofare 11, Borgo Chiaro 12): lì i puntini si raccolgono attorno a pochi punti.
- Il venerdì notte usa i diari feriali: la movida del venerdì è sottostimata.

## Domande per l'utente
1. **`cityrhythm_blimp.csv`** (presenze per quartiere e per ora) e il **KML delle aree**: chi li ha prodotti, con quale accordo o licenza? Nel progetto non è scritto. Vanno verificati con la stessa cura.
2. **`lcz_ascoli.geojson`**: viene dal progetto QGIS di un terzo; con quale permesso si pubblicano le celle?
3. **Gruppo Luoghi**: resta nascosto o si riattiva con i luoghi OSM (il livello è pronto, colorato per categoria)?
4. **`cityrhythm1.0.zip`** (backup del 2025, nel repository): dentro il vecchio codice compresso ci sono i nomi dei due CSV e 6 indirizzi di gist. Tenerlo, toglierlo da questo branch o chiarire i gist?
5. **Open-Meteo** mancava nei crediti di `main`: aggiunto qui; va portato anche su `main`?
6. **`IPUMS/DDI.md`** sul disco non contiene più il codebook dell'estratto (c'è un altro testo): il DDI originale (XML) va riscaricato da IPUMS se serve.

## Come si rigenera
```bash
curl -L -o /percorso/centro-latest.osm.pbf https://download.geofabrik.de/europe/italy/centro-latest.osm.pbf
cd sound-lab && .venv/bin/pip install --no-deps opening-hours-py==2.1.4
.venv/bin/python luoghi_osm.py /percorso/centro-latest.osm.pbf <timestamp di state.txt> ../public/data/luoghi_osm.geojson   # ~3 min
.venv/bin/python profili_mtus.py ../IPUMS/mtus_00003.dat.gz ../public/data/profili_luoghi.json                        # ~3 s
cd .. && node sound-lab/taratura_energia.mjs                                                                           # ~3 s, riscrive bussola.json
node sound-lab/confronto_bussola.mjs [--prima attrattori.json log_lo log_hi]                                           # ~17 s
```
