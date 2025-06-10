// main.js
import { initializeMap } from './src/map/map-setup.js';
import {
    loadPoiData, loadKMLLayer, loadCrowdedData, loadSpotMapperData, loadLczVitalityData,
    getFullKmlGeoJson,
    getPoiDateRange
} from './src/data/data-loader.js';
import {
    addKmlLayer, updateAllPresencePoints, addCrowdedPointsLayer,
    updateCrowdedPointsLayerStyle, getCrowdednessColumnName, addSpotsLayer, addLczVitalityLayer
} from './src/map/map-layers.js';
import { fitMapToBounds } from './src/utils/utils.js';
import { updateStatusMessage, initializeSidebar } from './src/ui/ui-sidebar.js';
import { setupTimelineControls, getCurrentHour } from './src/ui/ui-timeline.js';
import { setupLayerControls, initializeSpotTypeFilter } from './src/ui/ui-layer-controls.js';

// Main DOM references
const mapContainerId = 'map';
const sidebarElement = document.getElementById('info-content');
const loadingIndicator = document.getElementById('loading-indicator');

// Variabili globali per il filtro data
window.selectedDateRange = { min: null, max: null };

function setupCalendarDateRange() {
    const calendarContainer = document.getElementById('calendar-container');
    if (!calendarContainer) return;
    const { min, max } = getPoiDateRange();
    if (!min || !max) return;

    // Un solo input per il range
    calendarContainer.innerHTML = `
        <input type="text" id="calendar-range-picker" style="font-size:0.95em; width: 220px; text-align:center;" readonly>
        <button id="calendar-reset-btn" style="font-size:0.95em; padding: 2px 10px; margin-left: 10px;">Reset</button>
    `;

    const rangeInput = document.getElementById('calendar-range-picker');
    const resetBtn = document.getElementById('calendar-reset-btn');

    // Inizializza Litepicker
    const picker = new window.Litepicker({
        element: rangeInput,
        singleMode: false,
        format: 'YYYY-MM-DD',
        minDate: min.toISOString().slice(0,10),
        maxDate: max.toISOString().slice(0,10),
        startDate: min.toISOString().slice(0,10),
        endDate: max.toISOString().slice(0,10),
        autoApply: true,
        lang: 'en',
        tooltipText: { one: 'giorno', other: 'giorni' }
    });

    // Aggiorna il filtro quando cambia il range
    picker.on('selected', (start, end) => {
        window.selectedDateRange = {
            min: start ? new Date(start.format('YYYY-MM-DD')) : min,
            max: end ? new Date(end.format('YYYY-MM-DD')) : max
        };
        document.dispatchEvent(new CustomEvent('dateRangeChanged', { detail: { ...window.selectedDateRange } }));
    });

    // Reset
    resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        picker.setDateRange(min.toISOString().slice(0,10), max.toISOString().slice(0,10));
        window.selectedDateRange = { min, max };
        document.dispatchEvent(new CustomEvent('dateRangeChanged', { detail: { ...window.selectedDateRange } }));
    });
}

// Funzione di utilità per aggiornare la timeline in base al range selezionato
function updateTimelineForDateRange() {
    const slider = document.getElementById('timeSlider');
    const timeDisplay = document.getElementById('timeDisplay');
    if (!slider) return;
    const { min, max } = window.selectedDateRange || {};
    if (!min || !max) {
        slider.min = 0;
        slider.max = 167;
        slider.value = 0;
        if (timeDisplay) timeDisplay.textContent = '';
        return;
    }
    // Calcola i giorni unici (UTC) nell'intervallo
    const days = [];
    let d = new Date(min.getTime());
    d.setUTCHours(0,0,0,0);
    const maxDay = new Date(max.getTime());
    maxDay.setUTCHours(0,0,0,0);
    while (d <= maxDay) {
        days.push(new Date(d.getTime()));
        d.setUTCDate(d.getUTCDate() + 1);
    }
    if (days.length >= 7) {
        slider.min = 0;
        slider.max = 167;
        if (parseInt(slider.value) > 167) slider.value = 0;
        return;
    }
    // Mappa: per ogni giorno, 24 ore
    const timelineMap = [];
    days.forEach((day, i) => {
        for (let h = 0; h < 24; h++) {
            timelineMap.push({
                date: new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), h)),
                label: day.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: '2-digit' }) + ` ${h.toString().padStart(2,'0')}:00`
            });
        }
    });
    slider.min = 0;
    slider.max = timelineMap.length - 1;
    if (parseInt(slider.value) > timelineMap.length - 1) slider.value = 0;
    // Aggiorna la label della timeline
    function updateLabel() {
        const idx = parseInt(slider.value);
        if (timelineMap[idx] && timeDisplay) {
            timeDisplay.textContent = timelineMap[idx].label;
        }
    }
    slider.removeEventListener('_customInput', slider._customInputListener || (()=>{}));
    slider._customInputListener = function(e) {
        updateLabel();
        // Puoi qui lanciare eventuali eventi custom per aggiornare la mappa
    };
    slider.addEventListener('input', slider._customInputListener);
    updateLabel();
    // Salva la mappa per uso da ui-timeline.js (override temporaneo)
    window._timelineMap = timelineMap;
}

