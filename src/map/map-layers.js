import * as turf from '@turf/turf';
import { Popup } from 'maplibre-gl';
// src/map/map-layers.js
import { getMapInstance, isMapReady, whenMapReady, getBaseStyle, setWhiteOverCellsHidden, CELLS_UNDER_ID } from './map-setup.js';
import {
    KML_SOURCE_ID, KML_LAYER_ID, QUARTIERI_CREDITO,
    PRESENCE_POINTS_SOURCE_ID, PRESENCE_POINTS_LAYER_ID,
    CROWDED_SOURCE_ID, CROWDED_LAYER_ID,
    SPOTS_SOURCE_ID, SPOTS_LAYER_ID,
    LCZ_VITALITY_SOURCE_ID, LCZ_VITALITY_LAYER_ID,
    MAP_DATA_BASE, HOME_SHARE_URL, PRESENCE_HOME_OPACITY, PRESENCE_HOME_RADIUS, PRESENCE_MOVE_MS, PRESENCE_EXIT_METERS,
    PRESENCE_STAGGER, PRESENCE_BEND_MAX_M, PRESENCE_WIGGLE_PX, PRESENCE_WIGGLE_MIN_M, PRESENCE_WIGGLE_MAX_M,
    PRESENCE_WIGGLE_STEP_PX, MAP_STYLES, LCZ_DATA_VIEWS, UTCI_BANDS, UTCI_RAMP, SOUND_STATE_COLORS,
    DEBUG_MODE // <-- aggiunto
} from '../data/config.js';

// Chi è in casa si disegna attenuato: homeT va da 0 (fuori) a 1 (dentro un edificio)
const HOME_T = ['coalesce', ['get', 'homeT'], ['case', ['==', ['get', 'atHome'], true], 1, 0]];
const HOME_DIM = ['-', 1, ['*', 1 - PRESENCE_HOME_OPACITY, HOME_T]];
const FADE = ['coalesce', ['get', 'fade'], 1];

// Aspetto dei puntini (con o senza colore) nello stile di base attuale.
// Toner: da lontano neri, da vicino chi è fuori diventa bianco col bordo; chi è in casa attenuato.
// Nolli: una regola sola a ogni zoom. Chi è fuori è nero col bordo nero; chi è in casa è vuoto dentro, solo un
// bordo bianco che si vede sugli edifici scuri, grande la metà (PRESENCE_HOME_RADIUS). Col colore: fuori colore col
// bordo nero, in casa bordo del suo colore.
function presencePaint(colored) {
    const s = colored ? MAP_STYLES.PRESENCE_POINTS_COLOR : MAP_STYLES.PRESENCE_POINTS_ZOOM;
    if (getBaseStyle() === 'nolli') {
        const color = colored ? ['to-color', ['get', 'color']] : '#000000';
        // Lo zoom può stare solo in cima all'espressione: si scala il raggio di ogni tappa
        const homeScale = ['-', 1, ['*', 1 - PRESENCE_HOME_RADIUS, HOME_T]];
        return {
            'circle-radius': s.CIRCLE_RADIUS.map((v, i) => (i >= 4 && i % 2 === 0 ? ['*', v, homeScale] : v)),
            'circle-color': color,
            'circle-opacity': ['*', FADE, ['-', 1, HOME_T]],
            'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 12, 0.5, 15, 1],
            'circle-stroke-color': ['interpolate', ['linear'], HOME_T, 0, '#000000', 1, colored ? color : '#ffffff'],
            'circle-stroke-opacity': FADE
        };
    }
    return {
        'circle-radius': s.CIRCLE_RADIUS,
        'circle-color': s.CIRCLE_COLOR,
        'circle-opacity': ['*', s.CIRCLE_OPACITY, FADE, HOME_DIM],
        'circle-stroke-width': s.CIRCLE_STROKE_WIDTH,
        'circle-stroke-color': s.CIRCLE_STROKE_COLOR,
        'circle-stroke-opacity': ['*', s.CIRCLE_STROKE_OPACITY, FADE, HOME_DIM]
    };
}
import { calculateAveragePresenceForFeature, generatePointsForFeature, perlin2d, hash01, getWeekIndex, getDateTimeFromIndex } from '../utils/utils.js';
import { residentsSeenAtNight, homeShareFor } from './home-share.js';
import { applyPresenceColors, getPreviousPersonColor } from './presence-colors.js';
import { getFullKmlGeoJson, getPoiData, getLuoghi, getLczVitalityData, getDisplayGeometry } from '../data/data-loader.js';
import { addMapInteraction } from './map-interaction.js';
import { cellMap, presence, ispezioneCelle, puntoAscolto, raggioAscolto, celleVarco } from '../state/store.js';
import { setCellMapActive } from '../compass/cell-map.js';
import { coloreSuono } from '../compass/sound-color.js';

let fullCrowdedGeoJson = null; // luoghi con l'affluenza dell'ora (livello di debug «Affollamento»)
let fullSpotsGeoJson = null;   // luoghi OSM (livello sempre nascosto: i luoghi servono da poliattrattori)
let currentPresencePoints = null; // GeoJSON dei punti generati (con seed)
let animationFrameId = null;
let currentLczVisualizationType = 'LCZ'; // 'LCZ' or 'UHI'
let uhiDynamicVisibilityEnabled = false; // Flag per la visibilità dinamica UHI
let currentLczOpacity = 1; // Opacità corrente del layer LCZ (Intensità dello strato, 100% di default)
let lczOpacityBase = currentLczOpacity; // Opacità del riempimento senza evidenziazione: numero o rischio UHI dinamico
let lczHighlight = null; // Voce scelta nella legenda ({ view, key | lo, hi }); null = tutte le celle
let cellsOnTop = false; // "Sopra tutta la mappa": spento = le celle stanno sotto edifici, fiume, strade e verde

// --- CAMPO DI FORZE STATICO (GRIGLIA) ---
// Risoluzione della griglia in metri (es: 250 = 250m tra i punti della griglia)
const FORCE_GRID_RESOLUTION_METERS = 100;
let FORCE_GRID = null; // Verrà generata automaticamente
let FORCE_GRID_BBOX = null; // [minLon, minLat, maxLon, maxLat]

// Funzione per convertire metri in gradi latitudine (approssimazione)
function metersToLatDegrees(meters) {
    return meters / 111320;
}
// Funzione per convertire metri in gradi longitudine a una certa latitudine
function metersToLonDegrees(meters, lat) {
    return meters / (111320 * Math.cos(lat * Math.PI / 180));
}

// Genera la griglia FORCE_GRID in base alla bounding box delle KML e ai luoghi che attirano gente in quell'ora
function generateForceGrid(fullKml, timelineHourIndex) {
    if (!fullKml?.features?.length) return [];
    const ora = getWeekIndex(timelineHourIndex);
    const attractors = getLuoghi()
        .filter(l => l.affluenza[ora] > 0)
        .map(l => ({ lon: l.lon, lat: l.lat, strength: l.affluenza[ora] }));
    // DEBUG: log attractors
    console.log('Attractors:', attractors.length, attractors.map(a => a.strength));
    // Calcola la bounding box di tutte le KML
    const bbox = turf.bbox(fullKml); // [minLon, minLat, maxLon, maxLat]
    FORCE_GRID_BBOX = bbox;
    const [minLon, minLat, maxLon, maxLat] = bbox;
    // Calcola step in gradi
    const centerLat = (minLat + maxLat) / 2;
    const latStep = metersToLatDegrees(FORCE_GRID_RESOLUTION_METERS);
    const lonStep = metersToLonDegrees(FORCE_GRID_RESOLUTION_METERS, centerLat);
    // Parametri campo di forze
    const ATTR_FORCE_MULTIPLIER = 20;
    const RAGGIO_ATTRATTORE_KM = 2.0;
    const DECAY = 1.0;
    const grid = [];
    for (let lat = minLat; lat <= maxLat; lat += latStep) {
        for (let lon = minLon; lon <= maxLon; lon += lonStep) {
            let fx = 0, fy = 0;
            let attracted = false;
            attractors.forEach(attr => {
                // Calcola distanza in km
                const distKm = turf.distance([lon, lat], [attr.lon, attr.lat], { units: 'kilometers' });
                if (distKm < RAGGIO_ATTRATTORE_KM && distKm > 0.0001) {
                    attracted = true;
                    // Forza gravitazionale: F = strength / dist^DECAY
                    const force = ATTR_FORCE_MULTIPLIER * attr.strength / Math.pow(distKm, DECAY);
                    // Direzione verso l'attrattore
                    const dx = attr.lon - lon;
                    const dy = attr.lat - lat;
                    const mag = Math.sqrt(dx*dx + dy*dy);
                    if (mag > 0) {
                        fx += (dx / mag) * force * lonStep;
                        fy += (dy / mag) * force * latStep;
                    }
                }
            });
            // Forza random azzerata per debug
            if (!attracted) {
                fx += 0;
                fy += 0;
            }
            grid.push({ lon, lat, fx, fy });
        }
    }
    return grid;
}

// Trova il vettore di forza più vicino alle coordinate date
function getForceVectorForCoord(lon, lat, fullKml = null, timelineHourIndex = 0) {
    if (!FORCE_GRID || !FORCE_GRID_BBOX) {
        // Genera la griglia la prima volta che serve
        FORCE_GRID = generateForceGrid(fullKml || getFullKmlGeoJson(), timelineHourIndex);
    }
    let minDist = Infinity;
    let best = { fx: 0, fy: 0 };
    for (const cell of FORCE_GRID) {
        const d = Math.pow(cell.lon - lon, 2) + Math.pow(cell.lat - lat, 2);
        if (d < minDist) {
            minDist = d;
            best = cell;
        }
    }
    return { fx: best.fx, fy: best.fy };
}

// --- FUNZIONI ESPORTATE ---

/**
 * Imposta la visibilità di un layer sulla mappa.
 * @param {string} layerId - ID del layer da modificare.
 * @param {boolean} isVisible - True per rendere visibile, false per nascondere.
 */
export function setLayerVisibility(layerId, isVisible) {
    const map = getMapInstance();
    if (!map) {
        console.warn(`setLayerVisibility: Map instance not available for layer ${layerId}.`);
        return;
    }

    const visibilityValue = isVisible ? 'visible' : 'none';

    const applyVisibility = () => {
        // Gestione speciale per presence points: nascondi/mostra entrambi i sottolayer
        if (layerId === PRESENCE_POINTS_LAYER_ID) {
            [PRESENCE_POINTS_LAYER_ID + '-color', PRESENCE_POINTS_LAYER_ID + '-zoom'].forEach(subId => {
                if (map.getLayer(subId)) {
                    if (map.getLayoutProperty(subId, 'visibility') !== visibilityValue) {
                        map.setLayoutProperty(subId, 'visibility', visibilityValue);
                    }
                }
            });
            return;
        }
        try {
            if (map.getLayer(layerId)) {
                if (map.getLayoutProperty(layerId, 'visibility') !== visibilityValue) {
                    map.setLayoutProperty(layerId, 'visibility', visibilityValue);
                }
            } else {
                // console.warn(`setLayerVisibility: Layer ${layerId} not found on map.`);
            }
        } catch (error) {
            if (!error.message.includes('does not exist')) {
                 console.error(`Error setting visibility for layer ${layerId}:`, error);
            }
        }
    };

    if (!isMapReady()) {
        whenMapReady(applyVisibility);
    } else {
        applyVisibility();
    }
}

// Stato globale dello stile: le celle LCZ sono visibili? Lo scrive addLczVitalityLayer / removeLczVitalityLayer
const CELLE_VISIBILI = 'celleVisibili';

/**
 * Aggiunge i layer KML (base-outline, fill, outline) alla mappa.
 * @param {object} geoJson - GeoJSON FeatureCollection per le aree KML.
 * @param {boolean} initialVisibility - Visibilità iniziale dei layer.
 */
