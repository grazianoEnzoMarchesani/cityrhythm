// Motore audio della mappa sonora: legge solo lo store (audioEnabled, mood, musicMode).
// Musica, tre sorgenti scelte dal selettore (musicMode):
//  - 'ia': un brano per stato, in loop (public/audio/loops/), come prima;
//  - 'classica': un brano per stato, da Musopen (public/audio/classica/), in loop;
//  - 'metronomi': cento metronomi generati qui in tempo reale (src/audio/metronomi.js), senza file;
//  - 'sottotraccia': musica a regole (src/audio/sottotraccia*.js), generata qui dagli ingressi X, Y e calore.
// Nei modi generati (metronomi, sottotraccia) i suoni urbani restano, come con i brani.
// Nei modi con brani: dissolvenza incrociata equal-power verso lo stato nuovo, lunga quanto le animazioni
// della mappa (PRESENCE_MOVE_MS, oggi 1 s). Fuori dalle celle LCZ (stato null): silenzio.
// Suoni urbani: ogni gruppo alterna a caso le sue varianti (mix calcolato in public/audio/mix.json).
import { audioEnabled, mood, musicMode } from '../state/store.js';
import { AUDIO_BASE, PRESENCE_MOVE_MS } from '../data/config.js';
import { METRO, createMetronomi, nextBeat, beatGain, clickSamples, discomfort } from './metronomi.js';
import { Sottotraccia } from './sottotraccia.js';

const FADE_S = PRESENCE_MOVE_MS / 1000;
const MASTER_FADE_S = 1;
const STATES = ['routine', 'rifugio', 'passeggiata', 'festa', 'attesa', 'corrente', 'afa', 'fatica', 'calca', 'notte'];
const DIR = { ia: 'loops/', classica: 'classica/' }; // cartelle dei brani per sorgente

// Metronomi: si programmano colpi in anticipo di LOOK_S, controllando ogni TICK_MS.
const LOOK_S = 1.5;
const TICK_MS = 200;

const N = 64; // punti delle curve di dissolvenza

let ctx = null, master = null, mix = null, sfxManifest = null;
let mode = 'ia';
const music = {};      // 'sorgente/stato' -> { gain, loading: Promise }
const sfx = {};        // gruppo -> { gain, buffers, last }
let current = null;    // 'sorgente/stato' che sta suonando (o 'sorgente/null')
let sceneState = null; // stato della mappa per i suoni urbani (null fuori dalle celle)
const metro = { gen: null, click: null, pans: null, scale: null, fade: null, beat: 0, dNow: 0, dTarget: 0, timer: null, on: false };
// Sottotraccia: un generatore con il suo bus di livello (guadagno da sottotraccia-livelli.js).
const sotto = { gen: null, bus: null, on: false };

export function initAudioEngine() {
    audioEnabled.subscribe(on => (on ? start() : stop()));
    mood.subscribe(m => {
        metro.dTarget = discomfort(m) ?? 0;
        if (mix && audioEnabled.get()) play(m?.stato ?? null);
        if (mode === 'sottotraccia' && sotto.on) sottotracciaIngressi(m);
    });
    musicMode.subscribe(m => {
        mode = m;
        if (mix && audioEnabled.get()) { current = null; play(mood.get()?.stato ?? null); preloadAll(); }
        liberaAltreSorgenti();
    });
}

// Ogni sorgente di brani pesa circa 300 MB decodificati: quando si cambia, si scaricano le altre dopo la dissolvenza.
function liberaAltreSorgenti() {
    setTimeout(() => {
        for (const [key, e] of Object.entries(music)) {
            if (key.startsWith(mode + '/')) continue;
            e.src?.stop();
            e.gain.disconnect();
            delete music[key];
        }
    }, MASTER_FADE_S * 1000 + 200);
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
    metronomiStop();
    sottotracciaStop();
    ramp(master.gain, 0, MASTER_FADE_S);
    setTimeout(() => { if (!audioEnabled.get()) ctx.suspend(); }, MASTER_FADE_S * 1000 + 100);
}

function ramp(param, value, seconds) {
    const t = ctx.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.linearRampToValueAtTime(value, t + seconds);
}

/**
 * Dissolvenza equal-power (seno/coseno) verso 0 o 1, ripresa dal volume attuale se un'altra è a metà:
 * la somma delle potenze dei due brani resta costante, senza il "buco" a metà di quella lineare.
 */
