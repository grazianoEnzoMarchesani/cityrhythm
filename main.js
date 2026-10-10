// main.js
import { Litepicker } from 'litepicker';
import 'litepicker/dist/css/litepicker.css';
import { initializeMap } from './src/map/map-setup.js';
import {
    loadPoiData, loadKMLLayer, loadCrowdedData, loadSpotMapperData, loadLczVitalityData,
    getFullKmlGeoJson,
    getPoiDateRange
} from './src/data/data-loader.js';
import {
    addKmlLayer, updateAllPresencePoints, addCrowdedPointsLayer,
    updateCrowdedPointsLayerStyle, getTimelineCrowdednessColumn, addSpotsLayer, addLczVitalityLayer
} from './src/map/map-layers.js';
import { fitMapToBounds, rangeDays, WEEK_TYPE_FROM_DAYS } from './src/utils/utils.js';
import { updateStatusMessage, initializeSidebar } from './src/ui/ui-sidebar.js';
import { setupTimelineControls, getCurrentHour, setHour } from './src/ui/ui-timeline.js';
import { setupLayerControls, initializeSpotTypeFilter } from './src/ui/ui-layer-controls.js';
import { setupMapTools } from './src/ui/ui-map-tools.js';
import { startCompass } from './src/compass/compass.js';
import { initCompassUI } from './src/ui/ui-compass.js';
import { initAudioEngine } from './src/audio/audio-engine.js';
import { PHONE_QUERY } from './src/data/config.js';

// Riferimenti al DOM
const mapContainerId = 'map';
const sidebarElement = document.getElementById('info-content');
const PHONE = window.matchMedia(PHONE_QUERY);

// Variabili globali per il filtro data
window.selectedDateRange = { min: null, max: null };

const fmtData = d => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const iso = d => d.toISOString().slice(0, 10);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// --- PERIODO: calendario dentro il pannello "Periodo" della timeline ---
function setupCalendarDateRange() {
    const calendarContainer = document.getElementById('calendar-container');
    if (!calendarContainer) return;
    const { min, max } = getPoiDateRange();
    if (!min || !max) return;

    // Un solo campo per l'intervallo, più il ripristino
    calendarContainer.replaceChildren();
    const rangeInput = document.createElement('input');
    rangeInput.type = 'text';
    rangeInput.id = 'calendar-range-picker';
    rangeInput.readOnly = true;
    rangeInput.setAttribute('aria-label', 'Periodo dei dati: apri il calendario');
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.id = 'calendar-reset-btn';
    resetBtn.className = 'btn';
    resetBtn.textContent = 'Tutto il periodo';
    calendarContainer.append(rangeInput, resetBtn);

    // Inizializza Litepicker in italiano (mesi e giorni dal browser, via Intl)
    const picker = new Litepicker({
        element: rangeInput,
        singleMode: false,
        format: 'YYYY-MM-DD',
        minDate: iso(min),
        maxDate: iso(max),
        startDate: iso(min),
        endDate: iso(max),
        autoApply: true,
        lang: 'it-IT',
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

    // Ripristino: tutto il periodo
    resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        picker.setDateRange(iso(min), iso(max));
        window.selectedDateRange = { min, max };
        document.dispatchEvent(new CustomEvent('dateRangeChanged', { detail: { ...window.selectedDateRange } }));
    });

    setupPeriodPopover(min, max);
}

// Il pulsante "Periodo" apre e chiude il pannello con il calendario; l'etichetta dice il periodo scelto
function setupPeriodPopover(min, max) {
    const button = document.getElementById('period-button');
    const popover = document.getElementById('period-popover');
    if (!button || !popover) return;
    button.disabled = false; // si attiva solo quando i dati ci sono
    const setOpen = (open) => {
        popover.hidden = !open;
        button.setAttribute('aria-expanded', String(open));
        if (open) document.dispatchEvent(new CustomEvent('pannello-aperto', { detail: 'periodo' }));
    };
    button.addEventListener('click', () => setOpen(popover.hidden));
    // Un solo pannello alla volta: quello della Mappa sonora, dei Livelli o dello stile chiude questo
    document.addEventListener('pannello-aperto', (e) => { if (e.detail !== 'periodo') setOpen(false); });
    // Clic fuori chiude il pannello, ma non il calendario di Litepicker che sta fuori dal pannello
    document.addEventListener('pointerdown', (e) => {
        if (popover.hidden) return;
        if (popover.contains(e.target) || button.contains(e.target) || e.target.closest?.('.litepicker')) return;
        setOpen(false);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !popover.hidden) {
            setOpen(false);
            button.focus();
        }
    });
    updatePeriodButton();
}

