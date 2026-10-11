import * as turf from '@turf/turf';
import { getFullKmlGeoJson, getLuoghi } from '../data/data-loader.js';
import { getWeekIndex } from '../utils/utils.js';

// Luoghi dentro ogni area (confine del KML), calcolati una volta: id area → luoghi
const luoghiPerArea = new Map();

function luoghiDellArea(kmlFeatureId) {
    if (!kmlFeatureId) return getLuoghi();
    if (luoghiPerArea.has(kmlFeatureId)) return luoghiPerArea.get(kmlFeatureId);
    const area = getFullKmlGeoJson()?.features?.find(f => f.id === kmlFeatureId);
    const luoghi = area && turf.area(area) > 0 ? getLuoghi().filter(l => turf.booleanPointInPolygon([l.lon, l.lat], area)) : [];
    if (getLuoghi().length && area) luoghiPerArea.set(kmlFeatureId, luoghi); // non ricordare un elenco vuoto prima del caricamento
    return luoghi;
}

/**
 * Tipi di luogo dell'area all'ora scelta, dal più affollato. Dati per la scheda area, senza disegno.
 * Contano solo i luoghi che in quest'ora attirano gente (affluenza > 0, src/data/luoghi-core.js).
 * @param {number} timelineHourIndex - Indice dell'ora sulla timeline
 * @param {string|null} kmlFeatureId - Area selezionata
 * @returns {Array<object>} Oggetti con text (categoria in italiano), count (luoghi), value (affluenza sommata)
 *          e avgCrowdedness (affluenza media)
 */
export function getTipiDiLuogo(timelineHourIndex, kmlFeatureId = null) {
    const ora = getWeekIndex(timelineHourIndex);
    if (ora < 0) return [];
    const perTipo = new Map();
    luoghiDellArea(kmlFeatureId).forEach(l => {
        const v = l.affluenza[ora];
        if (!(v > 0)) return;
        const t = perTipo.get(l.nomeCategoria) || { count: 0, value: 0 };
        t.count += 1;
        t.value += v;
        perTipo.set(l.nomeCategoria, t);
    });
    return [...perTipo.entries()]
        .map(([text, { count, value }]) => ({ text, count, value, avgCrowdedness: value / count }))
        .sort((a, b) => b.value - a.value);
}
