// Sole e luna sul bordo del cerchio d'ascolto: dall'ora della timeline danno l'angolo sul quadrante a 24 ore
// (mezzogiorno a sud, mezzanotte a nord, 6 a est, 18 a ovest: come il sole vero) e dicono se è giorno o notte. Niente DOM né store.
// Alba e tramonto di Ascoli da SunCalc, in ore "da orologio" di Roma [F]. Con un giorno vero valgono quelli del giorno;
// con la settimana tipo (≥ 7 giorni) sono la media dei giorni del periodo scelto [S].
import { getTimes } from 'suncalc';

const LAT = 42.854, LON = 13.575; // come in compass-core.js
const ORE_ROMA = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const DEFAULT_MIN = '2024-06-01', DEFAULT_MAX = '2025-02-01'; // periodo del meteo
const oreRoma = (d) => { const [h, m] = ORE_ROMA.format(d).split(':').map(Number); return h + m / 60; };

const cacheGiorni = new Map();
function altaTramonto(giorno) { // 'AAAA-MM-GG' -> { alba, tramonto } in ore decimali
    let v = cacheGiorni.get(giorno);
    if (!v) {
        const t = getTimes(new Date(`${giorno}T12:00:00Z`), LAT, LON);
        v = { alba: oreRoma(t.sunrise), tramonto: oreRoma(t.sunset) };
        cacheGiorni.set(giorno, v);
    }
    return v;
}

const cachePeriodo = new Map();
function mediaPeriodo(min, max) { // un campione ogni 3 giorni basta: alba e tramonto cambiano piano
    const chiave = `${min}|${max}`;
    let v = cachePeriodo.get(chiave);
    if (!v) {
        let a = 0, t = 0, n = 0;
        for (let d = new Date(`${min}T12:00:00Z`); d <= new Date(`${max}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 3)) {
            const g = altaTramonto(d.toISOString().slice(0, 10));
            a += g.alba; t += g.tramonto; n++;
        }
        v = n ? { alba: a / n, tramonto: t / n } : altaTramonto(min);
        cachePeriodo.set(chiave, v);
    }
    return v;
}

/**
 * @param {number} ora ora del giorno (0-23)
 * @param {Date|null} data data vera (intervallo < 7 giorni) o null (settimana tipo)
 * @param {{min?: Date, max?: Date}} [periodo] periodo scelto, per la media nella settimana tipo
 * @returns {{giorno: boolean, angolo: number}} angolo in radianti dal nord in senso orario (mezzogiorno = π, cioè sud)
 */
export function soleLuna(ora, data, periodo = {}) {
    const { alba, tramonto } = data
        ? altaTramonto(data.toISOString().slice(0, 10))
        : mediaPeriodo(periodo.min?.toISOString().slice(0, 10) ?? DEFAULT_MIN, periodo.max?.toISOString().slice(0, 10) ?? DEFAULT_MAX);
    const h = ora + 0.5; // metà dell'ora: la timeline ha un passo di un'ora
    return { giorno: h >= alba && h < tramonto, angolo: Math.PI + (h - 12) / 24 * 2 * Math.PI };
}
