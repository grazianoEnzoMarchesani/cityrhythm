// Livello di Sottotraccia nell'app: guadagno (dB) interpolato dalla tabella misurata offline
// (src/audio/sottotraccia-livelli.json, scritta da sound-lab/sottotraccia/genera.py livelli).
// Serve perché l'app non normalizza i brani generati: senza questo, Calca suonerebbe più forte di Rifugio
// e il mix degli effetti (calcolato su -18 LUFS, audio.md) non tornerebbe più.
import tabella from './sottotraccia-livelli.json';

const { griglia, guadagno_dB: valori } = tabella;

/** Posizione di v su un asse: indice della cella e frazione dentro la cella. */
function posizione(asse, v) {
    const x = Math.min(asse[asse.length - 1], Math.max(asse[0], v));
    let i = 0;
    while (i < asse.length - 2 && x > asse[i + 1]) i++;
    return [i, (x - asse[i]) / (asse[i + 1] - asse[i])];
}

/** Guadagno in dB per gli ingressi (X, Y, H), interpolato in tre dimensioni. */
export function guadagnoDb(X, Y, H) {
    const [i, fx] = posizione(griglia.X, X);
    const [j, fy] = posizione(griglia.Y, Y);
    const [k, fh] = posizione(griglia.H, H);
    let somma = 0;
    for (let di = 0; di <= 1; di++) for (let dj = 0; dj <= 1; dj++) for (let dk = 0; dk <= 1; dk++) {
        const peso = (di ? fx : 1 - fx) * (dj ? fy : 1 - fy) * (dk ? fh : 1 - fh);
        somma += peso * valori[i + di][j + dj][k + dk];
    }
    return somma;
}