// Intervallo sul pulsante: l'anno una sola volta quando le due date sono nello stesso anno ("8 giu – 14 giu 2025"), per stare nel telefono
const etichettaPeriodo = (min, max) => {
    const giorno = d => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    return min.getUTCFullYear() === max.getUTCFullYear() ? `${giorno(min)} – ${fmtData(max)}` : `${fmtData(min)} – ${fmtData(max)}`;
};

function updatePeriodButton() {
    const button = document.getElementById('period-button');
    if (!button) return;
    const { min, max } = window.selectedDateRange || {};
    const { min: minTutto, max: maxTutto } = getPoiDateRange() || {};
    const tutto = !min || !max || (minTutto && max.getTime() === maxTutto.getTime() && min.getTime() === minTutto.getTime());
    button.textContent = tutto ? 'Periodo: tutto' : etichettaPeriodo(min, max);
}

// Funzione di utilità per aggiornare la timeline in base al range selezionato
function updateTimelineForDateRange() {
    const slider = document.getElementById('timeSlider');
    if (!slider) return;
    const { min, max } = window.selectedDateRange || {};
    // Meno di una settimana: giorni veri, ore con data; da 7 giorni in su: settimana tipo 168 h, senza date
    const giorni = rangeDays(min, max);
    let timelineMap = null;
    if (giorni > 0 && giorni < WEEK_TYPE_FROM_DAYS) {
        timelineMap = [];
        for (let k = 0; k < giorni; k++) {
            const day = new Date(Date.UTC(min.getUTCFullYear(), min.getUTCMonth(), min.getUTCDate() + k));
            const etichetta = day.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' });
            for (let h = 0; h < 24; h++) {
                timelineMap.push({
                    date: new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), h)),
                    label: `${etichetta} ${h.toString().padStart(2, '0')}:00`
                });
            }
        }
    }
    // Letta da ui-timeline.js (etichette e data vera)
    window._timelineMap = timelineMap;
    const maxIdx = timelineMap ? timelineMap.length - 1 : 167;
    slider.min = 0;
    slider.max = maxIdx;
    const hour = parseInt(slider.value, 10);
    setHour(hour > maxIdx ? 0 : hour);
    updatePeriodButton();
}

// --- PANNELLO DEI LIVELLI: aperto su schermi grandi, chiuso sul telefono ---
function setupLayersPanel() {
    const panel = document.getElementById('layer-controls');
    const toggle = document.getElementById('layers-toggle');
    const close = document.getElementById('layers-close');
    if (!panel || !toggle) return;
    const setOpen = (open) => {
        panel.hidden = !open;
        toggle.hidden = open;
        toggle.setAttribute('aria-expanded', String(open));
        if (!open && document.activeElement === close) toggle.focus();
        // Sul telefono un solo pannello alla volta: aprire i livelli chiude la Mappa sonora e il Periodo
        if (open && PHONE.matches) document.dispatchEvent(new CustomEvent('pannello-aperto', { detail: 'livelli' }));
    };
    toggle.addEventListener('click', () => setOpen(true));
    close?.addEventListener('click', () => setOpen(false));
    document.addEventListener('pannello-aperto', (e) => { if (PHONE.matches && e.detail !== 'livelli' && !panel.hidden) setOpen(false); });
    setOpen(!PHONE.matches);
    // Sul telefono i gruppi partono chiusi e se ne apre uno alla volta. Sul desktop il primo (Persone) è aperto
    const gruppi = [...panel.querySelectorAll('details.group')];
    gruppi.forEach((g) => g.addEventListener('toggle', () => {
        if (!g.open || !PHONE.matches) return;
        gruppi.forEach((altro) => { if (altro !== g) altro.open = false; });
    }));
    if (gruppi[0]) gruppi[0].open = !PHONE.matches;
    // Sul telefono Esc chiude il pannello dei livelli
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !e.defaultPrevented && PHONE.matches && !panel.hidden) setOpen(false);
    });
}

