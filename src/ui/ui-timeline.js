import { hourToLabel } from '../utils/utils.js';
import {
    updateAllPresencePoints,
    updateCrowdedPointsLayerStyle,
    getTimelineCrowdednessColumn,
    addSyntheticCrowdedPointsLayer,
    removeSyntheticCrowdedPointsLayer,
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
const directionButton = document.getElementById('directionButton');
const playIcon = playButton?.querySelector('.play-icon');
const pauseIcon = playButton?.querySelector('.pause-icon');
const directionIcon = directionButton?.querySelector('.direction-icon');

let currentHour = 0;
let isPlaying = false;
let isForward = true;
let animationFrameId = null;
let updateInProgress = false;
// Pausa fra un'ora e l'altra col Play: lo spostamento dei puntini più un attimo fermi a guardare
const PLAY_STEP_MS = PRESENCE_MOVE_MS + 300;

// --- FUNZIONI ESPORTATE ---
export function setupTimelineControls() {
    if (playButton) { playButton.addEventListener('click', togglePlay); }
    if (directionButton) { directionButton.addEventListener('click', toggleDirection); }
    if (timeSlider) { timeSlider.addEventListener('input', handleSliderInput); }
    initializeTimelineUI();
}

export function getCurrentHour() {
    return currentHour;
}

// Porta la timeline a un'ora (es. dopo un cambio di intervallo nel calendario).
export function setHour(hourIndex) {
    currentHour = hourIndex;
    if(timeSlider) timeSlider.value = currentHour;
    if(timeDisplay) timeDisplay.textContent = hourToLabelDynamic(currentHour);
    return updateAppStateForHour(currentHour);
}

// --- FUNZIONI INTERNE ---
function hourToLabelDynamic(hourIndex) {
    if (window._timelineMap && Array.isArray(window._timelineMap) && window._timelineMap.length > 0) {
        const entry = window._timelineMap[hourIndex];
        return entry ? entry.label : 'N/A';
    }
    return hourToLabel(hourIndex);
}

function initializeTimelineUI() {
    if(timeDisplay) timeDisplay.textContent = hourToLabelDynamic(currentHour);
    if(timeSlider) timeSlider.value = currentHour;
    updatePlayButton();
    updateDirectionButton();
}

function updatePlayButton() {
    if (!playButton || !playIcon || !pauseIcon) return;
    playIcon.style.display = isPlaying ? 'none' : 'block';
    pauseIcon.style.display = isPlaying ? 'block' : 'none';
    playButton.classList.toggle('active', isPlaying);
    playButton.setAttribute('title', isPlaying ? 'Pause' : 'Play');
}

function updateDirectionButton() {
    if (!directionButton || !directionIcon) return;
    directionIcon.classList.toggle('reversed', !isForward);
    directionButton.classList.toggle('active', !isForward);
    directionButton.setAttribute('title', isForward ? 'Direction: Forward' : 'Direction: Backward');
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
        const syntheticCrowdedVisible = getLayerToggleState('synthetic-crowded');
        if (syntheticCrowdedVisible) {
            addSyntheticCrowdedPointsLayer(hourIndex, true);
        } else {
            removeSyntheticCrowdedPointsLayer();
        }
        refreshKmlChartsForTimeline(hourIndex);
        // Niente attesa di 'idle': col brulichio dei puntini non arriva mai e gli ascoltatori si accumulano
        setTimeout(resolve, 100);
    });
}

async function stepAnimation() {
    if (updateInProgress) return;
    updateInProgress = true;
    let maxIdx = (window._timelineMap && window._timelineMap.length) ? window._timelineMap.length - 1 : 167;
    let nextHour = isForward ? currentHour + 1 : currentHour - 1;
    if (nextHour > maxIdx) nextHour = 0;
    if (nextHour < 0) nextHour = maxIdx;
    currentHour = nextHour;
    if(timeSlider) timeSlider.value = currentHour;
    if(timeDisplay) timeDisplay.textContent = hourToLabelDynamic(currentHour);
    try {
        await updateAppStateForHour(currentHour);
    } catch (error) {
    } finally {
        updateInProgress = false;
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
    if (isPlaying) {
        if (animationFrameId) {
            clearTimeout(animationFrameId);
            animationFrameId = null;
        }
        requestAnimationFrame(stepAnimation);
    } else {
        if (animationFrameId) {
            clearTimeout(animationFrameId);
            animationFrameId = null;
        }
    }
}

function toggleDirection() {
    isForward = !isForward;
    updateDirectionButton();
}

async function handleSliderInput(e) {
    if (isPlaying) {
        togglePlay();
    }
    const newHour = parseInt(e.target.value, 10);
    if (newHour === currentHour) return;
    if (updateInProgress) return;
    updateInProgress = true;
    currentHour = newHour;
    if(timeDisplay) timeDisplay.textContent = hourToLabelDynamic(currentHour);
    try {
        await updateAppStateForHour(currentHour);
    } catch (error) {
    } finally {
        updateInProgress = false;
    }
}