// Persone intorno a un punto, dai puntini della mappa (store `presence`).
// Griglia di caselle grandi quanto il raggio: per ogni punto si guardano solo le 9 caselle vicine.
const LAT0 = 42.85;
const MX = 111320 * Math.cos(LAT0 * Math.PI / 180), MY = 110570; // metri per grado

/** Indice spaziale dei puntini per contare le persone entro `radiusM`. */
export function buildCrowdIndex(p, radiusM) {
    const buckets = new Map();
    const keyOf = (x, y) => Math.floor(x / radiusM) + ',' + Math.floor(y / radiusM);
    for (let i = 0; i < p.w.length; i++) {
        const k = keyOf(p.lon[i] * MX, p.lat[i] * MY);
        if (!buckets.has(k)) buckets.set(k, []);
        buckets.get(k).push(i);
    }
    return { p, buckets, r: radiusM };
}

/** Persone (somma dei pesi) entro il raggio dal punto [lon, lat]. */
export function peopleAround({ p, buckets, r }, [lon, lat]) {
    const x = lon * MX, y = lat * MY, bx = Math.floor(x / r), by = Math.floor(y / r);
    let sum = 0;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        for (const i of buckets.get((bx + dx) + ',' + (by + dy)) || []) {
            if ((p.lon[i] * MX - x) ** 2 + (p.lat[i] * MY - y) ** 2 <= r * r) sum += p.w[i];
        }
    }
    return sum;
}
