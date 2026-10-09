// Prova del modello dei metronomi (src/audio/metronomi.js): node sound-lab/verifica_metronomi.mjs
// 1) a regime, per ogni livello di disagio, la coerenza simulata contro la teoria (fasi uniformi in ±a);
// 2) a disagio zero, metronomi partiti sfasati tornano insieme;
// 3) nessun valore fuori dal giro (scostamenti sempre in [-T0/2, T0/2)).
import { METRO, createMetronomi, nextBeat, coherence, coherenceTheory, discomfort } from '../src/audio/metronomi.js';

// Con N metronomi a caso la coerenza non è zero ma circa √(π/4N): è il rumore del campione, non un errore.
const RUMORE = Math.sqrt(Math.PI / (4 * METRO.N));

let ok = true;
const check = (cond, msg) => { if (!cond) { ok = false; console.log('  ✗', msg); } };

console.log(`Coerenza a regime (1 = tutti insieme, 0 = a caso; rumore di ${METRO.N} valori a caso ≈ ${RUMORE.toFixed(2)})`);
console.log('  disagio   simulata   teoria   scostamento tipico');
for (const d of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
    const m = createMetronomi();
    for (let k = 0; k < 300; k++) nextBeat(m, d);        // arriva a regime (300 colpi: il richiamo è rapido)
    let sum = 0;
    for (let k = 0; k < 500; k++) { nextBeat(m, d); sum += coherence(m); }
    const sim = sum / 500, th = coherenceTheory(d);
    const ms = 1000 * METRO.KAPPA * d * d / (1 - d) * METRO.T0; // ampiezza dello scostamento a regime, in ms
    console.log(`  ${d.toFixed(2).padStart(4)}      ${sim.toFixed(2).padStart(5)}     ${th.toFixed(2).padStart(5)}      ${d < 1 && ms < 500 ? '±' + Math.round(ms) + ' ms' : 'caos (oltre ±500 ms)'}`);
    if (d < 1) check(Math.abs(sim - th) < 0.08 || (th < 0.15 && sim < RUMORE + 0.1), `d=${d}: simulata ${sim.toFixed(3)} lontana dalla teoria ${th.toFixed(3)}`);
    for (const f of m.phase) check(Number.isFinite(f) && f >= -METRO.T0 / 2 && f < METRO.T0 / 2, `scostamento fuori giro a d=${d}`);
}

// Tempo di risposta: quanti colpi (secondi) per passare da uno stato a regime all'altro.
// Il disagio cambia piano nel sito (rampa di 1 s), ma i metronomi devono reagire in pochi secondi, non minuti.
function colpiPer(m, dDa, dA, condizione) {
    for (let k = 0; k < 300; k++) nextBeat(m, dDa);
    for (let k = 1; k <= 300; k++) { nextBeat(m, dA); if (condizione(coherence(m))) return k; }
    return Infinity;
}
const tIns = colpiPer(createMetronomi(), 0.75, 0.1, c => c >= 0.9);   // da sparsi a insieme
const tSparsi = colpiPer(createMetronomi(), 0, 0.75, c => c <= 0.3);  // da insieme a sparsi
console.log(`\nTempo di risposta: da sparsi a insieme (0,75 → 0,1) ${tIns} colpi; da insieme a sparsi (0 → 0,75) ${tSparsi} colpi`);
check(tIns <= 30 && tSparsi <= 30, `risposta troppo lenta: ${tIns} e ${tSparsi} colpi (limite 30)`);

// Partono sfasati a caso: a disagio zero devono tornare insieme in poco tempo.
const m0 = createMetronomi();
for (let i = 0; i < m0.phase.length; i++) m0.phase[i] = (Math.random() - 0.5) * METRO.T0;
for (let k = 0; k < 300; k++) nextBeat(m0, 0);
const c0 = coherence(m0);
console.log(`Dopo 300 colpi a disagio 0, partendo sfasati: coerenza ${c0.toFixed(4)}`);
check(c0 > 0.999, 'a disagio zero non tornano insieme');

// Il disagio dalla bussola: energia e comfort, 50/50.
console.log('\nDisagio dalla bussola (X energia, C comfort):');
for (const [X, C] of [[-1, 1], [0, 0], [1, -1], [1, 1], [-1, -1], [0.5, null]]) {
    console.log(`  X=${String(X).padStart(4)}  C=${String(C).padStart(5)}  →  d=${discomfort({ X, C }).toFixed(3)}`);
}
check(discomfort({ X: -1, C: 1 }) === 0 && discomfort({ X: 1, C: -1 }) === 1, 'estremi del disagio');

console.log(ok ? '\nOK: modello dei metronomi coerente con la teoria.' : '\nERRORE: vedi sopra.');
process.exitCode = ok ? 0 : 1;
