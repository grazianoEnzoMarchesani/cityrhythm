// Stati della bussola e energia sulla settimana tipo, per ogni cella dei quartieri e ogni ora (0 = lunedì 00:00 … 167),
// come li calcola la mappa sonora senza isteresi (src/compass/cell-map.js): folla attesa dai puntini
// (sound-lab/folla_attesa.mjs), meteo e sole del giorno al percentile `percentile_utci_settimana_tipo` dell'UTCI
// della cella fra tutti i giorni del periodo con quel giorno della settimana, presenze medie di quel giorno.
// Serve a confrontare due fonti dei luoghi (es. prima e dopo il branch dati-legali).
// Uso, dalla radice del progetto:
//   node sound-lab/confronto_bussola.mjs                       luoghi OSM, energia_cella di bussola.json
//   node sound-lab/confronto_bussola.mjs --prima <file.json> <log_lo> <log_hi>
//        aggiunge lo scenario «prima»: attrattori { punti: [{ lon, lat, affluenza: [168] }] } e la sua taratura
//   --passo N   una cella su N (più veloce; predefinito 1, tutte)
import fs from 'fs';
import { CFG_PATH, moduliDelSito, caricaAttrattori, modello, densita } from './folla_attesa.mjs';

const args = process.argv.slice(2);
const arg = (k, n = 1) => (args.includes(k) ? args.slice(args.indexOf(k) + 1, args.indexOf(k) + 1 + n) : null);
const passo = Number(arg('--passo')?.[0] ?? 1);
const cfg = JSON.parse(fs.readFileSync(CFG_PATH, 'utf8'));
const moduli = await moduliDelSito();
const { sunElevation, romeTime, localEnergy, cellTraits, cellClimate, weatherAt, evaluate } = moduli.core;

const scenari = [];
const prima = arg('--prima', 3);
if (prima) scenari.push({ nome: 'prima', file: prima[0], energia: { ...cfg.energia_cella, log_lo: +prima[1], log_hi: +prima[2] } });
scenari.push({ nome: 'dopo', file: null, energia: cfg.energia_cella });
scenari.forEach(s => {
    s.attrattori = caricaAttrattori(moduli, s.file);
    s.m = modello(moduli, cfg, s.attrattori);
});
const m0 = scenari[0].m;
const celle = m0.inside.filter((k, i) => i % passo === 0);
const indice = celle.map(k => m0.inside.indexOf(k));

// Meteo: per ogni giorno della settimana e ora, le ore vere del periodo che ci cadono
const met = JSON.parse(fs.readFileSync(new URL('../public/data/meteo_ascoli.json', import.meta.url), 'utf8')).hourly;
const metIndex = new Map(met.time.map((t, i) => [t, i]));
const giorni = [...new Set(met.time.map(t => t.slice(0, 10)))];
const traits = celle.map(k => cellTraits(m0.cells[k].p, cfg));

const STATI = ['notte', ...cfg.griglia.flat()];
const conteggi = scenari.map(() => Object.fromEntries([...STATI, 'fuori'].map(s => [s, 0])));
const xs = scenari.map(() => []);
const xPerOra = scenari.map(() => Array.from({ length: 24 }, () => [0, 0]));
let uguali = 0, totale = 0;
const cut = cfg.parametri.cut;

for (let wh = 0; wh < 168; wh++) {
    const jsDay = (Math.floor(wh / 24) + 1) % 7, hour = wh % 24, hh = String(hour).padStart(2, '0');
    const scelte = giorni.filter(g => new Date(g + 'T00:00:00Z').getUTCDay() === jsDay).map(g => {
        const key = `${g}T${hh}:00`, i = metIndex.get(key);
        return { key, weather: i !== undefined ? weatherAt(met, i) : null, sun: sunElevation(romeTime(key)) };
    }).filter(c => c.weather);
    const dens = scenari.map(s => densita(s.m, moduli, wh, jsDay, hour, s.m.mediaTipo.map(t => t[jsDay][hour])));
    celle.forEach((k, j) => {
        // giorno al percentile dell'UTCI della cella (come pickDay in src/compass/compass.js)
        const giornate = scelte.map(c => ({ c, T: cellClimate(c.weather, c.sun, traits[j], cfg.fisica).utci })).sort((a, b) => a.T - b.T);
        const giorno = giornate.length ? giornate[Math.max(0, Math.ceil(cfg.parametri.percentile_utci_settimana_tipo * giornate.length) - 1)].c : null;
        const stati = scenari.map((s, n) => {
            if (!giorno) { conteggi[n].fuori++; return 'fuori'; }
            const X = localEnergy(dens[n][indice[j]], { energia_cella: s.energia });
            const r = evaluate({ X, sun: giorno.sun, weather: giorno.weather, traits: traits[j] }, cfg);
            conteggi[n][r.stato]++;
            xs[n].push(X);
            xPerOra[n][hour][0] += X; xPerOra[n][hour][1]++;
            return r.stato;
        });
        if (stati.length > 1) { totale++; if (stati[0] === stati[1]) uguali++; }
    });
}

const pc = (a, b) => (100 * a / b).toFixed(1).replace('.', ',') + '%';
const n = xs[0].length;
console.log(`celle nei quartieri: ${celle.length}${passo > 1 ? ` (una su ${passo})` : ''} × 168 ore = ${n.toLocaleString('it-IT')} casi`);
console.log('\nstato        ' + scenari.map(s => s.nome.padStart(9)).join(''));
[...STATI, 'fuori'].forEach(st => console.log(st.padEnd(13) + scenari.map((s, i) => pc(conteggi[i][st], n).padStart(9)).join('')));
console.log('\nenergia X    ' + scenari.map(s => s.nome.padStart(9)).join(''));
const quantile = (v, p) => v[Math.floor(p * (v.length - 1))];
xs.forEach(v => v.sort((a, b) => a - b));
console.log('media        ' + xs.map(v => (v.reduce((a, b) => a + b, 0) / v.length).toFixed(2).padStart(9)).join(''));
[0.1, 0.25, 0.5, 0.75, 0.9].forEach(p => console.log(`${p * 100}° perc.`.padEnd(13) + xs.map(v => quantile(v, p).toFixed(2).padStart(9)).join('')));
console.log('poca (<−1/3) ' + xs.map(v => pc(v.filter(x => x < -cut).length, v.length).padStart(9)).join(''));
console.log('media        ' + xs.map(v => pc(v.filter(x => x >= -cut && x <= cut).length, v.length).padStart(9)).join(''));
console.log('tanta (>1/3) ' + xs.map(v => pc(v.filter(x => x > cut).length, v.length).padStart(9)).join(''));
console.log('\nX medio per ora del giorno (media dei 7 giorni)');
console.log('ora  ' + scenari.map(s => s.nome.padStart(8)).join(''));
for (let h = 0; h < 24; h++) console.log(String(h).padStart(2, '0') + '   ' + xPerOra.map(o => (o[h][0] / o[h][1]).toFixed(2).padStart(8)).join(''));
if (totale) console.log(`\nstesso stato prima e dopo: ${pc(uguali, totale)} dei casi`);
