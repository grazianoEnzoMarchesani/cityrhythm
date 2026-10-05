// Quanta gente di un quartiere è in casa a una certa ora (regola "prudente").
// Chi i dati vedono di notte (ore 2-4) in un quartiere sono i suoi residenti; a ogni ora la curva ISTAT
// (public/data/quota_in_casa.json, diari Uso del tempo 2008-09 via IPUMS MTUS) dice quanti di loro sono
// in casa. Quei puntini restano a casa, gli altri sono in giro. Usata da map-layers.js e da
// sound-lab/taratura_energia.mjs: le due copie della regola non devono divergere.

export const NIGHT_HOURS = [2, 3, 4];

// Residenti "visti dai dati": media sui giorni di presenze notturne ÷ quota in casa a quell'ora.
// records: righe del CSV delle presenze di un quartiere; dayOf(r) = giorno della settimana (0 = domenica).
export function residentsSeenAtNight(records, curve, dayOf) {
    let sum = 0, n = 0;
    records.forEach(r => {
        const js = dayOf(r);
        if (!(js >= 0)) return;
        NIGHT_HOURS.forEach(h => {
            const v = parseFloat(r[`presenze_${h}`]);
            if (!isNaN(v) && curve[js][h] > 0) { sum += v / curve[js][h]; n++; }
        });
    });
    return n ? sum / n : 0;
}

// Quota dei presenti che sta in casa: mai più di tutti i presenti.
export function homeShareFor(residents, curve, jsDay, hour, presence) {
    if (!(presence > 0) || !curve?.[jsDay]) return 0;
    return Math.min(1, residents * curve[jsDay][hour] / presence);
}
