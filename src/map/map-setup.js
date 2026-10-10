import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { Protocol } from 'pmtiles';
import { layers, namedFlavor } from '@protomaps/basemaps';
import { viewport } from '../state/store.js';
import { INITIAL_CENTER, INITIAL_ZOOM, MAP_DATA_BASE, KML_SOURCE_ID, NOLLI_COLORS } from '../data/config.js';

// Vite impacchetta il worker di MapLibre in un file unico; pmtiles:// legge i file .pmtiles locali.
maplibregl.setWorkerUrl(workerUrl);
maplibregl.addProtocol('pmtiles', new Protocol().tile);

// MapLibre vuole URL assoluti per font, icone e sorgenti.
const mapDataUrl = (path) => new URL(MAP_DATA_BASE + path, location.href).href;
const mapContainerEl = (id) => document.getElementById(id);

// Etichette dei controlli di MapLibre (tooltip e pulsanti) in italiano
const ITALIAN_LABELS = {
    'AttributionControl.ToggleAttribution': 'Crediti',
    'AttributionControl.MapFeedback': 'Segnala un problema',
    'NavigationControl.ResetBearing': 'Trascina per ruotare e inclinare, clic per tornare a nord',
    'NavigationControl.ZoomIn': 'Avvicina',
    'NavigationControl.ZoomOut': 'Allontana',
    'Map.Title': 'Mappa di Ascoli Piceno',
    'Popup.Close': 'Chiudi il popup',
};

// Aspetto "Toner" (Stamen / MapTiler, github.com/openmaptiles/maptiler-toner-gl-style) rifatto sullo
// schema Protomaps: carta bianca, acqua e strade nere, verde a trama. Edifici bianchi, senza tratteggio.
const BLACK = '#000000', WHITE = '#ffffff';
const TONER_3D_GREY = '#cfcfcf';
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

// Livelli in stile Toner: mappa di base Protomaps (OSM) senza etichette né icone + edifici TUM (2D e 3D).
function tonerLayers() {
    const base = layers('protomaps', TONER_FLAVOR, { lang: 'it' }).filter(l => l.type !== 'symbol');
    const park = base.findIndex(l => l.id === 'landuse_park');
    base[park].paint = { 'fill-color': BLACK, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.3, 16, 1] };
    base.splice(park + 1, 0, { ...base[park], id: 'landuse_park_pattern', paint: { 'fill-pattern': GREEN_PATTERN } });
    base.push({
        // Pieni dello stile Nolli (spenti nel Toner)
        id: 'buildings-fill', type: 'fill', source: 'buildings',
        layout: { visibility: 'none' },
        paint: { 'fill-color': NOLLI_COLORS.PIENI }
    }, {
        // Contorno a terra: bianco su bianco, dall'alto gli edifici altrimenti sparirebbero.
        id: 'buildings-outline', type: 'line', source: 'buildings',
        paint: { 'line-color': BLACK, 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.3, 17, 1.5] }
    }, {
        // Spento all'avvio (tasto 3D, ui-map-tools.js): restano le impronte 2D col contorno.
        // Grigio chiaro [S]: bianchi su fondo bianco non si vedevano in vista inclinata.
        id: 'buildings-3d', type: 'fill-extrusion', source: 'buildings',
        layout: { visibility: 'none' },
        paint: {
            'fill-extrusion-color': TONER_3D_GREY,
            'fill-extrusion-height': ['coalesce', ['get', 'height'], 0],
            'fill-extrusion-opacity': 1
        }
    });
    return base;
}

