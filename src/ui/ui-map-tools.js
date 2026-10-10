// ui-map-tools.js
// Comandi della mappa in alto a destra: stile della mappa di base (popover) e vista 3D (un tasto).
// I tasti stanno in index.html (#map-tools); MapLibre li sposta nella sua colonna (map-setup.js).
import { getMapInstance, whenMapReady, setBaseStyle, getBaseStyle, MAP_STYLE_KEY } from '../map/map-setup.js';
import { applyBaseStyleToOverlays } from '../map/map-layers.js';

const STILI = [['toner', 'Toner'], ['nolli', 'Nolli']];

// Vista 3D [S]: inclinazione di 55° e rilievo con esagerazione 1,2 (come prima dei due tasti).
const INCLINAZIONE_3D = 55;
const RILIEVO_3D = { source: 'terrain-dem', exaggeration: 1.2 }; // sorgente definita in map-setup.js
// Il modo 3D si accende sopra i 30° e si spegne sotto i 5° [S]. Nel mezzo non cambia:
// un gesto incerto intorno a una sola soglia non farebbe accendere e spegnere i livelli in continuo.
const SOGLIA_ACCESA = 30;
const SOGLIA_SPENTA = 5;

export function setupMapTools() {
    setupStyle();
    setupMode3D();
}

// Stile di base: il tasto apre un popover a sinistra con Toner e Nolli
function setupStyle() {
    const bottone = document.getElementById('style-button');
    const pannello = document.getElementById('style-popover');
    const gruppo = document.getElementById('map-style');
    if (!bottone || !pannello || !gruppo) return;

    // Scrive la scelta sui pulsanti e sul tasto (senza salvarla: è solo lo stato di partenza)
    const mostra = (name) => {
        gruppo.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.style === name)));
        const nome = STILI.find(([n]) => n === name)?.[1] ?? name;
        bottone.dataset.label = `Stile della mappa: ${nome}`;
    };
    const scegli = (name) => {
        mostra(name);
        try { localStorage.setItem(MAP_STYLE_KEY, name); } catch (e) { /* archivio del browser non disponibile */ }
        whenMapReady(() => {
            setBaseStyle(name);
            applyBaseStyleToOverlays();
        });
    };
    STILI.forEach(([name, label]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.style = name;
        button.textContent = label;
        button.addEventListener('click', () => scegli(name));
        gruppo.appendChild(button);
    });
    // La mappa parte già con lo stile giusto (map-setup.js): qui si legge quello vero, senza salvarlo
    mostra(getBaseStyle());

    // Un solo pannello alla volta, come per Livelli, Periodo e Mappa sonora
    const apri = (aperto) => {
        pannello.hidden = !aperto;
        bottone.setAttribute('aria-expanded', String(aperto));
        if (aperto) document.dispatchEvent(new CustomEvent('pannello-aperto', { detail: 'stile' }));
    };
    bottone.addEventListener('click', () => apri(pannello.hidden));
    document.addEventListener('pannello-aperto', (e) => { if (e.detail !== 'stile') apri(false); });
    // Clic fuori chiude il popover; Esc lo chiude e riporta il fuoco sul tasto
    document.addEventListener('pointerdown', (e) => {
        if (pannello.hidden || pannello.contains(e.target) || bottone.contains(e.target)) return;
        apri(false);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !pannello.hidden) { apri(false); bottone.focus(); }
    });
}

// Vista 3D: un tasto. Acceso = la mappa si inclina e si vedono edifici e rilievo; spento = vista dall'alto.
// Lo stato segue l'inclinazione vera: se la mappa viene inclinata a mano (tasto destro, due dita),
// il tasto e i livelli 3D seguono, così il tasto non dice mai il contrario di quello che si vede.
function setupMode3D() {
    const bottone = document.getElementById('toggle-3d');
    if (!bottone) return;
    const movimentoRidotto = window.matchMedia('(prefers-reduced-motion: reduce)');
    let accesa = false;    // stato vero: il modo 3D è acceso nei livelli
    let obiettivo = null;  // dove sta andando l'ultimo clic; null quando la camera è ferma

    // Durante il movimento il tasto mostra dove si va; a camera ferma, lo stato vero
    const mostra = () => {
        const on = obiettivo ?? accesa;
        bottone.setAttribute('aria-pressed', String(on));
        bottone.dataset.label = `Vista 3D: ${on ? 'accesa' : 'spenta'}`;
    };
    // I livelli si toccano solo quando il modo cambia davvero
    const applica = (on) => {
        if (on === accesa) return;
        accesa = on;
        const map = getMapInstance();
        map.setTerrain(on ? RILIEVO_3D : null);
        map.setLayoutProperty('buildings-3d', 'visibility', on ? 'visible' : 'none');
        mostra();
    };
    mostra();

    // Il clic muove solo la camera. Due clici rapidi di fila vanno ciascuno nella direzione opposta
    // a dove sta andando il precedente, anche se il tasto non ha ancora cambiato stato.
    bottone.addEventListener('click', () => whenMapReady(() => {
        const map = getMapInstance();
        const vuoleAccesa = !(obiettivo ?? accesa);
        map.easeTo({ pitch: vuoleAccesa ? INCLINAZIONE_3D : 0, duration: movimentoRidotto.matches ? 0 : 900 });
        // Dopo easeTo: se la camera si è già fermata (durata zero) non resta un obiettivo appeso
        obiettivo = map.isMoving() ? vuoleAccesa : null;
        mostra();
    }));

    whenMapReady(() => {
        const map = getMapInstance();
        // Stesso controllo al primo giro e a ogni cambio: anche un'inclinazione fatta prima del caricamento viene vista
        const sincronizza = () => {
            const inclinazione = map.getPitch();
            if (!accesa && inclinazione >= SOGLIA_ACCESA) applica(true);
            else if (accesa && inclinazione <= SOGLIA_SPENTA) applica(false);
        };
        map.on('pitch', sincronizza);
        map.on('moveend', () => { obiettivo = null; mostra(); });
        sincronizza();
    });
}
