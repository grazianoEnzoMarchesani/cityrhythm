// ui-layer-controls.js
import { refreshPresencePoints, setLayerVisibility, updateAllPresencePoints, addLczVitalityLayer, removeLczVitalityLayer, updateLczVitalityVisualization, setLczLayerOpacity, setUhiDynamicVisibility, getLczLegend, setLczHighlight, setCellsOnTop } from '../map/map-layers.js';
import { KML_LAYER_ID, CROWDED_LAYER_ID, PRESENCE_POINTS_LAYER_ID, DEBUG_MODE, MAP_STYLES } from '../data/config.js';
import { PRESENCE_COLOR_VARIABLES, setPresenceColorBy } from '../map/presence-colors.js';
import { coloreSuono, POSIZIONE_STATI } from '../compass/sound-color.js';
import { celleAccese } from '../state/store.js';

let kmlToggle = null;
let crowdedToggle = null;
let presenceToggle = null;
let lczVitalityToggle = null;
let lczVisualizationSelector = null;
let lczOpacitySlider = null;
let lczOpacityValue = null;
let cellsOnTopToggle = null;
let uhiDynamicVisibilityToggle = null;
let lczView = 'LCZ';   // vista scelta in "Cosa mostrare"
let legendPick = null; // voce della legenda evidenziata sulla mappa: { id, label }; null = tutte le celle

// Cosa mostrare: gruppi come un tempo nel menu, poi [vista, sigla, nome breve, titolo della legenda].
// I colori dei campioni e le legende vengono da getLczLegend (map-layers.js).
const VISTE_CELLE = [
    ['Cambiano con l’ora', [
        ['utci', 'UTCI', 'caldo percepito', 'Caldo percepito (UTCI)'],
        ['stato', 'Mappa sonora', 'come suona la città', 'Mappa sonora'],
    ]],
    ['Tipo di zona', [
        ['LCZ', 'LCZ', 'tipo di zona', 'Tipo di zona (LCZ)'],
        ['UHI', 'UHI', 'rischio di isola di calore', 'Rischio di isola di calore (UHI)'],
    ]],
    ['Forma della città', [
        ['svf_mean', 'SVF', 'cielo visibile', 'Cielo visibile (SVF)'],
        ['aspect_ratio', 'H/W', 'strade a canyon', 'Canyon stradale (H/W)'],
        ['z_h', 'Altezza', 'di edifici e alberi', 'Altezza di edifici e alberi'],
        ['terrain_rough', 'Rugosità', 'quanto frena il vento', 'Classe di rugosità'],
    ]],
    ['Superficie del suolo', [
        ['building_frac', 'Edificato', 'suolo coperto da edifici', 'Superficie edificata'],
        ['impervious_frac', 'Impermeabile', 'asfalto e pavimenti', 'Superficie impermeabile'],
        ['pervious_frac', 'Permeabile', 'terra, prato e alberi', 'Superficie permeabile'],
    ]],
    ['Calore', [
        ['albedo', 'Albedo', 'luce solare riflessa', 'Albedo'],
        ['admittance', 'Ammettenza', 'calore accumulato dai materiali', 'Ammettenza termica'],
        ['anthro_heat', 'Calore umano', 'traffico e climatizzazione', 'Calore prodotto dalle persone'],
        ['industry_heat', 'Calore industriale', 'solo le fabbriche', 'Calore industriale'],
    ]],
];

// --- FUNZIONI ESPORTATE ---
// Intensità dello strato in percentuale: la scrive lo slider o l'interruttore "sopra", e la applica se le celle ci sono
function setIntensity(percent) {
    if (lczOpacitySlider) lczOpacitySlider.value = percent;
    if (lczOpacityValue) lczOpacityValue.textContent = percent + '%';
    if (lczVitalityToggle && lczVitalityToggle.checked) setLczLayerOpacity(percent / 100);
}

