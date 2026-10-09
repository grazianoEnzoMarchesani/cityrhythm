// Calcolo della bussola emotiva, senza DOM né store (si prova anche con Node).
// Stessa formula di sound-lab/compass.py, che resta il riferimento; parametri in public/data/bussola.json.
import { getPosition } from 'suncalc';
import { UTCI_TERMS } from './utci-coeff.js';

const LAT = 42.854, LON = 13.575;

/** Data vera da un'ora "da orologio" di Roma scritta come 'AAAA-MM-GGTHH:MM'. */
export function romeTime(key) {
    const asUtc = new Date(key + ':00Z');
    for (const offsetH of [2, 1]) { // ora legale, poi solare
        const d = new Date(asUtc.getTime() - offsetH * 3600e3);
        const hour = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hourCycle: 'h23' }).format(d);
        if (Number(hour) === asUtc.getUTCHours()) return d;
    }
    return new Date(asUtc.getTime() - 3600e3);
}

/** Elevazione del sole in gradi su Ascoli. */
export function sunElevation(date) {
    return getPosition(date, LAT, LON).altitude; // SunCalc 2: gradi, con rifrazione
}

/** Energia del quartiere (-1 vuoto, +1 affollato) dalle persone nell'ora. */
export function areaEnergy(people, km2, cfg) {
    const { log_lo: lo, log_hi: hi } = cfg.energia;
    const x = 2 * (Math.log10(people / km2 + 1) - lo) / (hi - lo) - 1;
    return Math.max(-1, Math.min(1, x));
}

/**
 * Energia della cella (-1 vuoto, +1 affollato) dalle persone fuori casa entro `raggio_m`,
 * scala log tarata da sound-lab/taratura_energia.mjs (bussola.json → energia_cella).
 */
export function localEnergy(people, cfg) {
    const { log_lo: lo, log_hi: hi, raggio_m: r } = cfg.energia_cella;
    const perKm2 = people / (Math.PI * (r / 1000) ** 2);
    const x = 2 * (Math.log10(perKm2 + 1) - lo) / (hi - lo) - 1;
    return Math.max(-1, Math.min(1, x));
}

/** Energia della cella dal quartiere (riferimento Python): fuori dai quartieri sfuma verso -1 con la distanza. */
export function cellEnergy(areaX, distM, cfg) {
    const fade = Math.min(1, distM / cfg.parametri.energia_svanisce_m);
    return areaX - (areaX + 1) * fade;
}

const COSTRUITE = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);

/** Caratteristiche fisse della cella usate dalla piacevolezza. */
export function cellTraits(props, cfg) {
    return {
        svf: props.svf_mean > 0 ? props.svf_mean : cfg.parametri.svf_ripiego, // svf 0 = difetto del calcolo
        albedo: props.albedo,
        z0: props.z0_value,
        costruita: COSTRUITE.has(props.lcz_class),
        green: props.pervious_frac / 100
    };
}

/** Meteo dell'ora i-esima dal file Open-Meteo (colonne orarie). */
export function weatherAt(hourly, i) {
    return {
        ta: hourly.temperature_2m[i], rh: hourly.relative_humidity_2m[i], cloud: hourly.cloud_cover[i] / 100,
        windKmh: hourly.wind_speed_10m[i], dni: hourly.direct_normal_irradiance[i],
        dirH: hourly.direct_radiation[i], difH: hourly.diffuse_radiation[i], precipitation: hourly.precipitation[i]
    };
}

const SIGMA = 5.67e-8;
const vapourHpa = t => 6.112 * Math.exp(17.62 * t / (243.12 + t)); // Magnus
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/** Polinomio UTCI (Broede et al. 2012). pa in kPa, v a 10 m. */
// Coefficienti ed esponenti in array piatti e potenze precalcolate: stesso risultato, ~30 volte più veloce.
const UTCI_C = Float64Array.from(UTCI_TERMS, t => t[0]);
const UTCI_E = Uint8Array.from(UTCI_TERMS.flatMap(t => t.slice(1)));
const UTCI_MAXE = Math.max(...UTCI_E);
const POW = Array.from({ length: 4 }, () => new Float64Array(UTCI_MAXE + 1));
export function utciPoly(ta, v, dtr, pa) {
    const x = [ta, v, dtr, pa];
    for (let j = 0; j < 4; j++) {
        POW[j][0] = 1;
        for (let k = 1; k <= UTCI_MAXE; k++) POW[j][k] = POW[j][k - 1] * x[j];
    }
    const [p0, p1, p2, p3] = POW;
    let s = 0;
    for (let i = 0, e = 0; i < UTCI_C.length; i++, e += 4) {
        s += UTCI_C[i] * p0[UTCI_E[e]] * p1[UTCI_E[e + 1]] * p2[UTCI_E[e + 2]] * p3[UTCI_E[e + 3]];
    }
    return s;
}

/**
 * Stress termico della cella (UTCI), stessa catena di sound-lab/clima.py, dove sono spiegate le fonti:
 * aria + isola di calore notturna (Oke), temperatura media radiante (RayMan/VDI 3787),
 * vento riportato alla rugosità della cella (Wieringa, WMO), polinomio UTCI.
 */
