// Sottotraccia: regole della musica a generazione (modo "Sottotraccia" della mappa sonora).
// Ingressi X (energia), Y (piacevolezza), H (calore, con segno), I (irregolarità).
//   X, Y, H in -1..+1 (H: -1 freddo, +1 caldo); I in 0..1.
// Ogni ingresso muove un solo gruppo di parametri, e ogni parametro cambia in modo continuo:
//   X -> volume di cassa e hi-hat, tempo, voci (terza e quinta)
//   Y -> coppia stonata (a 1 kHz), banda dell'hi-hat (da chiusa ad aperta), con compensazione del volume;
//        e, sopra la soglia dei tre stati in alto, la MORBIDEZZA: scala senza bemolle, suono più tondo [S]
//   H -> registro (più grave con il caldo)                              [ipotesi: nessun paper]
//   I -> scostamento degli hi-hat, separato da X e Y                    [scelta]
// Legenda: [F] fonte (paper fuori dal progetto), [S] scelta nostra, [I] inferenza, [H] ipotesi.
// La sorgente unica delle regole è questo file: la lista degli eventi (sottotraccia-eventi.js) la usa,
// e la usano anche l'app e lo strumento di prova in sound-lab/sottotraccia/.

export const SOTTOTRACCIA = {
    // Scale sulla tonica Do (RADICE_HZ), dalla più cupa alla più chiara: a ogni passo si toglie un bemolle
    // (tasto nero del pianoforte). Eolio: Mi♭ La♭ Si♭ · dorico: Mi♭ Si♭ · misolidio: Si♭ · ionio e pentatonica: nessuno [S].
    // L'idea viene dal consiglio di una musicista (2026-10-12); nessun paper sulle scale tra quelli letti.
    SCALA_BASSA: [0, 2, 3, 5, 7, 8, 10],     // eolio (minore naturale): Y sotto la soglia dei tre stati in alto
    SCALE_MORBIDE: [
        [0, 2, 3, 5, 7, 9, 10],              // dorico
        [0, 2, 4, 5, 7, 9, 10],              // misolidio
        [0, 2, 4, 5, 7, 9, 11],              // ionio (maggiore)
        [0, 2, 4, 7, 9],                     // pentatonica maggiore: la più quieta
    ],
    RADICE_HZ: 440 * 2 ** (3 / 12),          // Do5 (523,25 Hz) con H = 0; un'ottava sotto con H = +1 [H]
    MOTIVO: [0, 2, 3, 2, 1, 2, 3, 4],        // gradi della scala: quattro note che tornano
    CUT: 1 / 3,                              // soglia della salita di cassa, hi-hat e coppia: bussola.json "cut"
    SCOSTAMENTO_MAX_S: 0.020,                // ±20 ms sugli hi-hat, a I = 1 [S]
    COPPIA_HZ: 1000,                         // [F: Fastl, banda critica ~160 Hz a 1 kHz]
    COPPIA_DISTANZA_HZ: 40,                  // [F: Plomp & Levelt, 1/4 della banda critica]
    HIHAT_LO: [300, 7000],                   // banda chiusa / aperta, bassi [S]
    HIHAT_HI: [3000, 12000],                 // banda chiusa / aperta, acuti [S] (Fastl cap. 9)
    HIHAT_LARGHEZZA_RIF: 2700,               // larghezza della banda chiusa: il volume è compensato rispetto a questa
    MUSICA_LUFS: -18,                        // [S] stesso livello di IA e classica
    TAU_NOTA_S: 0.35,                        // decadimento della nota [S]
    ATTACCO_NOTA_S: 0.010,                   // attacco della nota [S]
    ARMONICHE: [[1, 1.0], [2, 0.3], [3, 0.1]],   // [multiplo, peso]
    // Morbidezza m (0..1) = quanto Y supera la soglia CUT: attacco da 10 a 60 ms, decadimento da 0,35 a 0,6 s,
    // seconda e terza armonica quasi spente (suono più tondo, meno nitido: Fastl cap. 9) [S]
    MORBIDO_ATTACCO_S: 0.05, MORBIDO_TAU_S: 0.25, MORBIDO_ARM2: 0.7, MORBIDO_ARM3: 0.9,
    HIHAT_MORBIDO: [250, 1500],              // banda dell'hi-hat a m = 1: più scura e stretta [S]
    TAU_MOVIMENTO_S: 1 / 3,                  // ogni ingresso scorre verso il suo valore in ~1 s, come FADE_S [S]
};

export const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));

/** Morbidezza 0..1: 0 alla soglia dei tre stati in alto (Y = CUT), 1 con Y = 1. */
export const morbidezza = Y => clamp((Y - SOTTOTRACCIA.CUT) / (1 - SOTTOTRACCIA.CUT));