export function setupLayerControls() {
    kmlToggle = document.getElementById('toggle-kml');
    crowdedToggle = document.getElementById('toggle-crowded');
    presenceToggle = document.getElementById('toggle-presence');
    lczVitalityToggle = document.getElementById('toggle-lcz-vitality');
    lczVisualizationSelector = document.getElementById('lcz-visualization-selector');
    lczOpacitySlider = document.getElementById('lcz-opacity-slider');
    lczOpacityValue = document.getElementById('lcz-opacity-value');
    cellsOnTopToggle = document.getElementById('toggle-cells-on-top');
    uhiDynamicVisibilityToggle = document.getElementById('uhi-dynamic-visibility');

    // Aree KML e punti di affollamento: visibili solo in modalità sviluppatore (DEBUG_MODE in config.js)
    if (DEBUG_MODE) {
        document.querySelectorAll('[data-dev]').forEach(el => { el.hidden = false; });
        if (kmlToggle) kmlToggle.addEventListener('change', (event) => handleToggleChange(event, KML_LAYER_ID));
        if (crowdedToggle) {
            crowdedToggle.checked = false;
            crowdedToggle.addEventListener('change', (event) => handleToggleChange(event, CROWDED_LAYER_ID));
        }
    }
    if (presenceToggle) {
        presenceToggle.checked = true;
        presenceToggle.addEventListener('change', (event) => handleToggleChange(event, PRESENCE_POINTS_LAYER_ID));
    }
    setupPresenceColorSelector();

    // Celle: interruttore, vista (griglia di pulsanti), trasparenza, rischio UHI dinamico
    setupLczViewPicker();
    if (lczVitalityToggle) {
        lczVitalityToggle.checked = false;
        lczVitalityToggle.addEventListener('change', (event) => {
            const isChecked = event.target.checked;
            celleAccese.set(isChecked);
            if (isChecked) {
                addLczVitalityLayer(true, lczView);
                renderLczLegend(lczView);
                if (lczVisualizationSelector) lczVisualizationSelector.hidden = false;
            } else {
                removeLczVitalityLayer();
                if (lczVisualizationSelector) lczVisualizationSelector.hidden = true;
            }
        });
    }
    if (lczOpacitySlider && lczOpacityValue) {
        lczOpacitySlider.addEventListener('input', (event) => setIntensity(parseInt(event.target.value, 10)));
    }
    if (cellsOnTopToggle) {
        cellsOnTopToggle.checked = false;
        cellsOnTopToggle.addEventListener('change', (event) => {
            const onTop = event.target.checked;
            setCellsOnTop(onTop);
            // Sopra edifici e strade l'intensità scende da sola; spenta torna sempre al 100%
            setIntensity(Math.round((onTop ? MAP_STYLES.LCZ_VITALITY.FILL_OPACITY_ON_TOP : MAP_STYLES.LCZ_VITALITY.FILL_OPACITY) * 100));
        });
    }
    if (uhiDynamicVisibilityToggle) {
        uhiDynamicVisibilityToggle.addEventListener('change', (event) => {
            if (lczVitalityToggle && lczVitalityToggle.checked) {
                setUhiDynamicVisibility(event.target.checked);
            }
        });
    }
}

export function getLayerToggleState(layerName) {
    let toggleElement = null;
    switch (layerName) {
        case 'kml':
            toggleElement = kmlToggle || document.getElementById('toggle-kml');
            break;
        case 'crowded':
            toggleElement = crowdedToggle || document.getElementById('toggle-crowded');
            break;
        case 'presence':
            toggleElement = presenceToggle || document.getElementById('toggle-presence');
            break;
        case 'lcz-vitality':
            toggleElement = lczVitalityToggle || document.getElementById('toggle-lcz-vitality');
            break;
        default:
            return false;
    }
    return toggleElement ? toggleElement.checked : false;
}

// --- FUNZIONI INTERNE ---
// --- COLORAZIONE DEI PUNTINI (percentuali reali di ogni quartiere, stabile al cambio d'ora) ---
function setupPresenceColorSelector() {
    const group = document.getElementById('presence-color-by');
    if (!group) return;
    const options = [['none', 'Nessuno'], ...Object.entries(PRESENCE_COLOR_VARIABLES).map(([key, v]) => [key, v.label])];
    options.forEach(([key, label]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.colorBy = key;
        button.textContent = label;
        button.setAttribute('aria-pressed', String(key === 'none'));
        button.addEventListener('click', () => setPresenceColorSelection(key));
        group.appendChild(button);
    });
}

