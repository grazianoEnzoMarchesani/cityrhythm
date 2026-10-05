// Taratura dell'energia per cella della bussola (persone entro `raggio_m` dalla cella).
// Ricostruisce la distribuzione dei puntini della mappa con le stesse regole di
// updateAllPresencePoints (src/map/map-layers.js), senza arrotondamenti né identità:
//   3/4 delle persone del quartiere agli Spot attivi, in proporzione al loro affollamento sintetico;
//   1/4 "in giro" uniformemente sulle celle costruite o pavimentate del quartiere;
//   chi è a casa (regola di src/map/home-share.js con la curva ISTAT) non conta: sta dentro e non si sente.
// Poi prende il 10° e il 90° percentile delle ore di luce (sole sopra night_sun_deg), sulle celle
// dentro i quartieri, e li scrive in bussola.json → energia_cella.
// Uso, dalla radice del progetto:  node sound-lab/taratura_energia.mjs
import fs from 'fs';
import Papa from 'papaparse';
import * as turf from '@turf/turf';
import { createServer } from 'vite';

const read = p => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const CFG_PATH = new URL('../public/data/bussola.json', import.meta.url);
const cfg = JSON.parse(fs.readFileSync(CFG_PATH, 'utf8'));
const R = cfg.energia_cella?.raggio_m ?? 50;

// map-layers.js si carica senza mappa né pagina: bastano finti window/document
const el = new Proxy(function () {}, { get: (t, p) => p === Symbol.toPrimitive ? () => '' : el, apply: () => el, construct: () => el });
globalThis.window = { selectedDateRange: { min: null, max: null }, addEventListener() {} };
globalThis.document = { addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => el };
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const { generateSyntheticCrowdedPointsGeoJson, getCrowdednessColumnName } = await server.ssrLoadModule('/src/map/map-layers.js');
const { sunElevation, romeTime } = await server.ssrLoadModule('/src/compass/compass-core.js');
const { residentsSeenAtNight, homeShareFor } = await server.ssrLoadModule('/src/map/home-share.js');
await server.close();
const homeCurve = JSON.parse(read('../public/data/quota_in_casa.json')).quota_in_casa;

const csv = (p, typing) => Papa.parse(read(p), { header: true, skipEmptyLines: true, dynamicTyping: typing }).data;
const spots = csv('../public/data/cityrhythm_spotMapper.csv', true).filter(r => typeof r.Latitudine === 'number' && typeof r.Longitudine === 'number');
const crowded = csv('../public/data/cityrhythm_crowded_data.csv', true).filter(r => typeof r.latitude === 'number' && typeof r.longitude === 'number');
const poi = csv('../public/data/cityrhythm_blimp.csv', false);

// Quartieri dal KML (un anello per Placemark, come in compass.py)
const kml = read('../public/data/cityrhythm_blimp_areas.kml');
const areas = [...kml.matchAll(/<Placemark[^>]*>([\s\S]*?)<\/Placemark>/g)].map(([, pm]) => {
    const name = pm.match(/<name>([\s\S]*?)<\/name>/)[1].trim();
    const ring = pm.match(/<coordinates>([\s\S]*?)<\/coordinates>/)[1].trim().split(/\s+/).map(c => c.split(',').slice(0, 2).map(Number));
    return { name, key: name.toLowerCase(), poly: turf.polygon([ring]) };
}).filter(a => poi.some(r => r.poi_name.trim().toLowerCase() === a.key));
// Residenti visti dai dati di notte, per quartiere (come getResidentsSeen in map-layers.js)
const dayOf = r => new Date(r.date + 'T00:00:00Z').getUTCDay();
const residents = areas.map(a => residentsSeenAtNight(poi.filter(r => r.poi_name.trim().toLowerCase() === a.key), homeCurve, dayOf));

// Celle LCZ: centro, dentro un quartiere?, strada?
const STREET = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'E']);
const cells = JSON.parse(read('../public/data/lcz_ascoli.geojson')).features.map(f => {
    const [w, s, e, n] = turf.bbox(f);
    return { c: [(w + e) / 2, (s + n) / 2], p: f.properties };
});
const LAT0 = 42.85, MX = 111320 * Math.cos(LAT0 * Math.PI / 180), MY = 110570;
const near = (a, b) => ((a[0] - b[0]) * MX) ** 2 + ((a[1] - b[1]) * MY) ** 2 <= R * R;
const inside = cells.map((cell, k) => k).filter(k => cells[k].p.quartiere_dist_m === 0);
// celle (fra quelle dentro i quartieri) entro R da un punto
const around = pt => inside.filter(k => near(cells[k].c, pt));

