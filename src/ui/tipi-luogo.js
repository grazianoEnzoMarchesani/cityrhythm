import * as turf from '@turf/turf';
import { getCrowdedData, getFullKmlGeoJson, getSpotMapperData } from '../data/data-loader.js';
import { getTimelineCrowdednessColumn, generateSyntheticCrowdedPointsGeoJson } from '../map/map-layers.js';
import { DEBUG_MODE } from '../data/config.js';

/**
 * Extracts all unique tags from crowded data with counts and crowdedness values.
 * @param {string} columnName - Name of the crowdedness column for the current hour.
 * @param {string|null} kmlFeatureId - Optional KML feature ID selected to filter tags.
 * @returns {Array<object>} Array of tag objects with name, count, and total crowdedness.
 */
function extractTagsFromAttractorMode(columnName, kmlFeatureId = null) {
    // Forza la modalità synthetic
    const mode = 'synthetic';
    let real = [];
    let synthetic = [];
    if (mode === 'real' || mode === 'both') {
        real = getCrowdedData() || [];
    }
    if (mode === 'synthetic' || mode === 'both') {
        const spots = getSpotMapperData() || [];
        const crowded = getCrowdedData() || [];
        const syntheticGeo = generateSyntheticCrowdedPointsGeoJson(spots, crowded, columnName);
        if (syntheticGeo && syntheticGeo.features?.length) {
            synthetic = syntheticGeo.features.map(f => ({
                TAG: f.properties.TAG,
                synthetic_crowdedness: f.properties.synthetic_crowdedness,
                Longitudine: f.geometry.coordinates[0],
                Latitudine: f.geometry.coordinates[1]
            }));
        }
    }
    let records = [];
    if (mode === 'real') records = real;
    else if (mode === 'synthetic') records = synthetic;
    else records = [...real, ...synthetic];
    // Filtro per area se serve
    if (kmlFeatureId) {
        const kmlGeoJson = getFullKmlGeoJson();
        const selectedFeature = kmlGeoJson?.features?.find(f => f.id === kmlFeatureId);
        if (selectedFeature && turf.area(selectedFeature) > 0) {
            records = records.filter(record => {
                const lon = record.longitude ?? record.Longitudine;
                const lat = record.latitude ?? record.Latitudine;
                if (!lon || !lat) return false;
                const point = turf.point([lon, lat]);
                return turf.booleanPointInPolygon(point, selectedFeature);
            });
        }
    }
    // Calcolo tag
    const tagMap = new Map();
    records.forEach(record => {
        const tagField = record.TAG;
        if (!tagField || typeof tagField !== 'string') return;
        const value = (record.synthetic_crowdedness !== undefined)
            ? record.synthetic_crowdedness
            : (record.crowdedness !== undefined ? record.crowdedness : 0);
        const crowdednessValue = (record.synthetic_crowdedness !== undefined)
            ? record.synthetic_crowdedness
            : (record.crowdedness !== undefined ? record.crowdedness : 0);
        const tags = tagField.split(',').map(tag => tag.trim()).filter(tag => tag);
        tags.forEach(tag => {
            if (!tagMap.has(tag)) {
                tagMap.set(tag, { count: 0, totalCrowdedness: 0 });
            }
            const tagData = tagMap.get(tag);
            tagData.count += 1;
            tagData.totalCrowdedness += crowdednessValue;
        });
    });
    // LOG: Stampo tutti i TAG unici processati per debug
    if (DEBUG_MODE) console.log('[TAG-CLOUD] TAG unici nella word cloud:', Array.from(tagMap.keys()));
    return Array.from(tagMap.entries())
        .map(([name, data]) => ({
            text: name,
            count: data.count,
            value: data.totalCrowdedness,
            avgCrowdedness: data.count > 0 ? data.totalCrowdedness / data.count : 0
        }))
        .sort((a, b) => b.value - a.value);
}

/**
 * Tipi di luogo dell'area all'ora scelta, dal più affollato. Dati per la scheda area, senza disegno.
 * @param {number} timelineHourIndex - Indice dell'ora sulla timeline
 * @param {string|null} kmlFeatureId - Area selezionata
 * @returns {Array<object>} Oggetti con text, count, value (affollamento sommato) e avgCrowdedness
 */
export function getTipiDiLuogo(timelineHourIndex, kmlFeatureId = null) {
    const columnName = getTimelineCrowdednessColumn(timelineHourIndex);
    if (!columnName) return [];
    return extractTagsFromAttractorMode(columnName, kmlFeatureId);
}