// Usata anche dal clic su un grafico della scheda area
// (refresh = false: chi chiama ricolora i puntini da sé)
export function setPresenceColorSelection(key, refresh = true) {
    setPresenceColorBy(key);
    const active = PRESENCE_COLOR_VARIABLES[key] ? key : 'none';
    document.querySelectorAll('#presence-color-by button').forEach(b => {
        b.setAttribute('aria-pressed', String(b.dataset.colorBy === active));
    });
    const legend = document.getElementById('presence-color-legend');
    if (legend) {
        legend.replaceChildren();
        PRESENCE_COLOR_VARIABLES[key]?.categories.forEach(c => {
            const item = document.createElement('span');
            item.textContent = c.name;
            item.style.setProperty('--dot', c.color);
            legend.appendChild(item);
        });
    }
    if (refresh) refreshPresencePoints(presenceToggle ? presenceToggle.checked : undefined);
}

// --- COSA MOSTRARE: una griglia di pulsanti, ognuno con la sigla, un nome breve e un campione dei colori ---
function setupLczViewPicker() {
    const picker = document.getElementById('lcz-view-picker');
    if (!picker) return;
    VISTE_CELLE.forEach(([titolo, viste]) => {
        const gruppo = document.createElement('div');
        gruppo.className = 'view-group';
        const griglia = document.createElement('div');
        griglia.className = 'view-grid';
        viste.forEach(([view, sigla, nome, titoloVista]) => griglia.append(viewTile(view, sigla, nome, titoloVista)));
        gruppo.append(span('view-group-title', titolo), griglia);
        picker.append(gruppo);
    });
}

function viewTile(view, sigla, nome, titoloVista) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'view-tile';
    button.dataset.view = view;
    button.title = titoloVista;
    button.setAttribute('aria-pressed', String(view === lczView));
    const testo = document.createElement('span');
    testo.className = 'view-text';
    testo.append(span('view-head', sigla), span('view-sub', nome));
    button.append(viewIcon(getLczLegend(view)), testo);
    button.addEventListener('click', () => chooseLczView(view));
    return button;
}

// Campione della vista: sfumato per le scale, quadretti per le classi, la rosa dei nove stati per la Mappa sonora
function viewIcon(info) {
    const icon = document.createElement('span');
    icon.className = 'view-icon';
    if (info.kind === 'ramp') {
        const last = info.stops.length - 1;
        icon.style.background = `linear-gradient(to right, ${info.stops
            .map((s, i) => `${s.c} ${(i / last * 100).toFixed(1)}%`).join(', ')})`;
    } else if (info.kind === 'categories') {
        // Quattro colori distribuiti lungo la lista: bastano a riconoscere la vista
        const n = info.items.length;
        icon.classList.add('view-icon-grid');
        icon.style.setProperty('--cols', 2);
        [0, 1, 2, 3].forEach(k => icon.append(colorCell(info.items[Math.round(k * (n - 1) / 3)].color)));
    } else {
        // Stessa disposizione del quadrante: piacevolezza dall'alto in basso, energia da sinistra a destra
        icon.classList.add('view-icon-grid');
        icon.style.setProperty('--cols', 3);
        [1, 0, -1].forEach(Y => [-1, 0, 1].forEach(X => {
            const stato = Object.keys(POSIZIONE_STATI).find(k => POSIZIONE_STATI[k][0] === X && POSIZIONE_STATI[k][1] === Y);
            icon.append(colorCell(info.colors[stato]));
        }));
    }
    return icon;
}

function chooseLczView(view) {
    lczView = view;
    document.querySelectorAll('#lcz-view-picker .view-tile').forEach(b => {
        b.setAttribute('aria-pressed', String(b.dataset.view === view));
    });
    renderLczLegend(view); // cambiare vista riporta la legenda a "tutte le celle"
    if (lczVitalityToggle?.checked) updateLczVitalityVisualization(view);
}

