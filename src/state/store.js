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

if (import.meta.env.DEV) {
    time.subscribe(t => console.log('[store] ora', t.index, t.date ? t.date.toISOString().slice(0, 16) : 'settimana tipo'));
    viewport.subscribe(v => v && console.log('[store] area', v.bounds.map(n => n.toFixed(4)).join(', '), 'zoom', v.zoom.toFixed(1)));
    audioEnabled.subscribe(on => console.log('[store] audio', on));
}