// Stile "Nolli" (Pianta di Roma di G. B. Nolli, 1748): gli edifici sono i pieni scuri, strade e piazze il vuoto
// bianco fra i pieni, senza linee. Gli interni pubblici (chiese, musei, teatri, biblioteche: campo pub,
// sound-lab/interni_pubblici.py) restano bianchi col contorno, come in Nolli; i ponti sono vuoto bianco sul fiume.
// Da lontano strade principali, ferrovia e fiumi neri come nel Toner, per orientarsi fuori dal costruito; fra z 13
// e 15 (una strada di 6–8 m passa da 1 a 4 pixel e si legge già come vuoto fra gli isolati) le strade svaniscono
// e i fiumi diventano grigi. Stessi livelli del Toner: cambiano solo colori e visibilità (setBaseStyle).
const MAIN_ROADS = /^roads_(highway|major|rail|tunnels_highway|tunnels_major)$/;
const MAIN_BRIDGES = /^roads_bridges_(highway|major)$/;
function nolliLayers() {
    const nearZoom = (far, near) => ['interpolate', ['linear'], ['zoom'], 13, far, 15, near];
    return tonerLayers().map(l => {
        const n = { ...l, layout: { ...l.layout }, paint: { ...l.paint } };
        if (l.id === 'water') n.paint['fill-color'] = nearZoom(BLACK, NOLLI_COLORS.ACQUA);
        else if (l.id.startsWith('water_')) n.paint['line-color'] = nearZoom(BLACK, NOLLI_COLORS.ACQUA);
        // Le trame del Toner sono bianche coi buchi: sotto, nero pieno a ogni zoom (puntini e trattini sempre neri)
        else if (l.id === 'landuse_park') n.paint['fill-opacity'] = 1;
        else if (l.id === 'landuse_urban_green') n.paint['fill-opacity'] = 0;
        else if (MAIN_ROADS.test(l.id)) Object.assign(n.paint, { 'line-color': BLACK, 'line-opacity': nearZoom(1, 0) });
        else if (MAIN_BRIDGES.test(l.id)) n.paint['line-color'] = nearZoom(BLACK, WHITE);
        else if (l.id.startsWith('roads_bridges_')) n.paint['line-color'] = WHITE;
        else if (l.id.startsWith('roads_') || l.id.startsWith('boundaries')) n.layout.visibility = 'none';
        else if (l.id === 'buildings-fill') {
            n.layout.visibility = 'visible';
            n.paint['fill-color'] = ['case', ['has', 'pub'], WHITE, NOLLI_COLORS.PIENI];
        }
        else if (l.id === 'buildings-outline') n.paint['line-color'] = NOLLI_COLORS.PIENI;
        else if (l.id === 'buildings-3d') n.paint['fill-extrusion-color'] = ['case', ['has', 'pub'], '#e6e6e6', '#5a5a5a'];
        return n;
    });
}

const BASE_STYLES = { toner: tonerLayers(), nolli: nolliLayers() };

// Stile di partenza: Nolli. Resta quello scelto da chi guarda, se ne ha scelto un altro (ricordato nel browser).
// Chiave nuova: la versione precedente scriveva 'toner' a ogni visita, anche senza una scelta, e lo avrebbe
// mantenuto Toner per chi aveva già aperto il sito. Qui si salva solo dopo un clic.
export const MAP_STYLE_KEY = 'cityrhythm.mapStyle.v2';
export function getSavedMapStyle() {
    try { return localStorage.getItem(MAP_STYLE_KEY) === 'toner' ? 'toner' : 'nolli'; } catch (e) { return 'nolli'; }
}
let baseStyle = getSavedMapStyle();

export function getBaseStyle() {
    return baseStyle;
}

/** Passa la mappa di base a un altro stile ('toner' o 'nolli') cambiando solo le proprietà diverse. */
export function setBaseStyle(name) {
    if (!BASE_STYLES[name] || name === baseStyle) return;
    const from = new Map(BASE_STYLES[baseStyle].map(l => [l.id, l]));
    BASE_STYLES[name].forEach(l => {
        const old = from.get(l.id);
        const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
        new Set([...Object.keys(old.paint ?? {}), ...Object.keys(l.paint ?? {})]).forEach(key => {
            if (!same(old.paint?.[key], l.paint?.[key])) mapInstance.setPaintProperty(l.id, key, l.paint?.[key]);
        });
        const visibility = l.layout?.visibility ?? 'visible';
        if (visibility !== (old.layout?.visibility ?? 'visible')) mapInstance.setLayoutProperty(l.id, 'visibility', visibility);
    });
    baseStyle = name;
}

