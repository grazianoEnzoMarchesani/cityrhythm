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
// Parte da 'sottotraccia': è la modalità con cui si avvia la musica. La scrive solo il selettore in src/ui/ui-compass.js; la legge src/audio/audio-engine.js.
export const musicMode = writable('sottotraccia');
// Volume della mappa sonora, da 0 a 1 (posizione dello slider; il motore lo porta al quadrato, più vicino all'orecchio).
// Parte da 1: il mix è calcolato a quel livello. Lo scrive solo src/ui/ui-compass.js; lo legge src/audio/audio-engine.js.
export const volume = writable(1);
// Fino a dove si ascolta la gente intorno al centro della mappa, in metri (parte da 100: su telefono 50 m è un cerchio troppo piccolo; 50 è il minimo e la taratura).
// Lo scrive solo src/ui/ui-compass.js; lo legge src/compass/compass.js. Non si salva nel browser.
export const raggioAscolto = writable(100);
// Punto d'ascolto [lon, lat]: dove sta il cerchio, indipendente dalla telecamera. Si sposta a mano trascinando il cerchio.
// null = audio spento (all'accensione parte dal centro della mappa). Lo scrive solo src/ui/ui-compass.js; lo legge src/compass/compass.js.
export const puntoAscolto = writable(null);
// Celle sotto il cerchio d'ascolto (insieme di id), per cui servono stato e colore anche a celle spente
// (src/map/map-layers.js, varco): src/compass/cell-map.js calcola solo queste invece di tutte. null = cerchio spento.
export const celleVarco = writable(null);
// Bussola emotiva della cella al centro della mappa (src/compass/compass.js):
// stato = confermato dopo l'isteresi (null fuori dalle celle), proposto = in attesa di conferma.
export const mood = writable(null);
// UTCI e stato della bussola di tutte le celle LCZ nell'ora della timeline (src/compass/cell-map.js),
// calcolati solo mentre una mappa li mostra: { ids, utci: Float32Array, stato: string[] } o null.
export const cellMap = writable(null);
// Persone dei puntini nell'ora della timeline (src/map/map-layers.js): solo chi è fuori casa,
// ognuno col peso di quante persone vere rappresenta. { index, lon, lat, w: Float64Array } o null.
export const presence = writable(null);
// Interruttore «Mostra le celle» (src/ui/ui-layer-controls.js): il tasto di ispezione compare solo quando è acceso.
export const celleAccese = writable(false);
// Ispezione delle celle (src/ui/ui-map-tools.js): acceso, un clic mostra la cella e le aree non si aprono
// (la legge src/map/map-interaction.js). Si spegne da solo quando le celle si spengono.
export const ispezioneCelle = writable(false);

if (import.meta.env.DEV) {
    time.subscribe(t => console.log('[store] ora', t.index, t.date ? t.date.toISOString().slice(0, 16) : 'settimana tipo'));
    viewport.subscribe(v => v && console.log('[store] area', v.bounds.map(n => n.toFixed(4)).join(', '), 'zoom', v.zoom.toFixed(1)));
    audioEnabled.subscribe(on => console.log('[store] audio', on));
    let lastMood;
    mood.subscribe(m => { if (m && m.stato !== lastMood) { lastMood = m.stato; console.log('[store] bussola', m.stato, 'cella', m.cella); } });
}
