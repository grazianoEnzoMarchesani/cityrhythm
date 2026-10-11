// Folla attesa intorno a ogni cella LCZ dei quartieri, ora per ora: le regole dei puntini della mappa
// (updateAllPresencePoints in src/map/map-layers.js) senza arrotondamenti né identità.
//   3/4 dei puntini di un quartiere ai luoghi che in quell'ora attirano gente, in proporzione all'affluenza (0–100,
//       src/data/luoghi-core.js); se nessun luogo del quartiere attira gente (notti dei feriali), la divisione
//       dell'ultima ora che ne aveva [S], come nella mappa;
//   1/4 "in giro" uniformemente sulle celle costruite o pavimentate del quartiere;
//   chi è a casa (src/map/home-share.js con la curva ISTAT) non conta: sta dentro e non si sente.
// Lo usano taratura_energia.mjs (scala dell'energia) e confronto_bussola.mjs (stati della settimana tipo).
import fs from 'fs';
import Papa from 'papaparse';
import * as turf from '@turf/turf';
import { createServer } from 'vite';

const read = p => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
export const CFG_PATH = new URL('../public/data/bussola.json', import.meta.url);
const STREET = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'E']);
const LAT0 = 42.85, MX = 111320 * Math.cos(LAT0 * Math.PI / 180), MY = 110570;

/** Moduli del sito (puri) caricati con Vite, come fa il browser. */
export async function moduliDelSito() {
    const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
    const core = await server.ssrLoadModule('/src/compass/compass-core.js');
    const casa = await server.ssrLoadModule('/src/map/home-share.js');
    const luoghi = await server.ssrLoadModule('/src/data/luoghi-core.js');
    await server.close();
    return { core, casa, luoghi };
}

/**
 * Attrattori: i luoghi OSM del sito, oppure (per i confronti) un file JSON { punti: [{ lon, lat, affluenza: [168] }] }.
 * @returns {Array<{lon: number, lat: number, affluenza: ArrayLike<number>}>}
 */
export function caricaAttrattori(moduli, file = null) {
    if (file) return JSON.parse(fs.readFileSync(file, 'utf8')).punti;
    return moduli.luoghi.preparaLuoghi(JSON.parse(read('../public/data/luoghi_osm.geojson')),
        JSON.parse(read('../public/data/profili_luoghi.json')));
}