// Tutta l'inizializzazione della app dentro una funzione async
async function startApp() {
    // Sposto qui l'inizializzazione, senza attendere DOMContentLoaded
    if (!sidebarElement) { return; }

    initializeSidebar(sidebarElement);
    setupLayerControls();

    try {
        // Aspetta che mapboxgl sia disponibile
        if (typeof window.mapboxgl === 'undefined') {
            await new Promise((resolve) => {
                const check = () => {
                    if (typeof window.mapboxgl !== 'undefined') resolve();
                    else setTimeout(check, 50);
                };
                check();
            });
        }
        const map = initializeMap(mapContainerId);

        map.on('load', async () => {
            if(loadingIndicator) loadingIndicator.style.display = 'block';
            updateStatusMessage("Loading initial data...");

            let poiData, crowdedData, kmlGeoJson, spotsData, lczVitalityData;

            try {
                updateStatusMessage("Loading POI data...");
                poiData = await loadPoiData();

                updateStatusMessage("Loading KML data...");
                kmlGeoJson = await loadKMLLayer();

                updateStatusMessage("Loading Crowded data...");
                crowdedData = await loadCrowdedData();
                
                updateStatusMessage("Loading Spots data...");
                spotsData = await loadSpotMapperData();
                
                updateStatusMessage("Loading LCZ Vitality data...");
                lczVitalityData = await loadLczVitalityData();

                if (!poiData) { }
                if (!crowdedData) { }
                if (!spotsData) { }

                const fullKmlGeoJson = getFullKmlGeoJson();
                let boundsHaveData = !!(fullKmlGeoJson?.features?.length > 0);

                // Imposta KML layer a visibile
                const kmlVisible = true;
                if (boundsHaveData) {
                    addKmlLayer(fullKmlGeoJson, kmlVisible);
                } else {
                }

                // Imposta Crowded layer a non visibile
                const crowdedVisible = false;
                if (crowdedData?.length > 0) {
                    addCrowdedPointsLayer(crowdedVisible);
                } else {
                }
                
                // Imposta POI Spots layer a non visibile
                const spotsVisible = false;
                if (spotsData?.length > 0) {
                    addSpotsLayer(spotsVisible);
                    // Inizializza il selettore di tipi di POI
                    initializeSpotTypeFilter();
                } else {
                }
                
                // Imposta LCZ Vitality layer a non visibile
                const lczVisible = false;
                if (lczVitalityData?.length > 0) {
                    addLczVitalityLayer(lczVisible, 'LCZ');
                } else {
                }

                setupTimelineControls();
                const initialHour = getCurrentHour();

                const initialColumnName = getCrowdednessColumnName(initialHour);
                const initialCrowdednessMap = new Map();
                if (initialColumnName && crowdedData?.length > 0) {
                    let maxCrowdedness = 0;
                    let countNonZero = 0;
                    
                    crowdedData.forEach(record => {
                        if (record?.id !== undefined && record?.id !== null) {
                             const val = parseFloat(record[initialColumnName]);
                             const crowdednessValue = !isNaN(val) ? val : 0;
                             initialCrowdednessMap.set(String(record.id), crowdednessValue);
                             
                             if (crowdednessValue > 0) {
                                 countNonZero++;
                                 maxCrowdedness = Math.max(maxCrowdedness, crowdednessValue);
                             }
                        }
                    });
                }

                if (crowdedData?.length > 0) {
                    updateCrowdedPointsLayerStyle(initialHour, initialCrowdednessMap);
                }

                const updatePresenceSequence = () => {
                    // Imposta Presence layer a visibile
                    const presenceVisible = true;
                    if (boundsHaveData && poiData && Object.keys(poiData).length > 0) {
                        updateAllPresencePoints(initialHour, initialCrowdednessMap, presenceVisible);
                        
                        setTimeout(() => {
                            updateAllPresencePoints(initialHour, initialCrowdednessMap, presenceVisible);
                            
                            setTimeout(() => {
                                updateAllPresencePoints(initialHour, initialCrowdednessMap, presenceVisible);
                                
                                if (boundsHaveData) {
                                    map.once('idle', () => fitMapToBounds(map, fullKmlGeoJson));
                                }
                                
                                updateStatusMessage("Map ready.");
                            }, 1000);
                        }, 700);
                    } else {
                        if (boundsHaveData) {
                            map.once('idle', () => fitMapToBounds(map, fullKmlGeoJson));
                        }
                        updateStatusMessage("Map ready.");
                    }
                };
                
                setTimeout(updatePresenceSequence, 1000);

                setupCalendarDateRange();

            } catch (error) {
                updateStatusMessage(`Loading error: ${error.message}`, true);
            } finally {
                 if(loadingIndicator) loadingIndicator.style.display = 'none';
            }
        });

         map.on('error', (e) => { });

    } catch (error) {
        console.error("Error initializing map or app:", error);
    }
}

// Avvia subito l'app
startApp();

// Ascolta cambiamenti del range data
if (typeof window !== 'undefined') {
    document.addEventListener('dateRangeChanged', updateTimelineForDateRange);
}