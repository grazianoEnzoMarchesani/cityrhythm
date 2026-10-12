// Giorno scelto per ogni cella LCZ e ogni ora della settimana tipo (0 = lunedì 00:00 … 167), per il periodo intero dei dati.
// È lo stesso calcolo di pickDay() in src/compass/compass.js (il giorno al percentile `percentile_utci_settimana_tipo`
// dell'UTCI della cella fra i giorni con quel giorno della settimana), fatto una volta sola invece che a ogni ora nel browser:
// rifarlo per 12.500 celle × 35 giorni a ogni cambio d'ora bloccava la pagina per ~1 s.
// Uso, dalla radice del progetto:  node sound-lab/pick_giorni.mjs        (~2–4 minuti)
// Scrive public/data/pick_giorni.bin: intestazione di 4 Uint32 (celle, ore di meteo, 168, impronta di percentile e parametri fisici), poi 168 × celle byte:
// posizione del giorno fra quelli del periodo con quel giorno della settimana (255 = nessun giorno con meteo).
// Rilanciarlo se cambiano le celle (lcz_ascoli.geojson), il meteo, bussola.json o la formula del clima.
// Celle, meteo, percentile e parametri fisici li riconosce il sito dall'intestazione; un cambio della FORMULA in cellClimate no: va rilanciato a mano.
// Nel browser vale solo con «Periodo: tutto»; con un periodo scelto dall'utente il calcolo si rifà dal vivo.
import fs from 'fs';
import { moduliDelSito } from './folla_attesa.mjs';

const cfg = JSON.parse(fs.readFileSync(new URL('../public/data/bussola.json', import.meta.url), 'utf8'));
const met = JSON.parse(fs.readFileSync(new URL('../public/data/meteo_ascoli.json', import.meta.url), 'utf8')).hourly;
const celle = JSON.parse(fs.readFileSync(new URL('../public/data/lcz_ascoli.geojson', import.meta.url), 'utf8')).features;
const { core } = await moduliDelSito();
const { sunElevation, romeTime, cellTraits, cellClimate, weatherAt } = core;
const metIndex = new Map(met.time.map((t, i) => [t, i]));
const traits = celle.map(f => cellTraits(f.properties, cfg));
const N = celle.length, P = cfg.parametri.percentile_utci_settimana_tipo;

// Giorni del periodo intero che cadono nel giorno della settimana (come matchingDays in compass.js)
const min = new Date(met.time[0].slice(0, 10)), max = new Date(met.time[met.time.length - 1].slice(0, 10));
const giorniDel = (jsDay) => {
    const out = [], d = new Date(Date.UTC(min.getUTCFullYear(), min.getUTCMonth(), min.getUTCDate()));
    d.setUTCDate(d.getUTCDate() + (jsDay - d.getUTCDay() + 7) % 7);
    for (; d <= max; d.setUTCDate(d.getUTCDate() + 7)) out.push(d.toISOString().slice(0, 10));
    return out;
};

const out = new Uint8Array(16 + 168 * N);
new Uint32Array(out.buffer, 0, 4).set([N, met.time.length, 168, core.improntaTabella(cfg)]);
const t0 = Date.now();
for (let i = 0; i < 168; i++) {
    const jsDay = (Math.floor(i / 24) + 1) % 7, hh = String(i % 24).padStart(2, '0');
    const scelte = giorniDel(jsDay).map(g => {
        const key = `${g}T${hh}:00`, j = metIndex.get(key);
        return { weather: j !== undefined ? weatherAt(met, j) : null, sun: sunElevation(romeTime(key)) };
    });
    const conMeteo = scelte.map((s, n) => ({ s, n })).filter(({ s }) => s.weather);
    for (let k = 0; k < N; k++) {
        if (!conMeteo.length) { out[16 + i * N + k] = 255; continue; }
        const ord = conMeteo.map(({ s, n }) => ({ n, T: cellClimate(s.weather, s.sun, traits[k], cfg.fisica).utci })).sort((a, b) => a.T - b.T);
        out[16 + i * N + k] = ord[Math.max(0, Math.ceil(P * ord.length) - 1)].n;
    }
    if (i % 12 === 0) console.log(`ora ${i}/168, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
fs.writeFileSync(new URL('../public/data/pick_giorni.bin', import.meta.url), out);
console.log(`scritto public/data/pick_giorni.bin: ${(out.length / 1e6).toFixed(2)} MB`);