function powerRamp(param, value, seconds) {
    const t = ctx.currentTime;
    const g0 = Math.max(0, Math.min(1, param.value));
    const a0 = value ? Math.asin(g0) : Math.acos(g0); // punto di partenza sulla curva
    const len = (Math.PI / 2 - a0) / (Math.PI / 2) * seconds;
    const curve = Float32Array.from({ length: N }, (_, k) => {
        const a = a0 + (Math.PI / 2 - a0) * k / (N - 1);
        return value ? Math.sin(a) : Math.cos(a);
    });
    param.cancelScheduledValues(0);
    if (Math.abs(g0 - value) < 1e-3) return param.setValueAtTime(value, t); // già arrivato
    try {
        param.setValueCurveAtTime(curve, t, Math.max(len, 0.01));
    } catch {
        ramp(param, value, seconds);
    }
}

async function decode(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return ctx.decodeAudioData(await res.arrayBuffer());
}

/** Carica (una volta) il brano di uno stato di una sorgente e lo fa partire in loop a volume zero. */
function loadMusic(src, state) {
    const key = `${src}/${state}`;
    if (!music[key]) {
        const gain = ctx.createGain();
        gain.gain.value = 0;
        gain.connect(master);
        const e = { gain, src: null, loading: null };
        e.loading = decode(`${AUDIO_BASE}${DIR[src]}${state}.mp3`).then(buf => {
            if (music[key] !== e) return; // nel frattempo la sorgente è stata scartata
            e.src = ctx.createBufferSource();
            e.src.buffer = buf;
            e.src.loop = true;
            e.src.connect(gain);
            e.src.start();
        }).catch(err => {
            if (music[key] === e) { gain.disconnect(); delete music[key]; } // così al prossimo tentativo si riprova
            throw err;
        });
        music[key] = e;
    }
    return music[key].loading;
}

// Dopo il primo brano, carica gli altri uno alla volta, così i cambi di stato sono immediati.
async function preloadAll() {
    if (mode === 'metronomi' || mode === 'sottotraccia') return;
    for (const s of STATES) {
        try { await loadMusic(mode, s); } catch (err) { console.error('Audio:', err); }
    }
}

async function play(state) {
    const want = `${mode}/${state}`;
    if (want === current) return;
    current = want;
    const src = mode;
    const generata = src === 'metronomi' || src === 'sottotraccia'; // nessun file: il suono si genera qui
    const key = state && !generata ? `${src}/${state}` : null;
    if (key) {
        try { await loadMusic(src, state); }
        catch (err) { // brano mancante: niente musica, nessuna sorgente che resta accesa per errore
            console.error('Audio:', err);
            current = null;
            for (const v of Object.values(music)) powerRamp(v.gain.gain, 0, FADE_S);
            metronomiStop();
            sottotracciaStop();
            return;
        }
        if (current !== want) return; // nel frattempo lo stato o la sorgente sono cambiati
    }
    for (const [k, v] of Object.entries(music)) powerRamp(v.gain.gain, k === key ? 1 : 0, FADE_S);
    if (src === 'metronomi' && state) metronomiStart(); else metronomiStop();
    if (src === 'sottotraccia' && state) sottotracciaStart(); else sottotracciaStop();
    applyScene(state);
}

function applyScene(state) {
    sceneState = state;
    const scene = (state && mix.scene[state]) || {};
    // I metronomi suonano circa metronomi_db sotto i brani (misurato, sound-lab/metronomi.mjs):
    // i suoni urbani si abbassano della stessa differenza, così restano nello stesso rapporto.
    const trim = mode === 'metronomi' ? 10 ** ((mix.metronomi_db ?? 0) / 20) : 1;
    for (const [group, s] of Object.entries(sfx)) ramp(s.gain.gain, sceneGain(group, scene[group]) * trim, FADE_S);
}

// --- Metronomi (modello in src/audio/metronomi.js) ---

// Costruito una volta alla prima accensione: cento metronomi, ognuno con il suo panner, e il tac di legno.
function metronomiBuild() {
    metro.gen = createMetronomi();
    const samples = clickSamples(ctx.sampleRate);
    metro.click = ctx.createBuffer(1, samples.length, ctx.sampleRate);
    metro.click.getChannelData(0).set(samples);
    metro.scale = ctx.createGain();          // livello dei colpi, cambia a ogni battito (beatGain)
    metro.scale.gain.value = METRO.CLICK;
    metro.fade = ctx.createGain();           // dissolvenza di accensione/spegnimento
    metro.fade.gain.value = 0;
    metro.scale.connect(metro.fade);
    metro.fade.connect(master);
    metro.pans = Array.from(metro.gen.pan, p => {
        const panner = ctx.createStereoPanner();
        panner.pan.value = p;
        panner.connect(metro.scale);
        return panner;
    });
}

