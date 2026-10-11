import Papa from 'papaparse';
import { hourToLabel, getDateTimeFromIndex, rangeDays, WEEK_TYPE_FROM_DAYS, exportArrayToCSV } from '../utils/utils.js';
import { getPoiData, getSpotMapperData, getCrowdedData } from '../data/data-loader.js';
import { setKmlFeatureSelectedState } from '../map/map-setup.js';
import { getCrowdednessColumnName, generateSyntheticCrowdedPointsGeoJson } from '../map/map-layers.js';
import { DEBUG_MODE, PHONE_QUERY } from '../data/config.js';
import { getTipiDiLuogo } from './tipi-luogo.js';
import { paintAreaPanel, initAreaPanel, resetAreaPanel, resizeAreaCharts } from './area-panel.js';

let sidebarContainerElement = null;
let sidebarContentElement = null;
let statusMessageElement = null;
let statusBarElement = null;

let selectedKmlFeature = null;
let lastKmlTimelineHour = -1;
const PHONE = window.matchMedia(PHONE_QUERY);
let returnFocusEl = null; // dove si trovava il fuoco prima di aprire la scheda
// Ruotando il telefono la scheda può passare da tutto schermo a laterale: lo sfondo inerte segue il cambio
PHONE.addEventListener('change', () => setBackgroundInert(PHONE.matches && !!sidebarContainerElement && !sidebarContainerElement.hidden));

// --- FUNZIONI ESPORTATE ---
export function initializeSidebar(contentElement) {
    sidebarContentElement = contentElement;
    sidebarContainerElement = sidebarContentElement?.closest('#sidebar');
    // Messaggi di stato: nella barra in alto, non nella scheda
    statusMessageElement = document.getElementById('status-message');
    statusBarElement = document.getElementById('status-bar');
    if (!sidebarContentElement) {
        console.error("Sidebar content element not provided to initializeSidebar.");
        return;
    }
    if (!statusMessageElement) {
        console.warn("Status message element not found.");
    }
    document.getElementById('sidebar-close')?.addEventListener('click', closeSidebar);
    // Esc chiude la scheda, ma non se è aperto il calendario del periodo (gestisce lui l'Esc)
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || e.defaultPrevented || !sidebarContainerElement || sidebarContainerElement.hidden) return;
        if (document.getElementById('period-popover') && !document.getElementById('period-popover').hidden) return;
        e.preventDefault(); // avvisa gli altri ascoltatori di Esc (il pannello dei livelli sul telefono)
        closeSidebar();
    });
    window.addEventListener('resize', resizeAreaCharts);
    initAreaPanel(sidebarContentElement);
    if (DEBUG_MODE) console.log("Sidebar UI Initialized.");
    addExportSyntheticCrowdedButton();
}

// Messaggio nella barra in alto. Testo vuoto = barra nascosta. Errori: annunciati subito.
export function updateStatusMessage(message, isError = false) {
    if (!statusMessageElement) {
        const level = isError ? 'error' : 'log';
        console[level]("Status:", message);
        return;
    }
    statusMessageElement.textContent = message || '';
    if (statusBarElement) {
        statusBarElement.hidden = !message;
        statusBarElement.dataset.error = String(!!isError);
        statusBarElement.setAttribute('role', isError ? 'alert' : 'status');
    }
}

export function resetSidebar() {
    clearSidebarContent();
}

// La scheda compare solo quando c'è un'area selezionata; il fuoco va al titolo per chi usa la tastiera
function openSidebar() {
    if (!sidebarContainerElement || !sidebarContainerElement.hidden) return;
    returnFocusEl = document.activeElement;
    sidebarContainerElement.hidden = false;
    // Sul telefono la scheda copre tutto: il resto della pagina non si tocca né riceve il fuoco
    if (PHONE.matches) setBackgroundInert(true);
    document.getElementById('drawer-title')?.focus({ preventScroll: true });
}