// Tutta l'inizializzazione della app dentro una funzione async
async function startApp() {
    if (!sidebarElement) { return; }

    initializeSidebar(sidebarElement);

    try {
        const map = initializeMap(mapContainerId);
        setupLayerControls();
        setupMapTools(); // stile e 3D in alto a destra
        setupLayersPanel();

        map.on('load', async () => {
            try {
                updateStatusMessage('Carico i luoghi…');
                const poiData = await loadPoiData();

                updateStatusMessage('Carico le aree…');
                const kmlGeoJson = await loadKMLLayer();

                updateStatusMessage('Carico gli affollamenti…');
                const crowdedData = await loadCrowdedData();

                updateStatusMessage('Carico gli spot…');
                const spotsData = await loadSpotMapperData();

                updateStatusMessage('Carico le celle…');
                const lczVitalityData = await loadLczVitalityData();

                const fullKmlGeoJson = getFullKmlGeoJson();
                const boundsHaveData = !!(fullKmlGeoJson?.features?.length > 0);

                // Aree KML sempre visibili: su di esse si clicca per aprire la scheda
                if (boundsHaveData) addKmlLayer(fullKmlGeoJson, true);

                // Affollamento e spot: spenti all'avvio
                if (crowdedData?.length > 0) addCrowdedPointsLayer(false);
                if (spotsData?.length > 0) {
                    addSpotsLayer(false);
                    initializeSpotTypeFilter();
                }

                // Celle LCZ spente all'avvio; la mappa sonora parte solo se i dati ci sono
                if (lczVitalityData?.length > 0) {
                    addLczVitalityLayer(false, 'LCZ');
                    initCompassUI(map);
                    initAudioEngine();
                    startCompass().catch(err => console.error('Bussola non avviata:', err));
                }

                setupTimelineControls();
                const initialHour = getCurrentHour();

                const initialColumnName = getTimelineCrowdednessColumn(initialHour);
                const initialCrowdednessMap = new Map();
                if (initialColumnName && crowdedData?.length > 0) {
                    crowdedData.forEach(record => {
                        if (record?.id !== undefined && record?.id !== null) {
                            const val = parseFloat(record[initialColumnName]);
                            initialCrowdednessMap.set(String(record.id), !isNaN(val) ? val : 0);
                        }
                    });
                }
                if (crowdedData?.length > 0) {
                    updateCrowdedPointsLayerStyle(initialHour, initialCrowdednessMap);
                }

                setupCalendarDateRange();

                // Puntini: tre passi di aggiornamento, perché la sorgente non è pronta subito
                await wait(1000);
                if (boundsHaveData && poiData && Object.keys(poiData).length > 0) {
                    updateAllPresencePoints(initialHour, initialCrowdednessMap, true);
                    await wait(700);
                    updateAllPresencePoints(initialHour, initialCrowdednessMap, true);
                    await wait(1000);
                    updateAllPresencePoints(initialHour, initialCrowdednessMap, true);
                }
                if (boundsHaveData) fitMapToBounds(map, fullKmlGeoJson);

                updateStatusMessage('');
                document.documentElement.dataset.ready = '1';
            } catch (error) {
                updateStatusMessage(`Errore nel caricamento: ${error.message}`, true);
            }
        });

    } catch (error) {
        console.error("Error initializing map or app:", error);
        updateStatusMessage('Non riesco ad avviare la mappa.', true);
    }
}

// Avvia subito l'app
startApp();

// Ascolta cambiamenti del range data
if (typeof window !== 'undefined') {
    document.addEventListener('dateRangeChanged', updateTimelineForDateRange);
}
