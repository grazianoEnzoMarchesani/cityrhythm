// Colorazione dei puntini delle presenze secondo una caratteristica dei visitatori (genere, età...).
// Ogni quartiere usa le proprie percentuali reali, calcolate sugli stessi giorni dei grafici della barra laterale.
// Ogni persona ha un posto fisso in una "fila" (ordine dato da hash01 della sua chiave): i primi della fila
// prendono la prima categoria, i successivi la seconda, ecc. Così i conteggi sono esatti e,
// cambiando ora, le persone tengono il loro colore finché le percentuali non cambiano davvero.
import { CHART_COLORS } from '../data/config.js';
import { getDateTimeFromIndex, hash01, rangeDays, WEEK_TYPE_FROM_DAYS } from '../utils/utils.js';

export const PRESENCE_COLOR_VARIABLES = {
    gender: {
        label: 'Genere',
        categories: [
            { name: 'Uomini', fields: ['% M'], color: CHART_COLORS.GENDER_CHART.MALE },
            { name: 'Donne', fields: ['% F'], color: CHART_COLORS.GENDER_CHART.FEMALE }
        ]
    },
    age: {
        label: 'Età',
        categories: ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'].map(a => (
            { name: a, fields: [`% ${a}`], color: CHART_COLORS.AGE_CHART[a] }
        ))
    },
    nationality: {
        label: 'Nazionalità',
        categories: [
            { name: 'Italiani', fields: ['% Italiani', 'perc_italiani'], color: CHART_COLORS.NATIONALITY_CHART.ITALIANS },
            { name: 'Stranieri', fields: ['% Stranieri', 'perc_stranieri'], color: CHART_COLORS.NATIONALITY_CHART.FOREIGNERS }
        ]
    },
    visits: {
        label: 'Visite',
        categories: ['1 visita', '2 visite', '3 visite', '4 visite', '5+ visite'].map((name, i) => (
            { name, fields: [`visite_${i + 1}`], color: CHART_COLORS.VISITS_CHART[`VISIT_${i + 1}`] }
        ))
    }
};

let colorBy = 'none';
let personColors = new Map();   // chiave persona → colore nell'ora corrente
let previousColors = new Map(); // ora precedente: serve a chi sta lasciando la città
const sharesCache = new Map();

export function getPresenceColorBy() { return colorBy; }

export function setPresenceColorBy(key) {
    colorBy = PRESENCE_COLOR_VARIABLES[key] ? key : 'none';
}

export function getPreviousPersonColor(key) {
    return previousColors.get(key);
}

// Stesso filtro dei grafici: con meno di 7 giorni scelti tutti i giorni dell'intervallo,
// altrimenti solo quelli con lo stesso giorno della settimana (dentro l'intervallo, se c'è).
function filterRecords(records, timelineHourIndex) {
    const range = window.selectedDateRange;
    const min = range?.min instanceof Date ? range.min : null;
    const max = range?.max instanceof Date ? range.max : null;
    const shortRange = min && max && rangeDays(min, max) < WEEK_TYPE_FROM_DAYS;
    const { jsDayOfWeek } = getDateTimeFromIndex(timelineHourIndex);
    return records.filter(r => {
        const d = r.parsedDate;
        if (!(d instanceof Date) || isNaN(d)) return false;
        if (min && max && (d < min || d > max)) return false;
        return shortRange || d.getUTCDay() === jsDayOfWeek;
    });
}

// Quote (0–1, somma 1) di ogni categoria in un quartiere, o null se mancano i dati
function getAreaShares(kmlFeature, poiData, timelineHourIndex) {
    const poiName = kmlFeature.properties.poi_name?.trim().toLowerCase();
    const records = poiData[poiName];
    if (!records?.length) return null;
    const range = window.selectedDateRange;
    const { jsDayOfWeek } = getDateTimeFromIndex(timelineHourIndex);
    const cacheKey = [colorBy, poiName, jsDayOfWeek, range?.min?.getTime?.(), range?.max?.getTime?.()].join('|');
    if (sharesCache.has(cacheKey)) return sharesCache.get(cacheKey);

    const filtered = filterRecords(records, timelineHourIndex);
    const means = PRESENCE_COLOR_VARIABLES[colorBy].categories.map(cat => {
        let sum = 0, n = 0;
        filtered.forEach(r => {
            const field = cat.fields.find(f => r[f] !== undefined && r[f] !== '');
            const v = parseFloat(r[field]);
            if (!isNaN(v)) { sum += v; n++; }
        });
        return n ? sum / n : 0;
    });
    const total = means.reduce((a, b) => a + b, 0);
    const shares = total > 0 ? means.map(m => m / total) : null;
    sharesCache.set(cacheKey, shares);
    return shares;
}

// Conteggi interi che sommano a n, il più vicino possibile alle quote (metodo dei resti maggiori)
function countsFromShares(shares, n) {
    const exact = shares.map(s => s * n);
    const counts = exact.map(Math.floor);
    let left = n - counts.reduce((a, b) => a + b, 0);
    exact.map((x, i) => [x - counts[i], i])
        .sort((a, b) => b[0] - a[0])
        .forEach(([, i]) => { if (left > 0) { counts[i]++; left--; } });
    return counts;
}

// Imposta properties.color sui puntini (feature con personKey e kmlFeatureId), oppure lo toglie
export function applyPresenceColors(features, fullKml, poiData, timelineHourIndex) {
    previousColors = personColors;
    personColors = new Map();
    if (colorBy === 'none') {
        features.forEach(f => { delete f.properties.color; });
        return;
    }
    const byArea = new Map();
    features.forEach(f => {
        const id = f.properties.kmlFeatureId;
        if (!byArea.has(id)) byArea.set(id, []);
        byArea.get(id).push(f);
    });
    const categories = PRESENCE_COLOR_VARIABLES[colorBy].categories;
    byArea.forEach((people, id) => {
        const kmlFeature = fullKml.features.find(k => k.id === id);
        const shares = kmlFeature && getAreaShares(kmlFeature, poiData, timelineHourIndex);
        if (!shares) {
            people.forEach(f => { delete f.properties.color; });
            return;
        }
        const counts = countsFromShares(shares, people.length);
        const rank = new Map(people.map(f => [f, hash01(f.properties.personKey + ':' + colorBy)]));
        people.sort((a, b) => rank.get(a) - rank.get(b));
        let c = 0, used = 0;
        people.forEach(f => {
            while (c < counts.length - 1 && used >= counts[c]) { c++; used = 0; }
            f.properties.color = categories[c].color;
            personColors.set(f.properties.personKey, categories[c].color);
            used++;
        });
    });
}
