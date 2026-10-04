// Bussola emotiva collegata allo store: legge ora (time) e centro della mappa (viewport),
// trova la cella LCZ al centro e scrive lo stato in `mood`, con isteresi.
// Il futuro motore audio leggerà solo `mood`.
import * as turf from '@turf/turf';
import { time, viewport, mood } from '../state/store.js';
import { getLczVitalityData, getPoiData } from '../data/data-loader.js';
import { getDateTimeFromIndex } from '../utils/utils.js';
import { BUSSOLA_URL, METEO_URL } from '../data/config.js';
import { romeTime, sunElevation, areaEnergy, cellEnergy, cellTraits, weatherAt, evaluate } from './compass-core.js';

let cfg = null;
let met = null, metIndex = null;
let cells = [];
const poiByDay = new Map(); // 'nome quartiere|AAAA-MM-GG' -> riga del CSV presenze

let committed;             // stato confermato (undefined = ancora nessuno)
let pending = null, pendingTimer = null, last = null;

export async function startCompass() {
    const [c, m] = await Promise.all([fetch(BUSSOLA_URL), fetch(METEO_URL)].map(p => p.then(r => r.json())));
    cfg = c;
    met = m.hourly;
    metIndex = new Map(met.time.map((t, i) => [t, i]));
    cells = getLczVitalityData().map(f => ({ f, bbox: turf.bbox(f), traits: cellTraits(f.properties, cfg) }));
    for (const [name, records] of Object.entries(getPoiData() || {})) {
        records.forEach(r => r.parsedDate && poiByDay.set(name + '|' + r.parsedDate.toISOString().slice(0, 10), r));
    }
    time.subscribe(update);
    viewport.subscribe(update);
}

function findCell([lng, lat]) {
    const pt = turf.point([lng, lat]);
    return cells.find(({ f, bbox: [x0, y0, x1, y1] }) =>
        lng >= x0 && lng <= x1 && lat >= y0 && lat <= y1 && turf.booleanPointInPolygon(pt, f));
}

/** Media delle presenze del quartiere per giorno della settimana e ora, nell'intervallo scelto. */
function typicalPeople(area, jsDay, hour) {
    const { min, max } = window.selectedDateRange || {};
    let sum = 0, n = 0;
    for (const r of getPoiData()?.[area.toLowerCase()] || []) {
        const d = r.parsedDate;
        if (!d || d.getUTCDay() !== jsDay || (min && d < min) || (max && d > max)) continue;
        const v = parseFloat(r[`presenze_${hour}`]);
        if (!isNaN(v)) { sum += v; n++; }
    }
    return n ? sum / n : 0;
}

/** Ora 'AAAA-MM-GGTHH:MM' di un giorno tipo (a metà dell'intervallo scelto) per calcolare il sole. */
function typicalKey(jsDay, hour) {
    const { min, max } = window.selectedDateRange || {};
    const mid = min && max ? new Date((min.getTime() + max.getTime()) / 2) : new Date(Date.UTC(2024, 9, 1));
    const d = new Date(Date.UTC(mid.getUTCFullYear(), mid.getUTCMonth(), mid.getUTCDate() + (jsDay - mid.getUTCDay() + 7) % 7, hour));
    return d.toISOString().slice(0, 16);
}

function update() {
    const t = time.get(), v = viewport.get();
    if (!cfg || !v) return;
    const cell = findCell(v.center);
    if (!cell) return propose({ stato: null, fuori: true });

    const p = cell.f.properties;
    let key, people, weather = null;
    if (t.date) {
        key = t.date.toISOString().slice(0, 16); // ora "da orologio" di Roma
        const h = t.date.getUTCHours();
        people = parseFloat(poiByDay.get(p.quartiere.toLowerCase() + '|' + key.slice(0, 10))?.[`presenze_${h}`]);
        if (isNaN(people)) people = typicalPeople(p.quartiere, t.date.getUTCDay(), h); // l'unica ora mancante
        const i = metIndex.get(key);
        if (i !== undefined) weather = weatherAt(met, i);
    } else {
        const { jsDayOfWeek, hour } = getDateTimeFromIndex(t.index);
        key = typicalKey(jsDayOfWeek, hour);
        people = typicalPeople(p.quartiere, jsDayOfWeek, hour);
    }
    const sun = sunElevation(romeTime(key));
    const X = cellEnergy(areaEnergy(people, cfg.aree_km2[p.quartiere], cfg), p.quartiere_dist_m, cfg);
    const r = evaluate({ X, sun, weather, traits: cell.traits }, cfg);
    propose({
        ...r, sun, people, cella: p.id, lcz: p.lcz_class, quartiere: p.quartiere,
        distanzaQuartiere: p.quartiere_dist_m, settimanaTipo: !weather, geometry: cell.f.geometry
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