/** Legenda della vista scelta; il controllo di rischio dinamico compare solo con UHI. */
function renderLczLegend(view) {
    const uhiControl = document.getElementById('uhi-dynamic-control');
    if (uhiControl) uhiControl.hidden = view !== 'UHI';
    const legend = document.getElementById('lcz-legend');
    if (!legend) return;
    legendPick = null;
    setLczHighlight(null);
    legend.replaceChildren();
    const info = getLczLegend(view);
    // Le scale mettono l'unità nel titolo: sulle etichette farebbe spazio che non c'è (la scala UTCI si sovrapponeva)
    const voce = VISTE_CELLE.flatMap(([, viste]) => viste).find(v => v[0] === view);
    const unita = info.kind === 'ramp' && info.unit ? ` · ${info.unit}` : '';
    legend.append(span('legend-title', (voce ? voce[3] : view) + unita));
    if (info.kind === 'categories') legend.append(categoriesLegend(info));
    else if (info.kind === 'ramp') legend.append(rampLegend(info));
    else legend.append(soundGradientLegend(), notteLegendItem(info.colors.notte));
    appendLegendNote(legend, info.note);
    const hint = span('legend-hint', '');
    hint.id = 'lcz-legend-hint';
    legend.append(hint);
    updateLegendHint();
}

// Categorie: una colonna allineata. Per le LCZ, prima le zone costruite (1–10), poi suolo, verde e acqua (A–G)
function categoriesLegend(info) {
    const list = document.createElement('div');
    list.className = 'legend-list';
    const gruppi = info.view === 'LCZ'
        ? [['Zone costruite (1–10)', voce => /^\d+$/.test(voce.key)], ['Suolo, verde e acqua (A–G)', voce => !/^\d+$/.test(voce.key)]]
        : [[null, () => true]];
    gruppi.forEach(([titolo, tiene]) => {
        if (titolo) list.append(span('legend-group-title', titolo));
        info.items.filter(tiene).forEach(voce => {
            const content = [legendSwatch(voce.color)];
            if (voce.code) content.push(span('legend-code', voce.code));
            content.push(span('legend-name', voce.name));
            const label = voce.code ? `${voce.code} ${voce.name}` : voce.name;
            list.append(legendItem(`${info.view}-${voce.key}`, label, { view: info.view, key: voce.key },
                content, voce.code ? 'legend-item has-code' : 'legend-item'));
        });
    });
    return list;
}

/**
 * Scala a fasce: ogni tratto va da un'etichetta alla successiva (per l'UTCI sono le fasce ufficiali).
 * Le fasce agli estremi sono aperte: i valori fuori scala prendono il colore del bordo, come sulla mappa.
 */
function rampLegend(info) {
    const wrap = document.createElement('div');
    wrap.className = 'lcz-legend-ramp-wrap';
    const { stops } = info;
    const last = stops.length - 1;
    const unita = info.unit && !info.unit.includes('–') ? ` ${info.unit}` : '';
    const numero = t => String(t).replace('-', '−');
    // Solo gli stop con etichetta fanno da confine: quello senza etichetta resta dentro la sua fascia
    const etichettate = stops.flatMap((s, i) => (s.label === null ? [] : [i]));
    const bar = document.createElement('div');
    bar.className = 'lcz-legend-ramp';
    etichettate.slice(0, -1).forEach((a, k) => {
        const b = etichettate[k + 1];
        const primo = k === 0;
        const ultimo = k === etichettate.length - 2;
        const testo = primo ? `sotto ${numero(stops[b].t)}${unita}`
            : ultimo ? `da ${numero(stops[a].t)}${unita} in su`
            : `da ${numero(stops[a].t)} a ${numero(stops[b].t)}${unita}`;
        const seg = legendItem(`ramp-${k}`, testo, { view: info.view, lo: primo ? undefined : stops[a].t, hi: ultimo ? undefined : stops[b].t },
            [], 'ramp-seg');
        seg.style.flex = `0 0 ${((b - a) / last * 100).toFixed(2)}%`;
        seg.style.background = `linear-gradient(to right, ${stops.slice(a, b + 1)
            .map((s, j) => `${s.c} ${(j / (b - a) * 100).toFixed(1)}%`).join(', ')})`;
        seg.title = testo;
        seg.setAttribute('aria-label', testo);
        bar.append(seg);
    });
    const ticks = document.createElement('div');
    ticks.className = 'lcz-legend-ticks';
    etichettate.forEach(i => {
        const tick = document.createElement('span');
        tick.textContent = stops[i].label;
        tick.style.left = `${(i / last * 100).toFixed(2)}%`;
        ticks.append(tick);
    });
    wrap.append(bar, ticks);
    return wrap;
}

