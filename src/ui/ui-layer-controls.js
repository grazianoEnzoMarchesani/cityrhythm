// ui-layer-controls.js
import { refreshPresencePoints, setLayerVisibility, addSyntheticCrowdedPointsLayer, removeSyntheticCrowdedPointsLayer, updateAllPresencePoints, addLczVitalityLayer, removeLczVitalityLayer, updateLczVitalityVisualization, setLczLayerOpacity, setUhiDynamicVisibility, getLczLegend } from '../map/map-layers.js';
import { KML_LAYER_ID, CROWDED_LAYER_ID, PRESENCE_POINTS_LAYER_ID, SPOTS_LAYER_ID, LCZ_VITALITY_LAYER_ID, DEBUG_MODE } from '../data/config.js';
import { getMapInstance, whenMapReady } from '../map/map-setup.js';
import { getSpotMapperData } from '../data/data-loader.js';
import { PRESENCE_COLOR_VARIABLES, setPresenceColorBy } from '../map/presence-colors.js';

let kmlToggle = null;
let crowdedToggle = null;
let presenceToggle = null;
let spotsToggle = null;
let spotTypeFilter = null;
let syntheticCrowdedToggle = null;
let lczVitalityToggle = null;
let lczVisualizationSelector = null;
let lczVisualizationSelect = null;
let lczOpacitySlider = null;
let lczOpacityValue = null;
let uhiDynamicVisibilityToggle = null;

