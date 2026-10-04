// Motore audio della mappa sonora: legge solo lo store (audioEnabled, mood).
// Musica: un brano per stato, in loop, dissolvenza incrociata di 3 s verso lo stato nuovo.
// Suoni urbani: ogni gruppo alterna a caso le sue varianti (mix calcolato in public/audio/mix.json).
// Fuori dalle celle LCZ (stato null): silenzio.
import { audioEnabled, mood } from '../state/store.js';
import { AUDIO_BASE } from '../data/config.js';

const FADE_S = 3;
const MASTER_FADE_S = 1;
const STATES = ['routine', 'rifugio', 'passeggiata', 'festa', 'attesa', 'corrente', 'afa', 'fatica', 'calca', 'notte'];

let ctx = null, master = null, mix = null, sfxManifest = null;
const music = {};      // stato -> { gain, loading: Promise }
const sfx = {};        // gruppo -> { gain, buffers, last }
let current = null;    // stato che sta suonando

export function initAudioEngine() {
    audioEnabled.subscribe(on => (on ? start() : stop()));
    mood.subscribe(m => { if (mix && audioEnabled.get()) play(m?.stato ?? null); });
}

async function start() {
    if (!ctx) {
        ctx = new AudioContext(); // creato dopo il clic sull'interruttore (regola dei browser)
        master = ctx.createGain();
        master.gain.value = 0;
        master.connect(ctx.destination);
        [mix, sfxManifest] = await Promise.all(['mix.json', 'sfx/manifest.json'].map(f => fetch(AUDIO_BASE + f).then(r => r.json())));
        loadSfx();
    }
    await ctx.resume();
    ramp(master.gain, 1, MASTER_FADE_S);
    current = null;
    play(mood.get()?.stato ?? null);
    preloadAll();
}

function stop() {
    if (!ctx) return;
    ramp(master.gain, 0, MASTER_FADE_S);
    setTimeout(() => { if (!audioEnabled.get()) ctx.suspend(); }, MASTER_FADE_S * 1000 + 100);
}

function ramp(param, value, seconds) {
    const t = ctx.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.linearRampToValueAtTime(value, t + seconds);
}

async function decode(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return ctx.decodeAudioData(await res.arrayBuffer());
}

/** Carica (una volta) il brano di uno stato e lo fa partire in loop a volume zero. */
function loadMusic(state) {
    if (!music[state]) {
        const gain = ctx.createGain();
        gain.gain.value = 0;
        gain.connect(master);
        music[state] = {
            gain,
            loading: decode(`${AUDIO_BASE}loops/${state}.mp3`).then(buf => {
                const src = ctx.createBufferSource();
                src.buffer = buf;
                src.loop = true;
                src.connect(gain);
                src.start();
            })
        };
    }
    return music[state].loading;
}

// Dopo il primo brano, carica gli altri uno alla volta, così i cambi di stato sono immediati.
async function preloadAll() {
    for (const s of STATES) {
        try { await loadMusic(s); } catch (err) { console.error('Audio:', err); }
    }
}

async function play(state) {
    if (state === current) return;
    current = state;
    if (state) {
        try { await loadMusic(state); } catch (err) { console.error('Audio:', err); return; }
        if (current !== state) return; // nel frattempo lo stato è cambiato
    }
    for (const [s, v] of Object.entries(music)) ramp(v.gain.gain, s === state ? 1 : 0, FADE_S);
    applyScene(state);
}

// --- Suoni urbani ---

// Volume = musica (-18 LUFS) - sotto_musica_db + 20*log10(presenza); i file sono a -20 LUFS.
function sceneGain(group, presence) {
    if (!presence) return 0;
    const db = mix.music_lufs - mix.sotto_musica_db[group] + 20 * Math.log10(presence) - mix.sfx_file_lufs;
    return 10 ** (db / 20);
}

function applyScene(state) {
    const scene = (state && mix.scene[state]) || {};
    for (const [group, s] of Object.entries(sfx)) ramp(s.gain.gain, sceneGain(group, scene[group]), FADE_S);
}

async function loadSfx() {
    for (const [group, variants] of Object.entries(sfxManifest)) {
        try {
            const buffers = await Promise.all(variants.map(v => decode(`${AUDIO_BASE}sfx/${v.file}`)));
            const gain = ctx.createGain();
            gain.gain.value = 0;
            gain.connect(master);
            sfx[group] = { gain, buffers, last: -1 };
            playNext(group, ctx.currentTime + 0.1);
        } catch (err) { console.error('Audio:', err); }
    }
    applyScene(current);
}

// Mette in coda la clip successiva: variante diversa dalla precedente, velocità ±4%,
// dissolvenza incrociata equal-power fino a 1,2 s con quella in corso.
const N = 64;
const UP = Float32Array.from({ length: N }, (_, k) => Math.sin(k / (N - 1) * Math.PI / 2));
const DOWN = Float32Array.from({ length: N }, (_, k) => Math.cos(k / (N - 1) * Math.PI / 2));

function playNext(group, when) {
    if (ctx.state !== 'running') { // audio spento: niente clip in coda finché non si riaccende
        setTimeout(() => playNext(group, ctx.currentTime + 0.1), 500);
        return;
    }
    const s = sfx[group];
    let i = Math.floor(Math.random() * s.buffers.length);
    if (s.buffers.length > 1 && i === s.last) i = (i + 1) % s.buffers.length;
    s.last = i;
    const buf = s.buffers[i];
    const rate = 0.96 + Math.random() * 0.08;
    const dur = buf.duration / rate;
    const x = Math.min(1.2, dur * 0.3);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const env = ctx.createGain();
    env.gain.value = 0;
    env.gain.setValueCurveAtTime(UP, when, x);
    env.gain.setValueCurveAtTime(DOWN, when + dur - x, x);
    src.connect(env);
    env.connect(s.gain);
    src.start(when);
    src.stop(when + dur);
    const next = when + dur - x;
    setTimeout(() => playNext(group, next), Math.max(0, (next - ctx.currentTime - 2) * 1000));
}
