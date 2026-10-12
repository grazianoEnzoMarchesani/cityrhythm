# CityRhythm

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0) [![DOI all versions](https://zenodo.org/badge/DOI/10.5281/zenodo.15641270.svg)](https://doi.org/10.5281/zenodo.15641270) [![DOI v1.0.0](https://zenodo.org/badge/DOI/10.5281/zenodo.15641271.svg)](https://doi.org/10.5281/zenodo.15641271)

CityRhythm is an interactive map of how a city breathes through the week: where people are, who they are, how hot it feels, and **how all of that could sound**. It combines footfall, demographics, places, local climate and a sound layer that turns the mood of each part of the city into music. It is built for outreach: the music is there to convey feelings that images alone do not.

The data cover the **Comune di Ascoli Piceno** only.

---

### [**››› Open the live site at cityrhythm.it ‹‹‹**](https://cityrhythm.it)

The interface is in Italian.

---

## What it does

*   **Map.** MapLibre GL on a basemap served by the site itself, in two styles: *Nolli* (figure-ground, default) and *Toner*. One button switches to 3D (terrain and extruded buildings, residents per building).
*   **Timeline.** Scrub a typical week (168 hours), or real days when the chosen period is shorter than seven days. Periods are chosen with a date picker.
*   **People.** Thousands of moving dots represent the people outside their homes, hour by hour. Their number per neighbourhood comes from footfall data; *where* they stand comes from the places that attract people and from the share of people at home. Dots can be coloured by gender, age and other attributes.
*   **Places and footfall model.** 1,469 places from OpenStreetMap (bars, shops, churches, schools, parks…) each get an hourly profile for a typical week, built only from open data: opening hours (OSM `opening_hours`, or the average of places of the same type in the Marche) times the share of people found at that type of place in each hour (ISTAT time-use diaries 2008-09 via IPUMS MTUS). See `src/data/luoghi-core.js`.
*   **Cells of the city.** 12,496 vector cells of 30 m, each with a Local Climate Zone (LCZ), shown as maps of form, surface, heat and Urban Heat Island risk. Each cell also gets an hourly thermal comfort value (UTCI) from the weather.
*   **Area panel.** Selecting a neighbourhood shows statistics and ECharts charts (who frequents it, place types, details). Clicking a chart re-colours the dots on the map to match.
*   **Emotional compass.** For every cell and hour, the app computes an *energy* (how much is going on, from the crowd), a *pleasantness* (from thermal comfort) and a *heat with sign*. These map to ten named states (*Rifugio, Passeggiata, Fermento, Pausa, Quotidiano, Corrente, Torpore, Spossatezza, Ressa, Quiete*).
*   **Sound map.** Switch it on and the city plays. The default mode, **Sottotraccia**, is rule-based music generated live in the browser from energy, pleasantness and heat. A second mode plays recordings from the public-domain classical repertoire (Musopen), one piece per state. AI-generated loops and metronomes exist as debug modes.
*   **Listening circle.** A circle (50–250 m radius, movable by hand) selects the part of the city you listen to, independently of the camera. With the sound map on, the map shows the sound colours inside the circle. The circle's handle is a sun or moon that turns with the time of day.
*   **Privacy.** The site makes no requests to external services (no CDN, fonts, tiles or analytics). A privacy notice explains this.

## Technology

JavaScript with ES modules, no framework, built with Vite. All libraries come from `node_modules` at exact versions and are bundled; nothing is loaded from a CDN.

*   **Map:** [MapLibre GL JS](https://maplibre.org) 6, [PMTiles](https://protomaps.com) basemap from OpenStreetMap, 3D buildings from [GlobalBuildingAtlas (TUM)](https://github.com/zhu-xlab/GlobalBuildingAtlas), terrain from [Mapterhorn](https://mapterhorn.com)
*   **Charts:** [Apache ECharts](https://echarts.apache.org/), [D3.js](https://d3js.org/)
*   **Geospatial:** [Turf.js](https://turfjs.org/), [@tmcw/togeojson](https://github.com/placemark/togeojson)
*   **Sun and moon:** [SunCalc](https://github.com/mourner/suncalc)
*   **Data and UI:** [PapaParse](https://www.papaparse.com/), [Litepicker](https://litepicker.com/)
*   **Audio:** Web Audio API (no audio library)
*   **Build:** [Vite](https://vite.dev/) 8

Target browsers: Chrome 110+, Safari 16.4+, Firefox 115+, including phones.

## Getting started

You need [Node.js](https://nodejs.org/) (with npm). No API keys or tokens are needed: map, terrain, buildings and audio are local files.

```bash
git clone https://github.com/grazianoEnzoMarchesani/cityrhythm.git
cd cityrhythm
npm install
npm run dev
```

Open the URL printed by Vite (usually `http://localhost:5173`). To try it from a phone on the same network: `npm run dev -- --host 0.0.0.0`.

`npm run build` writes a self-contained site to `dist/`. Pushing to `main` deploys `dist/` to GitHub Pages through `.github/workflows/deploy.yml`.

## Data

Everything is served from `public/data/`; paths are set in `src/data/config.js`. The scripts that prepare the data live in `sound-lab/` (Python and Node). **Only data with a clear licence are kept in the repository**, and every file in `public/data/` has an entry in the licence inventory in `second-brain/dati-legali.md`.

| File | What it is | Source and licence |
|---|---|---|
| `luoghi_osm.geojson` | 1,469 places with type, position and opening hours | [OpenStreetMap](https://www.openstreetmap.org/copyright), © OpenStreetMap contributors, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Derivative database, shared under the same licence (`sound-lab/luoghi_osm.py`) |
| `profili_luoghi.json`, `quota_in_casa.json` | Hourly share of people at each type of place, and at home | Aggregates from the ISTAT time-use diaries 2008-09, harmonised in IPUMS MTUS. No microdata; every value comes from at least 30 diaries. Citations below |
| `cityrhythm_blimp.csv`, `cityrhythm_blimp_areas.kml` | Presences per neighbourhood and hour (11 areas, June 2024 – February 2025) | Footfall data acquired by the University of Camerino |
| `lcz_ascoli.geojson`, `pick_giorni.bin` | LCZ cells of 30 m and the per-day lookup used by the listening circle | Author's own work (`sound-lab/estrai_lcz.py`) |
| `meteo_ascoli.json` | Hourly weather | [Open-Meteo](https://open-meteo.com) |
| `bussola.json` | Compass parameters | Calibration by the project (`sound-lab/`) |
| `quartieri_disegno.geojson` | Neighbourhood outlines used for drawing only | Partly ISTAT 2021 census sections, CC BY 4.0 |
| `mappa/` | Basemap, terrain, buildings, fonts, icons | OpenStreetMap via Protomaps; buildings from GlobalBuildingAtlas (TUM, CC BY-NC 4.0) with residents from Meta Data for Good (HRSL 2020, CC BY 4.0); terrain from Mapterhorn |
| `public/audio/` | Classical loops, sound effects (and debug loops) | Classical recordings from Musopen, public domain as declared by the uploader; credited in the app |

Other rules: no data from outside the Comune of Ascoli Piceno; licensed microdata (`IPUMS/`, ISTAT diaries, the LCZ project) and scientific papers are never committed; every sound parameter is marked as coming from a source, a project choice, or a hypothesis.

**Citations for the time-use data.** Kimberly Fisher, Jonathan Gershuny, Sarah M. Flood, Juana Lamote, Liana C. Sayer, Daniel Backman, Etienne Breton, and Stephanie Richards. *Multinational Time Use Study Extract System: Version 1.5* [dataset]. Minneapolis, MN: IPUMS, 2025. https://doi.org/10.18128/D062.V1.5. This work uses the Multinational Time Use Study, Centre for Time Use Research, University College London, 2019, http://www.timeuse.org/mtus/reference.html.

## Project layout

```
index.html, main.js, style.css   entry point, markup, styles
src/
  state/store.js                 central store (subscribe / set / update / get)
  data/                          config, loading, place footfall model, state names
  compass/                       emotional compass: UTCI, energy, pleasantness, cell map
  audio/                         audio engine, Sottotraccia (rule-based music), metronomes
  map/                           map setup, layers, hover and click
  charts/                        the only module that imports ECharts
  ui/                            timeline, layers, area panel, sound map, circle, privacy
  utils/                         helpers
public/data/, public/audio/      data and sound served by the site
sound-lab/                       scripts to prepare data, calibrate and test (Python, Node)
second-brain/                    project memory: decisions, state, notes per topic
```

The pieces talk to each other only through the store. The compass is the only writer of the mood state, and the audio engine reads it, so the interface, charts, compass and audio can each be replaced independently.

`second-brain/` is the project's working memory (start from `SECOND_BRAIN.md`): it records decisions, rejected alternatives and open questions, for people and for coding agents.

## How to cite

Use the DOI for all versions (10.5281/zenodo.15641270) to cite the project in general, or the DOI of a specific version (for example 10.5281/zenodo.15641271 for v1.0.0) to cite that release; all versions are listed on the Zenodo page. Please also credit the data sources listed in the app's credits panel.

## Licence

The code is released under the **GNU General Public License v3.0** (see `LICENSE`). Data and audio keep the licences listed above; some, such as the TUM buildings (CC BY-NC), restrict commercial use.

## Author

Graziano Enzo Marchesani, University of Camerino (Unicam).