// Chiude la scheda e deseleziona l'area (il × e l'Esc); il fuoco torna dov'era
export function closeSidebar() {
    const eraAperta = sidebarContainerElement && !sidebarContainerElement.hidden;
    clearSidebarContent(true);
    if (eraAperta && returnFocusEl?.isConnected) returnFocusEl.focus({ preventScroll: true });
    returnFocusEl = null;
}

// Titolo della scheda: il nome dell'area (o "Area" senza selezione)
function setDrawerTitle(nome) {
    const titolo = document.getElementById('drawer-title');
    if (titolo) titolo.textContent = nome || 'Area';
}

// Sul telefono: tutto il resto della pagina inerte mentre la scheda è aperta
function setBackgroundInert(on) {
    ['side-column', 'timeline-container', 'layers-toggle', 'map'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.inert = on;
    });
}

export function displayKmlFeatureInfoAndCalculateAverages(kmlFeature, timelineHourIndex) {
    if (!sidebarContentElement) return;
    if (!kmlFeature || !kmlFeature.properties || !kmlFeature.geometry) {
        if (DEBUG_MODE) console.warn("displayKmlFeatureInfoAndCalculateAverages called without valid KML feature.");
        clearSidebarContent();
        updateStatusMessage("Dati dell’area non validi.", true);
        return;
    }
    const kmlProperties = kmlFeature.properties;
    const featureId = kmlFeature.id;
    const isSameKml = selectedKmlFeature?.id === featureId;
    clearSidebarContent(false, isSameKml);
    openSidebar();
    setDrawerTitle(kmlProperties.kml_name);
    selectedKmlFeature = kmlFeature;
    lastKmlTimelineHour = -1;
    setKmlFeatureSelectedState(featureId);
    if (!kmlProperties.poi_data_available) {
        const kmlName = kmlProperties.kml_name || "Area senza nome";
        let htmlContent = `<h3>${kmlName}</h3>`;
        if (kmlProperties.description) {
            const tempDiv = document.createElement('div'); tempDiv.innerHTML = kmlProperties.description;
            const cleanDescription = tempDiv.textContent || tempDiv.innerText || "";
            if (cleanDescription.trim()) { htmlContent += `<p class="small"><em>${cleanDescription.trim()}</em></p>`; }
        }
        htmlContent += `<p class="note-center note-gap">Per quest’area non ci sono dati storici dei luoghi: presenze e caratteristiche dei visitatori esistono solo dove ci sono questi dati.</p>`;
        sidebarContentElement.innerHTML = htmlContent;
        return;
    }
    calculateAndDisplayAverages(kmlFeature, timelineHourIndex);
}

export function refreshKmlChartsForTimeline(timelineHourIndex) {
    if (DEBUG_MODE) console.log("refreshKmlChartsForTimeline chiamata per orario:", timelineHourIndex, "ultimo orario:", lastKmlTimelineHour);
    if (selectedKmlFeature) {
        // Forziamo l'aggiornamento anche se l'orario non è cambiato
        // Questo risolve il problema della scomparsa della sidebar
        calculateAndDisplayAverages(selectedKmlFeature, timelineHourIndex);
    } else {
        if (DEBUG_MODE) console.log("Nessuna KML feature selezionata, impossibile aggiornare la sidebar");
    }
}

// --- FUNZIONI DI SUPPORTO E RENDERING ---
function clearSidebarContent(showDefaultMessage = true, preserveKmlSelection = false) {
    if (!sidebarContentElement) return;
    sidebarContentElement.innerHTML = '';
    resetAreaPanel();
    if (!preserveKmlSelection) {
        setKmlFeatureSelectedState(null);
        selectedKmlFeature = null;
        lastKmlTimelineHour = -1;
    }
    // Nessuna selezione: la scheda si chiude del tutto (niente pannello vuoto)
    if (showDefaultMessage && sidebarContainerElement) {
        sidebarContainerElement.hidden = true;
        setBackgroundInert(false);
    }
}

