// src/map/map-layers.js
import { getMapInstance } from './map-setup.js';
import {
    KML_SOURCE_ID, KML_LAYER_ID,
    PRESENCE_POINTS_SOURCE_ID, PRESENCE_POINTS_LAYER_ID,
    CROWDED_SOURCE_ID, CROWDED_LAYER_ID,
    SPOTS_SOURCE_ID, SPOTS_LAYER_ID,
    SYNTHETIC_CROWDED_SOURCE_ID, SYNTHETIC_CROWDED_LAYER_ID, // Assicurati sia definito in config.js
    ATTRACTION_MIN_CROWDEDNESS,
    MAP_STYLES,
    DEBUG_MODE // <-- aggiunto
} from '../data/config.js';
import { calculateAveragePresenceForFeature, generatePointsForFeature, perlin2d } from '../utils/utils.js';
import { getFullKmlGeoJson, getPoiData, getCrowdedData, getSpotMapperData } from '../data/data-loader.js';
import { addMapInteraction } from './map-interaction.js';

let fullCrowdedGeoJson = null;
let preparedCrowdedPoints = []; // prepared attractor points
let fullSpotsGeoJson = null;
export let fullSyntheticCrowdedGeoJson = null; // Cache per punti 'attractor' sintetici
let currentPresencePoints = null; // GeoJSON dei punti generati (con seed)
let animationFrameId = null;

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

// Genera la griglia FORCE_GRID in base alla bounding box delle KML e ai synthetic crowded
function generateForceGrid(fullKml, timelineHourIndex) {
    if (!fullKml?.features?.length) return [];
    // Ottieni synthetic crowded points
    const spotsData = getSpotMapperData();
    const crowdedData = getCrowdedData();
    const crowdednessColumn = getCrowdednessColumnName(timelineHourIndex);
    const syntheticGeoJson = generateSyntheticCrowdedPointsGeoJson(spotsData, crowdedData, crowdednessColumn);
    const attractors = (syntheticGeoJson?.features || [])
        .filter(f => (f.properties?.synthetic_crowdedness || 0) > 0)
        .map(f => ({
            lon: f.geometry.coordinates[0],
            lat: f.geometry.coordinates[1],
            strength: f.properties.synthetic_crowdedness
        }));
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

    if (!map.isStyleLoaded()) {
        map.once('idle', applyVisibility);
    } else {
        applyVisibility();
    }
}

/**
 * Aggiunge i layer KML (base-outline, fill, outline) alla mappa.
 * @param {object} geoJson - GeoJSON FeatureCollection per le aree KML.
 * @param {boolean} initialVisibility - Visibilità iniziale dei layer.
 */
