// Confronta la bussola JS (src/compass/compass-core.js) con i casi di prova di compass.py.
// Uso, dalla radice del progetto:  node sound-lab/verifica_bussola.mjs
import fs from 'fs';
import Papa from 'papaparse';
import { romeTime, sunElevation, areaEnergy, cellEnergy, cellTraits, weatherAt, evaluate } from '../src/compass/compass-core.js';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const cfg = JSON.parse(read('../public/data/bussola.json'));
const met = JSON.parse(read('../public/data/meteo_ascoli.json')).hourly;
const metIdx = new Map(met.time.map((t, i) => [t, i]));
const cells = new Map(JSON.parse(read('../public/data/lcz_ascoli.geojson')).features.map(f => [f.properties.id, f.properties]));
const poi = Papa.parse(read('../public/data/cityrhythm_blimp.csv'), { header: true, skipEmptyLines: true }).data;
const people = new Map(poi.map(r => [r.poi_name.trim() + '|' + r.date, r]));
const casi = JSON.parse(read('./data/bussola_campioni.json'));

let ok = 0, maxdX = 0, maxdY = 0, maxdT = 0, maxSun = 0;
const diversi = [];
for (const c of casi) {
    const [day, hm] = c.ora.split('T');
    const p = cells.get(c.cella);
    const areaX = areaEnergy(Number(people.get(p.quartiere + '|' + day)[`presenze_${Number(hm.slice(0, 2))}`]), cfg.aree_km2[p.quartiere], cfg);
    const i = metIdx.get(c.ora);
    const weather = weatherAt(met, i);
    const sun = sunElevation(romeTime(c.ora));
    const r = evaluate({ X: cellEnergy(areaX, p.quartiere_dist_m, cfg), sun, weather, traits: cellTraits(p, cfg) }, cfg);
    maxdX = Math.max(maxdX, Math.abs(r.X - c.X));
    maxdY = Math.max(maxdY, Math.abs(r.Y - c.Y));
    maxdT = Math.max(maxdT, Math.abs(r.T - c.T));
    maxSun = Math.max(maxSun, Math.abs(sun - c.sole));
    // la formula NOAA semplificata di compass.py e SunCalc differiscono fino a ~1 grado: a cavallo della soglia notte e' tollerato
    if (r.stato === c.stato || Math.abs(c.sole - cfg.parametri.night_sun_deg) < 1) ok++;
    if (r.stato !== c.stato) diversi.push(`${c.ora} cella ${c.cella}: py ${c.stato} (sole ${c.sole}) js ${r.stato} (sole ${sun.toFixed(2)})`);
}
console.log(`stato coerente ${ok}/${casi.length}; scarto max X ${maxdX.toExponential(1)}, Y ${maxdY.toExponential(1)}, UTCI ${maxdT.toFixed(2)} °C, sole ${maxSun.toFixed(2)} gradi`);
diversi.forEach(d => console.log('  ' + d));
process.exit(ok === casi.length ? 0 : 1);