export function addKmlLayer(geoJson, initialVisibility = true) {
    const map = getMapInstance();
    // Attendi che la mappa e lo stile siano pronti
    if (!map || !isMapReady()) {
        // console.log("addKmlLayer: Map or style not ready, deferring.");
        whenMapReady(() => addKmlLayer(geoJson, initialVisibility));
        return;
    }

    // Rimuovi layer e source esistenti per evitare duplicati
    const layersToRemove = [KML_LAYER_ID + '-outline', KML_LAYER_ID, KML_LAYER_ID + '-base-outline'];
    layersToRemove.forEach(layerId => {
        try {
            if (map.getLayer(layerId)) map.removeLayer(layerId);
        } catch (e) { console.warn(`Could not remove layer ${layerId}: ${e.message}`); }
    });
    try {
        if (map.getSource(KML_SOURCE_ID)) map.removeSource(KML_SOURCE_ID);
    } catch (e) { console.warn(`Could not remove source ${KML_SOURCE_ID}: ${e.message}`); }


    if (!geoJson?.features?.length) {
        console.warn("addKmlLayer: No features in GeoJSON, skipping layer addition.");
        return;
    }

    // Prepara GeoJSON assicurando che ogni feature abbia un ID univoco (necessario per feature state)
    const geoJsonForDisplay = JSON.parse(JSON.stringify(geoJson));
    let missingIdCount = 0;
    geoJsonForDisplay.features.forEach((feature, index) => {
        if (!feature.properties) feature.properties = {};
        // Solo il disegno: il confine mostrato e cliccato può essere quello ricavato dalle sezioni ISTAT.
        // I calcoli (presenze, celle, case, Spot) leggono il KML originale con getFullKmlGeoJson()
        const confineDisegno = getDisplayGeometry(feature.properties.name);
        if (confineDisegno) feature.geometry = confineDisegno;
        // Assicura stato hover default
        feature.properties.hovered = false;
        // Verifica e assegna ID se manca (promoteId richiede che l'ID sia nel campo 'id' principale)
        if (feature.id === undefined || feature.id === null) {
            if (feature.properties.id) {
                feature.id = feature.properties.id; // Promuovi ID da properties
            } else {
                // Genera un ID se manca completamente
                feature.id = `kml_feature_${index}`;
                feature.properties.id = feature.id; // Salvalo anche nelle properties se serve altrove
                missingIdCount++;
            }
        }
        // Assicura che feature.properties.id esista se feature.id esiste
        if (feature.id !== undefined && feature.properties.id === undefined) {
             feature.properties.id = feature.id;
        }
    });
    if (missingIdCount > 0) {
        console.warn(`addKmlLayer: Assigned fallback IDs to ${missingIdCount} KML features.`);
    }

    try {
        // Aggiungi la sorgente GeoJSON
        map.addSource(KML_SOURCE_ID, {
            type: 'geojson',
            data: geoJsonForDisplay,
            promoteId: 'id', // Usa il campo 'id' della feature come ID univoco
            attribution: QUARTIERI_CREDITO
        });

        // Inizializza hoverAmount a 0 per tutte le feature KML
        geoJsonForDisplay.features.forEach(f => {
            try {
                map.setFeatureState({ source: KML_SOURCE_ID, id: f.id }, { hoverAmount: 0 });
            } catch (e) {}
        });

        // Determina dove inserire i layer (sotto i punti se esistono)
        let beforeLayerId;
        const pointLayers = [PRESENCE_POINTS_LAYER_ID, CROWDED_LAYER_ID, SPOTS_LAYER_ID];
        for (const pointLayer of pointLayers) {
            if (map.getLayer(pointLayer)) {
                beforeLayerId = pointLayer;
                break;
            }
        }
        // console.log(`Adding KML layers before: ${beforeLayerId || 'top'}`);

        // 1. Layer Base Outline (sempre visibile sotto il fill)
        map.addLayer({
            id: KML_LAYER_ID + '-base-outline',
            type: 'line',
            source: KML_SOURCE_ID,
            layout: { 'visibility': initialVisibility ? 'visible' : 'none' },
            paint: {
                'line-color': MAP_STYLES.KML_LAYER.BASE_OUTLINE['line-color'],
                'line-width': MAP_STYLES.KML_LAYER.BASE_OUTLINE['line-width']
            }
        }, beforeLayerId);

        // 2. Layer Fill (invisibile di default, colorato su hover/selezione)
        map.addLayer({
            id: KML_LAYER_ID,
            type: 'fill',
            source: KML_SOURCE_ID,
            layout: { 'visibility': initialVisibility ? 'visible' : 'none' },
            paint: {
                'fill-color': [
                    'case',
                    // Con le celle accese l'area non si colora: resta solo il contorno, i colori delle celle non cambiano
                    ['==', ['global-state', CELLE_VISIBILI], true], MAP_STYLES.KML_LAYER.FILL.DEFAULT,
                    ['boolean', ['feature-state', 'selected'], false], MAP_STYLES.KML_LAYER.FILL.SELECTED,
                    // Interpolazione sfumata su hoverAmount
                    ['interpolate', ['linear'], ['feature-state', 'hoverAmount'], 0, MAP_STYLES.KML_LAYER.FILL.DEFAULT, 1, MAP_STYLES.KML_LAYER.FILL.HOVER],
                ],
                'fill-opacity': [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false], MAP_STYLES.KML_LAYER.OPACITY.SELECTED,
                    // Interpolazione sfumata su hoverAmount
                    ['interpolate', ['linear'], ['feature-state', 'hoverAmount'], 0, MAP_STYLES.KML_LAYER.OPACITY.DEFAULT, 1, MAP_STYLES.KML_LAYER.OPACITY.HOVER],
                ]
            }
        }, beforeLayerId);

        // 3. Layer Outline Dinamico (per hover/selezione)
        map.addLayer({
            id: KML_LAYER_ID + '-outline',
            type: 'line',
            source: KML_SOURCE_ID,
            layout: { 'visibility': initialVisibility ? 'visible' : 'none' },
            paint: {
                'line-color': [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false], MAP_STYLES.KML_LAYER.OUTLINE.SELECTED_COLOR,
                    ['interpolate', ['linear'], ['feature-state', 'hoverAmount'], 0, MAP_STYLES.KML_LAYER.OUTLINE.DEFAULT_COLOR, 1, MAP_STYLES.KML_LAYER.OUTLINE.HOVER_COLOR],
                ],
                'line-width': [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false], MAP_STYLES.KML_LAYER.OUTLINE.SELECTED_WIDTH,
                    ['interpolate', ['linear'], ['feature-state', 'hoverAmount'], 0, MAP_STYLES.KML_LAYER.OUTLINE.DEFAULT_WIDTH, 1, MAP_STYLES.KML_LAYER.OUTLINE.HOVER_WIDTH],
                ],
                'line-opacity': [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false], MAP_STYLES.KML_LAYER.OUTLINE.SELECTED_OPACITY,
                    ['interpolate', ['linear'], ['feature-state', 'hoverAmount'], 0, MAP_STYLES.KML_LAYER.OUTLINE.DEFAULT_OPACITY, 1, MAP_STYLES.KML_LAYER.OUTLINE.HOVER_OPACITY],
                ],
                // use a static dash pattern since expressions on dasharray aren't supported in Mapbox
                'line-dasharray': [2, 2]
            }
        }, beforeLayerId);

        // Aggiungi/aggiorna le interazioni dopo che i layer sono stati aggiunti
        addMapInteraction(map);

        // Funzione globale per aggiornare lo stato hover
        window.updateKmlHoverState = function(featureId, isHovered) {
             const currentMap = getMapInstance(); // Prendi l'istanza corrente
             if (!currentMap || !isMapReady() || !currentMap.getSource(KML_SOURCE_ID)) return;
             try {
                 currentMap.setFeatureState(
                     { source: KML_SOURCE_ID, id: featureId },
                     { hover: isHovered }
                 );
             } catch (error) {
                  if (!error.message?.includes('not found') && !error.message?.includes('No feature with ID')) {
                     console.warn(`Error setting hover state (${isHovered}) for feature ${featureId}: ${error.message}`);
                  }
             }
         };

    } catch (error) {
        console.error('Error adding KML source or layers:', error);
        layersToRemove.forEach(layerId => {
             try { if (map.getLayer(layerId)) map.removeLayer(layerId); } catch (e) {}
         });
        try { if (map.getSource(KML_SOURCE_ID)) map.removeSource(KML_SOURCE_ID); } catch (e) {}
    }
}

// --- LAYER PUNTI PRESENZA (PRESENCE POINTS) ---

export function removePresencePointsLayer() {
    const map = getMapInstance(); if (!map) return;
    try { if (map.getLayer(PRESENCE_POINTS_LAYER_ID)) map.removeLayer(PRESENCE_POINTS_LAYER_ID); } catch (e) { /* ignore */ }
    try { if (map.getSource(PRESENCE_POINTS_SOURCE_ID)) map.removeSource(PRESENCE_POINTS_SOURCE_ID); } catch (e) { /* ignore */ }
}

export function addOrUpdatePresencePointsLayer(pointsGeoJson, initialVisibility = true) {
    const map = getMapInstance();
    if (!map || !isMapReady()) {
        whenMapReady(() => addOrUpdatePresencePointsLayer(pointsGeoJson, initialVisibility));
        return;
    }

    const source = map.getSource(PRESENCE_POINTS_SOURCE_ID);

    if (!pointsGeoJson?.features?.length) {
        removePresencePointsLayer();
        return;
    }

    if (source) {
        try {
            source.setData(pointsGeoJson);
            setLayerVisibility(PRESENCE_POINTS_LAYER_ID, initialVisibility);
        } catch (e) {
            console.error("Error updating presence points source data:", e);
            removePresencePointsLayer();
            addOrUpdatePresencePointsLayer(pointsGeoJson, initialVisibility);
        }
    } else {
        try {
            map.addSource(PRESENCE_POINTS_SOURCE_ID, {
                type: 'geojson',
                data: pointsGeoJson,
                // Niente bordo attorno alle tessere: i cerchi fuori dalla tessera MapLibre li scarta comunque
                // (circle_bucket.ts), il bordo farebbe solo rielaborare due volte i puntini vicini ai margini.
                buffer: 0
            });

            map.addLayer({
                id: PRESENCE_POINTS_LAYER_ID + '-color',
                type: 'circle',
                source: PRESENCE_POINTS_SOURCE_ID,
                filter: ['has', 'color'],
                layout: { 'visibility': initialVisibility ? 'visible' : 'none' },
                paint: {
                    ...presencePaint(true),
                    'circle-pitch-alignment': 'viewport',
                    'circle-pitch-scale': 'map'
                }
            });

            map.addLayer({
                id: PRESENCE_POINTS_LAYER_ID + '-zoom',
                type: 'circle',
                source: PRESENCE_POINTS_SOURCE_ID,
                filter: ['!', ['has', 'color']],
                layout: { 'visibility': initialVisibility ? 'visible' : 'none' },
                paint: {
                    ...presencePaint(false),
                    'circle-pitch-alignment': 'viewport',
                    'circle-pitch-scale': 'map'
                }
            });
        } catch (e) {
            console.error("Error adding presence points source or layer:", e);
            removePresencePointsLayer();
        }
    }
}

// --- LUOGHI CHE ATTIRANO PERSONE (OpenStreetMap, affluenza da src/data/luoghi-core.js) ---

/**
 * Luoghi come punti, con l'affluenza (0–100) dell'ora della settimana tipo `oraSettimana`
 * (0 = lunedì 00:00 … 167). Prende il posto degli spot "sintetici" che copiavano i luoghi affollati.
 */
export function getAttrattoriGeoJson(oraSettimana) {
    return {
        type: 'FeatureCollection',
        features: getLuoghi().map(l => ({
            type: 'Feature',
            id: l.id,
            properties: { id: l.id, nome: l.nome, categoria: l.categoria, nomeCategoria: l.nomeCategoria, affluenza: l.affluenza[oraSettimana] ?? 0 },
            geometry: { type: 'Point', coordinates: [l.lon, l.lat] }
        }))
    };
}

// Luoghi dentro ogni quartiere (confine del KML), calcolati una volta: id quartiere → luoghi
const luoghiPerQuartiere = new Map();
function getLuoghiForFeature(kmlFeature) {
    if (luoghiPerQuartiere.has(kmlFeature.id)) return luoghiPerQuartiere.get(kmlFeature.id);
    const luoghi = getLuoghi().filter(l => turf.booleanPointInPolygon([l.lon, l.lat], kmlFeature.geometry));
    if (getLuoghi().length) luoghiPerQuartiere.set(kmlFeature.id, luoghi); // non ricordare un elenco vuoto prima del caricamento
    return luoghi;
}

// Livello «Affollamento (punti)»: solo in modalità sviluppatore, i luoghi con l'affluenza dell'ora
export function removeCrowdedPointsLayer() {
    const map = getMapInstance(); if (!map) return;
    try { if (map.getLayer(CROWDED_LAYER_ID)) map.removeLayer(CROWDED_LAYER_ID); } catch (e) { /* ignore */ }
    try { if (map.getSource(CROWDED_SOURCE_ID)) map.removeSource(CROWDED_SOURCE_ID); } catch (e) { /* ignore */ }
}

function convertAndStoreCrowdedGeoJson(oraSettimana) {
    const fc = getAttrattoriGeoJson(oraSettimana);
    fc.features.forEach(f => { f.properties.current_crowdedness = f.properties.affluenza; });
    fullCrowdedGeoJson = fc.features.length ? fc : null;
}

export function addCrowdedPointsLayer(timelineHourIndex, initialVisibility = true) {
    if (!DEBUG_MODE) return; // Non caricare layer in modalità non-debug
    const map = getMapInstance();
    if (!map || !isMapReady()) {
        whenMapReady(() => addCrowdedPointsLayer(timelineHourIndex, initialVisibility));
        return;
    }
    convertAndStoreCrowdedGeoJson(getWeekIndex(timelineHourIndex));
    removeCrowdedPointsLayer();
    if (!fullCrowdedGeoJson) return;
    try {
        map.addSource(CROWDED_SOURCE_ID, {
            type: 'geojson',
            data: fullCrowdedGeoJson,
            promoteId: 'id'
        });
        const beforeLayerId = map.getLayer(PRESENCE_POINTS_LAYER_ID) ? PRESENCE_POINTS_LAYER_ID : undefined;
        map.addLayer({
            id: CROWDED_LAYER_ID,
            type: 'circle',
            source: CROWDED_SOURCE_ID,
            layout: { 'visibility': initialVisibility ? 'visible' : 'none' },
            paint: {
                'circle-radius': MAP_STYLES.CROWDED_POINTS.CIRCLE_RADIUS,
                'circle-color': MAP_STYLES.CROWDED_POINTS.CIRCLE_COLOR,
                'circle-opacity': MAP_STYLES.CROWDED_POINTS.CIRCLE_OPACITY,
                'circle-stroke-width': MAP_STYLES.CROWDED_POINTS.CIRCLE_STROKE_WIDTH,
                'circle-stroke-color': MAP_STYLES.CROWDED_POINTS.CIRCLE_STROKE_COLOR,
                'circle-stroke-opacity': MAP_STYLES.CROWDED_POINTS.CIRCLE_STROKE_OPACITY,
                'circle-pitch-alignment': 'viewport',
                'circle-pitch-scale': 'map'
            }
        }, beforeLayerId);
    } catch (error) {
        console.error("Error adding crowded points source or layer:", error);
        removeCrowdedPointsLayer();
    }
}

export function updateCrowdedPointsLayerStyle(timelineHourIndex) {
    if (!DEBUG_MODE) return; // Non aggiornare layer in modalità non-debug
    const map = getMapInstance();
    const source = map && isMapReady() ? map.getSource(CROWDED_SOURCE_ID) : null;
    if (!source) return;
    convertAndStoreCrowdedGeoJson(getWeekIndex(timelineHourIndex));
    if (fullCrowdedGeoJson) source.setData(fullCrowdedGeoJson);
}

// --- GENTE IN CASA ---
let homeBuildings = null;      // [{ c: [lon, lat], v: residenti Meta }] degli edifici TUM
let homeCurve = null;          // quota in casa [giorno 0 = domenica][ora], da HOME_SHARE_URL
let homesLoading = null;
const homesByFeature = new Map(); // id quartiere → { coords, cum } (residenti cumulati per la scelta pesata)
const residentsByFeature = new Map(); // id quartiere → residenti visti dai dati di notte
let lastPresenceArgs = null;

// Residenti del quartiere come li vedono i dati (presenze notturne di tutti i giorni, vedi home-share.js)
function getResidentsSeen(kmlFeature) {
    if (!homeCurve) return 0;
    if (residentsByFeature.has(kmlFeature.id)) return residentsByFeature.get(kmlFeature.id);
    const records = getPoiData()?.[kmlFeature.properties.poi_name?.trim().toLowerCase()] || [];
    const n = residentsSeenAtNight(records, homeCurve, r => r.parsedDate instanceof Date ? r.parsedDate.getUTCDay() : -1);
    residentsByFeature.set(kmlFeature.id, n);
    return n;
}

