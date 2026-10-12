// UTCI e stato della bussola per tutte le celle LCZ nell'ora della timeline, per le mappe
// "UTCI" e "Sound map". Stesse funzioni della bussola (compass.js), senza isteresi: energia dalla
// gente entro `raggio_m`, meteo dell'ora vera o, in settimana tipo, del giorno al percentile
// `percentile_utci_settimana_tipo` per ogni cella. Legge `time` e `presence`, scrive solo `cellMap`.
import { time, presence, cellMap, celleVarco } from '../state/store.js';
import { compassReady } from './compass.js';
import { localEnergy, evaluate, improntaTabella } from './compass-core.js';
import { peopleAround } from './crowd.js';
import { getDateTimeFromIndex } from '../utils/utils.js';
import { PICK_GIORNI_URL } from '../data/config.js';

let ctx = null, active = false, pieno = false, unsubscribers = [], timer = null;
// pieno = serve ogni cella (una mappa oraria visibile); altrimenti solo quelle del varco d'ascolto (celleVarco)
// Giorno scelto per ogni cella in un'ora (il calcolo lungo, in settimana tipo): chiave -> { choices, pick }
const climateCache = new Map();
const CACHE_MAX = 168; // una settimana intera: il Play ripassa sulle stesse ore

/** Accende o spegne il calcolo di tutte le celle (solo mentre una mappa UTCI/Sound map è visibile). */
export function setCellMapActive(on) {
    const eraPieno = pieno;
    pieno = on;
    aggiorna();
    if (active && on && !eraPieno) schedule(); // già acceso per il solo varco: ora servono tutte le celle
}
// Con una mappa oraria visibile (pieno) il cerchio non cambia i risultati: non si ricalcola nulla mentre lo si trascina
celleVarco.subscribe(() => { aggiorna(); if (active && !pieno) schedule(); });

function aggiorna() {
    const voglio = pieno || !!celleVarco.get();
    if (voglio === active) return;
    active = voglio;
    if (!active) {
        unsubscribers.forEach(u => u());
        unsubscribers = [];
        clearTimeout(timer);
        cellMap.set(null);
        return;
    }
    compassReady.then(c => {
        ctx = c;
        caricaTabella();
        if (!active || unsubscribers.length) return;
        unsubscribers = [time.subscribe(schedule), presence.subscribe(schedule)];
        document.addEventListener('dateRangeChanged', onRangeChanged);
    });
}

function onRangeChanged() {
    climateCache.clear();
    if (active) schedule();
}

// Rinvio di un attimo: trascinando la timeline si calcola solo l'ultima ora.
function schedule() {
    clearTimeout(timer);
    timer = setTimeout(calcola, 30);
}

// Tutte le celle si calcolano e si pubblicano insieme, come sempre: la mappa cambia in un colpo solo.
// Con la tabella dei giorni (pick_giorni.bin) un'ora costa ~100 ms invece di ~1 s.
let idIndice = null, idsTutte = null;
function calcola() {
    if (!active) return;
    const { cfg, cells, crowdFor } = ctx;
    const t = time.get();
    const index = crowdFor(t);
    if (!index) return; // i puntini di quest'ora non sono ancora pronti: si riparte quando arrivano
    const pickOf = climateFor(ctx, t);
    const solo = pieno ? null : celleVarco.get();
    if (!idIndice) idIndice = new Map(cells.map((c, k) => [c.f.properties.id, k]));
    const lista = solo ? [...solo].map(id => idIndice.get(id)).filter(k => k !== undefined) : cells.map((_, k) => k);
    const n = cells.length;
    const risultato = {
        ids: idsTutte ??= cells.map(c => c.f.properties.id),
        utci: new Float32Array(n).fill(NaN), stato: new Array(n).fill(null), people: new Float32Array(n),
        x: new Float32Array(n).fill(NaN), y: new Float32Array(n).fill(NaN), // energia e piacevolezza, per la Sound map continua
        lista, attive: lista
    };
    for (const k of lista) {
        const c = cells[k], day = pickOf(k);
        if (!day) continue;
        risultato.people[k] = peopleAround(index, c.center);
        const r = evaluate({ X: localEnergy(risultato.people[k], cfg), sun: day.sun, weather: day.weather, traits: c.traits }, cfg);
        risultato.utci[k] = r.T ?? NaN;
        risultato.stato[k] = r.stato;
        risultato.x[k] = r.X;
        risultato.y[k] = r.Y;
    }
    cellMap.set(risultato);
}

// Tabella dei giorni scelti (settimana tipo, periodo intero): si carica una volta, alla prima accensione
let tabella = null, tabellaRichiesta = false;
function caricaTabella() {
    if (tabellaRichiesta) return;
    tabellaRichiesta = true;
    fetch(PICK_GIORNI_URL).then(r => (r.ok ? r.arrayBuffer() : null)).then(buf => {
        if (!buf || buf.byteLength < 16) return;
        const [n, ore, giorni, impronta] = new Uint32Array(buf, 0, 4);
        // Non è più la tabella di questi dati (celle, ore di meteo, percentile o parametri fisici): si calcola dal vivo
        if (!ctx || n !== ctx.cells.length || ore !== ctx.oreMeteo || giorni !== 168 || impronta !== improntaTabella(ctx.cfg) || buf.byteLength !== 16 + 168 * n) return;
        tabella = new Uint8Array(buf, 16);
        if (active) schedule();
    }).catch(() => { /* senza tabella il calcolo si fa dal vivo, più lento */ });
}

// Il giorno scelto per ogni cella si calcola solo quando serve (con il varco sono poche centinaia di celle) e si ricorda per l'ora.
function climateFor({ cells, climateChoices, pickDay }, t) {
    const range = window.selectedDateRange || {};
    const key = t.date ? t.date.toISOString().slice(0, 16)
        : `tipo ${t.index} ${range.min?.toISOString().slice(0, 10)} ${range.max?.toISOString().slice(0, 10)}`;
    if (!climateCache.has(key)) {
        climateCache.set(key, { choices: climateChoices(t), pick: new Array(cells.length) });
        if (climateCache.size > CACHE_MAX) climateCache.delete(climateCache.keys().next().value);
    }
    const voce = climateCache.get(key);
    // Settimana tipo sul periodo intero: il giorno è già nella tabella
    if (tabella && !t.date && !range.min && !range.max) {
        const { jsDayOfWeek, hour } = getDateTimeFromIndex(t.index), base = (((jsDayOfWeek + 6) % 7) * 24 + hour) * cells.length;
        return (k) => { const n = tabella[base + k]; return n === 255 ? null : voce.choices[n]; };
    }
    return (k) => voce.pick[k] !== undefined ? voce.pick[k] : (voce.pick[k] = pickDay(cells[k], voce.choices));
}
