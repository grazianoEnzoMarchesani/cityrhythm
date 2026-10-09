// Store centrale. Contratto degli store Svelte: subscribe(fn) chiama subito fn
// col valore attuale e restituisce la funzione per disiscriversi.
// React: useSyncExternalStore(store.subscribe, store.get).
export function writable(value) {
    const subs = new Set();
    const set = (v) => { value = v; subs.forEach(fn => fn(value)); };
    return {
        get: () => value,
        set,
        update: (fn) => set(fn(value)),
        subscribe(fn) { subs.add(fn); fn(value); return () => subs.delete(fn); }
    };
}

// Ora della timeline; date = data vera (intervallo < 7 giorni) o null (settimana tipo).
export const time = writable({ index: 0, date: null });
// Area inquadrata: bounds = [ovest, sud, est, nord].
export const viewport = writable(null);
export const audioEnabled = writable(false);
// Da dove viene la musica della mappa sonora: 'ia' (brani finetuning.ai), 'classica' (Musopen), 'metronomi', 'sottotraccia' (regole).
// La scrive solo il selettore in src/ui/ui-compass.js; la legge src/audio/audio-engine.js.
export const musicMode = writable('ia');
// Bussola emotiva della cella al centro della mappa (src/compass/compass.js):
// stato = confermato dopo l'isteresi (null fuori dalle celle), proposto = in attesa di conferma.
export const mood = writable(null);
// UTCI e stato della bussola di tutte le celle LCZ nell'ora della timeline (src/compass/cell-map.js),
// calcolati solo mentre una mappa li mostra: { ids, utci: Float32Array, stato: string[] } o null.
export const cellMap = writable(null);
// Persone dei puntini nell'ora della timeline (src/map/map-layers.js): solo chi è fuori casa,
// ognuno col peso di quante persone vere rappresenta. { index, lon, lat, w: Float64Array } o null.
export const presence = writable(null);

if (import.meta.env.DEV) {
    time.subscribe(t => console.log('[store] ora', t.index, t.date ? t.date.toISOString().slice(0, 16) : 'settimana tipo'));
    viewport.subscribe(v => v && console.log('[store] area', v.bounds.map(n => n.toFixed(4)).join(', '), 'zoom', v.zoom.toFixed(1)));
    audioEnabled.subscribe(on => console.log('[store] audio', on));
    let lastMood;
    mood.subscribe(m => { if (m && m.stato !== lastMood) { lastMood = m.stato; console.log('[store] bussola', m.stato, 'cella', m.cella); } });
}
