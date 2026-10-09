// Sottotraccia in tempo reale (Web Audio): suona gli eventi del pianificatore (sottotraccia-eventi.js).
// Il livello si calcola per evento, dagli ingressi che ogni evento porta con sé (tabella di sottotraccia-livelli.js):
// un evento già programmato non cambia volume quando cambia la bussola.
// Lookahead: 0,5 s con la scheda in vista, 1,5 s a scheda nascosta (i timer del browser rallentano).
// Niente DOM né store: il collegamento alla mappa sta in audio-engine.js.
import { Pianificatore } from './sottotraccia-eventi.js';
import { SOTTOTRACCIA } from './sottotraccia-regole.js';
import { guadagnoDb } from './sottotraccia-livelli.js';

const TICK_MS = 100;
const NOTA_DURATA_S = 1.5;      // la nota suona fino a 1,5 s, poi il suo decadimento è finito
const FADE_S = 1;               // accensione e spegnimento in 1 s, come la mappa sonora

const anticipo = () => (typeof document !== 'undefined' && document.hidden ? 1.5 : 0.5);

export class Sottotraccia {
    constructor(ctx, destinazione) {
        this.ctx = ctx;
        this.destinazione = destinazione;
        this.out = null;                // uscita del giro corrente: una nuova a ogni avvio
        this.rumore = this._rumoreBianco(1.0);
        this.pianificatore = null;
        this.ingressi = null;           // ultimi ingressi ricevuti, usati dal prossimo avvio
        this.t0 = 0;                    // istante audio corrispondente a t = 0 del pianificatore
        this.timer = null;
        this.attive = [];               // { nodo, fine }: sorgenti programmate, da fermare allo stop
    }

    /** Imposta gli ingressi (X, Y, H, I). Gli ingressi non finiti vengono ignorati. */
    setIngressi(q) {
        if (![q.X, q.Y, q.H ?? 0].every(Number.isFinite)) return;
        this.ingressi = { X: q.X, Y: q.Y, H: q.H ?? 0, I: q.I ?? 0 };
        if (this.pianificatore) this.pianificatore.setObiettivo(this.ingressi);
    }

    start() {
        if (this.timer) return;
        const ora = this.ctx.currentTime;
        // Un'uscita nuova a ogni avvio: le sorgenti rimaste dal giro precedente non si sommano a questa.
        this.out = this.ctx.createGain();
        this.out.gain.setValueAtTime(1, ora);
        this.out.connect(this.destinazione);
        this.t0 = ora + 0.05;
        this.pianificatore = new Pianificatore({
            seme: 2026,
            ingressi: this.ingressi ?? { X: -1, Y: 1, H: 0, I: 0 },
        });
        this.timer = setInterval(() => this._tick(), TICK_MS);
        this._tick();
    }

    stop() {
        if (!this.timer) return;
        clearInterval(this.timer);
        this.timer = null;
        const ora = this.ctx.currentTime;
        const uscita = this.out;
        // Sfumatura lineare a zero in FADE_S (setTarget non arriva mai a zero)
        uscita.gain.cancelScheduledValues(ora);
        uscita.gain.setValueAtTime(uscita.gain.value, ora);
        uscita.gain.linearRampToValueAtTime(0, ora + FADE_S);
        for (const a of this.attive) {
            try { a.nodo.stop(Math.min(a.fine, ora + FADE_S + 0.05)); } catch (_) { /* già fermo */ }
        }
        this.attive = [];
        this.pianificatore = null;
        setTimeout(() => { try { uscita.disconnect(); } catch (_) { /* già scollegata */ } }, (FADE_S + 0.2) * 1000);
        this.out = null;
    }

    _tick() {
        const ora = this.ctx.currentTime;
        const eventi = this.pianificatore.avanza(ora - this.t0 + anticipo());
        for (const e of eventi) {
            const quando = this.t0 + e.t;
            if (quando < ora) continue;  // già passato (la scheda era in pausa): si salta
            this._suona(e, quando);
        }
        this.attive = this.attive.filter(a => a.fine > ora);
    }

    _suona(e, t) {
        // Livello dell'evento: la tabella misurata, sugli ingressi con cui l'evento è stato pianificato
        const livello = 10 ** (guadagnoDb(e.ingressi.X, e.ingressi.Y, e.ingressi.H) / 20);
        if (e.tipo === 'cassa') this._cassa(t, e.g * livello);
        else if (e.tipo === 'hihat') this._hihat(t, e.g * livello, e.banda);
        else if (e.tipo === 'nota') this._nota(t, e.f, e.g * livello);
    }

    // Cassa: sinusoide con scivolamento da 120 a 45 Hz, decadimento con costante 0,08 s.
    _cassa(t, ampiezza) {
        const osc = this.ctx.createOscillator();
        const env = this.ctx.createGain();
        osc.frequency.setValueAtTime(120, t);
        osc.frequency.exponentialRampToValueAtTime(45, t + 0.09);
        env.gain.setValueAtTime(ampiezza, t);
        env.gain.setTargetAtTime(0.0001, t, 0.08);
        osc.connect(env).connect(this.out);
        osc.start(t); osc.stop(t + 0.3);
        this.attive.push({ nodo: osc, fine: t + 0.3 });
    }

    // Hi-hat: rumore filtrato con passa-banda, decadimento con costante 0,02 s.
    _hihat(t, ampiezza, [lo, hi]) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.rumore;
        const filtro = this.ctx.createBiquadFilter();
        filtro.type = 'bandpass';
        filtro.frequency.value = Math.sqrt(lo * hi);
        filtro.Q.value = Math.sqrt(lo * hi) / (hi - lo);
        const env = this.ctx.createGain();
        env.gain.setValueAtTime(ampiezza, t);
        env.gain.setTargetAtTime(0.0001, t, 0.02);
        src.connect(filtro).connect(env).connect(this.out);
        src.start(t, Math.random() * 0.5); src.stop(t + 0.1);
        this.attive.push({ nodo: src, fine: t + 0.1 });
    }

    // Nota: tre armoniche (1, 0,3, 0,1), attacco di 10 ms, decadimento con costante TAU_NOTA_S.
    _nota(t, f, ampiezza) {
        const env = this.ctx.createGain();
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(ampiezza, t + 0.01);
        env.gain.setTargetAtTime(0.0001, t + 0.01, SOTTOTRACCIA.TAU_NOTA_S);
        env.connect(this.out);
        [[1, 1.0], [2, 0.3], [3, 0.1]].forEach(([mult, peso]) => {
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.frequency.value = f * mult;
            g.gain.value = peso;
            osc.connect(g).connect(env);
            osc.start(t); osc.stop(t + NOTA_DURATA_S);
            this.attive.push({ nodo: osc, fine: t + NOTA_DURATA_S });
        });
    }

    // Rumore bianco a varianza unitaria (uniforme × √3): come il rumore gaussiano di genera.py, stesso livello.
    _rumoreBianco(secondi) {
        const buf = this.ctx.createBuffer(1, Math.round(this.ctx.sampleRate * secondi), this.ctx.sampleRate);
        const dati = buf.getChannelData(0);
        for (let i = 0; i < dati.length; i++) dati[i] = (Math.random() * 2 - 1) * Math.sqrt(3);
        return buf;
    }
}
