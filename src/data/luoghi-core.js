// Affluenza dei luoghi OSM per ora della settimana tipo (0 = lunedì 00:00 … 167 = domenica 23:00).
// Branch dati-legali, in prova: sostituisce i vecchi spot e i loro profili di affollamento (dati commerciali).
// File puro (niente import.meta.env né DOM): lo usano il sito (data-loader.js) e sound-lab/taratura_energia.mjs.
//
// Per ogni luogo p di un tipo di luogo L (profilo dei diari, public/data/profili_luoghi.json):
//   gente(p, t) = q_L(t) × a_p(t) / Ā_L(t)
//   q_L(t)  quota di persone che a quell'ora sta in quel tipo di luogo (diari ISTAT 2008-09 via IPUMS MTUS) [F];
//           null (meno di 30 diari, valore non pubblicato) vale 0
//   a_p(t)  quota dell'ora in cui il luogo è aperto (orari OSM propri o tipici, public/data/luoghi_osm.geojson) [F];
//           senza orari vale 1
//   Ā_L(t)  apertura media dei luoghi del Comune con lo stesso profilo: la gente di quel tipo di luogo si divide
//           fra quelli aperti, così chi resta aperto quando gli altri chiudono ne riceve di più [S]
// Poi gente(p, ·) si riporta a 100 nell'ora più piena del luogo [S]: stessa scala dei dati di prima (100 = ora di
// punta del luogo), quindi un bar e una farmacia al loro massimo pesano uguale. La corrispondenza fra tipo OSM e
// profilo dei diari è un'ipotesi [H] (sound-lab/luoghi_osm.py).

/**
 * @param {object} luoghi - FeatureCollection di luoghi_osm.geojson (con `aperture` e `categorie`)
 * @param {object} profili - contenuto di profili_luoghi.json
 * @returns {Array<{id: string, nome: string|null, categoria: string, nomeCategoria: string, lon: number, lat: number, affluenza: Float32Array}>}
 *          luoghi con affluenza 0–100 per le 168 ore; esclusi quelli che non attirano nessuno in nessuna ora
 */
export function preparaLuoghi(luoghi, profili) {
    const tabella = luoghi.aperture || [];
    const apertura = f => (f.properties.aperture >= 0 ? tabella[f.properties.aperture] : null);
    // Apertura media per profilo e ora (Ā_L)
    const somma = new Map(), quanti = new Map();
    luoghi.features.forEach(f => {
        const L = f.properties.profilo;
        if (!somma.has(L)) { somma.set(L, new Float64Array(168)); quanti.set(L, 0); }
        const a = apertura(f), s = somma.get(L);
        for (let t = 0; t < 168; t++) s[t] += a ? a[t] / 100 : 1;
        quanti.set(L, quanti.get(L) + 1);
    });
    const risultato = [];
    luoghi.features.forEach(f => {
        const p = f.properties;
        const q = profili.profili?.[p.profilo]?.quota;
        if (!q) return;
        const a = apertura(f), s = somma.get(p.profilo), n = quanti.get(p.profilo);
        const v = new Float32Array(168);
        let massimo = 0;
        for (let t = 0; t < 168; t++) {
            const media = s[t] / n;
            const ap = a ? a[t] / 100 : 1;
            v[t] = media > 0 && q[t] != null ? q[t] * ap / media : 0;
            if (v[t] > massimo) massimo = v[t];
        }
        if (!(massimo > 0)) return;
        for (let t = 0; t < 168; t++) v[t] = v[t] / massimo * 100;
        const [lon, lat] = f.geometry.coordinates;
        risultato.push({
            id: p.id, nome: p.nome, categoria: p.categoria,
            nomeCategoria: luoghi.categorie?.[p.categoria] || p.categoria,
            lon, lat, affluenza: v
        });
    });
    return risultato;
}