function ensureHomesLoaded() {
    if (homesLoading) return;
    homesLoading = Promise.all([
        fetch(HOME_SHARE_URL).then(r => r.json()).then(j => { homeCurve = j.quota_in_casa; }),
        fetch(MAP_DATA_BASE + 'gba_ascoli.geojson').then(r => r.json())
    ])
        .then(([, gj]) => {
            // Peso = residenti stimati da Meta (campo res, sound-lab/residenti_meta.py): capannoni, chiese
            // e scuole valgono 0. Senza il campo si ripiega sul volume (area × altezza). Negli interni pubblici
            // (campo pub, sound-lab/interni_pubblici.py) nessuno abita: Meta divide i suoi quadratini da 30 m
            // fra gli edifici che toccano, così anche chiese e musei ricevono residenti dei vicini.
            homeBuildings = gj.features.map(f => ({
                c: turf.centroid(f).geometry.coordinates,
                v: f.properties.pub ? 0 : f.properties.res ?? turf.area(f) * (f.properties.height > 0 ? f.properties.height : 3)
            }));
            buildingGrid = makeBuildingGrid(gj.features);
            // I punti dell'ora corrente sono stati disegnati senza case: ridisegnali
            if (lastPresenceArgs) updateAllPresencePoints(...lastPresenceArgs);
        })
        .catch(e => console.error('Case o quota in casa non caricate:', e));
}

function getHomesForFeature(kmlFeature) {
    if (!homeBuildings) return null;
    if (homesByFeature.has(kmlFeature.id)) return homesByFeature.get(kmlFeature.id);
    const [minLon, minLat, maxLon, maxLat] = turf.bbox(kmlFeature.geometry);
    const coords = [];
    const cum = [];
    let total = 0;
    homeBuildings.forEach(b => {
        const [lon, lat] = b.c;
        if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) return;
        if (!(b.v > 0) || !turf.booleanPointInPolygon(b.c, kmlFeature.geometry)) return;
        total += b.v;
        coords.push(b.c);
        cum.push(total);
    });
    const homes = coords.length ? { coords, cum, total } : null;
    homesByFeature.set(kmlFeature.id, homes);
    return homes;
}

// Edifici TUM in una griglia di ~50 m, per sapere in fretta se un punto cade dentro un edificio
const GRID_DEG = 0.0005;
let buildingGrid = null;
function makeBuildingGrid(features) {
    const grid = new Map();
    features.forEach(f => {
        const [w, s, e, n] = turf.bbox(f);
        for (let x = Math.floor(w / GRID_DEG); x <= Math.floor(e / GRID_DEG); x++) {
            for (let y = Math.floor(s / GRID_DEG); y <= Math.floor(n / GRID_DEG); y++) {
                const k = x + ':' + y;
                if (!grid.has(k)) grid.set(k, []);
                grid.get(k).push(f);
            }
        }
    });
    return grid;
}
function insideBuilding(lon, lat) {
    const near = buildingGrid?.get(Math.floor(lon / GRID_DEG) + ':' + Math.floor(lat / GRID_DEG));
    return !!near?.some(f => turf.booleanPointInPolygon([lon, lat], f));
}

// Posto fisso di chi è "in giro": un punto della sua cella fuori dagli edifici (sta in strada o in piazza).
// Nelle celle costruite il 37,5% dei punti a caso cadeva dentro un edificio. Primo tentativo come prima, poi
// altri punti della stessa cella; se la cella è quasi tutta edificata resta il primo (1% delle persone).
// Il numero del tentativo va prima di ':x': in coda, con hash01, i tentativi erano allineati (6,7% dentro).
const STREET_TRIES = 24;
function streetPosition(key, [w, s, e, n]) {
    const at = (t) => {
        const k = t ? key + ':strada' + t : key;
        return [w + hash01(k + ':x') * (e - w), s + hash01(k + ':y') * (n - s)];
    };
    for (let t = 0; t < STREET_TRIES; t++) {
        const p = at(t);
        if (!insideBuilding(p[0], p[1])) return p;
    }
    return at(0);
}

// Celle LCZ del quartiere dove si cammina: costruite (1–10) o pavimentate (E). Riquadri [w, s, e, n].
const STREET_LCZ = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'E']);
const streetCellsByFeature = new Map();
function getStreetCellsForFeature(kmlFeature) {
    if (streetCellsByFeature.has(kmlFeature.id)) return streetCellsByFeature.get(kmlFeature.id);
    const lcz = getLczVitalityData();
    if (!lcz?.length) return null; // non ancora caricate: non mettere in cache
    const [minLon, minLat, maxLon, maxLat] = turf.bbox(kmlFeature.geometry);
    const cells = [];
    lcz.forEach(cell => {
        if (!STREET_LCZ.has(cell.properties.LCZ)) return;
        const b = turf.bbox(cell);
        const c = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
        if (c[0] < minLon || c[0] > maxLon || c[1] < minLat || c[1] > maxLat) return;
        if (turf.booleanPointInPolygon(c, kmlFeature.geometry)) cells.push(b);
    });
    const result = cells.length ? cells : null;
    streetCellsByFeature.set(kmlFeature.id, result);
    return result;
}

// Casa della persona: edificio scelto in proporzione ai residenti, più qualche metro a caso per non sovrapporre i puntini.
function homePosition(homes, key) {
    const r = hash01(key + ':casa') * homes.total;
    let lo = 0, hi = homes.cum.length - 1;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (homes.cum[mid] < r) lo = mid + 1; else hi = mid;
    }
    const [lon, lat] = homes.coords[lo];
    const angle = hash01(key + ':a') * 2 * Math.PI;
    const radius = 4 * Math.sqrt(hash01(key + ':r'));
    return [
        lon + Math.cos(angle) * radius / (111320 * Math.cos(lat * Math.PI / 180)),
        lat + Math.sin(angle) * radius / 111320
    ];
}

// --- PERSONE DI OGNI QUARTIERE, RICORDATE DA UN'ORA ALL'ALTRA ---
const presenceStates = new Map(); // id quartiere → { at: chiave → attrattore, attrCoords, nRandom, next }

function getPresenceState(kmlId) {
    if (!presenceStates.has(kmlId)) {
        presenceStates.set(kmlId, { at: new Map(), attrCoords: new Map(), nRandom: 0, next: 0 });
    }
    return presenceStates.get(kmlId);
}

// Distanza al quadrato fra due [lon, lat] (basta per confrontare chi è più vicino)
function dist2(a, b) {
    const dx = (b[0] - a[0]) * Math.cos(a[1] * Math.PI / 180);
    const dy = b[1] - a[1];
    return dx * dx + dy * dy;
}

// Assegna ogni persona in più all'attrattore più vicino che ha bisogno di gente (needs.need cala).
// Restituisce chi non ha trovato posto.
function assignToNearestNeed(movers, needs, onAssign) {
    return movers.filter(m => {
        let best = null;
        let bestD = Infinity;
        needs.forEach(nd => {
            if (nd.need <= 0) return;
            const d = dist2(m.from, nd.c);
            if (d < bestD) { bestD = d; best = nd; }
        });
        if (!best) return true;
        best.need--;
        onAssign(m, best);
        return false;
    });
}

// Dentro il quartiere: porta ogni attrattore verso il numero atteso (targets: attrattore → persone).
// Restituisce chi avanza (ancora registrato qui) e i posti scoperti.
function rebalanceInsideArea(state, targets) {
    const byAttr = new Map();
    state.at.forEach((attrId, key) => {
        if (!byAttr.has(attrId)) byAttr.set(attrId, []);
        byAttr.get(attrId).push(key);
    });
    const movers = [];
    byAttr.forEach((keys, attrId) => {
        const extra = keys.length - (targets.get(attrId) || 0);
        for (let i = 1; i <= extra; i++) movers.push({ key: keys[keys.length - i], from: state.attrCoords.get(attrId) });
    });
    const needs = [];
    targets.forEach((n, attrId) => {
        const need = n - (byAttr.get(attrId)?.length || 0);
        if (need > 0) needs.push({ attrId, need, c: state.attrCoords.get(attrId) });
    });
    const left = assignToNearestNeed(movers, needs, (m, nd) => state.at.set(m.key, nd.attrId));
    return { movers: left, needs: needs.filter(nd => nd.need > 0) };
}

// Fra quartieri: chi avanza in un quartiere che si svuota va al posto scoperto più vicino
// in un quartiere che si riempie. Aggiorna movers e needs di ogni area con ciò che resta.
function transferBetweenAreas(areas) {
    const allNeeds = areas.flatMap(area => area.needs.map(nd => Object.assign(nd, { area })));
    if (!allNeeds.length) return;
    areas.forEach(area => {
        area.movers = assignToNearestNeed(area.movers, allNeeds, (m, nd) => {
            area.state.at.delete(m.key);
            nd.area.state.at.set(m.key, nd.attrId);
        });
    });
    areas.forEach(area => { area.needs = area.needs.filter(nd => nd.need > 0); });
}

// --- SPOSTAMENTO ANIMATO DEI PUNTINI FRA UN'ORA E L'ALTRA ---
let presenceMoveFrame = null;
let presenceMoveMs = PRESENCE_MOVE_MS;