function metronomiStart() {
    if (!metro.gen) metronomiBuild();
    if (metro.on) return;
    metro.on = true;
    metro.beat = Math.max(metro.beat, Math.ceil((ctx.currentTime + 0.6) / METRO.T0)); // mai due volte lo stesso colpo
    ramp(metro.fade.gain, 1, FADE_S);
    metro.timer = setInterval(metronomiTick, TICK_MS);
    metronomiTick();
}

function metronomiStop() {
    if (!metro.on) return;
    metro.on = false;
    clearInterval(metro.timer);
    ramp(metro.fade.gain, 0, FADE_S);
}

// Programma i colpi fino a LOOK_S avanti. Ogni colpo: metronomo i batte alla griglia del colpo + il suo scostamento.
// Il livello dei colpi di un battito si imposta prima che il battito cominci (dopo il colpo precedente).
function metronomiTick() {
    const now = ctx.currentTime;
    if (metro.beat * METRO.T0 < now + 0.1) metro.beat = Math.ceil((now + 0.6) / METRO.T0); // colpi già passati: si saltano
    const horizon = now + LOOK_S;
    while (metro.beat * METRO.T0 < horizon) {
        metro.dNow += (metro.dTarget - metro.dNow) * (1 - Math.exp(-METRO.T0 / FADE_S)); // il disagio cambia piano
        const t = metro.beat * METRO.T0;
        const offsets = nextBeat(metro.gen, metro.dNow);
        metro.scale.gain.cancelScheduledValues(t - METRO.T0 / 2); // niente eventi accumulati da un'ora all'altra
        metro.scale.gain.setValueAtTime(beatGain(offsets), t - METRO.T0 / 2);
        for (let i = 0; i < offsets.length; i++) {
            const s = ctx.createBufferSource();
            s.buffer = metro.click;
            s.connect(metro.pans[i]);
            s.start(t + offsets[i]);
        }
        metro.beat++;
    }
}

// --- Sottotraccia (modello in src/audio/sottotraccia*.js) ---

// Costruito alla prima accensione del modo: il generatore e il suo bus di livello.
function sottotracciaBuild() {
    sotto.gen = new Sottotraccia(ctx, master); // il livello è per evento, dentro il generatore
}

// Ingressi dalla bussola: X = energia, Y = piacevolezza, H = calore con segno (dalla bussola, compass-core).
// Fuori dalle celle, o senza valori finiti, restano gli ultimi ingressi validi: lo spegnimento lo fa play().
function sottotracciaIngressi(m) {
    if (!m || m.fuori || m.stato == null) return;
    if (![m.X, m.Y].every(Number.isFinite)) return;
    sotto.gen.setIngressi({ X: m.X, Y: m.Y, H: Number.isFinite(m.H) ? m.H : 0, I: 0 });
}

function sottotracciaStart() {
    if (!sotto.gen) sottotracciaBuild();
    if (sotto.on) return;
    sotto.on = true;
    sottotracciaIngressi(mood.get());
    sotto.gen.start();
}

function sottotracciaStop() {
    if (!sotto.on) return;
    sotto.on = false;
    sotto.gen.stop(); // il generatore sfuma la sua uscita in circa un secondo
}

/** Diagnostica: gli ingressi lisciati di Sottotraccia in questo istante (null se non suona). */
export function statoSottotraccia() {
    return sotto.gen?.pianificatore?.stato ?? null;
}

// --- Suoni urbani ---

// Volume = musica (-18 LUFS) - sotto_musica_db + 20*log10(presenza); i file sono a -20 LUFS.
function sceneGain(group, presence) {
    if (!presence) return 0;
    const db = mix.music_lufs - mix.sotto_musica_db[group] + 20 * Math.log10(presence) - mix.sfx_file_lufs;
    return 10 ** (db / 20);
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
    applyScene(sceneState);
}

// Mette in coda la clip successiva: variante diversa dalla precedente, velocità ±4%,
// dissolvenza incrociata equal-power fino a 1,2 s con quella in corso.
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
