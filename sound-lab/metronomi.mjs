// Traccia dei metronomi, con lo stesso codice del sito (src/audio/metronomi.js):
//   node sound-lab/metronomi.mjs [cartella di uscita, default sound-lab/metronomi]
// Scrive cinque brani fissi (disagio 0, 0,25, 0,5, 0,75, 1; 30 s ciascuno) e una salita da 0 a 1 in 3 minuti,
// per ascoltarli senza la mappa. Gli MP3 si fanno con ffmpeg (serve installato).
import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { METRO, createMetronomi, nextBeat, beatGain, clickSamples, panGains } from '../src/audio/metronomi.js';

const SR = 44100;
const FADE_S = 1; // come PRESENCE_MOVE_MS nel sito: il disagio cambia piano, non a scatti
const RISCALDAMENTO = 120; // colpi silenziosi prima di registrare: così i brani partono dallo stato a regime, non dal sincronismo iniziale
const OUT = process.argv[2] ?? new URL('./metronomi', import.meta.url).pathname;

/** Disegna i colpi per `secondi` secondi; dAt(t) dà il disagio al tempo t (secondi). */
function render(secondi, dAt) {
    const n = Math.ceil((secondi + 1) * SR);
    const L = new Float32Array(n), R = new Float32Array(n);
    const click = clickSamples(SR);
    const m = createMetronomi();
    const pan = Array.from(m.pan, panGains);
    let dNow = dAt(0);
    for (let k = -RISCALDAMENTO; k * METRO.T0 < secondi; k++) {
        const t = k * METRO.T0;
        dNow += (dAt(Math.max(0, t)) - dNow) * (1 - Math.exp(-METRO.T0 / FADE_S)); // stessa rampa del motore audio
        const off = nextBeat(m, dNow);
        if (k < 0) continue; // il riscaldamento aggiorna i passi ma non suona
        const g = beatGain(off); // stesso livello per battito del sito
        for (let i = 0; i < off.length; i++) {
            const start = Math.round((t + off[i]) * SR);
            if (start < 0) continue;
            const gl = pan[i][0] * g, gr = pan[i][1] * g;
            for (let j = 0; j < click.length && start + j < n; j++) {
                L[start + j] += click[j] * gl;
                R[start + j] += click[j] * gr;
            }
        }
    }
    let picco = 0;
    for (let i = 0; i < n; i++) picco = Math.max(picco, Math.abs(L[i]), Math.abs(R[i]));
    return { L, R, picco };
}

/** WAV stereo a 16 bit. */
function wav({ L, R }) {
    const n = L.length, data = Buffer.alloc(n * 4);
    for (let i = 0; i < n; i++) {
        data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(L[i] * 32767))), i * 4);
        data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(R[i] * 32767))), i * 4 + 2);
    }
    const h = Buffer.alloc(44);
    h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
    h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
    h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34);
    h.write('data', 36); h.writeUInt32LE(data.length, 40);
    return Buffer.concat([h, data]);
}

mkdirSync(OUT, { recursive: true });
const brani = [
    ...[0, 0.25, 0.5, 0.75, 1].map(d => [`metronomi_disagio_${String(Math.round(d * 100)).padStart(3, '0')}`, 30, () => d]),
    ['metronomi_salita', 180, t => Math.min(1, t / 180)]
];
for (const [nome, secondi, dAt] of brani) {
    const { L, R, picco } = render(secondi, dAt);
    const wavFile = join(OUT, `${nome}.wav`), mp3File = join(OUT, `${nome}.mp3`);
    writeFileSync(wavFile, wav({ L, R }));
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wavFile, '-b:a', '192k', mp3File]);
    unlinkSync(wavFile); // i WAV intermedi non servono e sono grandi: restano solo gli MP3
    console.log(`${nome}: ${secondi} s, picco ${(20 * Math.log10(picco)).toFixed(1)} dBFS → ${mp3File}`);
}