function buildMapStyle() {
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
                attribution: 'Edifici: <a href="https://github.com/zhu-xlab/GlobalBuildingAtlas">GlobalBuildingAtlas, TUM</a> (CC BY-NC 4.0) · Residenti: <a href="https://dataforgood.facebook.com/dfg/tools/high-resolution-population-density-maps">Meta Data for Good</a> (CC BY 4.0)'
                    + ' · Gente in casa: ISTAT Uso del tempo 2008-09 via <a href="https://doi.org/10.18128/D062.V1.5">IPUMS MTUS v1.5</a>;'
                    + ' this document uses the <a href="http://www.timeuse.org/mtus/reference.html">Multinational Time Use Study</a>, Centre for Time Use Research, University College London 2019'
            },
            'terrain-dem': {
                type: 'raster-dem', url: 'pmtiles://' + mapDataUrl('ascoli_terreno.pmtiles'),
                encoding: 'terrarium', tileSize: 512,
                attribution: '<a href="https://mapterhorn.com/attribution">© Mapterhorn</a>'
            }
        },
        layers: BASE_STYLES[baseStyle]
    };
}

// Un elemento già nella pagina (index.html) messo fra i controlli di MapLibre: lo sposta lui nella colonna
class ElementControl {
    constructor(element) { this.element = element; }
    onAdd() { return this.element; }
    onRemove() { this.element.remove(); }
}

let mapInstance = null;
let currentSelectedKmlFeatureId = null;
let mapReady = false;

// Dopo 'load' lo stile accetta sorgenti, livelli e proprietà. Non usare map.isStyleLoaded() né
// l'evento 'idle': sono falso / non arrivano mentre una sorgente GeoJSON si aggiorna, cioè quasi
// sempre col brulichio dei puntini (setData ~30 volte al secondo).
export function isMapReady() {
    return mapReady;
}

export function whenMapReady(fn) {
    if (mapReady) fn();
    else mapInstance.once('load', fn);
}

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
            attributionControl: false, // lo aggiungiamo sotto, compatto
            locale: ITALIAN_LABELS,
        });
        mapInstance.once('load', () => { mapReady = true; });

        // In alto a destra, in quest'ordine: zoom, comandi della mappa (stile, 3D), crediti (chiusi).
        // Il tasto "i" apre il testo completo.
        // La freccia del Nord si inclina con la mappa (visualizePitch): si vede se la vista è in 3D
        mapInstance.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
        mapInstance.addControl(new ElementControl(document.getElementById('map-tools')), 'top-right');
        mapInstance.addControl(new maplibregl.AttributionControl({ compact: true }), 'top-right');
        // Con la mappa caricata i crediti partono chiusi: li apre solo il tasto "i"
        mapInstance.once('load', () => {
            mapContainerEl(containerId)?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
        });

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
            // Errori di caricamento dello stile o delle tessere: un messaggio visibile in mappa
            if (e.error && (e.error.message.includes('Failed to fetch') || e.error.message.includes('style'))) {
                 console.error("Could not load map style or tiles. Check style URL and network connection.");
                 const mapContainer = document.getElementById(containerId);
                 if (mapContainer && !mapContainer.querySelector('.map-error')) {
                     const errorDiv = document.createElement('div');
                     errorDiv.className = 'map-error';
                     errorDiv.setAttribute('role', 'alert');
                     errorDiv.textContent = 'Non riesco a caricare la mappa. Controlla la connessione e ricarica la pagina.';
                     mapContainer.appendChild(errorDiv);
                 }
            }
        });

        return mapInstance;

    } catch (error) {
         console.error("Failed to initialize map:", error);
         const mapContainer = document.getElementById(containerId);
         if (mapContainer) {
             mapContainer.innerHTML = `<div class="map-error" role="alert">Non riesco ad avviare la mappa: ${error.message}</div>`;
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
    if (!mapInstance || !mapReady) {
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