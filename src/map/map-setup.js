import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { Protocol } from 'pmtiles';
import { layers, namedFlavor } from '@protomaps/basemaps';
import { viewport } from '../state/store.js';
import { INITIAL_CENTER, INITIAL_ZOOM, MAP_DATA_BASE, KML_SOURCE_ID } from '../data/config.js';

// Vite impacchetta il worker di MapLibre in un file unico; pmtiles:// legge i file .pmtiles locali.
maplibregl.setWorkerUrl(workerUrl);
maplibregl.addProtocol('pmtiles', new Protocol().tile);

// MapLibre vuole URL assoluti per font, icone e sorgenti.
const mapDataUrl = (path) => new URL(MAP_DATA_BASE + path, location.href).href;

// Aspetto "Toner" (Stamen / MapTiler, github.com/openmaptiles/maptiler-toner-gl-style) rifatto sullo
// schema Protomaps: carta bianca, acqua e strade nere, verde a trama. Edifici bianchi, senza tratteggio.
const BLACK = '#000000', WHITE = '#ffffff';
const TONER_FLAVOR = (() => {
    const light = namedFlavor('light');
    const flavor = Object.fromEntries(Object.entries(light).map(([key, value]) =>
        [key, typeof value !== 'string' ? value : /casing|halo/.test(key) ? WHITE : BLACK]));
    Object.assign(flavor, {
        background: WHITE, earth: WHITE, buildings: WHITE, glacier: WHITE, sand: WHITE, beach: WHITE,
        hospital: WHITE, industrial: WHITE, school: WHITE, zoo: WHITE, military: WHITE, aerodrome: WHITE,
        pedestrian: WHITE, pier: WHITE, runway: '#d8d8d8', railway: '#262626',
        tunnel_other: '#9c9c9c', tunnel_minor: '#9c9c9c', tunnel_link: '#9c9c9c', tunnel_major: '#9c9c9c', tunnel_highway: '#9c9c9c',
        ocean_label: WHITE, state_label: '#505050', country_label: BLACK
    });
    flavor.landcover = Object.fromEntries(Object.keys(light.landcover).map(k => [k, WHITE]));
    return flavor;
})();
// Trame del Toner (sprite "toner"): boschi a puntini, cimiteri a crocette, il resto del verde a trattini.
const GREEN_PATTERN = ['match', ['get', 'kind'],
    ['forest', 'wood', 'nature_reserve', 'national_park', 'protected_area'], 'toner:dots-t',
    'cemetery', 'toner:cross-t',
    'toner:dash-t'];

// Stile: mappa di base Protomaps (OSM) in versione Toner senza etichette né icone + edifici TUM in 3D + terreno per setTerrain.
function buildMapStyle() {
    const base = layers('protomaps', TONER_FLAVOR, { lang: 'it' }).filter(l => l.type !== 'symbol');
    const park = base.findIndex(l => l.id === 'landuse_park');
    base[park].paint = { 'fill-color': BLACK, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.3, 16, 1] };
    base.splice(park + 1, 0, { ...base[park], id: 'landuse_park_pattern', paint: { 'fill-pattern': GREEN_PATTERN } });
    base.push({
        // Contorno a terra: bianco su bianco, dall'alto gli edifici altrimenti sparirebbero.
        id: 'buildings-outline', type: 'line', source: 'buildings',
        paint: { 'line-color': BLACK, 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.3, 17, 1.5] }
    }, {
        id: 'buildings-3d', type: 'fill-extrusion', source: 'buildings',
        paint: {
            'fill-extrusion-color': WHITE,
            'fill-extrusion-height': ['coalesce', ['get', 'height'], 0],
            'fill-extrusion-opacity': 1
        }
    });
    return {
        version: 8,
        glyphs: mapDataUrl('fonts/') + '{fontstack}/{range}.pbf', // URL() codificherebbe le graffe
        sprite: [{ id: 'toner', url: mapDataUrl('sprites/toner') }],
        sources: {
            protomaps: {
                type: 'vector', url: 'pmtiles://' + mapDataUrl('ascoli_base.pmtiles'),
                attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://protomaps.com">Protomaps</a> · Stile Toner: <a href="https://stamen.com">Stamen</a>, <a href="https://github.com/openmaptiles/maptiler-toner-gl-style">MapTiler</a>'
            },
            buildings: {
                type: 'geojson', data: mapDataUrl('gba_ascoli.geojson'),
                attribution: 'Edifici: <a href="https://github.com/zhu-xlab/GlobalBuildingAtlas">GlobalBuildingAtlas, TUM</a> (CC BY-NC 4.0)'
            },
            'terrain-dem': {
                type: 'raster-dem', url: 'pmtiles://' + mapDataUrl('ascoli_terreno.pmtiles'),
                encoding: 'terrarium', tileSize: 512,
                attribution: '<a href="https://mapterhorn.com/attribution">© Mapterhorn</a>'
            }
        },
        layers: base
    };
}

let mapInstance = null;
let currentSelectedKmlFeatureId = null;