/** Scala (semitoni dalla tonica) per una morbidezza m: 4 passi uguali, uno in meno di bemolle a ogni passo. */
export function scalaPer(m, Y) {
    if (Y < SOTTOTRACCIA.CUT) return SOTTOTRACCIA.SCALA_BASSA;
    const n = SOTTOTRACCIA.SCALE_MORBIDE.length;
    return SOTTOTRACCIA.SCALE_MORBIDE[Math.min(n - 1, Math.floor(m * n))];
}

/** Forma della nota per una morbidezza m: attacco, decadimento, armoniche e durata dopo la quale si può spegnere. */
export function timbroNota(m = 0) {
    const S = SOTTOTRACCIA;
    const attacco = S.ATTACCO_NOTA_S + S.MORBIDO_ATTACCO_S * m;
    const tau = S.TAU_NOTA_S + S.MORBIDO_TAU_S * m;
    const pesi = [1, 1 - S.MORBIDO_ARM2 * m, 1 - S.MORBIDO_ARM3 * m];
    const armoniche = S.ARMONICHE.map(([mult, peso], i) => [mult, peso * pesi[i]]);
    return { attacco, tau, armoniche, durata: attacco + 4.3 * tau };
}

// Sotto -60 dB un guadagno è zero: la coda della smorzatura non arriva mai esattamente a 0, e senza
// questa soglia accenderebbe voci inudibili (e i loro oscillatori) per sempre.
const SILENZIO = 1e-3;
const pavimento = x => (x < SILENZIO ? 0 : x);

/** Parametri di un istante. q = { X, Y, H, I }. Tutto continuo: la densità è il tempo stesso. */
export function regole(q) {
    const { X, Y, H } = q;
    const I = q.I ?? 0;
    const r = {};
    // Tempo: 60 bpm con X = -1, 180 con X = +1 [S]. A 180 i sedicesimi stanno a 12 Hz, sotto la
    // soglia di ruvidezza (~15 Hz) [F: Fastl cap. 10-11].
    r.bpm = 120 + 60 * X;
    // Cassa e hi-hat: salgono in modo continuo da X = 0 a X = CUT [S]
    const salita = clamp(X / SOTTOTRACCIA.CUT);
    r.g_cassa = pavimento(salita);
    // Brillantezza dell'hi-hat: la banda si apre in modo continuo quando Y scende sotto 0 [S].
    // Interpolazione logaritmica tra la banda chiusa e quella aperta.
    const s = clamp(-Y);
    const lo = SOTTOTRACCIA.HIHAT_LO[0] * (SOTTOTRACCIA.HIHAT_LO[1] / SOTTOTRACCIA.HIHAT_LO[0]) ** s;
    const hi = SOTTOTRACCIA.HIHAT_HI[0] * (SOTTOTRACCIA.HIHAT_HI[1] / SOTTOTRACCIA.HIHAT_HI[0]) ** s;
    // Sopra la soglia dei tre stati in alto la banda si stringe e si scurisce, sempre in log [S]
    const m = morbidezza(Y);
    const [mlo, mhi] = SOTTOTRACCIA.HIHAT_MORBIDO;
    const lo2 = lo * (mlo / lo) ** m, hi2 = hi * (mhi / hi) ** m;
    r.hihat_banda = [lo2, hi2];
    r.morbidezza = m;
    r.scala = scalaPer(m, Y);
    // Il rumore bianco guadagna volume con la larghezza della banda: si compensa, così Y non sposta il volume [I]
    const compensazione = Math.sqrt(SOTTOTRACCIA.HIHAT_LARGHEZZA_RIF / (hi2 - lo2));
    r.g_hihat = pavimento(0.25 * salita * compensazione);
    // Coppia stonata: sale da 0 a Y = -CUT; poi -6 dB a Y = -1 (legge in dB: -12 - 6Y) [S]
    r.g_coppia = Y < 0 ? pavimento(clamp(-Y / SOTTOTRACCIA.CUT) * 10 ** ((-12 - 6 * Y) / 20)) : 0;
    // Voci: la radice sempre; la terza sale da X = -1 a X = 0; la quinta da X = 0 a X = 1 [S]
    r.g_terza = pavimento(clamp(X + 1));
    r.g_quinta = pavimento(clamp(X));
    // Registro: Do5 con H = 0; un'ottava sotto con H = +1 (caldo) [H]
    r.radice_Hz = SOTTOTRACCIA.RADICE_HZ * 2 ** (-H);
    // Scostamento degli hi-hat: solo dall'irregolarità I, mai da X o Y [S]
    r.scostamento_s = SOTTOTRACCIA.SCOSTAMENTO_MAX_S * clamp(I);
    return r;
}
