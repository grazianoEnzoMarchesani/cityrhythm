import { hourToLabel } from '../utils/utils.js';
import {
    updateAllPresencePoints,
    updateCrowdedPointsLayerStyle,
    getTimelineCrowdednessColumn,
    setPresenceMoveDuration
} from '../map/map-layers.js';
import { refreshKmlChartsForTimeline } from './ui-sidebar.js';
import { getCrowdedData } from '../data/data-loader.js';
import { getLayerToggleState } from './ui-layer-controls.js';
import { DEBUG_MODE, PRESENCE_MOVE_MS } from '../data/config.js';
import { time } from '../state/store.js';

const timeSlider = document.getElementById('timeSlider');
const timeDisplay = document.getElementById('timeDisplay');
const playButton = document.getElementById('playButton');
const playIcon = playButton?.querySelector('.play-icon');
const pauseIcon = playButton?.querySelector('.pause-icon');

let currentHour = 0;
let isPlaying = false;
let animationFrameId = null;
let updateInProgress = false;
// Pausa fra un'ora e l'altra col Play: lo spostamento dei puntini più un attimo fermi a guardare
const PLAY_STEP_MS = PRESENCE_MOVE_MS + 300;

// --- FUNZIONI ESPORTATE ---
export function setupTimelineControls() {
    if (playButton) playButton.addEventListener('click', togglePlay);
    if (timeSlider) timeSlider.addEventListener('input', handleSliderInput);
    setupKeyboard();
    initializeTimelineUI();
}

export function getCurrentHour() {
    return currentHour;
}

// Porta la timeline a un'ora (es. dopo un cambio di periodo nel calendario).
export function setHour(hourIndex) {
    currentHour = hourIndex;
    if (timeSlider) timeSlider.value = currentHour;
    showTime();
    return updateAppStateForHour(currentHour);
}

// --- FUNZIONI INTERNE ---
// Dice sempre in che modo si legge il tempo: giorni veri (periodo sotto 7 giorni) o settimana tipo.
function timeLabel(hourIndex) {
    if (window._timelineMap && Array.isArray(window._timelineMap) && window._timelineMap.length > 0) {
        const entry = window._timelineMap[hourIndex];
        return entry ? entry.label : 'Non disponibile';
    }
    // Spazi indivisibili dentro "Settimana tipo" e "Lun 00:00": sul telefono l'etichetta va a capo solo dopo il punto
    return `Settimana tipo · ${hourToLabel(hourIndex).replace(' ', ' ')}`;
}

function showTime() {
    const label = timeLabel(currentHour);
    if (timeDisplay) timeDisplay.textContent = label;
    if (timeSlider) timeSlider.setAttribute('aria-valuetext', label);
}

function initializeTimelineUI() {
    showTime();
    if (timeSlider) timeSlider.value = currentHour;
    updatePlayButton();
}

function updatePlayButton() {
    if (!playButton || !playIcon || !pauseIcon) return;
    playIcon.style.display = isPlaying ? 'none' : 'block';
    pauseIcon.style.display = isPlaying ? 'block' : 'none';
    playButton.classList.toggle('active', isPlaying);
    const testo = isPlaying ? 'Ferma la timeline' : 'Avvia la timeline';
    playButton.setAttribute('aria-label', testo);
    playButton.setAttribute('title', testo);
}

// Scorciatoie: barra spaziatrice avvia e ferma, frecce spostano di un'ora.
// Solo quando nessun elemento ha il fuoco: così non si scontrano con le frecce della mappa
// e con i campi di testo o i menu.
function setupKeyboard() {
    document.addEventListener('keydown', (e) => {
        if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
        const fuoco = document.activeElement;
        // Libero = nessun elemento ha il fuoco, oppure il titolo della scheda appena aperta
        const libero = fuoco === document.body || fuoco?.id === 'drawer-title';
        const sullaMappa = fuoco?.classList?.contains('maplibregl-canvas');
        if (e.key === ' ' && (libero || sullaMappa)) {
            e.preventDefault();
            togglePlay();
        } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && libero) {
            e.preventDefault();
            stepTo(e.key === 'ArrowRight' ? 1 : -1);
        }
    });
}