export function initializeMap(containerId) {
    if (mapInstance) {
        return mapInstance;
    }

    try {
        mapInstance = new maplibregl.Map({
            container: containerId,
            style: buildMapStyle(),
            center: INITIAL_CENTER,
            zoom: INITIAL_ZOOM,
            trackResize: true,
        });

        mapInstance.addControl(new maplibregl.NavigationControl());

        const publishViewport = () => {
            const b = mapInstance.getBounds();
            viewport.set({
                bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
                zoom: mapInstance.getZoom(),
                center: mapInstance.getCenter().toArray()
            });
        };
        mapInstance.on('load', publishViewport);
        mapInstance.on('moveend', publishViewport);

        mapInstance.on('error', (e) => {
            console.error("Mapbox Error:", e);
            // Gestione specifica per errori di caricamento stile/tile
            if (e.error && (e.error.message.includes('Failed to fetch') || e.error.message.includes('style'))) {
                 console.error("Could not load map style or tiles. Check style URL and network connection.");
                 // Potresti mostrare un messaggio all'utente qui
                 const mapContainer = document.getElementById(containerId);
                 if (mapContainer && !mapContainer.querySelector('.map-error-message')) {
                     const errorDiv = document.createElement('div');
                     errorDiv.className = 'map-error-message';
                     errorDiv.style.position = 'absolute';
                     errorDiv.style.top = '0';
                     errorDiv.style.left = '0';
                     errorDiv.style.width = '100%';
                     errorDiv.style.padding = '10px';
                     errorDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
                     errorDiv.style.color = 'white';
                     errorDiv.style.textAlign = 'center';
                     errorDiv.style.zIndex = '1000';
                     errorDiv.textContent = 'Error loading map style. Please check the console for details.';
                     mapContainer.appendChild(errorDiv);
                 }
            }
        });

        return mapInstance;

    } catch (error) {
         console.error("Failed to initialize map:", error);
         const mapContainer = document.getElementById(containerId);
         if (mapContainer) {
             mapContainer.innerHTML = `<div style="padding: 20px; color: red; background: #fdd; border: 1px solid red;">Failed to initialize map: ${error.message}. Please ensure MapLibre GL JS is loaded correctly.</div>`;
         }
         throw error; // Rilancia l'errore per bloccare eventualmente l'esecuzione
    }
}

// Dati attuali (lo stesso oggetto passato a setData) di una sorgente GeoJSON.
// ponytail: campo interno di MapLibre (_data.geojson); se cambia, passare a `await source.getData()`
// (pubblico ma asincrono: modificare le properties non arriverebbe più all'animazione dei punti).
export function getGeoJsonSourceData(source) {
    return source?._data?.geojson ?? null;
}

export function getMapInstance() {
    if (!mapInstance) {
        // Considera un messaggio di errore più robusto o un ritorno gestito
        console.error("Map instance is not available. Was initializeMap called successfully?");
        throw new Error("Map instance is not available.");
    }
    return mapInstance;
}

export function setKmlFeatureSelectedState(featureId) {
    // Nessuna modifica necessaria qui, usa l'API standard setFeatureState
    if (!mapInstance || !mapInstance.isStyleLoaded()) {
        // Considera un logging o un tentativo di ritardo se lo stile non è caricato
        console.warn("setKmlFeatureSelectedState called before style loaded or map not ready.");
        return;
    }

    const sourceId = KML_SOURCE_ID;

    // Verifica se la source esiste prima di interagire
    if (!mapInstance.getSource(sourceId)) {
        console.warn(`Source ${sourceId} not found. Cannot set feature state.`);
        currentSelectedKmlFeatureId = null;
        return;
    }

    const previousFeatureId = currentSelectedKmlFeatureId;

    // Deseleziona il feature precedente, se esiste
    if (previousFeatureId !== null && previousFeatureId !== undefined) {
        try {
            // Verifica se il feature state esiste prima di tentare di impostarlo a false
             if (mapInstance.getFeatureState({ source: sourceId, id: previousFeatureId })?.selected) {
                mapInstance.setFeatureState(
                    { source: sourceId, id: previousFeatureId },
                    { selected: false }
                );
             }
        } catch (e) {
            // Logga errori meno comuni, ignora errori "not found" che possono accadere
            if (!e.message?.includes('not found') && !e.message?.includes('No feature with ID')) {
                console.warn(`Minor error deselecting previous feature ${previousFeatureId}: ${e.message}`);
            }
        }
    }

    // Seleziona il nuovo feature, se fornito
    if (featureId !== null && featureId !== undefined) {
         // Non c'è bisogno di distinguere se è lo stesso del precedente,
         // setFeatureState sovrascrive o imposta lo stato.
        try {
             mapInstance.setFeatureState(
                 { source: sourceId, id: featureId },
                 { selected: true }
             );
             currentSelectedKmlFeatureId = featureId;
        } catch (e) {
             if (!e.message?.includes('not found') && !e.message?.includes('No feature with ID')) {
                 console.error(`Error setting feature state for ID ${featureId}: ${e.message}`);
             } else {
                 console.warn(`Feature with ID ${featureId} not found in source ${sourceId}. Cannot select.`);
             }
             // Se fallisce la selezione, assicurati che non rimanga selezionato
             currentSelectedKmlFeatureId = null;
        }
    } else {
        // Se featureId è null o undefined, nessun feature è selezionato
        currentSelectedKmlFeatureId = null;
    }
}