// Col Play della timeline lo spostamento deve finire prima dell'ora successiva:
// se venisse interrotto a ogni passo, i puntini si ammasserebbero al centro del quartiere.
export function setPresenceMoveDuration(ms) {
    presenceMoveMs = Math.min(PRESENCE_MOVE_MS, ms);
}
const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Punto fuori città sulla stessa direzione dal centro dei quartieri, PRESENCE_EXIT_METERS più in là
let cityCenter = null;
function outsideCity(coords, key) {
    if (!cityCenter) {
        const [minLon, minLat, maxLon, maxLat] = turf.bbox(getFullKmlGeoJson());
        cityCenter = [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
    }
    const kx = 111320 * Math.cos(cityCenter[1] * Math.PI / 180);
    let dx = (coords[0] - cityCenter[0]) * kx;
    let dy = (coords[1] - cityCenter[1]) * 111320;
    const len = Math.hypot(dx, dy);
    if (len < 1) {
        const angle = hash01(key + ':uscita') * 2 * Math.PI;
        dx = Math.cos(angle); dy = Math.sin(angle);
    } else {
        dx /= len; dy /= len;
    }
    return [coords[0] + dx * PRESENCE_EXIT_METERS / kx, coords[1] + dy * PRESENCE_EXIT_METERS / 111320];
}

// Un gruppo per colore disegnerebbe un colore sempre sopra gli altri, e negli assembramenti sembrerebbe
// più numeroso: ogni gruppo si divide in PRESENCE_LAYERS strati e l'ordine dei colori si inverte da uno strato
// all'altro, così nessun colore copre gli altri (come quando l'ordine era per persona). Lo strato viene dalla
// posizione nell'elenco, non da hash01: hash01 della stessa chiave con suffissi diversi non è indipendente
// (prova: con hash01(chiave + ':strato') gli uomini stavano in media più in alto delle donne).
const PRESENCE_LAYERS = 32;

// Ogni persona ha un suo modo di muoversi, calcolato una volta dalla chiave.
// Ritmi del brulichio (rad/s): passi lenti e scatti rapidi, pesati 0,65 e 0,35 in antWiggle.
const ANT_SLOW = [0.4, 1.0], ANT_FAST = [1.5, 3.0];
// Velocità massima di un puntino, in ampiezze al secondo: derivata delle due sinusoidi al massimo, sui due assi
const ANT_PEAK_SPEED = Math.SQRT2 * (0.65 * ANT_SLOW[1] + 0.35 * ANT_FAST[1]);
let antParams = new Map();
function getAntParams(key) {
    let p = antParams.get(key);
    if (!p) {
        const h = (s) => hash01(key + s);
        const slow = (s) => ANT_SLOW[0] + (ANT_SLOW[1] - ANT_SLOW[0]) * h(s);
        const fast = (s) => ANT_FAST[0] + (ANT_FAST[1] - ANT_FAST[0]) * h(s);
        p = {
            f1: slow(':f1'), f2: fast(':f2'),
            f3: slow(':f3'), f4: fast(':f4'),
            p1: 6.283 * h(':p1'), p2: 6.283 * h(':p2'), p3: 6.283 * h(':p3'), p4: 6.283 * h(':p4'),
            delay: PRESENCE_STAGGER * h(':parte'),                  // chi parte prima e chi dopo
            bend: 2 * h(':curva') - 1                               // da che parte curva il percorso
        };
        antParams.set(key, p);
    }
    return p;
}

// Spostamento del brulichio in metri al tempo s (secondi)
function antWiggle(p, s, amp) {
    return [
        amp * (0.65 * Math.sin(p.f1 * s + p.p1) + 0.35 * Math.sin(p.f2 * s + p.p2)),
        amp * (0.65 * Math.sin(p.f3 * s + p.p3) + 0.35 * Math.sin(p.f4 * s + p.p4))
    ];
}

const easeInOut = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // parte e arriva piano

// Posizione lungo il percorso a e → b per la persona p, avanzamento totale t (0–1):
// ognuno parte con un suo ritardo e devia un po' di lato, così chi parte dallo stesso spot si separa.
function walkPosition(a, b, p, t) {
    const e = easeInOut(Math.min(1, Math.max(0, (t - p.delay) / (1 - PRESENCE_STAGGER))));
    const kx = 111320 * Math.cos(a[1] * Math.PI / 180);
    const dx = (b[0] - a[0]) * kx, dy = (b[1] - a[1]) * 111320;
    const len = Math.hypot(dx, dy);
    const side = len > 0 ? p.bend * Math.min(0.2 * len, PRESENCE_BEND_MAX_M) * Math.sin(Math.PI * e) / len : 0;
    return {
        e,
        coords: [a[0] + (dx * e - dy * side) / kx, a[1] + (dy * e + dx * side) / 111320]
    };
}

// Il movimento continuo: un solo ciclo disegna sia gli spostamenti fra un'ora e l'altra
// sia il brulichio "a formichine" di chi sta fermo. Chi è a casa resta immobile.
// A ogni ridisegno MapLibre copia i puntini, li manda al worker e li ricodifica in tessere: era il lavoro più
// pesante della pagina. Per questo gli arrivano solo le proprietà usate dallo stile e i puntini con lo stesso
// aspetto (in casa, colore) e lo stesso strato come un'unica feature MultiPoint; resta un punto a sé solo chi
// sta cambiando aspetto (compare, svanisce, entra o esce di casa). Le feature restano le stesse finché non
// cambia l'aspetto di qualcuno: a ogni immagine cambiano solo le coordinate.
let presenceAnim = null; // { dots, leaving, collection, t0, settled }
let presenceLastDraw = 0;

function presenceLayerShown(map) {
    return map.getLayer(PRESENCE_POINTS_LAYER_ID + '-zoom')
        && map.getLayoutProperty(PRESENCE_POINTS_LAYER_ID + '-zoom', 'visibility') !== 'none';
}

// Quanto è "in casa" a metà strada: si attenua solo arrivando all'edificio (ultimo 20% del tragitto), si riaccende appena esce
function homeTAt(dot, e) {
    const to = dot.atHome ? 1 : 0;
    const k = to > dot.homeFrom ? Math.max(0, (e - 0.8) / 0.2) : Math.min(1, e / 0.2);
    return dot.homeFrom + (to - dot.homeFrom) * k;
}

const changesLook = (d) => d.arriving || d.homeFrom !== (d.atHome ? 1 : 0);

function rebuildPresenceCollection(anim) {
    const groups = new Map();
    const singles = [];
    anim.dots.forEach(d => {
        if (!anim.settled && changesLook(d)) {
            singles.push(d);
            return;
        }
        const { homeT, color } = d.properties;
        const look = `${homeT}|${color ?? ''}`;
        const k = `${d.layer}|${look}`;
        if (!groups.has(k)) {
            groups.set(k, {
                layer: d.layer, look,
                feature: { type: 'Feature', properties: { homeT, ...(color && { color }) }, geometry: { type: 'MultiPoint', coordinates: [] } }
            });
        }
        groups.get(k).feature.geometry.coordinates.push(d.c);
    });
    if (!anim.settled) singles.push(...anim.leaving);
    // Strato per strato; dentro lo strato l'ordine degli aspetti si inverte fra strati pari e dispari
    const byLayer = (a, b) => a.layer - b.layer || (a.layer % 2 ? -1 : 1) * a.look.localeCompare(b.look);
    anim.collection = {
        type: 'FeatureCollection',
        features: [
            ...[...groups.values()].sort(byLayer).map(g => g.feature),
            ...singles.map(d => ({ type: 'Feature', properties: d.properties, geometry: { type: 'Point', coordinates: d.c } }))
        ]
    };
}

// Persone dell'ora, ognuna con le sue properties (kmlFeatureId, colore...): per la colorazione dai grafici.
// Dopo aver cambiato le properties chiamare redrawPresenceDots().
export function getPresenceDots() {
    return presenceAnim ? [...presenceAnim.dots] : [];
}

export function redrawPresenceDots() {
    if (!presenceAnim) return;
    rebuildPresenceCollection(presenceAnim);
    if (presenceMoveFrame) presenceLastDraw = -Infinity; // il ciclo li spedisce alla prossima immagine
    else getMapInstance()?.getSource(PRESENCE_POINTS_SOURCE_ID)?.setData(presenceAnim.collection); // "riduci movimento"
}

// Scrive in c la posizione col brulichio (chi è a casa resta fermo)
function placeDot(c, [lon, lat], p, s, amp, kx, still) {
    if (still) { c[0] = lon; c[1] = lat; return; }
    const [wx, wy] = antWiggle(p, s, amp);
    c[0] = lon + wx / kx;
    c[1] = lat + wy / 111320;
}

// Fine dello spostamento: valori definitivi, tutti nei gruppi, e chi ha lasciato la città sparisce
function settlePresence(anim) {
    anim.dots.forEach(d => {
        delete d.properties.fade;
        d.properties.homeT = d.atHome ? 1 : 0;
    });
    anim.settled = true;
    rebuildPresenceCollection(anim);
}

function drawPresenceFrame(now) {
    const anim = presenceAnim;
    if (!anim) { presenceMoveFrame = null; return; }
    presenceMoveFrame = requestAnimationFrame(drawPresenceFrame);
    const map = getMapInstance();
    const src = map?.getSource(PRESENCE_POINTS_SOURCE_ID);
    if (!src || !presenceLayerShown(map)) return; // livello non ancora creato, o nascosto: nulla da disegnare
    const t = presenceMoveMs ? Math.min(1, (now - anim.t0) / presenceMoveMs) : 1;
    const moving = t < 1;
    const center = map.getCenter();
    const metersPerPixel = 40075016.686 * Math.cos(center.lat * Math.PI / 180) / (512 * Math.pow(2, map.getZoom()));
    const amp = Math.min(PRESENCE_WIGGLE_MAX_M, Math.max(PRESENCE_WIGGLE_MIN_M, PRESENCE_WIGGLE_PX * metersPerPixel));
    // Al massimo ~30 immagini al secondo, anche negli spostamenti (prima il worker di MapLibre non ne reggeva di più).
    // Da fermi solo quando il puntino più veloce ha fatto un passo visibile (PRESENCE_WIGGLE_STEP_PX pixel
    // fisici): a zoom 13 su schermo Retina ~10 volte al secondo.
    let frameMs = 33;
    if (!moving && anim.settled) {
        const peakPxPerS = ANT_PEAK_SPEED * amp / metersPerPixel * (window.devicePixelRatio || 1);
        frameMs = Math.max(frameMs, 1000 * PRESENCE_WIGGLE_STEP_PX / peakPxPerS);
    }
    if (now - presenceLastDraw < frameMs) return;
    presenceLastDraw = now;
    if (!moving && !anim.settled) settlePresence(anim);
    const s = now / 1000;
    const kx = 111320 * Math.cos(center.lat * Math.PI / 180);
    anim.dots.forEach(d => {
        let base = d.end;
        if (moving) {
            const w = walkPosition(d.start, d.end, d.p, t);
            base = w.coords;
            if (d.arriving) d.properties.fade = Math.min(1, 2 * w.e);
            d.properties.homeT = homeTAt(d, w.e);
        }
        placeDot(d.c, base, d.p, s, amp, kx, d.atHome);
    });
    if (moving) {
        anim.leaving.forEach(l => {
            const w = walkPosition(l.from, l.to, l.p, t);
            l.properties.fade = Math.min(1, 2 * (1 - w.e));
            placeDot(l.c, w.coords, l.p, s, amp, kx, false);
        });
    }
    src.setData(anim.collection);
}

// Dove si trova adesso ogni puntino (senza brulichio) e quanto è "in casa": da qui parte lo spostamento successivo
function displayedNow(anim, now) {
    const shown = new Map();
    if (!anim) return shown;
    const t = presenceMoveMs ? Math.min(1, (now - anim.t0) / presenceMoveMs) : 1;
    anim.dots.forEach(d => {
        if (t >= 1) { shown.set(d.key, { pos: d.end, homeT: d.atHome ? 1 : 0 }); return; }
        const w = walkPosition(d.start, d.end, d.p, t);
        shown.set(d.key, { pos: w.coords, homeT: homeTAt(d, w.e) });
    });
    return shown;
}

// Chi c'era anche prima scivola dalla vecchia alla nuova posizione; chi arriva in città entra dall'esterno
// comparendo piano (fade in), chi la lascia esce verso l'esterno svanendo (fade out).
function movePresencePointsTo(target, visible, arrivals = new Set(), leavers = []) {
    if (presenceMoveFrame) cancelAnimationFrame(presenceMoveFrame);
    presenceMoveFrame = null;
    const now = performance.now();
    const shown = displayedNow(presenceAnim, now);
    presenceAnim = null;
    const map = getMapInstance();
    const source = map?.getSource(PRESENCE_POINTS_SOURCE_ID);
    const animate = visible && presenceMoveMs && source && shown.size > 0 && !reduceMotion;
    const dots = (target?.features ?? []).map((f, i) => {
        const key = f.properties.personKey;
        const end = f.geometry.coordinates;
        const atHome = f.properties.atHome === true;
        const was = shown.get(key);
        const properties = { kmlFeatureId: f.properties.kmlFeatureId, homeT: atHome ? 1 : 0 };
        if (f.properties.color) properties.color = f.properties.color;
        return {
            key, end, atHome, properties, p: getAntParams(key), c: [...end], layer: i % PRESENCE_LAYERS,
            start: animate ? was?.pos ?? (arrivals.has(key) ? outsideCity(end, key) : end) : end,
            homeFrom: was?.homeT ?? 0,
            arriving: animate && arrivals.has(key)
        };
    });
    const leaving = animate ? leavers.filter(key => shown.has(key)).map(key => {
        const from = shown.get(key).pos;
        const color = getPreviousPersonColor(key);
        return {
            key, from, to: outsideCity(from, key), p: getAntParams(key), c: [...from],
            properties: { homeT: 0, fade: 1, ...(color && { color }) }
        };
    }) : [];
    // Ritmi solo di chi è in scena: col Play arriva sempre gente nuova e la tabella crescerebbe senza fine
    antParams = new Map([...dots, ...leaving].map(d => [d.key, d.p]));
    const anim = { dots, leaving, t0: animate ? now : -Infinity, settled: !animate };
    rebuildPresenceCollection(anim);
    presenceAnim = dots.length ? anim : null;
    if (!animate || !dots.length) {
        // Salto senza animazione (o primo disegno): crea il livello se serve
        addOrUpdatePresencePointsLayer(anim.collection, visible);
    } else {
        setLayerVisibility(PRESENCE_POINTS_LAYER_ID, visible);
    }
    if (presenceAnim && !reduceMotion) presenceMoveFrame = requestAnimationFrame(drawPresenceFrame);
}

// Ridisegna i puntini dell'ora corrente (es. dopo aver cambiato la colorazione)
export function refreshPresencePoints(visible) {
    if (lastPresenceArgs) updateAllPresencePoints(lastPresenceArgs[0], visible ?? lastPresenceArgs[1]);
}

// --- AGGIORNAMENTO COMPLESSIVO PUNTI PRESENZA (CON CAMPO DI FORZE STATICO) ---
export function updateAllPresencePoints(timelineHourIndex, initialVisibility = true) {
    const map = getMapInstance();
    const fullKml = getFullKmlGeoJson();
    const poiData = getPoiData();
    const ora = getWeekIndex(timelineHourIndex); // ora della settimana tipo per l'affluenza dei luoghi
    let allFinalPointsFeatures = [];
    const areas = [];
    const JITTER_METERS = 10;
    const { jsDayOfWeek, hour } = getDateTimeFromIndex(timelineHourIndex);
    lastPresenceArgs = [timelineHourIndex, initialVisibility];
    ensureHomesLoaded();
    const presenceArrivals = new Set(); // chi arriva in città: entra dall'esterno e compare piano
    const presenceLeavers = [];         // chi lascia la città: esce verso l'esterno e svanisce
    function metersToDegrees(meters, lat) {
        const latDeg = meters / 111320;
        const lonDeg = meters / (111320 * Math.cos(lat * Math.PI / 180));
        return { latDeg, lonDeg };
    }
    if (fullKml?.features?.length && poiData && Object.keys(poiData).length > 0) {
        // Ogni persona ha un'identità (chiave) ricordata da un'ora all'altra. Quando cambia l'ora:
        // 1. dentro il quartiere chi è in più a un attrattore cammina verso il più vicino che cresce;
        // 2. se un quartiere nel complesso si svuota e un altro si riempie, chi avanza nel primo
        //    cammina verso l'attrattore più vicino che cresce nel secondo;
        // 3. solo il resto arriva da fuori città o se ne va fuori città (con dissolvenza).
        // Una quota va a casa secondo ora e giorno (home-share.js), sempre nella stessa casa del quartiere dove si trova.
        fullKml.features.forEach(kmlFeature => {
            if (!kmlFeature?.properties?.poi_data_available) return;
            const { averagePresence } = calculateAveragePresenceForFeature(kmlFeature, poiData, timelineHourIndex);
            const state = getPresenceState(kmlFeature.id);
            // Peso di ogni luogo del quartiere in quest'ora: la sua affluenza (0–100, src/data/luoghi-core.js)
            const pesi = new Map();
            if (averagePresence > 0) {
                getLuoghiForFeature(kmlFeature).forEach(l => {
                    state.attrCoords.set(l.id, [l.lon, l.lat]);
                    if (l.affluenza[ora] > 0) pesi.set(l.id, l.affluenza[ora]);
                });
                // [S] Nessun luogo attivo (notti dei feriali: i diari hanno meno di 30 casi e quei valori valgono 0):
                // la gente resta divisa fra i luoghi come nell'ultima ora, invece di sparire. Quasi tutti sono a casa.
                if (!pesi.size) state.at.forEach(attrId => pesi.set(attrId, (pesi.get(attrId) || 0) + 1));
            }
            // Persone attese a ogni luogo in quest'ora, in proporzione al peso
            const totale = [...pesi.values()].reduce((somma, w) => somma + w, 0);
            const targets = new Map();
            pesi.forEach((w, attrId) => {
                const n = Math.round(w / totale * averagePresence * 0.3);
                if (n > 0) targets.set(attrId, n);
            });
            const { movers, needs } = rebalanceInsideArea(state, targets);
            areas.push({
                kmlFeature, state, movers, needs, averagePresence,
                homes: getHomesForFeature(kmlFeature),
                homeShare: homeShareFor(getResidentsSeen(kmlFeature), homeCurve, jsDayOfWeek, hour, averagePresence),
                nRandom: pesi.size ? Math.round(averagePresence * 0.1) : 0
            });
        });
        transferBetweenAreas(areas);

        areas.forEach(({ kmlFeature, state, movers, needs, homes, homeShare, nRandom }) => {
            const homeOf = (key) => homes ? homePosition(homes, key) : null;
            // Chi avanza ancora lascia la città, i posti ancora scoperti si riempiono con chi arriva da fuori
            movers.forEach(({ key }) => {
                state.at.delete(key);
                presenceLeavers.push(key);
            });
            needs.forEach(nd => {
                for (; nd.need > 0; nd.need--) {
                    const key = `${kmlFeature.id}:p${state.next++}`;
                    state.at.set(key, nd.attrId);
                    presenceArrivals.add(key);
                }
            });
            const placePerson = (key, lon, lat, props) => {
                if (homes && hash01(key + ':notte') < homeShare) {
                    [lon, lat] = homeOf(key);
                    props.atHome = true;
                }
                props.personKey = key;
                props.originalCoordinates = [lon, lat];
                allFinalPointsFeatures.push(turf.point([lon, lat], props));
            };
            state.at.forEach((attrId, key) => {
                const [cLon, cLat] = state.attrCoords.get(attrId);
                const angle = hash01(key + ':a') * 2 * Math.PI;
                const radius = hash01(key + ':r') * JITTER_METERS;
                const { latDeg, lonDeg } = metersToDegrees(radius, cLat);
                placePerson(key, cLon + Math.cos(angle) * lonDeg, cLat + Math.sin(angle) * latDeg, {
                    attrattoreId: attrId,
                    kmlFeatureId: kmlFeature.id,
                    isStatic: false,
                    noiseSeedX: Math.random() * 10000,
                    noiseSeedY: Math.random() * 10000
                });
            });
            // --- AGGIUNGI 10% RANDOM NELL'AREA (gente in giro, posto fisso per persona) ---
            for (let i = nRandom; i < state.nRandom; i++) presenceLeavers.push(`${kmlFeature.id}:giro:${i}`);
            for (let i = state.nRandom; i < nRandom; i++) presenceArrivals.add(`${kmlFeature.id}:giro:${i}`);
            state.nRandom = nRandom;
            // Solo dove la gente cammina davvero: celle costruite o pavimentate, mai fiume, boschi o prati
            const streetCells = getStreetCellsForFeature(kmlFeature);
            if (streetCells) {
                for (let i = 0; i < nRandom; i++) {
                    const key = `${kmlFeature.id}:giro:${i}`;
                    const [lon, lat] = streetPosition(key, streetCells[Math.floor(hash01(key + ':cella') * streetCells.length)]);
                    placePerson(key, lon, lat, {
                        kmlFeatureId: kmlFeature.id,
                        isStatic: false,
                        noiseSeedX: Math.random() * 10000,
                        noiseSeedY: Math.random() * 10000
                    });
                }
                return;
            }
            // Senza celle LCZ: punto a caso nel quartiere
            const bbox = turf.bbox(kmlFeature.geometry); // [minLon, minLat, maxLon, maxLat]
            let randomTries = 0;
            for (let i = 0; i < nRandom && randomTries < nRandom * 10; ) {
                // Genera punto nel bbox (sempre lo stesso per la stessa persona)
                const key = `${kmlFeature.id}:giro:${i}`;
                const lon = bbox[0] + hash01(key + ':x' + randomTries) * (bbox[2] - bbox[0]);
                const lat = bbox[1] + hash01(key + ':y' + randomTries) * (bbox[3] - bbox[1]);
                // Verifica che sia dentro la KML
                if (turf.booleanPointInPolygon([lon, lat], kmlFeature.geometry)) {
                    placePerson(key, lon, lat, {
                        kmlFeatureId: kmlFeature.id,
                        isStatic: false,
                        noiseSeedX: Math.random() * 10000,
                        noiseSeedY: Math.random() * 10000
                    });
                    i++;
                }
                randomTries++;
            }
        });
    }
    publishPresence(timelineHourIndex, allFinalPointsFeatures, areas);
    if (fullKml?.features?.length && poiData) applyPresenceColors(allFinalPointsFeatures, fullKml, poiData, timelineHourIndex);
    currentPresencePoints = allFinalPointsFeatures.length > 0
        ? turf.featureCollection(allFinalPointsFeatures)
        : null;
    movePresencePointsTo(currentPresencePoints, initialVisibility, presenceArrivals, presenceLeavers);
    
    // Aggiorna automaticamente la visualizzazione dinamica UHI se attivata
    if (uhiDynamicVisibilityEnabled && currentLczVisualizationType === 'UHI') {
        console.log('🔄 Auto-updating UHI dynamic visualization from updateAllPresencePoints');
        // Usa un piccolo timeout per assicurarsi che i presence points siano stati aggiornati
        setTimeout(() => {
            updateUhiDynamicVisualization();
        }, 50);
    }
    
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    if (DEBUG_MODE) addForceGridDebugLayer(map);
}

/**
 * Passa alla bussola (store `presence`) le persone fuori casa dell'ora: ogni puntino pesa
 * (persone vere del quartiere ÷ puntini del quartiere), così il totale resta quello dei dati.
 * Chi è a casa non conta: sta dentro e non si sente.
 */
function publishPresence(index, features, areas) {
    const dots = new Map();
    features.forEach(f => dots.set(f.properties.kmlFeatureId, (dots.get(f.properties.kmlFeatureId) || 0) + 1));
    const weight = new Map(areas.map(a => [a.kmlFeature.id, a.averagePresence / (dots.get(a.kmlFeature.id) || 1)]));
    const out = features.filter(f => !f.properties.atHome);
    const lon = new Float64Array(out.length), lat = new Float64Array(out.length), w = new Float64Array(out.length);
    out.forEach((f, i) => {
        [lon[i], lat[i]] = f.properties.originalCoordinates;
        w[i] = weight.get(f.properties.kmlFeatureId) ?? 0;
    });
    presence.set({ index, lon, lat, w });
}

// Funzione di animazione fluida dei punti density
function animatePresencePoints(timelineHourIndex, fullKml) {
    if (!currentPresencePoints) return;
    const map = getMapInstance();
    if (!map || !isMapReady()) return;
    const noiseTime = performance.now() * 0.00005; // più lento e fluido
    const NOISE_AMPLITUDE = 0.0003; // movimento più percepibile
    const features = currentPresencePoints.features.map(point => {
        if (point.properties?.isStatic) return point;
        const [lon, lat] = point.properties.originalCoordinates;
        const noiseSeedX = point.properties.noiseSeedX || 0;
        const noiseSeedY = point.properties.noiseSeedY || 0;
        const offsetX = (perlin2d(noiseSeedX, noiseTime) - 0.5) * 2 * NOISE_AMPLITUDE;
        const offsetY = (perlin2d(noiseSeedY, noiseTime) - 0.5) * 2 * NOISE_AMPLITUDE;
        let newLon = lon + offsetX;
        let newLat = lat + offsetY;
        // Applica anche il campo di forze statico (opzionale)
        const { fx, fy } = getForceVectorForCoord(lon, lat, fullKml, timelineHourIndex);
        newLon += fx;
        newLat += fy;
        // Verifica che il nuovo punto sia ancora dentro la KML
        const kmlFeature = fullKml.features.find(f => f.id === point.properties.kmlFeatureId);
        if (kmlFeature && kmlFeature.geometry && turf.booleanPointInPolygon(turf.point([newLon, newLat]), kmlFeature.geometry)) {
            return turf.point([newLon, newLat], point.properties);
        } else {
            return turf.point(point.properties.originalCoordinates, point.properties);
        }
    });
    const animatedGeoJson = { ...currentPresencePoints, features };
    const source = map.getSource(PRESENCE_POINTS_SOURCE_ID);
    if (source) source.setData(animatedGeoJson);
    animationFrameId = requestAnimationFrame(() => animatePresencePoints(timelineHourIndex, fullKml));
}

// --- DEBUG: Visualizzazione della griglia di forze sulla mappa ---
function addForceGridDebugLayer(map) {
    if (!DEBUG_MODE || !FORCE_GRID || !FORCE_GRID.length) return;
    // Rimuovi layer e source precedenti se esistono
    if (map.getLayer('force-grid-arrows')) {
        try { map.removeLayer('force-grid-arrows'); } catch(e){}
    }
    if (map.getSource('force-grid-arrows')) {
        try { map.removeSource('force-grid-arrows'); } catch(e){}
    }
    // Parametri di visualizzazione
    const centerLat = (FORCE_GRID_BBOX[1] + FORCE_GRID_BBOX[3]) / 2;
    const latStep = metersToLatDegrees(FORCE_GRID_RESOLUTION_METERS);
    const lonStep = metersToLonDegrees(FORCE_GRID_RESOLUTION_METERS, centerLat);
    const maxLen = Math.sqrt(latStep*latStep + lonStep*lonStep) * 0.5; // metà cella
    const DEBUG_VECTOR_SCALE = 1.0;
    const TRIANGLE_BASE = maxLen * 0.5; // larghezza base triangolo

    // Crea GeoJSON con un triangolo orientato per ogni vettore
    const features = FORCE_GRID.map(cell => {
        // Calcola il vettore normalizzato e limitato
        let dx = cell.fx * DEBUG_VECTOR_SCALE;
        let dy = cell.fy * DEBUG_VECTOR_SCALE;
        const len = Math.sqrt(dx*dx + dy*dy);
        if (len > maxLen && len > 0) {
            dx = dx * (maxLen / len);
            dy = dy * (maxLen / len);
        }
        // Centro del triangolo (origine della freccia)
        const cx = cell.lon;
        const cy = cell.lat;
        // Direzione della freccia
        const angle = Math.atan2(dy, dx);
        // Punta del triangolo (punta della freccia)
        const tip = [cx + dx, cy + dy];
        // Base del triangolo (due punti ai lati opposti rispetto alla punta)
        const baseAngle1 = angle + Math.PI - Math.PI/8;
        const baseAngle2 = angle + Math.PI + Math.PI/8;
        const base1 = [
            cx + Math.cos(baseAngle1) * TRIANGLE_BASE,
            cy + Math.sin(baseAngle1) * TRIANGLE_BASE
        ];
        const base2 = [
            cx + Math.cos(baseAngle2) * TRIANGLE_BASE,
            cy + Math.sin(baseAngle2) * TRIANGLE_BASE
        ];
        return {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [[tip, base1, base2, tip]]
            },
            properties: {}
        };
    });
    const gridGeoJson = {
        type: 'FeatureCollection',
        features
    };
    map.addSource('force-grid-arrows', {
        type: 'geojson',
        data: gridGeoJson
    });
    map.addLayer({
        id: 'force-grid-arrows',
        type: 'fill',
        source: 'force-grid-arrows',
        layout: {},
        paint: {
            'fill-color': '#00bfff', // azzurro
            'fill-opacity': 0.7
        }
    });
}