// --- FUNZIONI ESPORTATE ---
export function setupLayerControls() {
    kmlToggle = document.getElementById('toggle-kml');
    crowdedToggle = document.getElementById('toggle-crowded');
    presenceToggle = document.getElementById('toggle-presence');
    spotsToggle = document.getElementById('toggle-spots');
    spotTypeFilter = document.getElementById('spot-type-filter');
    syntheticCrowdedToggle = document.getElementById('toggle-synthetic-crowded');
    lczVitalityToggle = document.getElementById('toggle-lcz-vitality');
    lczVisualizationSelector = document.getElementById('lcz-visualization-selector');
    lczVisualizationSelect = document.getElementById('lcz-visualization-select');
    lczOpacitySlider = document.getElementById('lcz-opacity-slider');
    lczOpacityValue = document.getElementById('lcz-opacity-value');
    uhiDynamicVisibilityToggle = document.getElementById('uhi-dynamic-visibility');

    if (kmlToggle && DEBUG_MODE) {
        kmlToggle.checked = true;
        kmlToggle.addEventListener('change', (event) => handleToggleChange(event, KML_LAYER_ID));
    } else if (kmlToggle && !DEBUG_MODE) {
        kmlToggle.checked = false;
        kmlToggle.disabled = true;
        kmlToggle.parentElement.style.display = 'none';
    }
    if (crowdedToggle && DEBUG_MODE) {
        crowdedToggle.checked = false;
        crowdedToggle.addEventListener('change', (event) => handleToggleChange(event, CROWDED_LAYER_ID));
    } else if (crowdedToggle && !DEBUG_MODE) {
        crowdedToggle.checked = false;
        crowdedToggle.disabled = true;
        crowdedToggle.parentElement.style.display = 'none';
    }
    if (presenceToggle) {
        presenceToggle.checked = true;
        presenceToggle.addEventListener('change', (event) => handleToggleChange(event, PRESENCE_POINTS_LAYER_ID));
    }
    setupPresenceColorSelector();
    if (spotsToggle) {
        spotsToggle.checked = false;
        spotsToggle.addEventListener('change', (event) => handleToggleChange(event, SPOTS_LAYER_ID));
    } else {
        const layerControls = document.querySelector('.layer-controls');
        if (layerControls) {
            const spotsToggleDiv = document.createElement('div');
            spotsToggleDiv.className = 'layer-toggle';
            spotsToggle = document.createElement('input');
            spotsToggle.type = 'checkbox';
            spotsToggle.id = 'toggle-spots';
            spotsToggle.checked = false;
            const spotsLabel = document.createElement('label');
            spotsLabel.htmlFor = 'toggle-spots';
            spotsLabel.textContent = 'POI Spots';
            spotsToggleDiv.appendChild(spotsToggle);
            spotsToggleDiv.appendChild(spotsLabel);
            layerControls.appendChild(spotsToggleDiv);
            spotsToggle.addEventListener('change', (event) => handleToggleChange(event, SPOTS_LAYER_ID));
        }
    }
    if (spotTypeFilter) {
        spotTypeFilter.addEventListener('change', (event) => {
            filterSpotsByType(event.target.value);
        });
        if (getSpotMapperData()?.length > 0) {
            populateSpotTypeSelector();
        }
    } else {
        const layerControls = document.querySelector('.layer-controls');
        if (layerControls) {
            const filterDiv = document.createElement('div');
            filterDiv.className = 'spot-type-selector';
            spotTypeFilter = document.createElement('select');
            spotTypeFilter.id = 'spot-type-filter';
            const allOption = document.createElement('option');
            allOption.value = 'all';
            allOption.textContent = 'All types';
            spotTypeFilter.appendChild(allOption);
            filterDiv.appendChild(spotTypeFilter);
            layerControls.appendChild(filterDiv);
            spotTypeFilter.addEventListener('change', (event) => {
                filterSpotsByType(event.target.value);
            });
            if (getSpotMapperData()?.length > 0) {
                populateSpotTypeSelector();
            }
        }
    }
    if (syntheticCrowdedToggle) {
        syntheticCrowdedToggle.checked = false;
        syntheticCrowdedToggle.addEventListener('change', (event) => handleToggleChange(event, 'synthetic-crowded'));
    }
    
    // LCZ Vitality toggle
    if (lczVitalityToggle) {
        lczVitalityToggle.checked = false;
        lczVitalityToggle.addEventListener('change', (event) => {
            const isChecked = event.target.checked;
            if (isChecked) {
                const selectedType = lczVisualizationSelect?.value ?? 'LCZ';
                addLczVitalityLayer(true, selectedType);
                renderLczLegend(selectedType);
                if (lczVisualizationSelector) {
                    lczVisualizationSelector.style.display = 'block';
                }
            } else {
                removeLczVitalityLayer();
                if (lczVisualizationSelector) {
                    lczVisualizationSelector.style.display = 'none';
                }
            }
        });
    }
    
    // Selettore della mappa LCZ: classi, rischio UHI o un parametro delle celle
    if (lczVisualizationSelect) {
        lczVisualizationSelect.addEventListener('change', (event) => {
            renderLczLegend(event.target.value);
            if (lczVitalityToggle && lczVitalityToggle.checked) {
                updateLczVitalityVisualization(event.target.value);
            }
        });
    }

    // LCZ Opacity Slider
    if (lczOpacitySlider && lczOpacityValue) {
        lczOpacitySlider.addEventListener('input', (event) => {
            const opacity = parseInt(event.target.value);
            lczOpacityValue.textContent = opacity + '%';
            if (lczVitalityToggle && lczVitalityToggle.checked) {
                setLczLayerOpacity(opacity / 100);
            }
        });
    }
    
    // UHI Dynamic Visibility Toggle
    if (uhiDynamicVisibilityToggle) {
        uhiDynamicVisibilityToggle.addEventListener('change', (event) => {
            const isEnabled = event.target.checked;
            if (lczVitalityToggle && lczVitalityToggle.checked) {
                setUhiDynamicVisibility(isEnabled);
            }
        });
    }
    // --- 3D Terrain e 3D Buildings ---
    // Applicati anche all'avvio: al ricaricamento il browser può ricordare la casella com'era.
    const terrainToggle = document.getElementById('toggle-3d-terrain');
    if (terrainToggle) {
        const applyTerrain = () => whenMapReady(() => {
            getMapInstance().setTerrain(terrainToggle.checked
                ? { source: 'terrain-dem', exaggeration: 1.2 } // sorgente definita in map-setup.js
                : null);
        });
        terrainToggle.addEventListener('change', applyTerrain);
        applyTerrain();
    }
    const buildingsToggle = document.getElementById('toggle-3d-buildings');
    if (buildingsToggle) {
        const applyBuildings = () => whenMapReady(() => {
            getMapInstance().setLayoutProperty('buildings-3d', 'visibility', buildingsToggle.checked ? 'visible' : 'none');
        });
        buildingsToggle.addEventListener('change', applyBuildings);
        applyBuildings();
    }
}