const areaStreets = areas.map(a => cells.filter(c => STREET.has(c.p.lcz_class) && turf.booleanPointInPolygon(c.c, a.poly)).map(c => c.c));
const streetAround = areaStreets.map(list => list.map(around));
const spotFeatures = generateSyntheticCrowdedPointsGeoJson(spots, crowded, getCrowdednessColumnName(0)).features;
const spotArea = spotFeatures.map(f => areas.findIndex(a => turf.booleanPointInPolygon(f.geometry.coordinates, a.poly)));
const spotAround = spotFeatures.map((f, i) => (spotArea[i] >= 0 ? around(f.geometry.coordinates) : []));

// Forma della folla per ora della settimana tipo: per quartiere, persone in ogni cella per 1 persona del quartiere
const AREA_KM2 = Math.PI * (R / 1000) ** 2;
const pos = new Map(inside.map((k, i) => [k, i]));
const shape = Array.from({ length: 168 }, (_, wh) => {
    const col = getCrowdednessColumnName(wh);
    const crowd = generateSyntheticCrowdedPointsGeoJson(spots, crowded, col).features.map(f => f.properties.synthetic_crowdedness || 0);
    return areas.map((a, q) => {
        const sh = new Float32Array(inside.length);
        const mine = spotFeatures.map((_, i) => i).filter(i => spotArea[i] === q && crowd[i] > 0);
        if (!mine.length) return sh; // come nella mappa: senza Spot attivi nessun puntino
        const C = mine.reduce((s, i) => s + crowd[i], 0);
        mine.forEach(i => spotAround[i].forEach(k => { sh[pos.get(k)] += 0.75 * crowd[i] / C; }));
        const n = streetAround[q].length;
        streetAround[q].forEach(list => list.forEach(k => { sh[pos.get(k)] += 0.25 / n; }));
        return sh;
    });
});

// Persone per km² entro R, per ogni cella e ogni ora vera con luce
const people = new Map(poi.map(r => [r.poi_name.trim().toLowerCase() + '|' + r.date, r]));
const met = JSON.parse(read('../public/data/meteo_ascoli.json')).hourly;
const logs = [];
const sample = [];
for (const key of met.time) {
    const d = new Date(key + ':00Z'), h = d.getUTCHours(), wh = ((d.getUTCDay() + 6) % 7) * 24 + h;
    if (sunElevation(romeTime(key)) <= cfg.parametri.night_sun_deg) continue;
    const dens = new Float32Array(inside.length);
    areas.forEach((a, q) => {
        const v = parseFloat(people.get(a.key + '|' + key.slice(0, 10))?.[`presenze_${h}`]);
        if (isNaN(v)) return;
        const audible = 1 - homeShareFor(residents[q], homeCurve, d.getUTCDay(), h, v);
        const sh = shape[wh][q];
        for (let i = 0; i < sh.length; i++) dens[i] += v * sh[i] * audible;
    });
    for (let i = 0; i < dens.length; i += 3) logs.push(Math.log10(dens[i] / AREA_KM2 + 1)); // una cella su 3
    if (key.endsWith('T13:00') && key.startsWith('2024-08-15')) sample.push(dens);
}
logs.sort((a, b) => a - b);
const pct = p => logs[Math.floor(p * (logs.length - 1))];
const lo = pct(0.1), hi = pct(0.9);
cfg.energia_cella = { raggio_m: R, log_lo: +lo.toFixed(5), log_hi: +hi.toFixed(5) };
fs.writeFileSync(CFG_PATH, JSON.stringify(cfg, null, 2) + '\n');

const fmt = l => Math.round(10 ** l - 1).toLocaleString('it-IT');
console.log(`${inside.length} celle nei quartieri, ${logs.length.toLocaleString('it-IT')} valori (ore di luce, una cella su 3)`);
console.log(`persone/km² entro ${R} m: 10° perc. ${fmt(lo)} (≈ ${((10 ** lo - 1) * AREA_KM2).toFixed(1)} persone), `
    + `90° perc. ${fmt(hi)} (≈ ${((10 ** hi - 1) * AREA_KM2).toFixed(1)} persone)`);
console.log('quote:', [0.25, 0.5, 0.75].map(p => `${p * 100}% ${fmt(pct(p))}`).join(' · '), '· zero:', (logs.filter(l => l === 0).length / logs.length * 100).toFixed(0) + '%');
console.log('scritto in bussola.json → energia_cella');