// Passo di un'ora a mano (frecce): non avvia il Play, aggiorna tutto come il cursore
function stepTo(delta) {
    if (isPlaying) togglePlay();
    const maxIdx = (window._timelineMap && window._timelineMap.length) ? window._timelineMap.length - 1 : 167;
    let next = currentHour + delta;
    if (next > maxIdx) next = 0;
    if (next < 0) next = maxIdx;
    if (updateInProgress) return;
    currentHour = next;
    if (timeSlider) timeSlider.value = currentHour;
    showTime();
    updateInProgress = true;
    updateAppStateForHour(currentHour).finally(releaseUpdate);
}

function updateAppStateForHour(hourIndex) {
    time.set({ index: hourIndex, date: window._timelineMap?.[hourIndex]?.date ?? null });
    return new Promise((resolve) => {
        const crowdedData = getCrowdedData();
        const columnName = getTimelineCrowdednessColumn(hourIndex);
        const currentCrowdednessMap = new Map();
        if (columnName && crowdedData?.length > 0) {
            crowdedData.forEach(record => {
                if (record?.id !== undefined && record?.id !== null) {
                    const crowdedValue = parseFloat(record[columnName]);
                    const currentCrowdedness = !isNaN(crowdedValue) ? crowdedValue : 0;
                    currentCrowdednessMap.set(String(record.id), currentCrowdedness);
                }
            });
        }
        if (DEBUG_MODE) {
            updateCrowdedPointsLayerStyle(hourIndex, currentCrowdednessMap);
        }
        const presenceVisible = getLayerToggleState('presence');
        updateAllPresencePoints(hourIndex, currentCrowdednessMap, presenceVisible);
        refreshKmlChartsForTimeline(hourIndex);
        // Niente attesa di 'idle': col brulichio dei puntini non arriva mai e gli ascoltatori si accumulano
        setTimeout(resolve, 100);
    });
}

async function stepAnimation() {
    if (updateInProgress) return;
    updateInProgress = true;
    let maxIdx = (window._timelineMap && window._timelineMap.length) ? window._timelineMap.length - 1 : 167;
    let nextHour = currentHour + 1;
    if (nextHour > maxIdx) nextHour = 0;
    if (nextHour < 0) nextHour = maxIdx;
    currentHour = nextHour;
    if (timeSlider) timeSlider.value = currentHour;
    showTime();
    try {
        await updateAppStateForHour(currentHour);
    } catch (error) {
        // Un'ora che non si aggiorna non ferma la timeline: si passa all'ora dopo
    } finally {
        releaseUpdate();
        if (isPlaying) {
            animationFrameId = setTimeout(() => {
                requestAnimationFrame(stepAnimation);
            }, PLAY_STEP_MS);
        }
    }
}

function togglePlay() {
    isPlaying = !isPlaying;
    updatePlayButton();
    // Col Play i puntini devono arrivare prima del passo successivo
    setPresenceMoveDuration(isPlaying ? 0.9 * PLAY_STEP_MS : Infinity);
    if (animationFrameId) {
        clearTimeout(animationFrameId);
        animationFrameId = null;
    }
    if (isPlaying) requestAnimationFrame(stepAnimation);
}

// Trascinando veloce lo slider manda più valori mentre l'ora precedente si sta ancora aggiornando:
// l'ultimo valore si tiene da parte e si applica appena finisce, così cursore ed etichetta restano uguali.
let pendingHour = null;
async function handleSliderInput(e) {
    if (isPlaying) togglePlay();
    const newHour = parseInt(e.target.value, 10);
    // Prima il controllo sull'aggiornamento in corso: se l'ora è tornata quella attuale ma un'altra è in attesa, va annullata
    if (updateInProgress) {
        pendingHour = newHour;
        return;
    }
    if (newHour === currentHour) return;
    await applyHour(newHour);
}

async function applyHour(hour) {
    updateInProgress = true;
    currentHour = hour;
    showTime();
    try {
        await updateAppStateForHour(currentHour);
    } catch (error) {
        // l'ora resta mostrata, il prossimo cambio aggiorna tutto
    } finally {
        releaseUpdate();
    }
}

// Fine di ogni aggiornamento (cursore, Play, frecce): se nel frattempo lo slider ha chiesto un'altra ora, si applica ora
function releaseUpdate() {
    updateInProgress = false;
    const next = pendingHour;
    pendingHour = null;
    if (next !== null && next !== currentHour) applyHour(next);
}
