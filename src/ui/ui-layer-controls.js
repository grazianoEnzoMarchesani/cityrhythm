// ui-layer-controls.js
import { setLayerVisibility, addSyntheticCrowdedPointsLayer, removeSyntheticCrowdedPointsLayer, updateAllPresencePoints, addLczVitalityLayer, removeLczVitalityLayer, updateLczVitalityVisualization, setLczLayerOpacity, setUhiDynamicVisibility } from '../map/map-layers.js';
import { KML_LAYER_ID, CROWDED_LAYER_ID, PRESENCE_POINTS_LAYER_ID, SPOTS_LAYER_ID, LCZ_VITALITY_LAYER_ID, DEBUG_MODE } from '../data/config.js';
import { getMapInstance } from '../map/map-setup.js';
import { getSpotMapperData } from '../data/data-loader.js';

let kmlToggle = null;
let crowdedToggle = null;
let presenceToggle = null;
let spotsToggle = null;
let spotTypeFilter = null;
let syntheticCrowdedToggle = null;
let lczVitalityToggle = null;
let lczVisualizationSelector = null;
let lczVisualizationRadios = null;
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
    lczVisualizationRadios = document.querySelectorAll('input[name="lcz-visualization"]');
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
                const selectedType = document.querySelector('input[name="lcz-visualization"]:checked').value;
                addLczVitalityLayer(true, selectedType);
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
    
    // LCZ visualization type radio buttons
    if (lczVisualizationRadios) {
        lczVisualizationRadios.forEach(radio => {
            radio.addEventListener('change', (event) => {
                if (lczVitalityToggle && lczVitalityToggle.checked) {
                    updateLczVitalityVisualization(event.target.value);
                }
            });
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
    // --- 3D Terrain toggle ---
    const terrainToggle = document.getElementById('toggle-3d-terrain');
    if (terrainToggle) {
        terrainToggle.addEventListener('change', (event) => {
            const map = getMapInstance();
            if (!map || !map.isStyleLoaded()) return;
            if (event.target.checked) {
                // Aggiungi la sorgente terrain se non esiste
                if (!map.getSource('mapbox-dem')) {
                    map.addSource('mapbox-dem', {
                        type: 'raster-dem',
                        url: 'mapbox://mapbox.terrain-rgb',
                        tileSize: 512,
                        maxzoom: 14
                    });
                }
                map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.2 });
            } else {
                map.setTerrain(null);
            }
        });
    }
    // --- 3D Buildings toggle ---
    const buildingsToggle = document.getElementById('toggle-3d-buildings');
    if (buildingsToggle) {
        buildingsToggle.addEventListener('change', (event) => {
            const map = getMapInstance();
            if (!map || !map.isStyleLoaded()) return;
            const isVisible = event.target.checked ? 'visible' : 'none';
            // Trova tutti i layer con paint.fill-extrusion-height (3D buildings)
            map.getStyle().layers.forEach(layer => {
                if (layer.type === 'fill-extrusion' && layer.paint && layer.paint['fill-extrusion-height'] !== undefined) {
                    map.setLayoutProperty(layer.id, 'visibility', isVisible);
                }
            });
        });
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