// --- LAYER DEI LUOGHI (ex spot) ---
// Sempre nascosto (gruppo Luoghi tolto dai Livelli il 2026-10-11): i luoghi servono da poliattrattori dei puntini.

function convertAndStoreSpotsGeoJson() {
    const fc = getAttrattoriGeoJson(0);
    fullSpotsGeoJson = fc.features.length ? fc : null;
    return fullSpotsGeoJson;
}

export function removeSpotsLayer() {
    const map = getMapInstance();
    if (!map) return;
    const labelLayerId = SPOTS_LAYER_ID + '-labels';
    try { map.off('mousemove', SPOTS_LAYER_ID); } catch (e) {}
    try { map.off('mouseleave', SPOTS_LAYER_ID); } catch (e) {}
    try { if (map.getLayer(labelLayerId)) map.removeLayer(labelLayerId); } catch (e) { /* ignore */ }
    try { if (map.getLayer(SPOTS_LAYER_ID)) map.removeLayer(SPOTS_LAYER_ID); } catch (e) { /* ignore */ }
    try { if (map.getSource(SPOTS_SOURCE_ID)) map.removeSource(SPOTS_SOURCE_ID); } catch (e) { /* ignore */ }
}

export function addSpotsLayer(initialVisibility = true) {
    const map = getMapInstance();
    if (!map || !isMapReady()) {
        whenMapReady(() => addSpotsLayer(initialVisibility));
        return;
    }
    if (!fullSpotsGeoJson) {
        convertAndStoreSpotsGeoJson();
    }
    if (!fullSpotsGeoJson?.features?.length) {
        removeSpotsLayer();
        return;
    }
    removeSpotsLayer();
    try {
        map.addSource(SPOTS_SOURCE_ID, {
            type: 'geojson',
            data: fullSpotsGeoJson,
            promoteId: 'id'
        });
        map.addLayer({
            id: SPOTS_LAYER_ID,
            type: 'circle',
            source: SPOTS_SOURCE_ID,
            layout: { 'visibility': initialVisibility ? 'visible' : 'none' },
            paint: {
                'circle-radius': MAP_STYLES.SPOTS.CIRCLE_RADIUS,
                'circle-color': MAP_STYLES.SPOTS.CIRCLE_COLOR,
                'circle-opacity': MAP_STYLES.SPOTS.CIRCLE_OPACITY,
                'circle-stroke-width': MAP_STYLES.SPOTS.CIRCLE_STROKE_WIDTH,
                'circle-stroke-color': MAP_STYLES.SPOTS.CIRCLE_STROKE_COLOR,
                'circle-stroke-opacity': MAP_STYLES.SPOTS.CIRCLE_STROKE_OPACITY,
                'circle-pitch-alignment': 'viewport',
                'circle-pitch-scale': 'map'
            }
        });
        map.addLayer({
            id: SPOTS_LAYER_ID + '-labels',
            type: 'symbol',
            source: SPOTS_SOURCE_ID,
            layout: {
                'visibility': initialVisibility ? 'visible' : 'none',
                'text-field': ['coalesce', ['get', 'nome'], ''],
                'text-font': MAP_STYLES.SPOTS.LABELS.TEXT_FONT,
                'text-size': MAP_STYLES.SPOTS.LABELS.TEXT_SIZE,
                'text-offset': MAP_STYLES.SPOTS.LABELS.TEXT_OFFSET,
                'text-anchor': 'top',
                'text-allow-overlap': MAP_STYLES.SPOTS.LABELS.TEXT_ALLOW_OVERLAP,
                'text-ignore-placement': MAP_STYLES.SPOTS.LABELS.TEXT_IGNORE_PLACEMENT,
                'text-optional': MAP_STYLES.SPOTS.LABELS.TEXT_OPTIONAL,
                'text-pitch-alignment': 'viewport'
            },
            paint: {
                'text-color': MAP_STYLES.SPOTS.LABELS.TEXT_COLOR,
                'text-halo-color': MAP_STYLES.SPOTS.LABELS.TEXT_HALO_COLOR,
                'text-halo-width': MAP_STYLES.SPOTS.LABELS.TEXT_HALO_WIDTH,
                'text-opacity': [
                    'case',
                    ['boolean', ['feature-state', 'hover'], false], 1,
                    0
                ]
            }
        });
        let hoveredSpotId = null;
        map.on('mousemove', SPOTS_LAYER_ID, (e) => {
            if (e.features.length > 0) {
                 const currentHoverId = e.features[0].id ?? e.features[0].properties?.id;
                 if (currentHoverId !== undefined && currentHoverId !== hoveredSpotId) {
                     if (hoveredSpotId !== null) {
                         try { map.setFeatureState({ source: SPOTS_SOURCE_ID, id: hoveredSpotId }, { hover: false }); } catch(fsError){}
                     }
                     hoveredSpotId = currentHoverId;
                     try { map.setFeatureState({ source: SPOTS_SOURCE_ID, id: hoveredSpotId }, { hover: true }); } catch(fsError){ hoveredSpotId = null; }
                 }
            } else if (hoveredSpotId !== null) {
                 try { map.setFeatureState({ source: SPOTS_SOURCE_ID, id: hoveredSpotId }, { hover: false }); } catch(fsError){}
                 hoveredSpotId = null;
            }
             map.getCanvas().style.cursor = (e.features.length > 0) ? 'pointer' : '';
        });
        map.on('mouseleave', SPOTS_LAYER_ID, () => {
            if (hoveredSpotId !== null) {
                 try { map.setFeatureState({ source: SPOTS_SOURCE_ID, id: hoveredSpotId }, { hover: false }); } catch(fsError){}
                hoveredSpotId = null;
            }
            map.getCanvas().style.cursor = '';
        });
    } catch (error) {
        console.error("Error adding spots source or layer:", error);
        removeSpotsLayer();
    }
}