export function addKmlLayer(geoJson, initialVisibility = true) {
    const map = getMapInstance();
    // Attendi che la mappa e lo stile siano pronti
    if (!map || !map.isStyleLoaded()) {
        // console.log("addKmlLayer: Map or style not ready, deferring.");
        map.once('idle', () => addKmlLayer(geoJson, initialVisibility));
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
            promoteId: 'id' // Usa il campo 'id' della feature come ID univoco
        });

        // Inizializza hoverAmount a 0 per tutte le feature KML
        geoJsonForDisplay.features.forEach(f => {
            try {
                map.setFeatureState({ source: KML_SOURCE_ID, id: f.id }, { hoverAmount: 0 });
            } catch (e) {}
        });

        // Determina dove inserire i layer (sotto i punti se esistono)
        let beforeLayerId;
        const pointLayers = [PRESENCE_POINTS_LAYER_ID, CROWDED_LAYER_ID, SPOTS_LAYER_ID, SYNTHETIC_CROWDED_LAYER_ID];
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
             if (!currentMap || !currentMap.isStyleLoaded() || !currentMap.getSource(KML_SOURCE_ID)) return;
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
    if (!map || !map.isStyleLoaded()) {
        map.once('idle', () => addOrUpdatePresencePointsLayer(pointsGeoJson, initialVisibility));
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
                data: pointsGeoJson
            });

            map.addLayer({
                id: PRESENCE_POINTS_LAYER_ID + '-color',
                type: 'circle',
                source: PRESENCE_POINTS_SOURCE_ID,
                filter: ['has', 'color'],
                layout: { 'visibility': initialVisibility ? 'visible' : 'none' },
                paint: {
                    'circle-radius': MAP_STYLES.PRESENCE_POINTS_COLOR.CIRCLE_RADIUS,
                    'circle-color': MAP_STYLES.PRESENCE_POINTS_COLOR.CIRCLE_COLOR,
                    'circle-opacity': MAP_STYLES.PRESENCE_POINTS_COLOR.CIRCLE_OPACITY,
                    'circle-stroke-width': MAP_STYLES.PRESENCE_POINTS_COLOR.CIRCLE_STROKE_WIDTH,
                    'circle-stroke-color': MAP_STYLES.PRESENCE_POINTS_COLOR.CIRCLE_STROKE_COLOR,
                    'circle-stroke-opacity': MAP_STYLES.PRESENCE_POINTS_COLOR.CIRCLE_STROKE_OPACITY,
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
                    'circle-radius': MAP_STYLES.PRESENCE_POINTS_ZOOM.CIRCLE_RADIUS,
                    'circle-color': MAP_STYLES.PRESENCE_POINTS_ZOOM.CIRCLE_COLOR,
                    'circle-opacity': MAP_STYLES.PRESENCE_POINTS_ZOOM.CIRCLE_OPACITY,
                    'circle-stroke-width': MAP_STYLES.PRESENCE_POINTS_ZOOM.CIRCLE_STROKE_WIDTH,
                    'circle-stroke-color': MAP_STYLES.PRESENCE_POINTS_ZOOM.CIRCLE_STROKE_COLOR,
                    'circle-stroke-opacity': MAP_STYLES.PRESENCE_POINTS_ZOOM.CIRCLE_STROKE_OPACITY,
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

// --- LAYER PUNTI AFFOLLAMENTO (CROWDED POINTS) ---

export function removeCrowdedPointsLayer() {
    const map = getMapInstance(); if (!map) return;
    try { if (map.getLayer(CROWDED_LAYER_ID)) map.removeLayer(CROWDED_LAYER_ID); } catch (e) { /* ignore */ }
    try { if (map.getSource(CROWDED_SOURCE_ID)) map.removeSource(CROWDED_SOURCE_ID); } catch (e) { /* ignore */ }
}

export function getCrowdednessColumnName(hourIndex) {
    if (typeof hourIndex !== 'number' || hourIndex < 0 || hourIndex > 167) { return null; }
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const timelineDayIndex = Math.floor(hourIndex / 24);
    const hour = hourIndex % 24;
    if (timelineDayIndex < 0 || timelineDayIndex >= days.length) return null;
    const dayName = days[timelineDayIndex];
    const hourString = hour.toString().padStart(2, '0');
    return `${dayName}-${hourString}`;
}

function convertAndStoreCrowdedGeoJson(crowdedData) {
    fullCrowdedGeoJson = null;
    if (!crowdedData?.length) {
        console.warn("convertAndStoreCrowdedGeoJson: No crowded data provided.");
        return;
    }
    try {
        let validCount = 0; let invalidCount = 0;
        const features = crowdedData.map((record) => {
            const lat = record?.latitude;
            const lon = record?.longitude;
            const id = record?.id;
            if (typeof lat === 'number' && typeof lon === 'number' && !isNaN(lat) && !isNaN(lon) && id !== undefined && id !== null) {
                validCount++;
                const properties = { ...record, current_crowdedness: 0 };
                return {
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [lon, lat] },
                    properties: properties,
                    id: id
                };
            } else {
                invalidCount++;
                return null;
            }
        }).filter(feature => feature !== null);

        if (invalidCount > 0) {
             console.warn(`convertAndStoreCrowdedGeoJson: Skipped ${invalidCount} invalid records.`);
        }
        if (!features.length) {
            console.warn("convertAndStoreCrowdedGeoJson: No valid features generated from crowded data.");
            return;
        }
        fullCrowdedGeoJson = { type: 'FeatureCollection', features: features };
    } catch (error) {
        console.error("Error converting crowded data to GeoJSON:", error);
        fullCrowdedGeoJson = null;
    }
}

export function addCrowdedPointsLayer(initialVisibility = true) {
    if (!DEBUG_MODE) return; // Non caricare layer in modalità non-debug
    const map = getMapInstance();
    if (!map || !map.isStyleLoaded()) {
        map.once('idle', () => addCrowdedPointsLayer(initialVisibility));
        return;
    }
    if (!fullCrowdedGeoJson) {
        convertAndStoreCrowdedGeoJson(getCrowdedData());
    }
    if (!fullCrowdedGeoJson?.features?.length) {
        removeCrowdedPointsLayer();
        return;
    }
    removeCrowdedPointsLayer();
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

export function updateCrowdedPointsLayerStyle(timelineHourIndex, currentCrowdednessMap) {
    if (!DEBUG_MODE) return; // Non aggiornare layer in modalità non-debug
    const map = getMapInstance();
    if (!map || !map.isStyleLoaded() || !fullCrowdedGeoJson?.features?.length || !currentCrowdednessMap) {
        return;
    }
    const source = map.getSource(CROWDED_SOURCE_ID);
    if (!source) {
        return;
    }
    let dataChanged = false;
    preparedCrowdedPoints = [];
    try {
        let countCrowdedAboveThreshold = 0;
        let maxCrowdednessValue = 0;
        fullCrowdedGeoJson.features.forEach(feature => {
            if (feature.properties && feature.id !== undefined && feature.id !== null) {
                const featureIdStr = String(feature.id);
                const currentCrowdedness = currentCrowdednessMap.get(featureIdStr) || 0;
                maxCrowdednessValue = Math.max(maxCrowdednessValue, currentCrowdedness);
                if (feature.properties.current_crowdedness !== currentCrowdedness) {
                    feature.properties.current_crowdedness = currentCrowdedness;
                    dataChanged = true;
                }
                if (currentCrowdedness >= ATTRACTION_MIN_CROWDEDNESS) {
                    preparedCrowdedPoints.push({
                        id: feature.id,
                        feature: feature,
                        currentCrowdedness: currentCrowdedness
                    });
                    countCrowdedAboveThreshold++;
                }
            }
        });
        if (dataChanged) {
            source.setData(fullCrowdedGeoJson);
        }
    } catch (error) {
         console.error("Error updating crowded points properties:", error);
    }
}

// --- AGGIORNAMENTO COMPLESSIVO PUNTI PRESENZA (CON CAMPO DI FORZE STATICO) ---
export function updateAllPresencePoints(timelineHourIndex, currentCrowdednessMap, initialVisibility = true, colors = null) {
    const map = getMapInstance();
    const fullKml = getFullKmlGeoJson();
    const poiData = getPoiData();
    const spotsData = getSpotMapperData();
    const crowdedData = getCrowdedData();
    const crowdednessColumn = getCrowdednessColumnName(timelineHourIndex);
    const syntheticGeoJson = generateSyntheticCrowdedPointsGeoJson(spotsData, crowdedData, crowdednessColumn);
    const syntheticPoints = (syntheticGeoJson?.features || []).filter(f => (f.properties?.synthetic_crowdedness || 0) > 0);
    let allFinalPointsFeatures = [];
    const JITTER_METERS = 10;
    function metersToDegrees(meters, lat) {
        const latDeg = meters / 111320;
        const lonDeg = meters / (111320 * Math.cos(lat * Math.PI / 180));
        return { latDeg, lonDeg };
    }
    if (fullKml?.features?.length && poiData && Object.keys(poiData).length > 0) {
        fullKml.features.forEach(kmlFeature => {
            if (kmlFeature?.properties?.poi_data_available) {
                const { averagePresence } = calculateAveragePresenceForFeature(kmlFeature, poiData, timelineHourIndex);
                if (averagePresence <= 0) return;
                // Trova i synthetic point interni all'area
                const synthInArea = syntheticPoints.filter(synth =>
                    turf.booleanPointInPolygon(synth, kmlFeature.geometry)
                );
                if (synthInArea.length === 0) return;
                // Somma delle crowdedness
                const totalCrowdedness = synthInArea.reduce((sum, s) => sum + (s.properties.synthetic_crowdedness || 0), 0);
                // Se la somma è zero, distribuisci uniformemente
                synthInArea.forEach(synth => {
                    let n = 0;
                    if (totalCrowdedness > 0) {
                        n = Math.round((synth.properties.synthetic_crowdedness / totalCrowdedness) * averagePresence * 0.3);
                    } else {
                        n = Math.floor((averagePresence / synthInArea.length) * 0.3);
                    }
                    for (let i = 0; i < n; i++) {
                        const angle = Math.random() * 2 * Math.PI;
                        const radius = Math.random() * JITTER_METERS;
                        const { latDeg, lonDeg } = metersToDegrees(radius, synth.geometry.coordinates[1]);
                        const dx = Math.cos(angle) * lonDeg;
                        const dy = Math.sin(angle) * latDeg;
                        const lon = synth.geometry.coordinates[0] + dx;
                        const lat = synth.geometry.coordinates[1] + dy;
                        const props = {
                            syntheticId: synth.id,
                            kmlFeatureId: kmlFeature.id,
                            originalCoordinates: [lon, lat],
                            isStatic: false,
                            noiseSeedX: Math.random() * 10000,
                            noiseSeedY: Math.random() * 10000
                        };
                        if (colors) {
                            props.color = colors[Math.floor(Math.random() * colors.length)];
                        }
                        const point = turf.point([lon, lat], props);
                        allFinalPointsFeatures.push(point);
                    }
                });
                // --- AGGIUNGI 20% RANDOM NELL'AREA ---
                const nRandom = Math.round(averagePresence * 0.1);
                // Calcola bounding box area
                const bbox = turf.bbox(kmlFeature.geometry); // [minLon, minLat, maxLon, maxLat]
                let randomTries = 0;
                for (let i = 0; i < nRandom && randomTries < nRandom * 10; ) {
                    // Genera punto random nel bbox
                    const lon = bbox[0] + Math.random() * (bbox[2] - bbox[0]);
                    const lat = bbox[1] + Math.random() * (bbox[3] - bbox[1]);
                    // Verifica che sia dentro la KML
                    if (turf.booleanPointInPolygon([lon, lat], kmlFeature.geometry)) {
                        const props = {
                            kmlFeatureId: kmlFeature.id,
                            originalCoordinates: [lon, lat],
                            isStatic: false,
                            noiseSeedX: Math.random() * 10000,
                            noiseSeedY: Math.random() * 10000
                        };
                        if (colors) {
                            props.color = colors[Math.floor(Math.random() * colors.length)];
                        }
                        const point = turf.point([lon, lat], props);
                        allFinalPointsFeatures.push(point);
                        i++;
                    }
                    randomTries++;
                }
            }
        });
    }
    currentPresencePoints = allFinalPointsFeatures.length > 0
        ? turf.featureCollection(allFinalPointsFeatures)
        : null;
    addOrUpdatePresencePointsLayer(currentPresencePoints, initialVisibility);
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    if (DEBUG_MODE) addForceGridDebugLayer(map);
}

// Funzione di animazione fluida dei punti density
function animatePresencePoints(timelineHourIndex, fullKml) {
    if (!currentPresencePoints) return;
    const map = getMapInstance();
    if (!map || !map.isStyleLoaded()) return;
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

// --- PUNTI AFFOLLAMENTO SINTETICI (SYNTHETIC CROWDED POINTS) ---

export function generateSyntheticCrowdedPointsGeoJson(spotsData, crowdedData, crowdednessColumn) {
    if (!Array.isArray(spotsData) || !Array.isArray(crowdedData) || !crowdednessColumn) {
        console.warn("generateSyntheticCrowdedPointsGeoJson: Invalid input data or column name.");
        return null;
    }
    if (typeof turf === 'undefined') {
        console.error("generateSyntheticCrowdedPointsGeoJson: Turf.js is required.");
        return null;
    }
    const realCrowdedPoints = crowdedData
        .map(cp => {
            const crowdedness = parseFloat(cp[crowdednessColumn]) || 0;
            if (crowdedness > 0 && typeof cp.longitude === 'number' && typeof cp.latitude === 'number') {
                return {
                    ...cp,
                    tags: (cp.TAG || '').toLowerCase().split(',').map(t => t.trim()).filter(Boolean),
                    crowdedness: crowdedness,
                    coords: [cp.longitude, cp.latitude]
                };
            }
            return null;
        })
        .filter(cp => cp !== null);

    if (realCrowdedPoints.length === 0) {
        return { type: 'FeatureCollection', features: [] };
    }

    const EPSILON = 0.01; // km, per evitare divisione per zero
    const K = 5; // Numero di vicini da considerare

    // Funzione per similarità Jaccard tra due array di tag
    function jaccardSimilarity(tagsA, tagsB) {
        if (!tagsA.length || !tagsB.length) return 0;
        const setA = new Set(tagsA);
        const setB = new Set(tagsB);
        const intersection = new Set([...setA].filter(x => setB.has(x)));
        const union = new Set([...setA, ...setB]);
        return intersection.size / union.size;
    }

    const syntheticFeatures = spotsData
        .map((spot, idx) => {
            const spotTags = (spot.TAG || '').toLowerCase().split(',').map(t => t.trim()).filter(Boolean);
            const spotCoords = [spot.Longitudine, spot.Latitudine];
            if (!spotTags.length || typeof spotCoords[0] !== 'number' || typeof spotCoords[1] !== 'number') {
                return null;
            }
            const spotPoint = turf.point(spotCoords);
            // Calcola peso combinato per ogni CP
            const weightedCPs = realCrowdedPoints.map(cp => {
                const tagSim = jaccardSimilarity(spotTags, cp.tags);
                if (tagSim === 0) return null;
                const distKm = turf.distance(spotPoint, turf.point(cp.coords), { units: 'kilometers' });
                // Non limito la distanza, ma il peso sarà basso se lontano
                const weight = tagSim * (1 / (distKm + EPSILON));
                return { crowdedness: cp.crowdedness, weight, distKm, tagSim };
            }).filter(x => x !== null && x.weight > 0);

            // Ordina per peso decrescente e prendi i primi K
            weightedCPs.sort((a, b) => b.weight - a.weight);
            const knn = weightedCPs.slice(0, K);

            let inheritedCrowdedness = 0;
            if (knn.length > 0) {
                let weightedSum = 0;
                let weightSum = 0;
                knn.forEach(({ crowdedness, weight }) => {
                    weightedSum += crowdedness * weight;
                    weightSum += weight;
                });
                if (weightSum > 0) {
                    inheritedCrowdedness = weightedSum / weightSum;
                }
            }
            return {
                type: 'Feature',
                id: spot.id || `spot_${idx}`,
                properties: {
                    ...spot,
                    synthetic_crowdedness: inheritedCrowdedness
                },
                geometry: {
                    type: 'Point',
                    coordinates: spotCoords
                }
            };
        })
        .filter(f => f !== null);

    return {
        type: 'FeatureCollection',
        features: syntheticFeatures
    };
}

// --- LAYER PUNTI AFFOLLAMENTO SINTETICI ---

export function removeSyntheticCrowdedPointsLayer() {
    const map = getMapInstance();
    if (!map) return;
    try { if (map.getLayer(SYNTHETIC_CROWDED_LAYER_ID)) map.removeLayer(SYNTHETIC_CROWDED_LAYER_ID); } catch (e) { /* ignore */ }
    try { if (map.getSource(SYNTHETIC_CROWDED_SOURCE_ID)) map.removeSource(SYNTHETIC_CROWDED_SOURCE_ID); } catch (e) { /* ignore */ }
}

export function addSyntheticCrowdedPointsLayer(timelineHourIndex, initialVisibility = true) {
    const map = getMapInstance();
    if (!map || !map.isStyleLoaded()) {
        map.once('idle', () => addSyntheticCrowdedPointsLayer(timelineHourIndex, initialVisibility));
        return;
    }
    const spotsData = getSpotMapperData();
    const crowdedData = getCrowdedData();
    const crowdednessColumn = getCrowdednessColumnName(timelineHourIndex);
    if (!spotsData?.length || !crowdedData?.length || !crowdednessColumn) {
        console.warn("addSyntheticCrowdedPointsLayer: Missing data to generate synthetic points.");
        removeSyntheticCrowdedPointsLayer();
        return;
    }
    fullSyntheticCrowdedGeoJson = generateSyntheticCrowdedPointsGeoJson(spotsData, crowdedData, crowdednessColumn);
    if (!fullSyntheticCrowdedGeoJson?.features?.length) {
        removeSyntheticCrowdedPointsLayer();
        return;
    }
    removeSyntheticCrowdedPointsLayer();
    try {
        let beforeLayerId;
         if (map.getLayer(CROWDED_LAYER_ID)) {
             beforeLayerId = CROWDED_LAYER_ID;
         } else if (map.getLayer(PRESENCE_POINTS_LAYER_ID)) {
             beforeLayerId = PRESENCE_POINTS_LAYER_ID;
         }
        map.addSource(SYNTHETIC_CROWDED_SOURCE_ID, {
            type: 'geojson',
            data: fullSyntheticCrowdedGeoJson,
            promoteId: 'id'
        });
        map.addLayer({
            id: SYNTHETIC_CROWDED_LAYER_ID,
            type: 'circle',
            source: SYNTHETIC_CROWDED_SOURCE_ID,
            layout: { 'visibility': initialVisibility ? 'visible' : 'none' },
            paint: {
                'circle-radius': MAP_STYLES.SYNTHETIC_CROWDED_POINTS.CIRCLE_RADIUS,
                'circle-color': MAP_STYLES.SYNTHETIC_CROWDED_POINTS.CIRCLE_COLOR,
                'circle-opacity': MAP_STYLES.SYNTHETIC_CROWDED_POINTS.CIRCLE_OPACITY,
                'circle-stroke-width': MAP_STYLES.SYNTHETIC_CROWDED_POINTS.CIRCLE_STROKE_WIDTH,
                'circle-stroke-color': MAP_STYLES.SYNTHETIC_CROWDED_POINTS.CIRCLE_STROKE_COLOR,
                'circle-stroke-opacity': MAP_STYLES.SYNTHETIC_CROWDED_POINTS.CIRCLE_STROKE_OPACITY,
                'circle-pitch-alignment': 'viewport',
                'circle-pitch-scale': 'map'
            }
        }, beforeLayerId);
    } catch (error) {
        console.error("Error adding synthetic crowded points source or layer:", error);
        removeSyntheticCrowdedPointsLayer();
    }
}


// --- LAYER SPOT MAPPER (POI SPOTS) ---

function convertAndStoreSpotsGeoJson(spotsData) {
    fullSpotsGeoJson = null;
    if (!spotsData || !Array.isArray(spotsData) || spotsData.length === 0) {
        console.warn("convertAndStoreSpotsGeoJson: No spots data provided.");
        return null;
    }
    try {
        const features = spotsData
            .filter(spot => typeof spot.Longitudine === 'number' && typeof spot.Latitudine === 'number')
            .map((spot, index) => {
                const id = spot.id || `spot_${index}`;
                return {
                    type: 'Feature',
                    id: id,
                    properties: {
                        ...spot,
                        id: id,
                        name: spot.Nome || 'Spot',
                        tipo: spot.Tipo || 'unknown',
                        tag: spot.TAG || ''
                    },
                    geometry: {
                        type: 'Point',
                        coordinates: [spot.Longitudine, spot.Latitudine]
                    }
                };
        });
        if (!features.length) {
            console.warn("convertAndStoreSpotsGeoJson: No valid features generated from spots data.");
            return null;
        }
        fullSpotsGeoJson = {
            type: 'FeatureCollection',
            features: features
        };
        return fullSpotsGeoJson;
    } catch (error) {
        console.error("Error converting spots data to GeoJSON:", error);
        fullSpotsGeoJson = null;
        return null;
    }
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
    if (!map || !map.isStyleLoaded()) {
        map.once('idle', () => addSpotsLayer(initialVisibility));
        return;
    }
    if (!fullSpotsGeoJson) {
        convertAndStoreSpotsGeoJson(getSpotMapperData());
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
                'text-field': ['get', 'name'],
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