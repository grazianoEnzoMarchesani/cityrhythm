# CityRhythm — Strumenti (`sound-lab/`) e avvio

> Parte del second brain di CityRhythm: **indice in `SECOND_BRAIN.md`**, da leggere per primo. Questo file si legge quando il lavoro tocca questo argomento e si aggiorna col comando `/second-brain`.

- `analyze.py <cartella>`: analisi dei brani (LUFS, BPM, tonalità, sfumature).
- `process.py <music/> loops`: loop musicali + `loops/manifest.json` (mappa in `SELECTION`).
- `analyze_sfx.py <cartella>`: analisi effetti (durata, LUFS, picco, stabilità, sfumature, nota dominante, distanza timbrica fra varianti).
- `process_sfx.py <music/sfx> sfx`: effetti pronti + `sfx/manifest.json`; raggruppa da solo le varianti dal nome (`Traffico1`, `Traffico2` → `traffico`).
- `mix.json` (→ `public/audio/mix.json`): regola del mix effetti e scene per stato.
- `compass.py [cartella dati]`: **riferimento** della bussola per cella su tutte le ore (~1 min). Legge `../public/data/` (presenze, KML, `lcz_ascoli.geojson`, `meteo_ascoli.json`, `bussola.json`), riscrive in `bussola.json` le ancore dell'energia e i km² dei quartieri, stampa la distribuzione degli stati e scrive `data/bussola_campioni.json` (220 casi di prova).
- `clima.py`: catena fisica UTCI per cella, con le fonti nel commento iniziale.
- `genera_utci.py`: estrae il polinomio UTCI dal **sorgente** di pythermalcomfort e scrive `src/compass/utci-coeff.js` (prova: 24,6 °C come nella documentazione). Installare con **`.venv/bin/pip install --no-deps pythermalcomfort`**: senza `--no-deps` abbassa numpy sotto la versione di pandas e i calcoli si **corrompono** in silenzio (successo: 881 °C su array grandi; numpy ripristinato a 2.5.3).
- `taratura_energia.mjs`: `node sound-lab/taratura_energia.mjs` dalla radice (~8 s); ricostruisce i puntini con le regole della mappa (3/4 agli Spot, 1/4 sulle strade, chi è a casa escluso con `home-share.js` e `quota_in_casa.json`) e riscrive `energia_cella` in `bussola.json`. Rilanciarlo se cambiano raggio, regole dei puntini, curva in casa o dati.
- `residenti_meta.py "../Lcz_neurali 2" ../public/data/mappa/gba_ascoli.geojson` (~12 s): legge Meta HRSL 2020 dall'archivio italiano di Simone (`meta_hrsl/cache/ita_population.zip`, via `/vsizip/` di GDAL di QGIS, senza estrarre i 17 GB), solo pixel nel Comune; ogni quadratino divide i residenti fra gli edifici che tocca in proporzione al volume toccato, altrimenti all'edificio più vicino entro 60 m (6.025), altrimenti persi (420). Scrive `res` negli edifici. Il ritaglio `meta_hrsl_aoi.tif` di Simone non copre il sud del Comune (si ferma a 42,81° N): non usarlo.
- `casa_mtus.py ../IPUMS/mtus_00003.dat.gz ../public/data/quota_in_casa.json` (~3 s): curva in casa dai diari IPUMS MTUS (posizioni delle colonne dal DDI in `IPUMS/DDI.md`). Microdati in `IPUMS/` e `UsoTempo_*/`, entrambi in `.gitignore`.
- `verifica_bussola.mjs`: `node sound-lab/verifica_bussola.mjs` dalla radice; confronta JS e Python su clima, UTCI e piacevolezza con l'energia per quartiere (oggi 220/220 stati; l'energia per cella non è coperta, UTCI entro 0,17 °C: SunCalc e la formula solare di Python differiscono fino a 0,9°; tollerati i casi a cavallo di −6°).
- `estrai_lcz.py "../Lcz_neurali 2" ../public/data/lcz_ascoli.geojson`: estrae le celle dal gpkg (usa `ogr2ogr` e `proj.db` di **QGIS 3.44** nell'app: il Python di QGIS non parte da solo), aggiunge quartiere e distanza.
- `estrai_edifici_gba.py <uscita.geojson>`: ritaglia gli edifici TUM sul Comune (istruzioni di scaricamento in testa al file; serve `ijson`). `data/comune_ascoli.geojson`: confine del Comune, da usare per **ogni** ritaglio.
- Mappa di base e terreno si rigenerano con la CLI `pmtiles` (brew): `pmtiles extract https://build.protomaps.com/AAAAMMGG.pmtiles ascoli_base.pmtiles --bbox=13.41,42.77,13.75,42.94 --maxzoom=15` e lo stesso da `https://download.mapterhorn.com/planet.pmtiles` con `--maxzoom=12`.
- `index.html` (pagina di ascolto): bussola 3×3 cliccabile, bottone Notte, dissolvenza (default 3 s), sezione "Suoni urbani" con 6 cursori e casella **"Mix calcolato per stato"**.
- Avvio:
  ```bash
  cd sound-lab && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
  .venv/bin/python process.py ../music loops && .venv/bin/python process_sfx.py ../music/sfx sfx
  python3 -m http.server 8765
  ```
  Poi http://localhost:8765. I file vanno caricati uno alla volta (il server di Python si inceppa con molte richieste parallele).
- **Piattaforma**: `npm install && npm run dev` dalla radice. Nessun token né `.env.local`.
- **Prove nel browser (agente)**: Chrome for Testing già presente in `~/.cache/puppeteer/chrome/mac_arm-*/`; `npm install puppeteer-core` in una cartella temporanea (non nel progetto), avvio con `--use-angle=swiftshader --enable-unsafe-swiftshader` (WebGL senza GPU), `npx vite --port 5179` dalla radice. Per raggiungere la mappa dalla pagina: `import()` dello **stesso URL** di `map-setup.js` letto da `performance.getEntriesByType('resource')` (dopo un ricaricamento a caldo ha `?t=…`; un URL diverso crea un secondo modulo senza mappa), poi `getMapInstance()`. Servono ~15 s dopo il caricamento.