export function initializeSpotTypeFilter() {
    populateSpotTypeSelector();
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
        case 'spots':
            toggleElement = spotsToggle || document.getElementById('toggle-spots');
            break;
        case 'synthetic-crowded':
            toggleElement = syntheticCrowdedToggle || document.getElementById('toggle-synthetic-crowded');
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
    const options = [['none', 'Off'], ...Object.entries(PRESENCE_COLOR_VARIABLES).map(([key, v]) => [key, v.label])];
    options.forEach(([key, label]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.role = 'radio';
        button.dataset.colorBy = key;
        button.textContent = label;
        button.setAttribute('aria-checked', String(key === 'none'));
        button.addEventListener('click', () => setPresenceColorSelection(key));
        group.appendChild(button);
    });
}

// Usata anche dal clic su un grafico della barra laterale
// (refresh = false: chi chiama ricolora i puntini da sé)
export function setPresenceColorSelection(key, refresh = true) {
    setPresenceColorBy(key);
    const active = PRESENCE_COLOR_VARIABLES[key] ? key : 'none';
    document.querySelectorAll('#presence-color-by button').forEach(b => {
        b.setAttribute('aria-checked', String(b.dataset.colorBy === active));
    });
    const legend = document.getElementById('presence-color-legend');
    if (legend) {
        legend.innerHTML = '';
        PRESENCE_COLOR_VARIABLES[key]?.categories.forEach(c => {
            const item = document.createElement('span');
            item.textContent = c.name;
            item.style.setProperty('--dot', c.color);
            legend.appendChild(item);
        });
    }
    if (refresh) refreshPresencePoints(presenceToggle ? presenceToggle.checked : undefined);
}

/** Legenda della mappa LCZ scelta; il controllo "UHI Dynamic Visibility" compare solo con UHI. */
function renderLczLegend(type) {
    const uhiControl = document.getElementById('uhi-dynamic-control');
    if (uhiControl) uhiControl.style.display = type === 'UHI' ? 'block' : 'none';
    const legend = document.getElementById('lcz-legend');
    if (!legend) return;
    legend.innerHTML = '';
    const info = getLczLegend(type);
    if (info.kind === 'categories') {
        const list = document.createElement('div');
        list.className = 'lcz-legend-categories';
        info.items.forEach(({ color, label }) => {
            const item = document.createElement('span');
            item.textContent = label;
            item.style.setProperty('--swatch', color);
            list.appendChild(item);
        });
        legend.appendChild(list);
        appendLegendNote(legend, info.note);
        return;
    }
    if (info.kind === 'compass') {
        // Mini bussola: righe = piacevolezza (sereno in alto), colonne = energia (poca → tanta gente)
        const rows = [['Serene', ['rifugio', 'passeggiata', 'festa']], ['Neutral', ['attesa', 'routine', 'corrente']],
            ['Oppressive', ['afa', 'fatica', 'calca']]];
        const grid = document.createElement('div');
        grid.className = 'lcz-legend-compass';
        rows.forEach(([label, states]) => {
            const head = document.createElement('span');
            head.className = 'lcz-legend-compass-row';
            head.textContent = label;
            grid.appendChild(head);
            states.forEach(st => grid.appendChild(compassCell(st, info.colors[st])));
        });
        grid.appendChild(document.createElement('span'));
        const axis = document.createElement('span');
        axis.className = 'lcz-legend-compass-axis';
        axis.textContent = 'few people → crowded';
        grid.appendChild(axis);
        const night = document.createElement('div');
        night.className = 'lcz-legend-compass-night';
        night.appendChild(compassCell('notte', info.colors.notte));
        night.append(' dark and few people');
        legend.append(grid, night);
        appendLegendNote(legend, info.note);
        return;
    }
    // Soglie a passo regolare: la scala è lineare a tratti fra una soglia e l'altra
    const pos = i => (i / (info.stops.length - 1) * 100).toFixed(1);
    const bar = document.createElement('div');
    bar.className = 'lcz-legend-ramp';
    bar.style.background = `linear-gradient(to right, ${info.stops
        .map(([, c], i) => `${c} ${pos(i)}%`).join(', ')})`;
    const ticks = document.createElement('div');
    ticks.className = 'lcz-legend-ticks';
    info.stops.forEach(([v], i) => {
        if (v === null) return; // soglia senza etichetta
        const tick = document.createElement('span');
        tick.textContent = i === info.stops.length - 1 && info.unit && !info.unit.includes('–') ? `${v} ${info.unit}` : v;
        tick.style.left = `${pos(i)}%`;
        ticks.appendChild(tick);
    });
    const note = document.createElement('div');
    note.className = 'lcz-legend-note';
    note.textContent = info.unit.includes('–') ? `${info.note} (${info.unit})` : info.note;
    legend.append(bar, ticks, note);
}

