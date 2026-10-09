// Sottotraccia: pianificatore degli eventi. Dalle regole (sottotraccia-regole.js) produce la lista dei colpi
// e delle note, battito per battito. Nessun suono qui: solo tempi, tipi, altezze e livelli.
// È puro e deterministico (stesso seme, stessa sequenza): lo usano l'app (Web Audio, in tempo reale)
// e lo strumento di prova (sound-lab/sottotraccia/, che sintetizza gli stessi eventi in file).
//
// Evento: { t, tipo, g, ... }
//   tipo 'cassa':  { t, g }
//   tipo 'hihat':  { t, g, banda: [lo, hi] }
//   tipo 'nota':   { t, g, f, durata }    (durata = il tempo di un battito; il suono poi decade da solo)
import { SOTTOTRACCIA, regole } from './sottotraccia-regole.js';

/** Generatore pseudo-casuale a seme fisso (mulberry32): identico in browser e in Node. */
function generatore(seme) {
    let a = seme >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Ingressi interpolati linearmente da una lista di fotogrammi [{t, X, Y, H, I}].
 * Serve alle clip con rampe; nell'app gli ingressi vengono dalla mappa.
 */
export function ingressiAl(t, fotogrammi) {
    if (t <= fotogrammi[0].t) return { ...fotogrammi[0] };
    for (let i = 1; i < fotogrammi.length; i++) {
        const b = fotogrammi[i], a = fotogrammi[i - 1];
        if (t <= b.t) {
            const f = (t - a.t) / (b.t - a.t);
            const mix = k => a[k] + (b[k] - a[k]) * f;
            return { X: mix('X'), Y: mix('Y'), H: mix('H'), I: mix('I') };
        }
    }
    return { ...fotogrammi[fotogrammi.length - 1] };
}

export class Pianificatore {
    /**
     * seme: numero per il generatore casuale. ingressi: { X, Y, H, I } iniziali.
     * obiettivoA(t): facoltativa; dà gli ingressi desiderati al tempo t (secondi dal via).
     * Senza obiettivoA, gli ingressi restano quelli impostati con setObiettivo().
     */
    constructor({ seme = 2026, ingressi = { X: -1, Y: 1, H: 0, I: 0 }, obiettivoA = null } = {}) {
        this.casuale = generatore(seme);
        this.obiettivo = { ...ingressi };
        this.obiettivoA = obiettivoA;
        this.stato = { ...ingressi, I: ingressi.I ?? 0 };
        this.t = 0;          // inizio del prossimo battito (secondi dal via)
        this.k = 0;          // numero del battito
    }

    setObiettivo(q) {
        // Ingressi non finiti (per esempio fuori dalle celle) non si accettano: restano gli ultimi validi
        if (![q.X, q.Y, q.H ?? 0].every(Number.isFinite)) return;
        this.obiettivo = { X: q.X, Y: q.Y, H: q.H ?? 0, I: q.I ?? 0 };
    }

    /**
     * Pianifica tutti i battiti che iniziano prima di `fino` (secondi dal via).
     * Restituisce gli eventi in ordine di battito (i colpi di hi-hat possono avere tempi leggermente diversi).
     */
    avanza(fino) {
        const eventi = [];
        while (this.t < fino) {
            const obiettivo = this.obiettivoA ? this.obiettivoA(this.t) : this.obiettivo;
            // Gli ingressi scorrono verso l'obiettivo a ogni battito, con costante di tempo TAU_MOVIMENTO_S
            const T0 = 60 / regole(this.stato).bpm;
            const a = 1 - Math.exp(-T0 / SOTTOTRACCIA.TAU_MOVIMENTO_S);
            for (const k of ['X', 'Y', 'H', 'I']) this.stato[k] += (obiettivo[k] - this.stato[k]) * a;
            const r = regole(this.stato);
            const T = 60 / r.bpm;
            // Ogni evento porta gli ingressi del suo battito: il livello si calcola per evento, non sul bus
            this._battito(eventi, r, T, { X: this.stato.X, Y: this.stato.Y, H: this.stato.H });
            this.t += T;
            this.k++;
        }
        return eventi;
    }

    _battito(eventi, r, T, ingressi) {
        const t = this.t;
        if (r.g_cassa > 0) eventi.push({ t, tipo: 'cassa', g: 0.9 * r.g_cassa, ingressi });
        if (r.g_hihat > 0) {
            for (let j = 0; j < 4; j++) {          // sedicesimi: sempre sotto 12 Hz con bpm <= 180
                const scarto = (this.casuale() * 2 - 1) * r.scostamento_s;
                eventi.push({ t: t + j * T / 4 + scarto, tipo: 'hihat', g: r.g_hihat, banda: r.hihat_banda, ingressi });
            }
        }
        // Una nota a battito: il motivo gira sui gradi della scala
        const grado = SOTTOTRACCIA.MOTIVO[this.k % SOTTOTRACCIA.MOTIVO.length];
        const f0 = r.radice_Hz * 2 ** (SOTTOTRACCIA.SCALA[grado % SOTTOTRACCIA.SCALA.length] / 12);
        const pesi = [1, r.g_terza, r.g_quinta];
        SOTTOTRACCIA.ACCORDO.forEach((iv, i) => {
            if (pesi[i] > 0) eventi.push({ t, tipo: 'nota', g: 0.25 * pesi[i], f: f0 * 2 ** (iv / 12), durata: T, ingressi });
        });
        if (r.g_coppia > 0) {
            eventi.push({ t, tipo: 'nota', g: 0.25 * r.g_coppia, f: SOTTOTRACCIA.COPPIA_HZ, durata: T, ingressi });
            eventi.push({ t, tipo: 'nota', g: 0.25 * r.g_coppia, f: SOTTOTRACCIA.COPPIA_HZ + SOTTOTRACCIA.COPPIA_DISTANZA_HZ, durata: T, ingressi });
        }
    }
}