/** Quartieri, celle, residenti e forma della folla per ogni ora della settimana tipo (0 = lunedì 00:00). */
export function modello(moduli, cfg, attrattori) {
    const R = cfg.energia_cella?.raggio_m ?? 50;
    const homeCurve = JSON.parse(read('../public/data/quota_in_casa.json')).quota_in_casa;
    const poi = Papa.parse(read('../public/data/cityrhythm_blimp.csv'), { header: true, skipEmptyLines: true }).data;

    // Quartieri dal KML (un anello per Placemark, come in compass.py)
    const kml = read('../public/data/cityrhythm_blimp_areas.kml');
    const areas = [...kml.matchAll(/<Placemark[^>]*>([\s\S]*?)<\/Placemark>/g)].map(([, pm]) => {
        const name = pm.match(/<name>([\s\S]*?)<\/name>/)[1].trim();
        const ring = pm.match(/<coordinates>([\s\S]*?)<\/coordinates>/)[1].trim().split(/\s+/).map(c => c.split(',').slice(0, 2).map(Number));
        return { name, key: name.toLowerCase(), poly: turf.polygon([ring]) };
    }).filter(a => poi.some(r => r.poi_name.trim().toLowerCase() === a.key));
    // Residenti visti dai dati di notte, per quartiere (come getResidentsSeen in map-layers.js)
    const dayOf = r => new Date(r.date + 'T00:00:00Z').getUTCDay();
    const residents = areas.map(a => moduli.casa.residentsSeenAtNight(poi.filter(r => r.poi_name.trim().toLowerCase() === a.key), homeCurve, dayOf));

    // Celle LCZ: centro, dentro un quartiere?, strada?
    const cells = JSON.parse(read('../public/data/lcz_ascoli.geojson')).features.map(f => {
        const [w, s, e, n] = turf.bbox(f);
        return { c: [(w + e) / 2, (s + n) / 2], p: f.properties };
    });
    const near = (a, b) => ((a[0] - b[0]) * MX) ** 2 + ((a[1] - b[1]) * MY) ** 2 <= R * R;
    const inside = cells.map((cell, k) => k).filter(k => cells[k].p.quartiere_dist_m === 0);
    const pos = new Map(inside.map((k, i) => [k, i]));
    const around = pt => inside.filter(k => near(cells[k].c, pt)); // celle (fra quelle dei quartieri) entro R da un punto

    const areaStreets = areas.map(a => cells.filter(c => STREET.has(c.p.lcz_class) && turf.booleanPointInPolygon(c.c, a.poly)).map(c => c.c));
    const streetAround = areaStreets.map(list => list.map(around));
    const attrArea = attrattori.map(l => areas.findIndex(a => turf.booleanPointInPolygon([l.lon, l.lat], a.poly)));
    const attrAround = attrattori.map((l, i) => (attrArea[i] >= 0 ? around([l.lon, l.lat]) : []));
    const perArea = areas.map((a, q) => attrattori.map((_, i) => i).filter(i => attrArea[i] === q));

    // Ora (settimana tipo) da cui prendere la divisione fra i luoghi: la stessa se qualcuno attira gente,
    // altrimenti l'ultima ora precedente che ne aveva (giro della settimana)
    const oraAttiva = areas.map((a, q) => Array.from({ length: 168 }, (_, wh) => {
        for (let d = 0; d < 168; d++) {
            const h = (wh - d + 168) % 168;
            if (perArea[q].some(i => attrattori[i].affluenza[h] > 0)) return h;
        }
        return -1;
    }));

    // Forma della folla: per quartiere, persone entro R da ogni cella per 1 persona del quartiere
    const shape = Array.from({ length: 168 }, (_, wh) => areas.map((a, q) => {
        const sh = new Float32Array(inside.length);
        const h = oraAttiva[q][wh];
        if (h < 0) return sh; // nessun luogo in tutta la settimana: nessun puntino
        const mine = perArea[q].filter(i => attrattori[i].affluenza[h] > 0);
        const C = mine.reduce((s, i) => s + attrattori[i].affluenza[h], 0);
        mine.forEach(i => attrAround[i].forEach(k => { sh[pos.get(k)] += 0.75 * attrattori[i].affluenza[h] / C; }));
        const n = streetAround[q].length;
        streetAround[q].forEach(list => list.forEach(k => { sh[pos.get(k)] += 0.25 / n; }));
        return sh;
    }));
    const notti = areas.map((a, q) => oraAttiva[q].filter((h, wh) => h !== wh).length);

    // Presenze: per giorno vero e media per giorno della settimana su tutto il periodo (settimana tipo senza intervallo)
    const people = new Map(poi.map(r => [r.poi_name.trim().toLowerCase() + '|' + r.date, r]));
    const mediaTipo = areas.map(a => {
        const somma = Array.from({ length: 7 }, () => new Float64Array(24)), quanti = Array.from({ length: 7 }, () => new Float64Array(24));
        poi.filter(r => r.poi_name.trim().toLowerCase() === a.key).forEach(r => {
            const g = dayOf(r);
            for (let h = 0; h < 24; h++) {
                const v = parseFloat(r[`presenze_${h}`]);
                if (!isNaN(v)) { somma[g][h] += v; quanti[g][h]++; }
            }
        });
        return somma.map((s, g) => Array.from(s, (x, h) => (quanti[g][h] ? x / quanti[g][h] : 0)));
    });

    return { R, AREA_KM2: Math.PI * (R / 1000) ** 2, homeCurve, areas, residents, cells, inside, shape, notti, people, mediaTipo };
}

/** Persone fuori casa entro R da ogni cella dei quartieri, dato il numero di persone di ogni quartiere. */
export function densita(m, moduli, wh, jsDay, hour, presenze) {
    const dens = new Float32Array(m.inside.length);
    m.areas.forEach((a, q) => {
        const v = presenze[q];
        if (!(v > 0)) return;
        const audible = 1 - moduli.casa.homeShareFor(m.residents[q], m.homeCurve, jsDay, hour, v);
        const sh = m.shape[wh][q];
        for (let i = 0; i < sh.length; i++) dens[i] += v * sh[i] * audible;
    });
    return dens;
}