function compassCell(state, color) {
    const cell = document.createElement('span');
    cell.className = 'lcz-legend-compass-cell';
    cell.textContent = state[0].toUpperCase() + state.slice(1);
    cell.style.background = color;
    // testo chiaro sui colori scuri
    const [r, g, b] = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
    cell.style.color = 0.299 * r + 0.587 * g + 0.114 * b < 140 ? '#fff' : '#222';
    return cell;
}

function appendLegendNote(legend, text) {
    if (!text) return;
    const note = document.createElement('div');
    note.className = 'lcz-legend-note';
    note.textContent = text;
    legend.appendChild(note);
}

function handleToggleChange(event, layerId) {
    const isChecked = event.target.checked;
    if (layerId === 'synthetic-crowded') {
        if (isChecked) {
            // Usa ora corrente della timeline
            const hourIndex = window.getCurrentHour ? window.getCurrentHour() : 0;
            addSyntheticCrowdedPointsLayer(hourIndex, true);
        } else {
            removeSyntheticCrowdedPointsLayer();
        }
        return;
    }
    if (layerId === KML_LAYER_ID) {
        setLayerVisibility(KML_LAYER_ID + '-outline', isChecked);
        setLayerVisibility(KML_LAYER_ID + '-base-outline', isChecked);
    } else if (layerId === SPOTS_LAYER_ID) {
        setLayerVisibility(SPOTS_LAYER_ID + '-labels', isChecked);
    } else if (layerId === LCZ_VITALITY_LAYER_ID) {
        setLayerVisibility(LCZ_VITALITY_LAYER_ID + '-stroke', isChecked);
    }
    setLayerVisibility(layerId, isChecked);
}

function filterSpotsByType(selectedType) {
    const map = getMapInstance();
    if (!map) return;
    if (selectedType === 'all') {
        map.setFilter(SPOTS_LAYER_ID, null);
        map.setFilter(SPOTS_LAYER_ID + '-labels', null);
    } else {
        const filter = ['==', ['get', 'tipo'], selectedType];
        map.setFilter(SPOTS_LAYER_ID, filter);
        map.setFilter(SPOTS_LAYER_ID + '-labels', filter);
    }
}

function populateSpotTypeSelector() {
    if (!spotTypeFilter) return;
    const spotsData = getSpotMapperData();
    if (!spotsData || !spotsData.length) return;
    const types = new Set();
    spotsData.forEach(spot => {
        if (spot.Tipo) {
            types.add(spot.Tipo);
        }
    });
    const sortedTypes = Array.from(types).sort();
    while (spotTypeFilter.options.length > 1) {
        spotTypeFilter.remove(1);
    }
    sortedTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        spotTypeFilter.appendChild(option);
    });
}