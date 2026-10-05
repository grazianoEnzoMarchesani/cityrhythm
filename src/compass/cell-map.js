// UTCI e stato della bussola per tutte le celle LCZ nell'ora della timeline, per le mappe
// "UTCI" e "Sound map". Stesse funzioni della bussola (compass.js), senza isteresi: energia dalla
// gente entro `raggio_m`, meteo dell'ora vera o, in settimana tipo, del giorno al percentile
// `percentile_utci_settimana_tipo` per ogni cella. Legge `time` e `presence`, scrive solo `cellMap`.
import { time, presence, cellMap } from '../state/store.js';
import { compassReady } from './compass.js';
import { localEnergy, evaluate } from './compass-core.js';
import { peopleAround } from './crowd.js';

let ctx = null, active = false, unsubscribers = [], timer = null;
// Giorno scelto per ogni cella in un'ora (il calcolo lungo, in settimana tipo): chiave -> { choices, pick }
const climateCache = new Map();
const CACHE_MAX = 48;

/** Accende o spegne il calcolo (solo mentre una mappa UTCI/Sound map è visibile). */
export function setCellMapActive(on) {
    if (on === active) return;
    active = on;
    if (!on) {
        unsubscribers.forEach(u => u());
        unsubscribers = [];
        clearTimeout(timer);
        cellMap.set(null);
        return;
    }
    compassReady.then(c => {
        ctx = c;
        if (!active || unsubscribers.length) return;
        unsubscribers = [time.subscribe(schedule), presence.subscribe(schedule)];
        document.addEventListener('dateRangeChanged', onRangeChanged);
    });
}

function onRangeChanged() {
    climateCache.clear();
    if (active) schedule();
}

// Rinvio di un attimo: trascinando la timeline si calcola solo l'ultima ora.
function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => {
        if (!active) return;
        const result = computeCellMap(ctx, time.get());
        if (result) cellMap.set(result);
    }, 30);
}

function climateFor({ cells, climateChoices, pickDay }, t) {
    const range = window.selectedDateRange || {};
    const key = t.date ? t.date.toISOString().slice(0, 16)
        : `tipo ${t.index} ${range.min?.toISOString().slice(0, 10)} ${range.max?.toISOString().slice(0, 10)}`;
    if (climateCache.has(key)) return climateCache.get(key);
    const choices = climateChoices(t);
    const pick = cells.map(c => pickDay(c, choices));
    climateCache.set(key, pick);
    if (climateCache.size > CACHE_MAX) climateCache.delete(climateCache.keys().next().value);
    return pick;
}

/** UTCI e stato di ogni cella nell'ora `t`, o null se i puntini di quell'ora non sono ancora pronti. */
export function computeCellMap(context, t) {
    const { cfg, cells, crowdFor } = context;
    const index = crowdFor(t);
    if (!index) return null;
    const pick = climateFor(context, t);
    const n = cells.length;
    const utci = new Float32Array(n).fill(NaN), stato = new Array(n).fill(null), people = new Float32Array(n);
    cells.forEach((c, k) => {
        const day = pick[k];
        if (!day) return;
        people[k] = peopleAround(index, c.center);
        const r = evaluate({ X: localEnergy(people[k], cfg), sun: day.sun, weather: day.weather, traits: c.traits }, cfg);
        utci[k] = r.T ?? NaN;
        stato[k] = r.stato;
    });
    return { ids: cells.map(c => c.f.properties.id), utci, stato, people };
}
