# CityRhythm

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0) [![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.15641271.svg)](https://doi.org/10.5281/zenodo.15641271)

CityRhythm is an advanced, interactive geospatial data visualisation dashboard designed to explore and analyse complex urban dynamics. The application provides detailed insights into footfall, demographics, and visitor interests across different city areas, with powerful temporal filtering capabilities.

---

### [**››› View the Live Demo at cityrhythm.it ‹‹‹**](https://cityrhythm.it)

---

![CityRhythm Screenshot](https://www.cityrhythm.it/screenshot.png) 
*(Note: You can replace this link with a direct link to a screenshot in your repository)*

## Core Features

This application goes beyond simple data plotting, incorporating several sophisticated features to provide a rich analytical experience:

*   **Interactive Map Interface:** A fluid and responsive map built with **Mapbox GL JS**, serving as the central canvas for all data layers.
*   **Dynamic Timeline Control:** A sleek timeline allows users to scrub through a full week (168 hours) to observe how urban patterns change over time.
*   **Detailed Analytics Sidebar:** When an area is selected, the sidebar populates with a rich set of interactive charts and statistics, powered by **ECharts**.
*   **Multiple Data Layers:** Visualise distinct datasets simultaneously, including:
    *   KML Polygons defining specific areas.
    *   Presence Points representing population density.
    *   POI (Points of Interest) spots.
    *   Local Climate Zones (LCZ) and Urban Heat Island (UHI) risk.
*   **Synthetic Crowdedness Engine:** Where direct footfall data is unavailable, CityRhythm employs a K-Nearest Neighbours algorithm. It estimates crowd levels for POIs based on the distance and tag similarity (Jaccard index) to known crowded points.
*   **Dynamic Presence Point Simulation:** Population is visualised not as static dots, but as thousands of individual points with organic, "swarming" behaviour driven by a Perlin noise function. Their distribution is intelligently weighted by the synthetic crowdedness engine.
*   **Dynamic UHI Risk Visualisation:** The Urban Heat Island risk layer is not static. Its opacity dynamically changes based on the combination of an area's intrinsic UHI risk and the real-time density of presence points, highlighting areas of combined risk.
*   **Cross-Filtering Interaction:** Clicking on a chart in the sidebar (e.g., gender distribution) instantly re-colours the presence points on the map to match, providing powerful visual feedback.
*   **3D Visualisation:** Toggle 3D terrain and building extrusions to gain a more immersive understanding of the urban environment.

## Technology Stack

CityRhythm is built with a modern front-end stack, leveraging powerful open-source libraries:

*   **Mapping:** [Mapbox GL JS](https://mapbox.com/mapbox-gl-js)
*   **Data Visualisation/Charts:** [Apache ECharts](https://echarts.apache.org/)
*   **Geospatial Analysis:** [Turf.js](https://turfjs.org/)
*   **Word Cloud Generation:** [D3.js](https://d3js.org/) + `d3-cloud`
*   **CSV Parsing:** [PapaParse](https://www.papaparse.com/)
*   **Date/Time Picker:** [Litepicker](https://litepicker.com/)
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

3.  **Configuration (Optional):**
    The application uses a public Mapbox access token located in `config.js`. If you encounter any issues with the map loading, you may need to replace it with your own token.
    ```javascript
    // In config.js
    export const MAPBOX_TOKEN = 'YOUR_OWN_MAPBOX_TOKEN';
    ```

4.  **Serve the application:**
    We recommend `npx`, which runs a package without installing it globally.
    ```bash
    npx http-server
    ```
    This will start a local server.

5.  **Open in your browser:**
    Open your web browser and navigate to the URL provided by `http-server`, which is typically `http://localhost:8080`.

## Data Sources

The application is powered by several datasets hosted externally. The URLs are configured in `config.js`.

*   **KML Areas:** [cityrhythm_blimp_areas.kml](https://gist.githubusercontent.com/grazianoEnzoMarchesani/aad5e543d62ffd2478b0152348f39e0d/raw/305653b7b40f5858e0d8f83e11a99e921ac500a8/cityrhythm_blimp_areas.kml)
*   **POI Historical Data:** [cityrhythm_blimp.csv](https://gist.githubusercontent.com/grazianoEnzoMarchesani/0ac7cac113479e704e2af0865e7f516d/raw/adb569636698d58b16a610dbc82f1b4936f9b2ad/cityrhythm_blimp.csv)
*   **Crowdedness Data:** [cityrhythm_crowded_data.csv](https://gist.githubusercontent.com/grazianoEnzoMarchesani/d4574acad4dabf1e4b83fe2d68a59e91/raw/90bd98a5ff27ba9d968028ae374211f90025d284/cityrhythm_crowded_data.csv)
*   **POI Spots (Spot Mapper):** [cityrhythm_spotMapper.csv](https://gist.githubusercontent.com/grazianoEnzoMarchesani/c2813df8436ad6ebb91327d5e517f1ae/raw/296130747c07c88cb834d7860a1ceaee43502281/cityrhythm_spotMapper.csv)
*   **LCZ Vitality Data:** [lcz_vitality.csv](https://gist.githubusercontent.com/grazianoEnzoMarchesani/bc2ad1bea5689e0195296daa57f9b893/raw/0ecce2a26b35c561e110a135638f4f5b84c8acd8/lcz_vitality.csv)

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
