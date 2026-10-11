# CityRhythm

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0) [![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.15641271.svg)](https://doi.org/10.5281/zenodo.15641271)

CityRhythm is an advanced, interactive geospatial data visualisation dashboard designed to explore and analyse complex urban dynamics. The application provides detailed insights into footfall, demographics, and visitor interests across different city areas, with powerful temporal filtering capabilities.

---

### [**››› View the Live Demo at cityrhythm.it ‹‹‹**](https://cityrhythm.it)

---

## Core Features

This application goes beyond simple data plotting, incorporating several sophisticated features to provide a rich analytical experience:

*   **Interactive Map Interface:** A fluid and responsive map built with **MapLibre GL JS**, serving as the central canvas for all data layers.
*   **Dynamic Timeline Control:** A sleek timeline allows users to scrub through a full week (168 hours) to observe how urban patterns change over time.
*   **Detailed Analytics Sidebar:** When an area is selected, the sidebar populates with a rich set of interactive charts and statistics, powered by **ECharts**.
*   **Multiple Data Layers:** Visualise distinct datasets simultaneously, including:
    *   KML Polygons defining specific areas.
    *   Presence Points representing population density.
    *   Places that attract people (bars, shops, churches, schools, parks…) from OpenStreetMap.
    *   Local Climate Zones (LCZ) and Urban Heat Island (UHI) risk.
*   **Place Footfall Model:** Every OpenStreetMap place gets an hourly profile for a typical week from open data only: its opening hours (OSM `opening_hours`, or the average of places of the same type in the Marche region) multiplied by the share of people found at that kind of place in each hour, from time-use diaries (ISTAT 2008-09 via IPUMS MTUS). See `src/data/luoghi-core.js`.
*   **Dynamic Presence Point Simulation:** Population is visualised not as static dots, but as thousands of individual points with organic, "swarming" behaviour. Their distribution is weighted by the place footfall model.
*   **Dynamic UHI Risk Visualisation:** The Urban Heat Island risk layer is not static. Its opacity dynamically changes based on the combination of an area's intrinsic UHI risk and the real-time density of presence points, highlighting areas of combined risk.
*   **Cross-Filtering Interaction:** Clicking on a chart in the sidebar (e.g., gender distribution) instantly re-colours the presence points on the map to match, providing powerful visual feedback.
*   **3D Visualisation:** Toggle 3D terrain and building extrusions to gain a more immersive understanding of the urban environment.

## Technology Stack

CityRhythm is built with a modern front-end stack, leveraging powerful open-source libraries:

*   **Mapping:** [MapLibre GL JS](https://maplibre.org), [PMTiles](https://protomaps.com) basemap from OpenStreetMap, 3D buildings from [GlobalBuildingAtlas (TUM)](https://github.com/zhu-xlab/GlobalBuildingAtlas), terrain from [Mapterhorn](https://mapterhorn.com)
*   **Data Visualisation/Charts:** [Apache ECharts](https://echarts.apache.org/)
*   **Geospatial Analysis:** [Turf.js](https://turfjs.org/)
*   **Charts helpers:** [D3.js](https://d3js.org/)
*   **CSV Parsing:** [PapaParse](https://www.papaparse.com/)
*   **Date/Time Picker:** [Litepicker](https://litepicker.com/)
*   **KML parsing:** [@tmcw/togeojson](https://github.com/placemark/togeojson)
*   **Build:** [Vite](https://vite.dev/) (vanilla; plugins for Svelte, React or Vue can be added in `vite.config.js`)
*   **Core:** HTML5, CSS3, modern JavaScript (ES Modules)

## Getting Started

To run the CityRhythm application locally, follow these steps.

### Prerequisites

You need a local web server to run the application, as modern browsers restrict ES Modules from working with the `file://` protocol. A simple Node.js-based server is recommended.

*   [Node.js](https://nodejs.org/) (which includes npm)

### Installation & Running

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/grazianoEnzoMarchesani/cityrhythm.git
    ```

2.  **Navigate to the project directory:**
    ```bash
    cd cityrhythm
    ```

3.  **Configuration:** none. No API keys or tokens are needed: map, terrain and buildings are local files (Ascoli Piceno only) in `public/data/mappa/`.

4.  **Install and run:**
    ```bash
    npm install
    npm run dev
    ```
    Open the URL printed by Vite (typically `http://localhost:5173`).

5.  **Production build:** `npm run build` writes a self-contained site to `dist/`. All libraries are bundled from `node_modules` and all data is served from `public/data/`: the site loads nothing from external services, map tiles included. Pushing to `main` deploys `dist/` to GitHub Pages via `.github/workflows/deploy.yml`.

## Data Sources

The datasets are served by the site itself from `public/data/`; the paths are configured in `src/data/config.js`. Only the Comune di Ascoli Piceno is covered. The scripts that prepare the data are in `sound-lab/`.

*   **KML Areas:** `cityrhythm_blimp_areas.kml`
*   **POI Historical Data (presences per area and hour):** `cityrhythm_blimp.csv`
*   **Places that attract people:** `luoghi_osm.geojson` — names, types, positions and opening hours from [OpenStreetMap](https://www.openstreetmap.org/copyright), © OpenStreetMap contributors, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) (Geofabrik extract, prepared by `sound-lab/luoghi_osm.py`). The file is a derivative database and is shared under the same licence.
*   **Hourly profile per type of place:** `profili_luoghi.json` — aggregate shares from the ISTAT time-use diaries 2008-09, harmonised in IPUMS MTUS (Kimberly Fisher, Jonathan Gershuny, Sarah M. Flood, Juana Lamote, Liana C. Sayer, Daniel Backman, Etienne Breton, and Stephanie Richards. *Multinational Time Use Study Extract System: Version 1.5* [dataset]. Minneapolis, MN: IPUMS, 2025. https://doi.org/10.18128/D062.V1.5; this document uses the Multinational Time Use Study, Centre for Time Use Research, University College London 2019, http://www.timeuse.org/mtus/reference.html). No microdata; every value comes from at least 30 diaries (`sound-lab/profili_mtus.py`).
*   **Share of people at home:** `quota_in_casa.json` — same diaries and citations (`sound-lab/casa_mtus.py`).
*   **LCZ cells:** `lcz_ascoli.geojson` (`sound-lab/estrai_lcz.py`)
*   **Weather:** `meteo_ascoli.json` (Open-Meteo); compass parameters: `bussola.json`
*   **Neighbourhood drawing:** `quartieri_disegno.geojson` (partly ISTAT 2021 census sections, CC BY 4.0)
*   **Map:** `mappa/` — basemap from OpenStreetMap via Protomaps, buildings from GlobalBuildingAtlas (TUM, CC BY-NC 4.0) with residents from Meta Data for Good (CC BY 4.0), terrain from Mapterhorn. Full credits are shown in the map.

## Architecture Overview

The codebase is structured into modules to separate concerns:

*   **`main.js`**: The main entry point that initialises and orchestrates the entire application.
*   **`index.html`**: The main HTML structure.
*   **`style.css`**: All application styles.
*   **`config.js`**: Central configuration for API keys, data URLs, and styling constants.
*   **`src/data/`**: Handles loading, parsing, and storing all external data.
*   **`src/map/`**: Contains all map-related logic, including map setup, layer management, and user interaction (hover/click).
*   **`src/ui/`**: Manages all UI components outside the map, such as the sidebar, timeline, and layer controls.
*   **`src/utils/`**: A collection of helper functions used across the application.

## License

This project is licensed under the **GNU General Public License v3.0**. Please see the `LICENSE` file for full details.
