// Colore continuo della Sound map: stessa forma del suono (Sottotraccia e la bussola).
// Le nove caselle della bussola (SOUND_STATE_COLORS) diventano ancore agli angoli di un quadrato
// X, Y in -1..+1; fra un'ancora e l'altra i colori si mescolano in spazio Lab (come la scala UTCI).
// Così le micro-differenze di energia e piacevolezza si vedono sulla mappa, come si sentono.
// Notte resta un colore fisso: non è un punto del piano (bussola-clima.md).
import { interpolateLab } from 'd3';
import { SOUND_STATE_COLORS } from '../data/sound-colors.js';

// Posizione di ogni stato sul piano: X = energia (colonna), Y = piacevolezza (riga). Stessa griglia di bussola.json.
const POSIZIONE = {
    afa: [-1, -1], fatica: [0, -1], calca: [1, -1],
    attesa: [-1, 0], routine: [0, 0], corrente: [1, 0],
    rifugio: [-1, 1], passeggiata: [0, 1], festa: [1, 1],
};
const colorePunto = (X, Y) => {
    const stato = Object.keys(POSIZIONE).find(k => POSIZIONE[k][0] === X && POSIZIONE[k][1] === Y);
    return SOUND_STATE_COLORS[stato];
};
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/**
 * Colore della Sound map per il punto (X, Y), o null se la cella non ha un suono (fuori dalle celle).
 * Notte è un colore fisso. Gli ingressi fuori da -1..+1 si portano al bordo.
 */
export function coloreSuono(X, Y, stato) {
    if (stato == null) return null;
    if (stato === 'notte') return SOUND_STATE_COLORS.notte;
    if (!Number.isFinite(X) || !Number.isFinite(Y)) return null;
    const x = clamp(X, -1, 1), y = clamp(Y, -1, 1);
    // Il quadrato è diviso in quattro: un lato a -1..0 e uno a 0..+1 per ciascun asse
    const x0 = x < 0 ? -1 : 0, x1 = x0 + 1;
    const y0 = y < 0 ? -1 : 0, y1 = y0 + 1;
    const fx = x - x0, fy = y - y0;
    const bassoSinistra = colorePunto(x0, y0), bassoDestra = colorePunto(x1, y0);
    const altoSinistra = colorePunto(x0, y1), altoDestra = colorePunto(x1, y1);
    const basso = interpolateLab(bassoSinistra, bassoDestra)(fx);
    const alto = interpolateLab(altoSinistra, altoDestra)(fx);
    return interpolateLab(basso, alto)(fy);
}

/** Posizione (X, Y) di ogni stato, per la legenda. */
export const POSIZIONE_STATI = POSIZIONE;
