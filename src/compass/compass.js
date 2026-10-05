// Bussola emotiva collegata allo store: legge ora (time), centro della mappa (viewport) e puntini
// delle persone (presence), trova la cella LCZ al centro e scrive lo stato in `mood`, con isteresi.
// Il motore audio legge solo `mood`.
import * as turf from '@turf/turf';
import { time, viewport, mood, presence } from '../state/store.js';
import { getLczVitalityData } from '../data/data-loader.js';
import { getDateTimeFromIndex } from '../utils/utils.js';
import { BUSSOLA_URL, METEO_URL } from '../data/config.js';
import { romeTime, sunElevation, localEnergy, cellTraits, cellClimate, weatherAt, evaluate } from './compass-core.js';
import { buildCrowdIndex, peopleAround } from './crowd.js';

let cfg = null;
let met = null, metIndex = null;
let cells = [];
let crowd = null; // indice dei puntini dell'ora corrente

let resolveReady;
/** Si risolve quando i dati della bussola sono caricati (usato da cell-map.js). */
export const compassReady = new Promise(r => { resolveReady = r; });

let committed;             // stato confermato (undefined = ancora nessuno)
let pending = null, pendingTimer = null, last = null;

export async function startCompass() {
    const [c, m] = await Promise.all([fetch(BUSSOLA_URL), fetch(METEO_URL)].map(p => p.then(r => r.json())));
    cfg = c;
    met = m.hourly;
    metIndex = new Map(met.time.map((t, i) => [t, i]));
    cells = getLczVitalityData().map(f => {
        const bbox = turf.bbox(f);
        return { f, bbox, center: [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2], traits: cellTraits(f.properties, cfg) };
    });
    resolveReady({ cfg, cells, climateChoices, pickDay, crowdFor });
    time.subscribe(update);
    viewport.subscribe(update);
    presence.subscribe(update);
    document.addEventListener('dateRangeChanged', update);
}

function findCell([lng, lat]) {
    const pt = turf.point([lng, lat]);
    return cells.find(({ f, bbox: [x0, y0, x1, y1] }) =>
        lng >= x0 && lng <= x1 && lat >= y0 && lat <= y1 && turf.booleanPointInPolygon(pt, f));
}

/** Indice dei puntini se corrispondono all'ora `t` della timeline, altrimenti null (in arrivo). */
function crowdFor(t) {
    const p = presence.get();
    if (!p || p.index !== t.index) return null;
    if (crowd?.p !== p) crowd = buildCrowdIndex(p, cfg.energia_cella.raggio_m);
    return crowd;
}

/** Giorni veri dell'intervallo scelto (tutto il periodo dei dati se non c'è) che cadono nel giorno della settimana. */
function matchingDays(jsDay) {
    let { min, max } = window.selectedDateRange || {};
    min = min || new Date(met.time[0].slice(0, 10));
    max = max || new Date(met.time[met.time.length - 1].slice(0, 10));
    const days = [];
    const d = new Date(Date.UTC(min.getUTCFullYear(), min.getUTCMonth(), min.getUTCDate()));
    d.setUTCDate(d.getUTCDate() + (jsDay - d.getUTCDay() + 7) % 7);
    for (; d <= max; d.setUTCDate(d.getUTCDate() + 7)) days.push(d.toISOString().slice(0, 10));
    return days;
}

/**
 * Ore vere da cui prendere meteo e sole: con una data vera solo quella; nella settimana tipo
 * tutti i giorni dell'intervallo che cadono in quel giorno della settimana (vedi pickDay).
 * @returns {Array<{key: string, weather: object|null, sun: number}>}
 */
function climateChoices(t) {
    const keys = t.date ? [t.date.toISOString().slice(0, 16)] : (() => { // ora "da orologio" di Roma
        const { jsDayOfWeek, hour } = getDateTimeFromIndex(t.index);
        const hh = String(hour).padStart(2, '0');
        return matchingDays(jsDayOfWeek).map(day => `${day}T${hh}:00`);
    })();
    return keys.map(key => {
        const i = metIndex.get(key);
        return { key, weather: i !== undefined ? weatherAt(met, i) : null, sun: sunElevation(romeTime(key)) };
    });
}

/**
 * Settimana tipo: fra i giorni veri si prende quello al percentile `percentile_utci_settimana_tipo`
 * dell'UTCI della cella (0,9 = una giornata calda, superata 1 volta su 10) e se ne usano meteo e sole.
 * Né media né maggioranza del meteo: i giorni miti, più numerosi, cancellavano il caldo.
 * Con una sola ora (data vera) restituisce quella.
 */
function pickDay(cell, choices) {
    if (choices.length === 1) return choices[0];
    const days = choices.filter(c => c.weather)
        .map(c => ({ c, T: cellClimate(c.weather, c.sun, cell.traits, cfg.fisica).utci }))
        .sort((a, b) => a.T - b.T);
    if (!days.length) return null;
    return days[Math.max(0, Math.ceil(cfg.parametri.percentile_utci_settimana_tipo * days.length) - 1)].c;
}

function update() {
    const t = time.get(), v = viewport.get();
    if (!cfg || !v) return;
    const index = crowdFor(t);
    if (!index) return; // i puntini di quest'ora non sono ancora pronti: si aggiorna quando arrivano
    const cell = findCell(v.center);
    if (!cell) return propose({ stato: null, fuori: true });

    const p = cell.f.properties;
    const choices = climateChoices(t);
    const day = pickDay(cell, choices);
    if (!day) return propose({ stato: null, fuori: true });
    const people = peopleAround(index, cell.center);
    const X = localEnergy(people, cfg);
    const r = evaluate({ X, sun: day.sun, weather: day.weather, traits: cell.traits }, cfg);
    propose({
        ...r, sun: day.sun, people, raggio: cfg.energia_cella.raggio_m,
        giorni: t.date ? null : { totale: choices.filter(c => c.weather).length, scelto: day.key.slice(0, 10) },
        cella: p.id, lcz: p.lcz_class, quartiere: p.quartiere,
        distanzaQuartiere: p.quartiere_dist_m, geometry: cell.f.geometry
    });
}

// Isteresi: un nuovo stato diventa effettivo solo se resta lo stesso per `tenuta_s` secondi.
function propose(live) {
    last = live;
    if (committed === undefined) committed = live.stato;
    if (live.stato === committed) {
        clearTimeout(pendingTimer);
        pending = null;
    } else if (live.stato !== pending) {
        clearTimeout(pendingTimer);
        pending = live.stato;
        pendingTimer = setTimeout(() => {
            committed = pending;
            pending = null;
            mood.set({ ...last, stato: committed, proposto: null });
        }, cfg.parametri.tenuta_s * 1000);
    }
    mood.set({ ...live, stato: committed, proposto: pending });
}