function calculateAndDisplayAverages(kmlFeature, timelineHourIndex) {
    if (!kmlFeature || !kmlFeature.properties || !kmlFeature.geometry) {
        if (DEBUG_MODE) console.warn("calculateAndDisplayAverages: Invalid KML feature.");
        clearSidebarContent(false, true);
        sidebarContentElement.innerHTML = `<h3>${kmlFeature?.properties?.kml_name || 'Area selezionata'}</h3><p class="note-center">Errore interno o dati dell’area non validi.</p>`;
        return;
    }
    if (!kmlFeature.properties.poi_data_available) {
        if (DEBUG_MODE) console.warn("calculateAndDisplayAverages: Called for KML without POI data.");
        clearSidebarContent(false, true);
        sidebarContentElement.innerHTML = `<h3>${kmlFeature.properties.kml_name || 'Area selezionata'}</h3><p class="note-center">Per quest’area non ci sono dati storici dei luoghi: presenze e caratteristiche dei visitatori esistono solo dove ci sono questi dati.</p>`;
        lastKmlTimelineHour = timelineHourIndex;
        return;
    }

    const kmlProperties = kmlFeature.properties;
    const poiName = kmlProperties.poi_name;
    const allPoiData = getPoiData();
    const poiRecords = allPoiData[poiName?.trim().toLowerCase()];

    if (!poiRecords || poiRecords.length === 0) {
        if (DEBUG_MODE) console.warn(`No POI records found for ${poiName}.`);
        const kmlName = kmlProperties.kml_name || "Area";
        clearSidebarContent(false, true);
        sidebarContentElement.innerHTML = `<h3>${kmlName}</h3><p class="note-center">Ci sono dati per quest’area, ma non ci sono record per questo momento. Può essere un problema temporaneo: riprova più tardi.</p>`;
        if (DEBUG_MODE) console.log(`Nessun dato dei luoghi per ${kmlName}.`);
        lastKmlTimelineHour = timelineHourIndex;
        return;
    }

    const { jsDayOfWeek, hour } = getDateTimeFromIndex(timelineHourIndex);
    const currentTimelineLabel = window._timelineMap?.[timelineHourIndex]?.label ?? hourToLabel(timelineHourIndex);

    // --- AGGIUNTA: filtro per range date selezionato ---
    let dateMin = null, dateMax = null;
    if (typeof window !== 'undefined' && window.selectedDateRange) {
        dateMin = window.selectedDateRange.min instanceof Date ? window.selectedDateRange.min : null;
        dateMax = window.selectedDateRange.max instanceof Date ? window.selectedDateRange.max : null;
    }

    let filteredRecords;
    // Stessa soglia della timeline (main.js): meno di 7 giorni = giorni veri, altrimenti settimana tipo
    if (dateMin && dateMax && rangeDays(dateMin, dateMax) < WEEK_TYPE_FROM_DAYS) {
        // If the selected date range is shorter than 7 days, ignore the day-of-week filter
        filteredRecords = poiRecords.filter(record => {
            const validDate = record.parsedDate instanceof Date && !isNaN(record.parsedDate.getTime());
            const inRange = validDate && record.parsedDate >= dateMin && record.parsedDate <= dateMax;
            return validDate && inRange;
        });
    } else {
        filteredRecords = poiRecords.filter(record => {
            const validDate = record.parsedDate instanceof Date && !isNaN(record.parsedDate.getTime());
            const inDay = validDate && record.parsedDate.getUTCDay() === jsDayOfWeek;
            const inRange = !dateMin || !dateMax || (validDate && record.parsedDate >= dateMin && record.parsedDate <= dateMax);
            return validDate && inDay && inRange;
        });
    }

    const count = filteredRecords.length;
    const sums = {
        presenzeOra: 0, percM: 0, percF: 0,
        perc18_24: 0, perc25_34: 0, perc35_44: 0, perc45_54: 0, perc55_64: 0, perc65plus: 0,
        percItaliani: 0, percStranieri: 0,
        visite1: 0, visite2: 0, visite3: 0, visite4: 0, visite5: 0,
        interests: {}, provinces: {}, countries: {},
    };
    
    // Oggetti per tracciare min, max e relative date
    const stats = {
        presenzeOra: { min: { value: Infinity, date: null }, max: { value: -Infinity, date: null } },
        percM: { min: { value: Infinity, date: null }, max: { value: -Infinity, date: null } },
        percF: { min: { value: Infinity, date: null }, max: { value: -Infinity, date: null } },
        perc18_24: { min: { value: Infinity, date: null }, max: { value: -Infinity, date: null } },
        perc25_34: { min: { value: Infinity, date: null }, max: { value: -Infinity, date: null } },
        perc35_44: { min: { value: Infinity, date: null }, max: { value: -Infinity, date: null } },
        perc45_54: { min: { value: Infinity, date: null }, max: { value: -Infinity, date: null } },
        perc55_64: { min: { value: Infinity, date: null }, max: { value: -Infinity, date: null } },
        perc65plus: { min: { value: Infinity, date: null }, max: { value: -Infinity, date: null } },
        percItaliani: { min: { value: Infinity, date: null }, max: { value: -Infinity, date: null } },
        percStranieri: { min: { value: Infinity, date: null }, max: { value: -Infinity, date: null } },
        visite1: { min: { value: Infinity, date: null }, max: { value: -Infinity, date: null } },
        visite2: { min: { value: Infinity, date: null }, max: { value: -Infinity, date: null } },
        visite3: { min: { value: Infinity, date: null }, max: { value: -Infinity, date: null } },
        visite4: { min: { value: Infinity, date: null }, max: { value: -Infinity, date: null } },
        visite5: { min: { value: Infinity, date: null }, max: { value: -Infinity, date: null } }
    };
    
    const interestKeys = [ 'Beauty','Book','Culture','Discount','Energy','Entertainment','Fashion','Fitness','Food','Free time','Health','Home appliance','Homedecor','Insurance','Interior design','Kids','Luxury','Motor','News','Pet','Photography','Sex','Streaming','Tech','Travel'];
    interestKeys.forEach(key => {
        sums.interests[key] = { sum: 0, count: 0 };
        stats[key] = { min: { value: Infinity, date: null }, max: { value: -Infinity, date: null } };
    });

    if (count > 0) {
        const presenzeKey = `presenze_${hour}`;

        filteredRecords.forEach(rec => {
            const safeAdd = (currentSum, value) => {
                const numValue = parseFloat(value);
                return !isNaN(numValue) ? currentSum + numValue : currentSum;
            };
            
            // Funzione per tracciare min/max
            const updateMinMax = (field, value, date) => {
                const numValue = parseFloat(value);
                if (!isNaN(numValue)) {
                    if (numValue < stats[field].min.value) {
                        stats[field].min.value = numValue;
                        stats[field].min.date = date;
                    }
                    if (numValue > stats[field].max.value) {
                        stats[field].max.value = numValue;
                        stats[field].max.date = date;
                    }
                }
            };

            const recordDate = rec.parsedDate;
            const formattedDate = recordDate instanceof Date ? recordDate.toLocaleDateString('it-IT', { timeZone: 'UTC' }) : 'n.d.';
            
            // Aggiorna sums e min/max per presenza
            const presenceValue = rec[presenzeKey];
            sums.presenzeOra = safeAdd(sums.presenzeOra, presenceValue);
            updateMinMax('presenzeOra', presenceValue, formattedDate);
            
            // Aggiorna sums e min/max per genere
            sums.percM = safeAdd(sums.percM, rec['% M']); updateMinMax('percM', rec['% M'], formattedDate);
            sums.percF = safeAdd(sums.percF, rec['% F']); updateMinMax('percF', rec['% F'], formattedDate);
            
            // Aggiorna sums e min/max per età
            sums.perc18_24 = safeAdd(sums.perc18_24, rec['% 18-24']); updateMinMax('perc18_24', rec['% 18-24'], formattedDate);
            sums.perc25_34 = safeAdd(sums.perc25_34, rec['% 25-34']); updateMinMax('perc25_34', rec['% 25-34'], formattedDate);
            sums.perc35_44 = safeAdd(sums.perc35_44, rec['% 35-44']); updateMinMax('perc35_44', rec['% 35-44'], formattedDate);
            sums.perc45_54 = safeAdd(sums.perc45_54, rec['% 45-54']); updateMinMax('perc45_54', rec['% 45-54'], formattedDate);
            sums.perc55_64 = safeAdd(sums.perc55_64, rec['% 55-64']); updateMinMax('perc55_64', rec['% 55-64'], formattedDate);
            sums.perc65plus = safeAdd(sums.perc65plus, rec['% 65+']); updateMinMax('perc65plus', rec['% 65+'], formattedDate);

            const itaKey = Object.keys(rec).find(k => k.toLowerCase() === '% italiani' || k.toLowerCase() === 'perc_italiani');
            const strKey = Object.keys(rec).find(k => k.toLowerCase() === '% stranieri' || k.toLowerCase() === 'perc_stranieri');
            if (itaKey) {
                sums.percItaliani = safeAdd(sums.percItaliani, rec[itaKey]);
                updateMinMax('percItaliani', rec[itaKey], formattedDate);
            }
            if (strKey) {
                sums.percStranieri = safeAdd(sums.percStranieri, rec[strKey]);
                updateMinMax('percStranieri', rec[strKey], formattedDate);
            }

            // Aggiorna sums e min/max per visite
            const visite1Val = parseFloat(rec['visite_1']); 
            if (!isNaN(visite1Val)) {
                sums.visite1 += visite1Val;
                updateMinMax('visite1', visite1Val, formattedDate);
            }
            
            const visite2Val = parseFloat(rec['visite_2']); 
            if (!isNaN(visite2Val)) {
                sums.visite2 += visite2Val;
                updateMinMax('visite2', visite2Val, formattedDate);
            }
            
            const visite3Val = parseFloat(rec['visite_3']); 
            if (!isNaN(visite3Val)) {
                sums.visite3 += visite3Val;
                updateMinMax('visite3', visite3Val, formattedDate);
            }
            
            const visite4Val = parseFloat(rec['visite_4']); 
            if (!isNaN(visite4Val)) {
                sums.visite4 += visite4Val;
                updateMinMax('visite4', visite4Val, formattedDate);
            }
            
            const visite5Val = parseFloat(rec['visite_5']); 
            if (!isNaN(visite5Val)) {
                sums.visite5 += visite5Val;
                updateMinMax('visite5', visite5Val, formattedDate);
            }

            // Aggiorna sums e min/max per interessi
            interestKeys.forEach(key => { 
                const val = parseFloat(rec[key]); 
                if (!isNaN(val)) { 
                    sums.interests[key].sum += val; 
                    sums.interests[key].count++; 
                    updateMinMax(key, val, formattedDate);
                } 
            });

            for (let i = 1; i <= 6; i++) {
                const pk = Object.keys(rec).find(k => k.toLowerCase() === `provincia_${i}`);
                const ppk = Object.keys(rec).find(k => k.toLowerCase().startsWith(`percentuale_prov_${i}`) || k.toLowerCase().startsWith(`perc_provincia_${i}`));
                if (pk && ppk && typeof rec[pk] === 'string' && rec[pk].trim()) {
                    const n = rec[pk].trim();
                    const pv = parseFloat(rec[ppk]);
                    if (!isNaN(pv)) {
                        if (!sums.provinces[n]) sums.provinces[n] = { sum: 0, count: 0 };
                        sums.provinces[n].sum += pv; sums.provinces[n].count++;
                    }
                }
            }
             for (let i = 1; i <= 5; i++) {
                 const nk = Object.keys(rec).find(k => k.toLowerCase() === `nazione_${i}`);
                 const pnk = Object.keys(rec).find(k => k.toLowerCase().startsWith(`percentuale_naz_${i}`) || k.toLowerCase().startsWith(`perc_nazione_${i}`));
                 if (nk && pnk && typeof rec[nk] === 'string' && rec[nk].trim()) {
                     const n = rec[nk].trim();
                     const pv = parseFloat(rec[pnk]);
                     if (!isNaN(pv)) {
                         if (!sums.countries[n]) sums.countries[n] = { sum: 0, count: 0 };
                         sums.countries[n].sum += pv; sums.countries[n].count++;
                     }
                 }
             }
        });
    }

    // Normalizza i valori min/max quando nessun dato è stato trovato
    Object.keys(stats).forEach(key => {
        if (stats[key].min.value === Infinity) stats[key].min.value = 0;
        if (stats[key].max.value === -Infinity) stats[key].max.value = 0;
    });

    const averages = { count: count, stats: stats };
    if (count > 0) {
        averages.presenzeOra = sums.presenzeOra / count;
        averages.percM = sums.percM / count; averages.percF = sums.percF / count;
        averages.perc18_24 = sums.perc18_24 / count; averages.perc25_34 = sums.perc25_34 / count;
        averages.perc35_44 = sums.perc35_44 / count; averages.perc45_54 = sums.perc45_54 / count;
        averages.perc55_64 = sums.perc55_64 / count; averages.perc65plus = sums.perc65plus / count;
        averages.percItaliani = sums.percItaliani / count; averages.percStranieri = sums.percStranieri / count;
        averages.visite1 = sums.visite1 / count;
        averages.visite2 = sums.visite2 / count;
        averages.visite3 = sums.visite3 / count;
        averages.visite4 = sums.visite4 / count;
        averages.visite5 = sums.visite5 / count;
        averages.interests = {}; interestKeys.forEach(key => { averages.interests[key] = sums.interests[key].count > 0 ? sums.interests[key].sum / sums.interests[key].count : 0; });
        averages.provinces = {}; Object.keys(sums.provinces).forEach(name => { averages.provinces[name] = sums.provinces[name].count > 0 ? sums.provinces[name].sum / sums.provinces[name].count : 0; });
        averages.countries = {}; Object.keys(sums.countries).forEach(name => { averages.countries[name] = sums.countries[name].count > 0 ? sums.countries[name].sum / sums.countries[name].count : 0; });
    } else {
        Object.assign(averages, { presenzeOra: 0, percM: 0, percF: 0, perc18_24: 0, perc25_34: 0, perc35_44: 0, perc45_54: 0, perc55_64: 0, perc65plus: 0, percItaliani: 0, percStranieri: 0, visite1: 0, visite2: 0, visite3: 0, visite4: 0, visite5: 0, interests: {}, provinces: {}, countries: {} });
        interestKeys.forEach(key => averages.interests[key] = 0);
    }

    // Dopo aver calcolato tutte le somme e statistiche, calcoliamo i valori assoluti min/max
    // per tutte le ore e tutti i giorni della finestra selezionata
    const absoluteMinPresence = { value: Infinity, date: null, hour: null };
    const absoluteMaxPresence = { value: -Infinity, date: null, hour: null };
    
    if (count > 0) {
        filteredRecords.forEach(rec => {
            for (let h = 0; h < 24; h++) {
                const key = `presenze_${h}`;
                const val = parseFloat(rec[key]);
                if (!isNaN(val)) {
                    if (val < absoluteMinPresence.value) {
                        absoluteMinPresence.value = val;
                        absoluteMinPresence.date = rec.parsedDate instanceof Date ? rec.parsedDate.toLocaleDateString('it-IT', { timeZone: 'UTC' }) : 'n.d.';
                        absoluteMinPresence.hour = h;
                    }
                    if (val > absoluteMaxPresence.value) {
                        absoluteMaxPresence.value = val;
                        absoluteMaxPresence.date = rec.parsedDate instanceof Date ? rec.parsedDate.toLocaleDateString('it-IT', { timeZone: 'UTC' }) : 'n.d.';
                        absoluteMaxPresence.hour = h;
                    }
                }
            }
        });
    }
    
    // La scheda si disegna in area-panel.js: qui passano solo i dati già calcolati
    paintAreaPanel({
        featureId: kmlFeature.id,
        count,
        etichetta: currentTimelineLabel,
        medie: averages,
        statistiche: stats,
        assoluto: { min: absoluteMinPresence, max: absoluteMaxPresence },
        ora: hour,
        registri: filteredRecords,
        luoghi: count > 0
            ? getTipiDiLuogo(timelineHourIndex, kmlFeature.id).map(t => ({ nome: t.text, conteggio: t.count, valore: t.value }))
            : [],
    });
    lastKmlTimelineHour = timelineHourIndex;
    setTimeout(() => resizeAreaCharts(), 100);
}

