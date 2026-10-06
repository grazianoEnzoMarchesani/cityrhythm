import fs from 'node:fs';
// Esempio vero del video della piacevolezza: cella del Centro Storico piu' vicina al centro, tutte le ore 13 di luglio 2024.
// node presentazione/video/esempio.mjs dalla radice (~5 s).
const P = new URL('../../', import.meta.url).pathname;
const core = await import(P + 'src/compass/compass-core.js');
const cfg = JSON.parse(fs.readFileSync(P + 'public/data/bussola.json'));
const gj = JSON.parse(fs.readFileSync(P + 'public/data/lcz_ascoli.geojson'));
const met = JSON.parse(fs.readFileSync(P + 'public/data/meteo_ascoli.json'));
// cella del Centro Storico piu' vicina al centro usato dal codice (42.854, 13.575)
const c = (f) => { const r = f.geometry.coordinates[0]; let x = 0, y = 0; for (const p of r) { x += p[0]; y += p[1]; } return [x / r.length, y / r.length]; };
let best = null, bd = 1e9;
for (const f of gj.features) {
  if (!String(f.properties.quartiere || '').includes('Centro') || !(f.properties.svf_mean > 0)) continue;
  const [x, y] = c(f); const d = (x - 13.575) ** 2 + (y - 42.854) ** 2;
  if (d < bd) { bd = d; best = f; }
}
console.log('cella', JSON.stringify(best.properties));
const t = core.cellTraits(best.properties, cfg);
console.log('traits', t);
const H = met.hourly; const rows = [];
for (let i = 0; i < H.time.length; i++) {
  const key = H.time[i];
  if (!key.startsWith('2024-07') || !key.endsWith('T13:00')) continue;
  const w = core.weatherAt(H, i); const sun = core.sunElevation(core.romeTime(key));
  const cl = core.cellClimate(w, sun, t, cfg.fisica);
  const u10 = Math.max(w.windKmh / 3.6, 0.1), F = cfg.fisica;
  const v10 = u10 * Math.log(F.altezza_miscelamento_m / F.z0_stazione) / Math.log(10 / F.z0_stazione) * Math.log(10 / t.z0) / Math.log(F.altezza_miscelamento_m / t.z0);
  const comf = core.comfort(cl.utci, cfg.fisica);
  const r = core.evaluate({ X: 0, sun, weather: w, traits: t }, cfg);
  rows.push({ key, ta: w.ta, rh: w.rh, wind: w.windKmh, rain: w.precipitation, sun: +sun.toFixed(1), tmrt: +cl.tmrt.toFixed(1), v10: +v10.toFixed(2), utci: +cl.utci.toFixed(2), comf: +comf.toFixed(3), Y: +r.Y.toFixed(3) });
}
rows.sort((a, b) => a.utci - b.utci);
console.table(rows);
console.log('mediana', rows[Math.floor(rows.length / 2)]);
