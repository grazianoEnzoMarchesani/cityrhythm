// Taratura dell'energia per cella della bussola (persone entro `raggio_m` dalla cella).
// Ricostruisce la distribuzione dei puntini della mappa con le stesse regole di updateAllPresencePoints
// (src/map/map-layers.js), senza arrotondamenti né identità (sound-lab/folla_attesa.mjs):
//   3/4 delle persone del quartiere ai luoghi che attirano gente, in proporzione alla loro affluenza
//       (luoghi OpenStreetMap con l'affluenza di src/data/luoghi-core.js);
//   1/4 "in giro" uniformemente sulle celle costruite o pavimentate del quartiere;
//   chi è a casa (regola di src/map/home-share.js con la curva ISTAT) non conta: sta dentro e non si sente.
// Poi prende il 10° e il 90° percentile delle ore di luce (sole sopra night_sun_deg), sulle celle
// dentro i quartieri, e li scrive in bussola.json → energia_cella.
// Uso, dalla radice del progetto:  node sound-lab/taratura_energia.mjs
//   --prova                  stampa i valori senza scrivere bussola.json
//   --attrattori <file.json> usa altri attrattori ({ punti: [{ lon, lat, affluenza: [168] }] }), per i confronti
import fs from 'fs';
import { CFG_PATH, moduliDelSito, caricaAttrattori, modello, densita } from './folla_attesa.mjs';

const args = process.argv.slice(2);
const prova = args.includes('--prova');
const fileAttrattori = args.includes('--attrattori') ? args[args.indexOf('--attrattori') + 1] : null;

const cfg = JSON.parse(fs.readFileSync(CFG_PATH, 'utf8'));
const moduli = await moduliDelSito();
const { sunElevation, romeTime } = moduli.core;
const attrattori = caricaAttrattori(moduli, fileAttrattori);
const m = modello(moduli, cfg, attrattori);

// Persone per km² entro R, per ogni cella e ogni ora vera con luce
const met = JSON.parse(fs.readFileSync(new URL('../public/data/meteo_ascoli.json', import.meta.url), 'utf8')).hourly;
const logs = [];
for (const key of met.time) {
    const d = new Date(key + ':00Z'), h = d.getUTCHours(), wh = ((d.getUTCDay() + 6) % 7) * 24 + h;
    if (sunElevation(romeTime(key)) <= cfg.parametri.night_sun_deg) continue;
    const presenze = m.areas.map(a => parseFloat(m.people.get(a.key + '|' + key.slice(0, 10))?.[`presenze_${h}`]));
    const dens = densita(m, moduli, wh, d.getUTCDay(), h, presenze);
    for (let i = 0; i < dens.length; i += 3) logs.push(Math.log10(dens[i] / m.AREA_KM2 + 1)); // una cella su 3
}
logs.sort((a, b) => a - b);
const pct = p => logs[Math.floor(p * (logs.length - 1))];
const lo = pct(0.1), hi = pct(0.9);
const fmt = l => Math.round(10 ** l - 1).toLocaleString('it-IT');
console.log(`${attrattori.length} attrattori, ${m.inside.length} celle nei quartieri, ${logs.length.toLocaleString('it-IT')} valori (ore di luce, una cella su 3)`);
console.log(`persone/km² entro ${m.R} m: 10° perc. ${fmt(lo)} (≈ ${((10 ** lo - 1) * m.AREA_KM2).toFixed(1)} persone), `
    + `90° perc. ${fmt(hi)} (≈ ${((10 ** hi - 1) * m.AREA_KM2).toFixed(1)} persone)`);
console.log('quote:', [0.25, 0.5, 0.75].map(p => `${p * 100}% ${fmt(pct(p))}`).join(' · '), '· zero:', (logs.filter(l => l === 0).length / logs.length * 100).toFixed(0) + '%');
console.log('ore della settimana tipo senza luoghi attivi, per quartiere:', m.areas.map((a, q) => `${a.name.replace('Ascoli - ', '')} ${m.notti[q]}`).join(', '));
console.log(`log_lo ${lo.toFixed(5)}, log_hi ${hi.toFixed(5)}`);
if (!prova) {
    cfg.energia_cella = { raggio_m: m.R, log_lo: +lo.toFixed(5), log_hi: +hi.toFixed(5) };
    fs.writeFileSync(CFG_PATH, JSON.stringify(cfg, null, 2) + '\n');
    console.log('scritto in bussola.json → energia_cella');
}