// --- AGGIUNTA: Bottone ed export CSV synthetic crowded points con stato avanzamento ---
function setExportProgressStatus(msg, percent = null) {
    let status = document.getElementById('export-synthetic-crowded-status');
    if (!status) {
        status = document.createElement('div');
        status.id = 'export-synthetic-crowded-status';
        status.className = 'export-status';
        const btn = document.getElementById('export-synthetic-crowded-btn');
        if (btn && btn.parentNode) btn.parentNode.insertBefore(status, btn);
    }
    if (percent !== null && percent >= 0 && percent <= 100) {
        status.innerHTML = `${msg} <span class='export-pct'>${percent}%</span>`;
    } else {
        status.textContent = msg;
    }
}

function clearExportProgressStatus() {
    const status = document.getElementById('export-synthetic-crowded-status');
    if (status) status.textContent = '';
}

function exportSyntheticCrowdedCSV() {
    const spots = getSpotMapperData();
    const crowdedData = getCrowdedData();
    const btn = document.getElementById('export-synthetic-crowded-btn');
    if (!spots?.length || !crowdedData?.length) {
        setExportProgressStatus('Dati non disponibili.');
        return;
    }
    if (btn) btn.disabled = true;
    setExportProgressStatus('Preparazione dati... 0%', 0);

    // --- Se DEBUG_MODE è false, scarica e usa il CSV statico ---
    if (!DEBUG_MODE) {
        // URL fornito dall'utente
        const synthetic_crowded_points_URL = 'https://gist.githubusercontent.com/grazianoEnzoMarchesani/69fa4c4f62d91ad5e768ee34d1b0b07c/raw/655542d96ad0038322a841259a3d241431ea65eb/synthetic_crowded_points.csv';
        setExportProgressStatus('Download CSV pre-calcolato...');
        fetch(synthetic_crowded_points_URL)
            .then(response => {
                if (!response.ok) throw new Error('Errore nel download del CSV statico');
                return response.text();
            })
            .then(csvText => {
                // Usa PapaParse se disponibile, altrimenti esporta direttamente
                if (Papa) {
                    const parsed = Papa.parse(csvText, { header: true });
                    if (parsed.errors && parsed.errors.length > 0) {
                        setExportProgressStatus('Errore parsing CSV statico');
                        if (btn) btn.disabled = false;
                        return;
                    }
                    exportArrayToCSV(parsed.data, 'synthetic_crowded_points.csv');
                } else {
                    // Esporta il testo così com'è
                    const blob = new Blob([csvText], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'synthetic_crowded_points.csv';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }
                setExportProgressStatus('Completato!');
                if (btn) btn.disabled = false;
                setTimeout(clearExportProgressStatus, 3500);
            })
            .catch(err => {
                setExportProgressStatus('Errore nel download del CSV statico');
                if (btn) btn.disabled = false;
            });
        return;
    }
    // --- Altrimenti (DEBUG_MODE true): calcolo live come ora ---
    const result = [];
    const total = spots.length;
    let lastPercent = 0;
    // 1. Prepara lookup crowded point per coordinate (lat/lon arrotondate)
    const coordKey = (lat, lon) => `${Number(lat).toFixed(6)},${Number(lon).toFixed(6)}`;
    const crowdedMap = new Map();
    crowdedData.forEach(cp => {
        crowdedMap.set(coordKey(cp.latitude, cp.longitude), cp);
    });
    // 2. Per evitare duplicati, tieni traccia dei crowded point già esportati
    const exportedCrowdedKeys = new Set();
    // 3. Precalcola tutti i synthetic crowded points per ogni ora
    const syntheticByHour = Array(168);
    for (let h = 0; h < 168; h++) {
        const crowdednessColumn = getCrowdednessColumnName(h);
        const syntheticGeoJson = generateSyntheticCrowdedPointsGeoJson(spots, crowdedData, crowdednessColumn);
        // Mappa: coordKey -> synthetic_crowdedness
        const hourMap = new Map();
        if (syntheticGeoJson && syntheticGeoJson.features?.length) {
            syntheticGeoJson.features.forEach(f => {
                const coords = f.geometry?.coordinates;
                if (coords && coords.length === 2) {
                    hourMap.set(coordKey(coords[1], coords[0]), f.properties.synthetic_crowdedness || 0);
                }
            });
        }
        syntheticByHour[h] = hourMap;
    }
    // 4. Genera i dati
    let i = 0;
    function processNextChunk() {
        const chunkSize = 5;
        for (let c = 0; c < chunkSize && i < total; c++, i++) {
            const spot = spots[i];
            const key = coordKey(spot.Latitudine, spot.Longitudine);
            const crowded = crowdedMap.get(key);
            let row = {
                latitude: spot.Latitudine,
                longitude: spot.Longitudine,
                name: spot.Nome || spot.name || '',
                TAG: spot.TAG || ''
            };
            if (crowded) {
                // PRIORITÀ: crowded point
                row.type = 'crowded';
                for (let h = 0; h < 168; h++) {
                    const crowdednessColumn = getCrowdednessColumnName(h);
                    let val = crowded[crowdednessColumn] !== undefined ? crowded[crowdednessColumn] : 0;
                    row[`crowdness${h+1}`] = Math.round(val);
                }
                exportedCrowdedKeys.add(key);
            } else {
                // Synthetic logic aggiornata
                row.type = 'synthetic';
                for (let h = 0; h < 168; h++) {
                    const val = syntheticByHour[h].get(key) || 0;
                    row[`crowdness${h+1}`] = Math.round(val);
                }
            }
            result.push(row);
        }
        // Aggiorna stato
        const percent = Math.floor((i / total) * 100);
        if (percent !== lastPercent) {
            setExportProgressStatus('Preparazione dati...', percent);
            lastPercent = percent;
        }
        if (i < total) {
            setTimeout(processNextChunk, 0);
        } else {
            // Dopo aver processato tutti gli spot, aggiungi i crowded point che NON sono già stati esportati
            crowdedData.forEach(cp => {
                const key = coordKey(cp.latitude, cp.longitude);
                if (!exportedCrowdedKeys.has(key)) {
                    const row = {
                        latitude: cp.latitude,
                        longitude: cp.longitude,
                        name: cp.name || cp.Nome || '',
                        TAG: cp.TAG || '',
                        type: 'crowded'
                    };
                    for (let h = 0; h < 168; h++) {
                        const crowdednessColumn = getCrowdednessColumnName(h);
                        let val = cp[crowdednessColumn] !== undefined ? cp[crowdednessColumn] : 0;
                        row[`crowdness${h+1}`] = Math.round(val);
                    }
                    result.push(row);
                }
            });
            setExportProgressStatus('Download in corso...');
            setTimeout(() => {
                exportArrayToCSV(result, 'synthetic_crowded_points.csv');
                setExportProgressStatus('Completato!');
                if (btn) btn.disabled = false;
                setTimeout(clearExportProgressStatus, 3500);
            }, 100);
        }
    }
    processNextChunk();
}

// --- AGGIUNTA: Bottone nella sidebar ---
function addExportSyntheticCrowdedButton() {
    if (!sidebarContainerElement) return;
    // Se non in debug mode, non mostrare nulla
    if (!DEBUG_MODE) {
        // Se esiste già, rimuovi bottone e stato
        const btn = document.getElementById('export-synthetic-crowded-btn');
        if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
        const status = document.getElementById('export-synthetic-crowded-status');
        if (status && status.parentNode) status.parentNode.removeChild(status);
        return;
    }
    let btn = document.getElementById('export-synthetic-crowded-btn');
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'export-synthetic-crowded-btn';
        btn.textContent = 'Scarica CSV punti synthetic crowded (168h)';
        btn.className = 'btn export-btn';
        btn.onclick = exportSyntheticCrowdedCSV;
        sidebarContainerElement.insertBefore(btn, sidebarContainerElement.firstChild);
    }
    // Aggiungi/crea lo stato sopra il bottone
    setExportProgressStatus('');
}