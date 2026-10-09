// Modalità "Metronomi" della mappa sonora: cento metronomi a molla che battono da soli.
// Ispirato a James Pantaleone, "Synchronization of metronomes", Am. J. Phys. 70, 992–1000 (2002):
// lì i metronomi si accoppiano attraverso la base comune; qui, più semplicemente, ciascuno è tirato
// verso una griglia comune da una molla (il "tavolo") e il disagio ne allenta la presa e ne allarga il passo.
// Il disagio viene da energia (X) e comfort termico (C, dalla bussola): media dei due, 50/50.
// Parametri scelti da noi, da confermare con l'ascolto (non vengono da letteratura):
// T0, RICHIAMO, KAPPA (quanto si allargano i passi), i pesi 50/50 e il livello dei colpi.
// Niente DOM né store: si prova anche in Node (sound-lab/verifica_metronomi.mjs, sound-lab/metronomi.mjs).

export const METRO = {
    N: 100,         // metronomi, come nel video
    T0: 1,          // secondi fra due colpi di ciascun metronomo: 60 al minuto
    RICHIAMO: 1 / 12, // quanto la molla riporta il metronomo in fila a ogni colpo: ~12 colpi per tornare insieme
    KAPPA: 0.6,     // a regime lo scostamento è KAPPA·d²/(1−d) battiti: a d = 0,1 ≈ 7 ms (un colpo unico), a d = 0,5 ≈ 0,3 battiti
    SEED: 2025,
    CLICK: 0.10     // livello dei colpi: il tic unico arriva a circa −3 dBFS (vedi beatGain)
};
// Passo proprio di ciascun metronomo (±EPS di T0). Legato al richiamo così che lo scostamento a regime
// resti KAPPA·d²/(1−d) anche con un richiamo più rapido: cambiare la velocità non cambia l'ampiezza.
const EPS = METRO.KAPPA * METRO.RICHIAMO;
const LAMBDA = METRO.RICHIAMO;

/** Disagio 0..1 dalla bussola: energia (X, -1..+1) e comfort termico (C, +1 senza stress). */
export function discomfort(mood) {
    if (!mood || mood.X == null) return null;
    const energia = (mood.X + 1) / 2;
    if (mood.C == null) return energia; // senza meteo della cella: solo l'energia
    return (energia + (1 - mood.C) / 2) / 2;
}

function rng(seed) { // mulberry32: stesso seme, stessa sequenza, in browser e in Node
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Scostamento dalla griglia riportato in [-T0/2, T0/2): un metronomo è un'onda circolare.
const wrap = x => x - METRO.T0 * Math.round(x / METRO.T0);

/** Metronomi: passo proprio (eps), posizione nella stanza (pan), scostamento attuale (phase, s). */
export function createMetronomi(seed = METRO.SEED) {
    const r = rng(seed);
    const eps = new Float64Array(METRO.N), pan = new Float64Array(METRO.N);
    for (let i = 0; i < METRO.N; i++) {
        eps[i] = EPS * (2 * r() - 1);
        pan[i] = 2 * r() - 1;
    }
    return { eps, pan, phase: new Float64Array(METRO.N) };
}

/**
 * Un colpo di tutti i metronomi. Restituisce lo scostamento di ciascuno per questo colpo
 * e aggiorna lo stato per il successivo: la molla riporta verso la griglia con forza (1 - d),
 * il passo proprio allontana con forza d² (il disagio pesa poco finché è basso). Con d = 0 battono sempre insieme.
 * A regime, con un disagio costante, lo schema degli scostamenti si ripete a ogni colpo (è un ostinato).
 */
export function nextBeat(m, d) {
    const used = Float64Array.from(m.phase);
    const keep = 1 - LAMBDA * (1 - d);
    for (let i = 0; i < m.phase.length; i++) {
        m.phase[i] = wrap(m.phase[i] * keep + m.eps[i] * METRO.T0 * d * d);
    }
    return used;
}

/** Colpo di metronomo: un "tac" di legno, 30 ms, picco normalizzato a 1. */
export function clickSamples(sampleRate) {
    const n = Math.round(0.03 * sampleRate), out = new Float32Array(n), r = rng(7);
    let peak = 0;
    for (let i = 0; i < n; i++) {
        const t = i / sampleRate;
        const tone = 0.7 * Math.sin(2 * Math.PI * 1800 * t) + 0.3 * Math.sin(2 * Math.PI * 3600 * t);
        const noise = (2 * r() - 1) * Math.exp(-t / 0.0015);
        out[i] = (0.8 * tone + 0.4 * noise) * Math.exp(-t / 0.004);
        peak = Math.max(peak, Math.abs(out[i]));
    }
    for (let i = 0; i < n; i++) out[i] /= peak;
    return out;
}

/** Guadagni destro e sinistro (potenza costante) per un metronomo in posizione p (-1 sinistra, +1 destra). */
export function panGains(p) {
    const a = (p + 1) * Math.PI / 4;
    return [Math.cos(a), Math.sin(a)];
}

// Quanto due colpi si sovrappongono nel tempo: autocorrelazione del tac (1 a Δt = 0, zero dopo 30 ms).
const LAG_STEP = 0.0002, LAG_MAX = 0.03;
const OVERLAP = (() => {
    const c = clickSamples(44100), sr = 44100;
    let e0 = 0;
    for (const x of c) e0 += x * x;
    const tab = new Float64Array(Math.round(LAG_MAX / LAG_STEP) + 1);
    for (let k = 0; k < tab.length; k++) {
        const lag = Math.round(k * LAG_STEP * sr);
        let s = 0;
        for (let n = 0; n + lag < c.length; n++) s += c[n] * c[n + lag];
        tab[k] = s / e0;
    }
    return tab;
})();
const overlap = dt => { const k = Math.round(Math.abs(dt) / LAG_STEP); return k < OVERLAP.length ? OVERLAP[k] : 0; };

/**
 * Livello dei colpi di un battito. L'energia di N colpi è la somma delle sovrapposizioni fra tutte le coppie:
 * se battono insieme i colpi si sommano (il tic unico, più forte in ampiezza), se sono sparsi no.
 * Il livello di ogni colpo si regola perché l'energia del battito resta la stessa: il tic unico è più piano,
 * i colpi sparsi sono più forti. Così il volume complessivo non salta quando il disagio cambia.
 */
export function beatGain(offsets) {
    let S = 0;
    for (let i = 0; i < offsets.length; i++) {
        for (let j = 0; j < offsets.length; j++) S += overlap(offsets[i] - offsets[j]);
    }
    return METRO.CLICK * Math.sqrt(offsets.length / S);
}

/** Coerenza: quanto i colpi di un battito stanno insieme (1 = tutti insieme, 0 = a caso). */
export function coherence(m) {
    let re = 0, im = 0;
    for (const f of m.phase) {
        re += Math.cos(2 * Math.PI * f / METRO.T0);
        im += Math.sin(2 * Math.PI * f / METRO.T0);
    }
    return Math.hypot(re, im) / m.phase.length;
}

/** Coerenza attesa a regime (teoria): scostamenti uniformi in ±a, con a = KAPPA·d²/(1−d) in unità di T0. */
export function coherenceTheory(d) {
    if (d >= 1) return 0;
    const a = METRO.KAPPA * d * d / (1 - d);
    const x = 2 * Math.PI * a;
    return Math.abs(x === 0 ? 1 : Math.sin(x) / x);
}