// --- LAYER LCZ VITALITY ---

/**
 * Rimuove il layer LCZ Vitality dalla mappa.
 */
// Livello sotto cui vanno le celle quando stanno "sopra edifici e strade": il primo livello di dati presente.
// Il KML (quartiere selezionato) e i puntini (sottolivelli -color e -zoom) restano sopra anche con le celle al 100%.
function overlayBeforeId(map) {
    return [KML_LAYER_ID, PRESENCE_POINTS_LAYER_ID + '-color', PRESENCE_POINTS_LAYER_ID + '-zoom', CROWDED_LAYER_ID, SPOTS_LAYER_ID].find(id => map.getLayer(id));
}

export function removeLczVitalityLayer() {
    const map = getMapInstance();
    if (!map) return;
    
    try { if (map.getLayer(LCZ_VITALITY_LAYER_ID)) map.removeLayer(LCZ_VITALITY_LAYER_ID); } catch (e) { /* ignore */ }
    // La sorgente resta finché serve al varco d'ascolto
    try { if (map.getSource(LCZ_VITALITY_SOURCE_ID) && !map.getLayer(VARCO_LAYER_ID)) { map.removeSource(LCZ_VITALITY_SOURCE_ID); statoApplicato = new Map(); varcoDentro = new Set(); } } catch (e) { /* ignore */ }
    setCellMapActive(false);
    setWhiteOverCellsHidden(false); // senza celle il bianco torna com'era
    if (isMapReady()) map.setGlobalStateProperty(CELLE_VISIBILI, false); // lo stato globale esiste solo a stile caricato
    aggiornaVarco(); // se il cerchio d'ascolto è acceso, la mappa sonora resta al suo interno
}

/**
 * Aggiunge il layer LCZ Vitality alla mappa.
 * @param {boolean} initialVisibility - Visibilità iniziale del layer.
 * @param {string} visualizationType - Tipo di visualizzazione: 'LCZ' o 'UHI'
 */
export function addLczVitalityLayer(initialVisibility = true, visualizationType = 'LCZ') {
    const map = getMapInstance();
    if (!map || !isMapReady()) {
        whenMapReady(() => addLczVitalityLayer(initialVisibility, visualizationType));
        return;
    }

    const lczData = getLczVitalityData();
    if (DEBUG_MODE) {
        console.log("addLczVitalityLayer: LCZ data received:", lczData);
        console.log("LCZ data length:", lczData?.length);
        
        // Log unique LCZ values found in the data
        if (lczData?.length) {
            const uniqueLczValues = [...new Set(lczData.map(feature => feature.properties?.LCZ))];
            console.log("Unique LCZ values in data:", uniqueLczValues);
        }
    }
    
    if (!lczData?.length) {
        console.warn("addLczVitalityLayer: No LCZ vitality data available.");
        removeLczVitalityLayer();
        return;
    }

    // Converti i dati in formato GeoJSON
    const geoJsonData = {
        type: 'FeatureCollection',
        features: lczData
    };

    if (DEBUG_MODE) {
        console.log("GeoJSON data for LCZ layer:", geoJsonData);
        console.log("First feature:", geoJsonData.features[0]);
        if (geoJsonData.features[0]) {
            console.log("First feature geometry:", geoJsonData.features[0].geometry);
            console.log("First feature properties:", geoJsonData.features[0].properties);
        }
    }

    // Rimuovi layer esistente se presente
    removeLczVitalityLayer();

    try {
        // Determina dove inserire il layer (sotto gli altri layer di punti)
        const beforeLayerId = overlayBeforeId(map);

        // Aggiungi la sorgente
        if (!map.getSource(LCZ_VITALITY_SOURCE_ID)) map.addSource(LCZ_VITALITY_SOURCE_ID, {
            type: 'geojson',
            data: geoJsonData,
            promoteId: 'id'
        });

        // Determina i colori in base al tipo di visualizzazione
        const fillColor = getLczFillColor(visualizationType);

        if (DEBUG_MODE) {
            console.log("Fill color expression type:", visualizationType);
            console.log("Fill color expression length:", fillColor?.length);
        }

        // Aggiungi il layer fill
        map.addLayer({
            id: LCZ_VITALITY_LAYER_ID,
            type: 'fill',
            source: LCZ_VITALITY_SOURCE_ID,
            layout: { 'visibility': initialVisibility ? 'visible' : 'none' },
            paint: {
                'fill-color': fillColor,
                'fill-opacity': currentLczOpacity,
                'fill-antialias': MAP_STYLES.LCZ_VITALITY.FILL_ANTIALIAS
            }
        }, beforeLayerId);
        map.setGlobalStateProperty(CELLE_VISIBILI, initialVisibility);

        bindLczPopup(map);

        // Salva il tipo di visualizzazione corrente
        currentLczVisualizationType = visualizationType;
        placeCellLayers();
        syncCellMap(visualizationType);
        applyCellMap(lastCellMap, true); // il feature-state si perde quando la sorgente viene ricreata
        lczOpacityBase = currentLczOpacity;
        applyLczPaint(); // riparte dall'opacità normale, con l'eventuale voce evidenziata
        aggiornaVarco();

        if (DEBUG_MODE) {
            console.log(`LCZ Vitality layer added with ${geoJsonData.features.length} features using ${visualizationType} visualization.`);
            console.log("Layer visibility:", initialVisibility);
            console.log("Fill color expression:", fillColor);
            
            // Verify layer was added
            setTimeout(() => {
                if (map.getLayer(LCZ_VITALITY_LAYER_ID)) {
                    console.log("✅ LCZ layer successfully added to map");
                    console.log("Layer style:", map.getLayoutProperty(LCZ_VITALITY_LAYER_ID, 'visibility'));
                } else {
                    console.error("❌ LCZ layer not found on map");
                }
                
                if (map.getSource(LCZ_VITALITY_SOURCE_ID)) {
                    console.log("✅ LCZ source successfully added to map");
                } else {
                    console.error("❌ LCZ source not found on map");
                }
            }, 100);
        }
    } catch (error) {
        console.error("Error adding LCZ vitality source or layer:", error);
        removeLczVitalityLayer();
    }
}

// Nomi delle classi LCZ (Stewart & Oke) e del rischio isola di calore
export const LCZ_NAMES = {
    '1': 'Compatto alto', '2': 'Compatto medio', '3': 'Compatto basso', '4': 'Aperto alto',
    '5': 'Aperto medio', '6': 'Aperto basso', '7': 'Leggero basso', '8': 'Grandi edifici bassi',
    '9': 'Edificato sparso', '10': 'Industria pesante', 'A': 'Alberi fitti', 'B': 'Alberi sparsi',
    'C': 'Arbusti e macchia', 'D': 'Piante basse', 'E': 'Roccia o pavimentato', 'F': 'Suolo nudo',
    'G': 'Acqua'
};
const UHI_NAMES = {
    'Very Low': 'Molto basso', 'Low': 'Basso', 'Low-Medium': 'Basso-medio', 'Medium-Low': 'Medio-basso',
    'Medium': 'Medio', 'High': 'Alto', 'Very High': 'Molto alto'
};
// Parametri che costruiscono la classe: [campo, etichetta, unità]
const LCZ_PARAMS = [
    ['svf_mean', 'Cielo visibile (Sky View Factor)', '0–1'],
    ['aspect_ratio', 'Rapporto altezza/larghezza (H/W)', ''],
    ['building_frac', 'Superficie coperta da edifici', '%'],
    ['impervious_frac', 'Superficie impermeabile', '%'],
    ['pervious_frac', 'Superficie permeabile', '%'],
    ['z_h', 'Altezza media di edifici e alberi', 'm'],
    ['terrain_rough', 'Classe di rugosità (Davenport)', '1–8'],
    ['admittance', 'Ammettenza termica', 'J m⁻² s⁻½ K⁻¹'],
    ['albedo', 'Albedo', '0–1'],
    ['anthro_heat', 'Calore antropico', 'W/m²'],
    ['industry_heat', 'Calore industriale', 'W/m²']
];

/**
 * Colore delle celle per una vista: 'LCZ', 'UHI' o un campo di LCZ_DATA_VIEWS (scala continua).
 * @param {string} type
 */
function getLczFillColor(type) {
    if (type === 'LCZ') return MAP_STYLES.LCZ_VITALITY.LCZ_COLORS;
    if (type === 'utci') {
        const v = ['feature-state', 'utci'];
        return ['case', ['==', ['typeof', v], 'number'],
            ['interpolate-lab', ['linear'], v, ...UTCI_RAMP.flatMap(([t, c]) => [t, ['to-color', c]])],
            'rgba(0,0,0,0)'];
    }
    if (type === 'stato') {
        // Colore continuo calcolato per cella (src/compass/sound-color.js) e messo nel feature-state 'colore'
        return ['to-color', ['coalesce', ['feature-state', 'colore'], 'rgba(0,0,0,0)']];
    }
    const view = LCZ_DATA_VIEWS[type];
    if (!view) return MAP_STYLES.LCZ_VITALITY.UHI_COLORS;
    const value = ['get', type];
    const hasValue = ['==', ['typeof', value], 'number'];
    return ['case',
        view.missing !== undefined ? ['all', hasValue, ['!=', value, view.missing]] : hasValue,
        ['interpolate', ['linear'], value, ...view.stops.flatMap(([v, c]) => [v, ['to-color', c]])],
        'rgba(0,0,0,0)'
    ];
}

/**
 * Legenda della vista. Tre forme: categorie (LCZ, UHI), scala a fasce (campi continui, UTCI), rosa degli stati (Sound map).
 * Ogni voce porta il valore con cui si evidenzia sulla mappa (view + key, o lo/hi per le fasce).
 * @param {string} type
 * @returns {{kind: 'categories', view: string, items: Array<{key: string, color: string, code: string, name: string}>}
 *   | {kind: 'ramp', view: string, stops: Array<{t: number, c: string, label: string|null}>, unit: string, note: string}
 *   | {kind: 'compass', view: string, colors: object, note: string}}
 */
export function getLczLegend(type) {
    if (type === 'utci') {
        return {
            kind: 'ramp', view: 'utci', unit: '°C',
            // Le etichette vengono dai valori: null = nessuna etichetta (il punto verde pieno non apre una fascia)
            stops: UTCI_RAMP.map(([t, c, label]) => ({ t, c, label: label === null ? null : String(t).replace('-', '−') })),
            note: 'Temperatura percepita stimata di una persona ferma in ogni cella, all’ora della timeline: '
                + '9–26 °C nessuno stress termico, da 26 moderato, da 32 forte, da 38 molto forte. '
                + 'Settimana tipo: una giornata calda (90° percentile).'
        };
    }
    if (type === 'stato') {
        return {
            kind: 'compass', view: 'stato', colors: SOUND_STATE_COLORS,
            note: 'Cosa suona la mappa sonora in ogni cella, all’ora della timeline.'
        };
    }
    const view = LCZ_DATA_VIEWS[type];
    if (view) {
        return {
            kind: 'ramp', view: type, unit: view.unit, note: view.note,
            stops: view.stops.map(([t, c]) => ({ t, c, label: String(t) }))
        };
    }
    // Le espressioni 'case' hanno coppie [condizione, colore]: la condizione è ['==', ['get', campo], valore]
    const expr = type === 'LCZ' ? MAP_STYLES.LCZ_VITALITY.LCZ_COLORS : MAP_STYLES.LCZ_VITALITY.UHI_COLORS;
    const items = [];
    for (let i = 1; i + 1 < expr.length; i += 2) {
        const key = expr[i][2];
        if (key === 'UNKNOWN') continue;
        const isLcz = type === 'LCZ';
        items.push({
            key, color: expr[i + 1],
            code: isLcz ? key : '',
            name: isLcz ? LCZ_NAMES[key] : UHI_NAMES[key] ?? key
        });
    }
    return { kind: 'categories', view: type, items };
}

/**
 * Condizione MapLibre (vera o falsa per cella) di una voce della legenda.
 * Le scale continue guardano il valore: il feature-state per UTCI, la proprietà per i campi LCZ.
 * Fuori dalla scala (lo/hi assenti) la fascia è aperta: come sulla mappa, i valori estremi prendono il colore del bordo.
 */
function lczHighlightCondition({ view, key, lo, hi }) {
    if (view === 'LCZ') return ['==', ['get', 'LCZ'], key];
    if (view === 'UHI') return ['==', ['get', 'UHI risk'], key];
    if (view === 'stato') return ['==', ['feature-state', 'stato'], key];
    const value = view === 'utci' ? ['feature-state', 'utci'] : ['get', view];
    const range = [];
    const missing = LCZ_DATA_VIEWS[view]?.missing;
    if (missing !== undefined) range.push(['!=', value, missing]);
    if (lo !== undefined) range.push(['>=', value, lo]);
    if (hi !== undefined) range.push(['<', value, hi]);
    // 'case' e non 'all' da solo: i confronti non si valutano su un valore che non è un numero
    return ['case', ['==', ['typeof', value], 'number'], ['all', ...(range.length ? range : [true])], false];
}

/**
 * Opacità di riempimento: la base (numero o rischio UHI dinamico), spenta fuori dalla voce evidenziata.
 * Unico punto che scrive questo valore, così la base e la voce non si sovrascrivono.
 */
function applyLczPaint() {
    const map = getMapInstance();
    if (!map || !isMapReady() || !map.getLayer(LCZ_VITALITY_LAYER_ID)) return;
    // Con il cerchio d'ascolto acceso le celle fuori dal cerchio si fanno tenui, e dentro c'è il varco a piena forza
    const tenue = varcoAttivo() && celleVisibili(map);
    map.setPaintProperty(LCZ_VITALITY_LAYER_ID, 'fill-opacity', opacitaCelle(tenue ? FUORI_VARCO : 1));
    if (map.getLayer(VARCO_LAYER_ID)) map.setPaintProperty(VARCO_LAYER_ID, 'fill-opacity', opacitaVarco(map));
}
/** Opacità del riempimento (base, più l'eventuale voce evidenziata) moltiplicata per `k`. */
function opacitaCelle(k) {
    const on = lczHighlight ? lczHighlightCondition(lczHighlight) : null;
    const per = v => (k === 1 ? v : ['*', k, v]);
    // Le altre celle restano appena visibili [S]: si vede dove sta il gruppo nella città, e restano cliccabili
    return on ? ['case', on, per(lczOpacityBase), LCZ_HIGHLIGHT_DIM * k] : per(lczOpacityBase);
}
const VARCO_OPACITA = 1; // varco a celle spente: come le celle accese al 100%
const FUORI_VARCO = 0.25; // [S] opacità delle celle fuori dal cerchio d'ascolto quando le celle sono accese

