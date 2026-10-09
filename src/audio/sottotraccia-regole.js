// Sottotraccia: regole della musica a generazione (modo "Sottotraccia" della mappa sonora).
// Ingressi X (energia), Y (piacevolezza), H (calore, con segno), I (irregolarità).
//   X, Y, H in -1..+1 (H: -1 freddo, +1 caldo); I in 0..1.
// Ogni ingresso muove un solo gruppo di parametri, e ogni parametro cambia in modo continuo:
//   X -> volume di cassa e hi-hat, tempo, voci (terza e quinta)
//   Y -> coppia stonata (a 1 kHz), banda dell'hi-hat (da chiusa ad aperta), con compensazione del volume
//   H -> registro (più grave con il caldo)                              [ipotesi: nessun paper]
//   I -> scostamento degli hi-hat, separato da X e Y                    [scelta]
// Legenda: [F] fonte in paper/, [S] scelta nostra, [I] inferenza, [H] ipotesi.
// La sorgente unica delle regole è questo file: la lista degli eventi (sottotraccia-eventi.js) la usa,
// e la usano anche l'app e lo strumento di prova in sound-lab/sottotraccia/.

export const SOTTOTRACCIA = {
    SCALA: [0, 2, 3, 5, 7, 8, 10, 12],       // minore naturale, semitoni [S]: tonalità dei brani (audio.md)
    MOTIVO: [0, 2, 3, 2, 1, 2, 3, 4],        // gradi della scala: quattro note che tornano
    ACCORDO: [0, 3, 7],                      // radice, terza minore, quinta [S]
    CUT: 1 / 3,                              // soglia della salita di cassa, hi-hat e coppia: bussola.json "cut"
    SCOSTAMENTO_MAX_S: 0.020,                // ±20 ms sugli hi-hat, a I = 1 [S]
    COPPIA_HZ: 1000,                         // [F: Fastl, banda critica ~160 Hz a 1 kHz]
    COPPIA_DISTANZA_HZ: 40,                  // [F: Plomp & Levelt, 1/4 della banda critica]
    HIHAT_LO: [300, 7000],                   // banda chiusa / aperta, bassi [S]
    HIHAT_HI: [3000, 12000],                 // banda chiusa / aperta, acuti [S] (Fastl cap. 9)
    HIHAT_LARGHEZZA_RIF: 2700,               // larghezza della banda chiusa: il volume è compensato rispetto a questa
    MUSICA_LUFS: -18,                        // [S] stesso livello di IA e classica
    NOTA_DURATA_S: 1.5,                      // la nota suona fino a 1,5 s, poi si spegne (il decadimento è in TAU_NOTA_S)
    TAU_NOTA_S: 0.35,                        // decadimento della nota [S]
    TAU_MOVIMENTO_S: 1 / 3,                  // ogni ingresso scorre verso il suo valore in ~1 s, come FADE_S [S]
};

export const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));

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
    r.hihat_banda = [lo, hi];
    // Il rumore bianco guadagna volume con la larghezza della banda: si compensa, così Y non sposta il volume [I]
    const compensazione = Math.sqrt(SOTTOTRACCIA.HIHAT_LARGHEZZA_RIF / (hi - lo));
    r.g_hihat = pavimento(0.25 * salita * compensazione);
    // Coppia stonata: sale da 0 a Y = -CUT; poi -6 dB a Y = -1 (legge in dB: -12 - 6Y) [S]
    r.g_coppia = Y < 0 ? pavimento(clamp(-Y / SOTTOTRACCIA.CUT) * 10 ** ((-12 - 6 * Y) / 20)) : 0;
    // Voci: la radice sempre; la terza sale da X = -1 a X = 0; la quinta da X = 0 a X = 1 [S]
    r.g_terza = pavimento(clamp(X + 1));
    r.g_quinta = pavimento(clamp(X));
    // Registro: 440 Hz con H = 0; un'ottava sotto con H = +1 (caldo) [H]
    r.radice_Hz = 440 * 2 ** (-H);
    // Scostamento degli hi-hat: solo dall'irregolarità I, mai da X o Y [S]
    r.scostamento_s = SOTTOTRACCIA.SCOSTAMENTO_MAX_S * clamp(I);
    return r;
}