// Sound map: un quadrato con la sfumatura e i nomi degli stati sulle loro posizioni.
// Asse verticale = piacevolezza (sereno in alto), orizzontale = energia (poca gente → tanta gente).
// Ogni nome è un pulsante: evidenzia le celle di quello stato.
function soundGradientLegend() {
    const wrap = document.createElement('div');
    wrap.className = 'lcz-legend-compass';
    const canvas = document.createElement('canvas');
    const N = 60;
    canvas.width = N; canvas.height = N;
    const ctx = canvas.getContext('2d');
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const X = -1 + 2 * (i + 0.5) / N, Y = 1 - 2 * (j + 0.5) / N;
        ctx.fillStyle = coloreSuono(X, Y, 'routine');
        ctx.fillRect(i, j, 1, 1);
    }
    wrap.appendChild(canvas);
    for (const [stato, [X, Y]] of Object.entries(POSIZIONE_STATI)) {
        const nome = capitalizza(stato);
        const tag = legendItem(`stato-${stato}`, nome, { view: 'stato', key: stato }, [document.createTextNode(nome)], 'state-tag');
        // Alone bianco: il nome si legge sia sul colore della sfumatura sia sul fondo del pannello
        tag.style.left = `${(X + 1) / 2 * 100}%`;
        tag.style.top = `${(1 - Y) / 2 * 100}%`;
        tag.style.textShadow = '0 0 3px #fff, 0 0 3px #fff, 0 0 2px #fff';
        wrap.appendChild(tag);
    }
    const asse = document.createElement('span');
    asse.className = 'axis';
    asse.textContent = 'Poca gente → molta gente';
    wrap.appendChild(asse);
    return wrap;
}

function notteLegendItem(color) {
    return legendItem('stato-notte', 'Notte', { view: 'stato', key: 'notte' },
        [legendSwatch(color), span('legend-name', 'Notte: buio e poca gente')]);
}

/**
 * Voce cliccabile della legenda: evidenzia sulla mappa solo le celle di quella voce.
 * Un altro clic sulla stessa voce le mostra di nuovo tutte.
 */
function legendItem(id, label, selection, content, className = 'legend-item') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.dataset.pick = id;
    button.setAttribute('aria-pressed', 'false');
    button.append(...content);
    button.addEventListener('click', () => {
        const spenta = legendPick?.id === id;
        legendPick = spenta ? null : { id, label };
        setLczHighlight(spenta ? null : selection);
        updateLegendHint();
    });
    return button;
}

/** Stato della legenda: la voce evidenziata (aria-pressed) e la riga che dice come tornare a tutte. */
function updateLegendHint() {
    const legend = document.getElementById('lcz-legend');
    if (!legend) return;
    legend.classList.toggle('has-pick', !!legendPick);
    legend.querySelectorAll('[data-pick]').forEach(b => {
        b.setAttribute('aria-pressed', String(b.dataset.pick === legendPick?.id));
    });
    const hint = document.getElementById('lcz-legend-hint');
    if (hint) {
        hint.textContent = legendPick
            ? `Sulla mappa solo: ${legendPick.label}. Un altro clic le mostra tutte.`
            : 'Clicca una voce per vedere solo lei sulla mappa.';
    }
}

function span(className, text) {
    const el = document.createElement('span');
    el.className = className;
    el.textContent = text;
    return el;
}

function legendSwatch(color) {
    const el = span('legend-swatch', '');
    el.style.setProperty('--swatch', color);
    return el;
}

function colorCell(color) {
    const el = document.createElement('span');
    el.style.background = color;
    return el;
}

const capitalizza = s => s[0].toUpperCase() + s.slice(1);

function appendLegendNote(legend, text) {
    if (!text) return;
    const note = document.createElement('div');
    note.className = 'lcz-legend-note';
    note.textContent = text;
    legend.appendChild(note);
}

function handleToggleChange(event, layerId) {
    const isChecked = event.target.checked;
    if (layerId === KML_LAYER_ID) {
        setLayerVisibility(KML_LAYER_ID + '-outline', isChecked);
        setLayerVisibility(KML_LAYER_ID + '-base-outline', isChecked);
    }
    setLayerVisibility(layerId, isChecked);
}