// --- Varco d'ascolto: dentro il cerchio si vede la mappa sonora (o la vista scelta, a celle accese) ---
const VARCO_LAYER_ID = 'lcz-varco-layer';
let varcoCentri = null; // centro di ogni cella: { id, lon, lat }
let varcoFrame = 0, varcoOn = false;
const varcoAttivo = () => !!puntoAscolto.get();
const celleVisibili = (map) => !!map.getLayer(LCZ_VITALITY_LAYER_ID) && map.getLayoutProperty(LCZ_VITALITY_LAYER_ID, 'visibility') !== 'none';
/** Vista del varco: quella delle celle se sono accese, altrimenti la Sound map. */
function vistaVarco() {
    const map = getMapInstance();
    return map && celleVisibili(map) ? currentLczVisualizationType : 'stato';
}

function centriCelle() {
    if (!varcoCentri) {
        varcoCentri = getLczVitalityData().map(f => {
            const ring = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates[0][0] : f.geometry.coordinates[0];
            let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
            for (const [x, y] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
            return { id: f.properties.id, lon: (x0 + x1) / 2, lat: (y0 + y1) / 2 };
        });
    }
    return varcoCentri;
}

/** Id delle celle con il centro dentro il cerchio: il bordo segue la griglia, come in Morphocode. */
function celleDentroCerchio() {
    const [lon, lat] = puntoAscolto.get(), r = raggioAscolto.get();
    const mx = 111320 * Math.cos(lat * Math.PI / 180), my = 110570;
    const dentro = new Set();
    for (const c of centriCelle()) if (((c.lon - lon) * mx) ** 2 + ((c.lat - lat) * my) ** 2 <= r * r) dentro.add(c.id);
    return dentro;
}

// Il varco non usa un filtro: cambiare un filtro fa rifare al worker di MapLibre l'impaginazione di tutte le 12.500 celle,
// a ogni movimento del cerchio. Ogni cella ha invece un'etichetta `dentro` nel feature-state, e si scrive solo per quelle
// che entrano o escono (decine per movimento). L'opacità del varco è 0 per chi non è dentro.
let varcoDentro = new Set();
const DENTRO = ['boolean', ['feature-state', 'dentro'], false];
const opacitaVarco = (map) => ['case', DENTRO, celleVisibili(map) ? opacitaCelle(1) : VARCO_OPACITA, 0];

function aggiornaDentro() {
    const map = getMapInstance();
    if (!map || !varcoAttivo() || !map.getLayer(VARCO_LAYER_ID) || !map.getSource(LCZ_VITALITY_SOURCE_ID)) return;
    const nuove = celleDentroCerchio();
    let cambiato = false;
    for (const id of nuove) if (!varcoDentro.has(id)) { map.setFeatureState({ source: LCZ_VITALITY_SOURCE_ID, id }, { dentro: true }); cambiato = true; }
    for (const id of varcoDentro) if (!nuove.has(id)) { map.setFeatureState({ source: LCZ_VITALITY_SOURCE_ID, id }, { dentro: false }); cambiato = true; }
    varcoDentro = nuove;
    if (cambiato) celleVarco.set(nuove); // cell-map.js calcola stato e colore solo per queste, se non serve ogni cella
}

/** Accende, spegne e aggiorna il varco. Con il cerchio spento lo toglie e rimette le celle com'erano. */
function aggiornaVarco() {
    const map = getMapInstance();
    if (!map || !isMapReady()) return;
    varcoOn = varcoAttivo();
    if (!varcoOn) {
        celleVarco.set(null);
        if (map.getSource(LCZ_VITALITY_SOURCE_ID)) varcoDentro.forEach(id => map.setFeatureState({ source: LCZ_VITALITY_SOURCE_ID, id }, { dentro: false })); // se la sorgente resta, il cerchio dopo parte pulito
        varcoDentro = new Set();
        if (map.getLayer(VARCO_LAYER_ID)) map.removeLayer(VARCO_LAYER_ID);
        if (!map.getLayer(LCZ_VITALITY_LAYER_ID) && map.getSource(LCZ_VITALITY_SOURCE_ID)) { map.removeSource(LCZ_VITALITY_SOURCE_ID); statoApplicato = new Map(); }
        applyLczPaint();
        syncCellMap(currentLczVisualizationType);
        placeCellLayers();
        if (!map.getLayer(LCZ_VITALITY_LAYER_ID)) setWhiteOverCellsHidden(false);
        return;
    }
    if (!map.getSource(LCZ_VITALITY_SOURCE_ID)) {
        map.addSource(LCZ_VITALITY_SOURCE_ID, { type: 'geojson', data: { type: 'FeatureCollection', features: getLczVitalityData() }, promoteId: 'id' });
    }
    if (!map.getLayer(VARCO_LAYER_ID)) {
        map.addLayer({ id: VARCO_LAYER_ID, type: 'fill', source: LCZ_VITALITY_SOURCE_ID,
            paint: { 'fill-color': getLczFillColor(vistaVarco()), 'fill-opacity': 0, 'fill-antialias': MAP_STYLES.LCZ_VITALITY.FILL_ANTIALIAS } });
        applyCellMap(lastCellMap, true); // il feature-state si perde se la sorgente è nuova
    } else {
        map.setPaintProperty(VARCO_LAYER_ID, 'fill-color', getLczFillColor(vistaVarco()));
    }
    map.setPaintProperty(VARCO_LAYER_ID, 'fill-opacity', opacitaVarco(map));
    aggiornaDentro();
    applyLczPaint();
    syncCellMap(currentLczVisualizationType);
    placeCellLayers();
    applyCellMap(lastCellMap); // la vista del varco può leggere altri campi del feature-state
}

// Trascinando il cerchio: a celle spente (solo la mappa sonora nel cerchio) si aggiorna a ogni immagine; a celle accese,
// dove ogni aggiornamento ridisegna una griglia piena, al massimo ogni VARCO_INTERVALLO_CELLE_MS, con l'ultima posizione
// sempre applicata alla fine (non si rifanno i passaggi intermedi dello zigzag).
const VARCO_INTERVALLO_CELLE_MS = 300; // [S] scelta nostra, da rivedere a mano
let varcoTimer = 0, varcoUltimo = 0;
function sullaMossaDelCerchio() {
    if (varcoAttivo() !== varcoOn) { aggiornaVarco(); return; }
    if (!varcoOn || varcoFrame || varcoTimer) return; // un aggiornamento è già in coda: userà la posizione di quel momento
    const map = getMapInstance();
    const attesa = map && celleVisibili(map) ? VARCO_INTERVALLO_CELLE_MS - (performance.now() - varcoUltimo) : 0;
    const esegui = () => { varcoFrame = 0; varcoTimer = 0; varcoUltimo = performance.now(); aggiornaDentro(); };
    if (attesa > 0) varcoTimer = setTimeout(esegui, attesa);
    else varcoFrame = requestAnimationFrame(esegui);
}
puntoAscolto.subscribe(sullaMossaDelCerchio);
raggioAscolto.subscribe(sullaMossaDelCerchio);
// Opacità delle celle non scelte nella legenda: [S] scelta visiva, da rivedere all'ascolto a schermo
const LCZ_HIGHLIGHT_DIM = 0.12;

/**
 * Evidenzia sulla mappa una voce della legenda: le altre celle si spengono. Con null tornano tutte.
 * @param {{view: string, key?: string, lo?: number, hi?: number} | null} selection
 */
export function setLczHighlight(selection) {
    lczHighlight = selection;
    applyLczPaint();
}

let lczPopupBound = false;

/** Popup al clic su una cella LCZ: classe, rischio e parametri con cui è stata calcolata. */
function bindLczPopup(map) {
    if (lczPopupBound) return;
    lczPopupBound = true;
    // Solo celle (tasto in ui-map-tools.js): con il tasto spento il clic va al quartiere e la cella non risponde
    map.on('mouseenter', LCZ_VITALITY_LAYER_ID, () => { if (ispezioneCelle.get()) map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', LCZ_VITALITY_LAYER_ID, () => { if (ispezioneCelle.get()) map.getCanvas().style.cursor = ''; });
    map.on('click', LCZ_VITALITY_LAYER_ID, e => {
        if (!ispezioneCelle.get()) return;
        const p = e.features?.[0]?.properties;
        if (!p) return;
        const fmt = v => (typeof v === 'number' ? (Number.isInteger(v) ? v : +v.toFixed(3)) : v);
        const rows = LCZ_PARAMS
            .filter(([key]) => p[key] !== undefined && p[key] !== null)
            .map(([key, label, unit]) => `<tr><td>${label}</td><td style="text-align:right;padding-left:8px"><b>${fmt(p[key])}</b> ${unit}</td></tr>`)
            .join('');
        const fix = p.lcz_esa_fix && p.lcz_esa_fix !== '-' ? `<br>Corretta con ESA WorldCover: ${p.lcz_esa_fix}` : '';
        const k = lastCellMap && cellMapIndex?.get(p.id);
        const now = k === undefined || k === null ? '' : (() => {
            const u = lastCellMap.utci[k], st = lastCellMap.stato[k];
            const band = Number.isNaN(u) ? null : [...UTCI_BANDS].reverse().find(([t]) => u >= t);
            return `<div style="margin-top:6px;padding:4px 6px;background:#f3f3f3;border-radius:4px">In quest'ora: `
                + (band ? `UTCI ≈ <b>${Math.round(u)} °C</b> (${band[3]}, stima) · ` : '')
                + `mappa sonora <b>${st ? st[0].toUpperCase() + st.slice(1) : '—'}</b>`
                + ` · ≈ ${Math.round(lastCellMap.people[k])} persone in giro qui intorno</div>`;
        })();
        new Popup({ maxWidth: '340px' })
            .setLngLat(e.lngLat)
            .setHTML(`<div style="font-size:12px;line-height:1.4">
                <div style="font-size:14px"><b>LCZ ${p.lcz_class} – ${LCZ_NAMES[p.lcz_class] ?? 'sconosciuta'}</b></div>
                Rischio isola di calore: <b>${UHI_NAMES[p.lcz_vulnerability] ?? p.lcz_vulnerability}</b>${fix}${now}
                <table style="margin-top:6px;border-collapse:collapse">${rows}</table>
                <div style="color:#888;margin-top:4px">Cella ${p.id} · 30 × 30 m</div></div>`)
            .addTo(map);
    });
}

// --- Mappe orarie della bussola (UTCI e Sound map): colori dal feature-state delle celle ---
const CELL_MAP_TYPES = new Set(['utci', 'stato']);
let lastCellMap = null, cellMapIndex = null; // ultimo risultato e id cella -> posizione

// Di default, in ogni stile, le celle stanno sopra lo sfondo bianco e sotto verde, acqua, strade ed edifici:
// il bianco non le copre (setWhiteOverCellsHidden). "Sopra edifici e strade" le porta sopra tutto, ma sotto i
// puntini delle persone e sotto il quartiere selezionato.
function placeCellLayers() {
    const map = getMapInstance();
    const haCelle = !!map.getLayer(LCZ_VITALITY_LAYER_ID), haVarco = !!map.getLayer(VARCO_LAYER_ID);
    if (!haCelle && !haVarco) return;
    const sopra = cellsOnTop ? overlayBeforeId(map) : CELLS_UNDER_ID;
    if (haCelle) map.moveLayer(LCZ_VITALITY_LAYER_ID, sopra);
    if (haVarco) map.moveLayer(VARCO_LAYER_ID, sopra); // dove stanno le celle: sotto edifici e campiture, o sopra tutto con «Sopra tutta la mappa»
    // All'avvio il livello esiste ma è spento (addLczVitalityLayer(false)): allora il bianco resta com'è
    const visible = haVarco || (haCelle && map.getLayoutProperty(LCZ_VITALITY_LAYER_ID, 'visibility') !== 'none');
    setWhiteOverCellsHidden(visible && !cellsOnTop);
}

/** Interruttore "Sopra tutta la mappa": true porta le celle sopra edifici, fiume e strade. */
export function setCellsOnTop(on) {
    cellsOnTop = on;
    if (isMapReady()) placeCellLayers();
}

/** Dopo un cambio di stile della mappa di base (setBaseStyle): puntini e mappe delle celle al loro posto. */
export function applyBaseStyleToOverlays() {
    const map = getMapInstance();
    [[true, '-color'], [false, '-zoom']].forEach(([colored, suffix]) => {
        const id = PRESENCE_POINTS_LAYER_ID + suffix;
        if (map.getLayer(id)) Object.entries(presencePaint(colored)).forEach(([k, v]) => map.setPaintProperty(id, k, v));
    });
    placeCellLayers();
}

/** Accende il calcolo per cella solo se il livello LCZ è visibile con una mappa oraria. */
function syncCellMap(type) {
    const on = (CELL_MAP_TYPES.has(type) && !!getMapInstance().getLayer(LCZ_VITALITY_LAYER_ID))
        || (varcoAttivo() && CELL_MAP_TYPES.has(vistaVarco()));
    setCellMapActive(on);
}

// Ultimo feature-state scritto per ogni cella (id -> { u, s, c }): se non cambia non si riscrive. Si scrivono solo i campi
// che la vista legge (UTCI: utci; Sound map: stato e colore; le altre viste nessuno): con la Sound map l'UTCI cambia a ogni ora
// per ogni cella, ma il colore spesso no, e migliaia di setFeatureState inutili costavano più del calcolo.
let statoApplicato = new Map(), campiApplicati = '';
const campiDellaVista = (vista) => (vista === 'utci' ? 'u' : vista === 'stato' ? 'sc' : '');
/** `tutte`: riscrive ogni cella calcolata (dopo che la sorgente è stata ricreata), non solo il pezzo appena arrivato. */
function applyCellMap(result, tutte = false) {
    lastCellMap = result;
    if (result && !cellMapIndex) cellMapIndex = new Map(result.ids.map((id, k) => [id, k]));
    if (!result) return;
    const map = getMapInstance();
    if (!map.getSource(LCZ_VITALITY_SOURCE_ID)) return;
    // Quello che serve è la vista del varco (che a celle spente è la Sound map) o, senza cerchio, quella delle celle
    const campi = campiDellaVista(varcoAttivo() ? vistaVarco() : currentLczVisualizationType);
    if (!campi) { campiApplicati = ''; statoApplicato = new Map(); return; } // la vista non legge nulla: al ritorno si riscrive tutto
    const daCapo = tutte || campi !== campiApplicati; // vista cambiata o sorgente nuova: si riscrive ogni cella calcolata
    if (daCapo) { statoApplicato = new Map(); campiApplicati = campi; }
    const elenco = daCapo ? (result.lista ?? result.ids.map((_, k) => k)) : (result.attive ?? result.ids.map((_, k) => k));
    const conUtci = campi === 'u';
    for (const k of elenco) {
        const u = Number.isNaN(result.utci[k]) ? null : result.utci[k], st = result.stato[k];
        if (u === null && !st) continue; // non ancora calcolata
        const id = result.ids[k];
        const prima = statoApplicato.get(id);
        if (conUtci) {
            if (prima && prima.u === u) continue;
            statoApplicato.set(id, { u });
            map.setFeatureState({ source: LCZ_VITALITY_SOURCE_ID, id }, { utci: u });
        } else {
            const colore = coloreSuono(result.x[k], result.y[k], st);
            if (prima && prima.s === st && prima.c === colore) continue;
            statoApplicato.set(id, { s: st, c: colore });
            map.setFeatureState({ source: LCZ_VITALITY_SOURCE_ID, id }, { stato: st, colore });
        }
    }
}
cellMap.subscribe(r => applyCellMap(r));

/**
 * Cambia il tipo di visualizzazione del layer LCZ Vitality.
 * @param {string} visualizationType - Tipo di visualizzazione: 'LCZ' o 'UHI'
 */
export function updateLczVitalityVisualization(visualizationType) {
    const map = getMapInstance();
    if (!map || !isMapReady() || !map.getLayer(LCZ_VITALITY_LAYER_ID)) {
        return;
    }

    try {
        const fillColor = getLczFillColor(visualizationType);

        map.setPaintProperty(LCZ_VITALITY_LAYER_ID, 'fill-color', fillColor);
        currentLczVisualizationType = visualizationType;
        placeCellLayers();
        syncCellMap(visualizationType);
        aggiornaVarco();
        applyCellMap(lastCellMap); // la nuova vista può leggere altri campi del feature-state

        // Se stiamo passando a UHI e la visualizzazione dinamica è attiva, aggiorna
        if (visualizationType === 'UHI' && uhiDynamicVisibilityEnabled) {
            updateUhiDynamicVisualization();
        } else {
            // Fuori da UHI dinamico: opacità normale
            setLczLayerOpacity(currentLczOpacity);
        }

        if (DEBUG_MODE) {
            console.log(`LCZ Vitality visualization updated to: ${visualizationType}`);
        }
    } catch (error) {
        console.error("Error updating LCZ vitality visualization:", error);
    }
}

/**
 * Restituisce il tipo di visualizzazione attualmente attiva per LCZ Vitality.
 * @returns {string} Il tipo di visualizzazione corrente ('LCZ' o 'UHI')
 */
export function getCurrentLczVisualizationType() {
    return currentLczVisualizationType;
}

/**
 * Imposta l'opacità del layer LCZ Vitality.
 * @param {number} opacity - Valore di opacità tra 0 e 1
 */
export function setLczLayerOpacity(opacity) {
    const map = getMapInstance();
    if (!map || !isMapReady() || !map.getLayer(LCZ_VITALITY_LAYER_ID)) {
        return;
    }

    try {
        currentLczOpacity = opacity;
        lczOpacityBase = opacity;
        applyLczPaint();
        
        if (DEBUG_MODE) {
            console.log(`LCZ layer opacity set to: ${opacity}`);
        }
    } catch (error) {
        console.error("Error setting LCZ layer opacity:", error);
    }
}

/**
 * Attiva/disattiva la visibilità dinamica UHI basata sulla densità di presence points.
 * @param {boolean} enabled - True per attivare, false per disattivare
 */
export function setUhiDynamicVisibility(enabled) {
    uhiDynamicVisibilityEnabled = enabled;
    
    if (DEBUG_MODE) {
        console.log(`UHI dynamic visibility ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    // Se è attivato e siamo in modalità UHI, aggiorna immediatamente la visualizzazione
    if (enabled && currentLczVisualizationType === 'UHI') {
        updateUhiDynamicVisualization();
    } else if (!enabled) {
        // Ripristina l'opacità normale
        setLczLayerOpacity(currentLczOpacity);
    }
}

/**
 * Aggiorna la visualizzazione dinamica UHI basata sulla densità di presence points.
 */
export function updateUhiDynamicVisualization() {
    console.log('🎯 updateUhiDynamicVisualization called');
    
    const map = getMapInstance();
    if (!map || !isMapReady() || !map.getLayer(LCZ_VITALITY_LAYER_ID)) {
        console.log('❌ Map, style, or LCZ layer not ready');
        return;
    }
    
    console.log('📊 uhiDynamicVisibilityEnabled:', uhiDynamicVisibilityEnabled);
    console.log('📊 currentLczVisualizationType:', currentLczVisualizationType);
    
    if (!uhiDynamicVisibilityEnabled || currentLczVisualizationType !== 'UHI') {
        console.log('❌ Dynamic visibility disabled or not in UHI mode');
        return;
    }

    try {
        const lczData = getLczVitalityData();
        
        if (!lczData?.length || !currentPresencePoints?.features?.length) {
            return;
        }

        // Calcola le metriche avanzate di presenza per ogni poligono UHI
        // Punti ordinati per longitudine: per ogni cella si passano a Turf solo quelli nel suo riquadro
        const points = [...currentPresencePoints.features].sort((a, b) => a.geometry.coordinates[0] - b.geometry.coordinates[0]);
        const lons = points.map(p => p.geometry.coordinates[0]);

        const updatedFeatures = lczData.map((feature, index) => {
            const [minX, minY, maxX, maxY] = getCellBbox(feature);
            let lo = 0, hi = lons.length;
            while (lo < hi) { const mid = (lo + hi) >> 1; if (lons[mid] < minX) lo = mid + 1; else hi = mid; }
            const candidates = [];
            for (let i = lo; i < lons.length && lons[i] <= maxX; i++) {
                const y = points[i].geometry.coordinates[1];
                if (y >= minY && y <= maxY) candidates.push(points[i]);
            }
            const presenceMetrics = calculatePresenceMetrics(feature, candidates);
            const uhiRisk = feature.properties['UHI risk'];
            
            // Calcola l'opacità usando il sistema ibrido
            let opacity = getUhiDynamicOpacityHybrid(uhiRisk, presenceMetrics);
            
            return {
                ...feature,
                properties: {
                    ...feature.properties,
                    dynamicOpacity: opacity,
                    presenceCount: presenceMetrics.count,
                    presenceDensity: presenceMetrics.density,
                    presenceConcentration: presenceMetrics.concentration,
                    presenceHybridScore: presenceMetrics.hybridScore
                }
            };
        });

        // Crea una nuova espressione di opacità dinamica
        const dynamicOpacityExpression = [
            'case',
            ['has', 'dynamicOpacity'],
            ['get', 'dynamicOpacity'],
            currentLczOpacity // fallback all'opacità normale
        ];

        // Aggiorna la sorgente con i nuovi dati
        const updatedGeoJson = {
            type: 'FeatureCollection',
            features: updatedFeatures
        };

        map.getSource(LCZ_VITALITY_SOURCE_ID).setData(updatedGeoJson);
        lczOpacityBase = dynamicOpacityExpression;
        applyLczPaint();

        if (DEBUG_MODE) {
            console.log('UHI dynamic visualization updated');
            console.log('Features with presence points:', updatedFeatures.filter(f => f.properties.presenceCount > 0).length);
        }
    } catch (error) {
        console.error("Error updating UHI dynamic visualization:", error);
    }
}

const cellBboxCache = new WeakMap();

/** Riquadro [minX, minY, maxX, maxY] di una cella LCZ, calcolato una volta sola. */
function getCellBbox(feature) {
    let bbox = cellBboxCache.get(feature.geometry);
    if (!bbox) {
        bbox = turf.bbox(feature);
        cellBboxCache.set(feature.geometry, bbox);
    }
    return bbox;
}

/**
 * Calcola metriche avanzate di presenza per un poligono (sistema ibrido).
 * @param {object} polygon - Feature poligono
 * @param {array} points - Array di punti presence
 * @returns {object} Oggetto con count, density, concentration, hybridScore
 */
function calculatePresenceMetrics(polygon, points) {
    const metrics = {
        count: 0,
        density: 0,
        concentration: 0,
        hybridScore: 0
    };
    
    try {
        // 1. Conteggio assoluto
        const pointsInPolygon = [];
        points.forEach(point => {
            if (turf.booleanPointInPolygon(point, polygon)) {
                pointsInPolygon.push(point);
                metrics.count++;
            }
        });
        
        if (metrics.count === 0) {
            return metrics;
        }
        
        // 2. Densità per area standard (900m² = 0.0009 km²)
        const STANDARD_AREA_KM2 = 0.0009;
        metrics.density = metrics.count / STANDARD_AREA_KM2; // punti per km²
        
        // 3. Concentrazione (quanto sono raggruppati i punti)
        if (metrics.count > 1) {
            // Calcola la distanza media tra tutti i punti
            let totalDistance = 0;
            let pairCount = 0;
            
            for (let i = 0; i < pointsInPolygon.length; i++) {
                for (let j = i + 1; j < pointsInPolygon.length; j++) {
                    const dist = turf.distance(pointsInPolygon[i], pointsInPolygon[j], { units: 'meters' });
                    totalDistance += dist;
                    pairCount++;
                }
            }
            
            const avgDistance = totalDistance / pairCount;
            // Normalizza: distanza bassa = alta concentrazione
            // Assumendo che 30m sia la distanza massima in un poligono di 900m²
            const maxDistance = 30; // metri
            metrics.concentration = Math.max(0, 1 - (avgDistance / maxDistance));
        } else {
            metrics.concentration = 1; // Un singolo punto è perfettamente concentrato
        }
        
        // 4. Punteggio ibrido combinato
        // Normalizza i componenti
        const normalizedCount = Math.min(metrics.count / 20, 1); // max 20 punti
        const normalizedDensity = Math.min(metrics.density / 22222, 1); // 20 punti / 0.0009 km²
        const normalizedConcentration = metrics.concentration; // già 0-1
        
        // Combina con pesi: conteggio 40%, densità 40%, concentrazione 20%
        metrics.hybridScore = (normalizedCount * 0.4) + 
                             (normalizedDensity * 0.4) + 
                             (normalizedConcentration * 0.2);
        
    } catch (error) {
        console.warn("Error calculating presence metrics:", error);
    }
    
    return metrics;
}

/**
 * Calcola il numero di presence points all'interno di un poligono (legacy).
 * @param {object} polygon - Feature poligono
 * @param {array} points - Array di punti presence
 * @returns {number} Numero di punti all'interno del poligono
 */
function calculatePresencePointsInPolygon(polygon, points) {
    const metrics = calculatePresenceMetrics(polygon, points);
    return metrics.count;
}

/**
 * Calcola l'opacità dinamica basata su UHI Risk e metriche avanzate di presenza.
 * Sistema ibrido che considera: conteggio, densità, concentrazione.
 * @param {string} uhiRisk - Livello di rischio UHI
 * @param {object} presenceMetrics - Oggetto con metriche di presenza
 * @returns {number} Valore di opacità tra 0 e 1
 */
function getUhiDynamicOpacityHybrid(uhiRisk, presenceMetrics) {
    // Mappa i livelli UHI Risk a valori numerici
    const uhiRiskLevels = {
        'Very Low': 1,
        'Low': 2,
        'Low-Medium': 3,
        'Medium-Low': 4,
        'Medium': 5,
        'High': 6,
        'Very High': 7
    };
    
    const riskLevel = uhiRiskLevels[uhiRisk] || 1;
    const riskIntensity = riskLevel / 7; // 0-1
    
    // Usa il punteggio ibrido delle metriche di presenza
    const presenceIntensity = presenceMetrics.hybridScore; // già 0-1
    
    // Definisci soglie per "alto rischio" e "alta presenza"
    const highRiskThreshold = 0.6; // 60% del rischio massimo (circa Medium+)
    const highPresenceThreshold = 0.3; // 30% del punteggio ibrido massimo
    
    const isHighRisk = riskIntensity >= highRiskThreshold;
    const isHighPresence = presenceIntensity >= highPresenceThreshold;
    
    // Sistema di visibilità migliorato
    if (isHighRisk && isHighPresence) {
        // ✅ Alto rischio + alta presenza = Molto visibile (0.75-0.95)
        const combinedIntensity = (riskIntensity + presenceIntensity) / 2;
        return 0.75 + (combinedIntensity * 0.2); // 0.75 - 0.95
    } else if (isHighRisk && !isHighPresence) {
        // 🟡 Alto rischio + bassa presenza = Moderatamente visibile (0.4-0.6)
        const adjustedIntensity = riskIntensity * 0.5 + presenceIntensity * 0.5;
        return 0.4 + (adjustedIntensity * 0.2); // 0.4 - 0.6
    } else if (!isHighRisk && isHighPresence) {
        // 🟡 Basso rischio + alta presenza = Moderatamente visibile (0.3-0.5)
        const adjustedIntensity = riskIntensity * 0.3 + presenceIntensity * 0.7;
        return 0.3 + (adjustedIntensity * 0.2); // 0.3 - 0.5
    } else {
        // ✅ Basso rischio + bassa presenza = Poco visibile (0.15-0.35)
        const combinedIntensity = (riskIntensity + presenceIntensity) / 2;
        return 0.15 + (combinedIntensity * 0.2); // 0.15 - 0.35
    }
}

/**
 * Calcola l'opacità dinamica (versione legacy per compatibilità).
 * @param {string} uhiRisk - Livello di rischio UHI
 * @param {number} presenceCount - Numero di presence points
 * @returns {number} Valore di opacità tra 0 e 1
 */
function getUhiDynamicOpacity(uhiRisk, presenceCount) {
    // Crea metriche semplificate per compatibilità
    const presenceMetrics = {
        count: presenceCount,
        density: presenceCount / 0.0009, // densità per km²
        concentration: presenceCount > 0 ? 0.5 : 0, // concentrazione media
        hybridScore: Math.min(presenceCount / 20, 1) // normalizzato
    };
    
    return getUhiDynamicOpacityHybrid(uhiRisk, presenceMetrics);
}