export function cellClimate(w, sun, t, F) {
    const u10 = Math.max(w.windKmh / 3.6, 0.1);
    const e = vapourHpa(w.ta) * w.rh / 100;
    const clear = 1.24 * (e / (w.ta + 273.15)) ** (1 / 7);           // Brutsaert
    const epsSky = w.cloud + (1 - w.cloud) * clear;                   // Crawford & Duchon

    // 1. aria della cella: isola di calore notturna nelle sole celle costruite
    let dt = 0;
    if (sun < 0 && t.costruita) {
        const dtMax = Math.min(Math.max(15.27 - 13.88 * t.svf, 0), 2.01 * Math.log10(F.popolazione) - 4.06);
        const phiCloud = clamp((F.eps_superfici - epsSky) / (F.eps_superfici - clear), 0, 1);
        dt = dtMax * Math.min(1, u10 ** -0.5) * phiCloud;
    }
    const tCell = w.ta + dt;
    const rhCell = clamp(100 * e / vapourHpa(tCell), 0, 100);

    // 2. temperatura media radiante di una persona in piedi
    const beta = Math.max(sun, 0) * Math.PI / 180;
    const hw = Math.tan(Math.acos(clamp(t.svf, 0.01, 1))) / 2;
    const fSun = sun > 0 ? clamp(1 - (2 / Math.PI) * hw / Math.max(Math.tan(beta), 1e-3), 0, 1) : 0;
    const s = Math.max(sun, 0);
    const fp = 0.308 * Math.cos((s * (0.998 - s * s / 50000)) * Math.PI / 180);
    const lSky = epsSky * SIGMA * (w.ta + 273.15) ** 4;
    const lSurf = F.eps_superfici * SIGMA * (tCell + 273.15) ** 4;
    const lUp = t.svf * lSky + (1 - t.svf) * lSurf;
    const dUp = t.svf * w.difH;
    const dDown = t.albedo * (w.dirH * fSun + w.difH * t.svf);
    const k = F.ak / F.ep;
    const sumFi = 0.06 * (lUp + k * dUp) + 0.06 * (lSurf + k * dDown)
        + 0.88 * (0.5 * (lUp + lSurf) + k * 0.5 * (dUp + dDown));
    const tmrt = (sumFi / SIGMA + fp * F.ak * w.dni * fSun / (F.ep * SIGMA)) ** 0.25 - 273.15;

    // 3. vento a 10 m sulla rugosità della cella (altezza di miscelamento)
    const z0s = F.z0_stazione, zb = F.altezza_miscelamento_m;
    const v10 = u10 * Math.log(zb / z0s) / Math.log(10 / z0s) * Math.log(10 / t.z0) / Math.log(zb / t.z0);

    // 4. UTCI (ingressi riportati entro i limiti del polinomio)
    const tc = clamp(tCell, -50, 50);
    const utci = utciPoly(tc, clamp(v10, 0.5, 17), clamp(tmrt - tc, -30, 70), vapourHpa(tc) * rhCell / 1000);
    return { utci, tmrt, tAir: tCell };
}

/**
 * Calore con segno dall'UTCI: 0 senza stress, +1 dallo stress forte del caldo, -1 da quello del freddo.
 * Usa le stesse soglie di comfort(): vale C = 1 - 2|H|. Lo legge il suono (Sottotraccia), come il comfort lo legge Y.
 */
export function calore(utci, F) {
    const [c0, c1] = F.utci_nessuno_stress;
    const caldo = clamp((utci - c1) / (F.utci_stress_forte_caldo - c1), 0, 1);
    const freddo = clamp((c0 - utci) / (c0 - F.utci_stress_forte_freddo), 0, 1);
    return caldo - freddo;
}

/** +1 senza stress termico, -1 da stress forte (fasce ufficiali UTCI). */
export function comfort(utci, F) {
    const [c0, c1] = F.utci_nessuno_stress;
    const c = utci > c1 ? 1 - 2 * (utci - c1) / (F.utci_stress_forte_caldo - c1)
        : utci < c0 ? 1 - 2 * (c0 - utci) / (c0 - F.utci_stress_forte_freddo) : 1;
    return clamp(c, -1, 1);
}

/**
 * Stato della bussola per una cella in un'ora.
 * weather = weatherAt(...) oppure null (settimana tipo: piacevolezza fissa a Neutro).
 */
export function evaluate({ X, sun, weather, traits }, cfg) {
    const P = cfg.parametri;
    let Y = 0, T = null, C = null, H = null, tmrt = null;
    if (weather) {
        const c = cellClimate(weather, sun, traits, cfg.fisica);
        T = c.utci;
        tmrt = c.tmrt;
        C = comfort(T, cfg.fisica);
        H = calore(T, cfg.fisica);
        Y = P.w_comfort * C + P.w_green * (2 * traits.green - 1)
            - P.rain * (weather.precipitation > P.rain_mm ? 1 : 0);
        Y = clamp(Y, -1, 1);
    }
    const cut = P.cut;
    let stato;
    if (sun < P.night_sun_deg && X < -cut) {
        stato = 'notte';
    } else {
        const col = X < -cut ? 0 : X > cut ? 2 : 1;
        const row = Y < -cut ? 0 : Y > cut ? 2 : 1;
        stato = cfg.griglia[row][col];
    }
    return { X, Y, T, C, H, tmrt, stato };
}
