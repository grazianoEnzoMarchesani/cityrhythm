import { hourToLabel, getDateTimeFromIndex, calculateAveragePresenceForFeature } from '../utils/utils.js';
import { getPoiData } from '../data/data-loader.js';
import { 
  CHART_COLORS, 
  PRESENCE_POINTS_SOURCE_ID,
  CHART_PALETTE
} from '../data/config.js';
import { setKmlFeatureSelectedState, getMapInstance } from '../map/map-setup.js';
import { updateTagCloud } from './tag-cloud.js';
import { getSpotMapperData, getCrowdedData } from '../data/data-loader.js';
import { getCrowdednessColumnName, generateSyntheticCrowdedPointsGeoJson } from '../map/map-layers.js';
import { exportArrayToCSV } from '../utils/utils.js';
import { DEBUG_MODE } from '../data/config.js';

let sidebarContainerElement = null;
let sidebarContentElement = null;
let statusMessageElement = null;

const kmlChartInstances = {};

let selectedKmlFeature = null;
let lastKmlTimelineHour = -1;

// --- FUNZIONI ESPORTATE ---
export function initializeSidebar(contentElement) {
    sidebarContentElement = contentElement;
    sidebarContainerElement = sidebarContentElement?.closest('#sidebar');
    if (sidebarContainerElement) {
        statusMessageElement = sidebarContainerElement.querySelector('#status-message');
    } else {
        console.error("Could not find #sidebar container for status message.");
    }
    if (!sidebarContentElement) {
        console.error("Sidebar content element not provided to initializeSidebar.");
        return;
    }
    if (!statusMessageElement) {
        console.warn("Status message element not found in sidebar.");
    }
    window.addEventListener('resize', resizeActiveCharts);
    addChartClickListeners();
    if (DEBUG_MODE) console.log("Sidebar UI Initialized.");
    addExportSyntheticCrowdedButton();
}

export function updateStatusMessage(message, isError = false) {
    if (statusMessageElement) {
        statusMessageElement.innerHTML = `<p${isError ? ' style="color:red; font-weight: bold;"' : ''}>${message || ""}</p>`;
    } else {
        const level = isError ? 'error' : 'log';
        console[level]("Status:", message);
    }
}

export function resetSidebar() {
    clearSidebarContent();
}

export function displayKmlFeatureInfoAndCalculateAverages(kmlFeature, timelineHourIndex) {
    if (!sidebarContentElement) return;
    if (!kmlFeature || !kmlFeature.properties || !kmlFeature.geometry) {
        if (DEBUG_MODE) console.warn("displayKmlFeatureInfoAndCalculateAverages called without valid KML feature.");
        clearSidebarContent();
        updateStatusMessage("Invalid KML area data.", true);
        return;
    }
    const kmlProperties = kmlFeature.properties;
    const featureId = kmlFeature.id;
    const isSameKml = selectedKmlFeature?.id === featureId;
    clearSidebarContent(false, isSameKml);
    selectedKmlFeature = kmlFeature;
    lastKmlTimelineHour = -1;
    setKmlFeatureSelectedState(featureId);
    if (!kmlProperties.poi_data_available) {
        const kmlName = kmlProperties.kml_name || "Unnamed KML Area";
        let htmlContent = `<h3>${kmlName}</h3>`;
        if (kmlProperties.description) {
            const tempDiv = document.createElement('div'); tempDiv.innerHTML = kmlProperties.description;
            const cleanDescription = tempDiv.textContent || tempDiv.innerText || "";
            if (cleanDescription.trim()) { htmlContent += `<p style="font-size: 0.9em;"><em>${cleanDescription.trim()}</em></p>`; }
        }
        htmlContent += `<p style="text-align: center; margin-top: 20px;">This area does not have historical data (POI) available. Information about visitor presence and demographic characteristics is only available for areas with associated historical records.</p>`;
        sidebarContentElement.innerHTML = htmlContent;
        updateStatusMessage(`Details for area ${kmlName} (no POI data).`);
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
    Object.keys(kmlChartInstances).forEach(chartId => {
        try { kmlChartInstances[chartId]?.dispose(); } catch (e) {}
        delete kmlChartInstances[chartId];
    });
    if (!preserveKmlSelection) {
        setKmlFeatureSelectedState(null);
        selectedKmlFeature = null;
        lastKmlTimelineHour = -1;
    }
    if (showDefaultMessage) {
        sidebarContentElement.innerHTML = `
        <div style="padding: 30px 10px; text-align: center;">
            <svg width="60" height="60" viewBox="0 0 24 24" style="margin-bottom: 15px; opacity: 0.3;">
                <path fill="currentColor" d="M12 2C8.14 2 5 5.14 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.86-3.14-7-7-7zm0 10.5c-1.93 0-3.5-1.57-3.5-3.5S10.07 6.5 12 6.5s3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/>
            </svg>
            <p style="margin-bottom: 15px; opacity: 0.75;">Select an area on the map to view historical footfall data, demographic distribution and prevalent interests of visitors.</p>
            <p style="font-size: 0.9em; opacity: 0.5;">Data is displayed based on day of week and hour</p>
        </div>`;
    }
}

function calculateAndDisplayAverages(kmlFeature, timelineHourIndex) {
    if (!kmlFeature || !kmlFeature.properties || !kmlFeature.geometry) {
        if (DEBUG_MODE) console.warn("calculateAndDisplayAverages: Invalid KML feature.");
        clearSidebarContent(false, true);
        sidebarContentElement.innerHTML = `<h3>${kmlFeature?.properties?.kml_name || 'Selected Area'}</h3><p style="text-align: center;">Internal error or invalid KML data.</p>`;
        return;
    }
    if (!kmlFeature.properties.poi_data_available) {
        if (DEBUG_MODE) console.warn("calculateAndDisplayAverages: Called for KML without POI data.");
        clearSidebarContent(false, true);
        sidebarContentElement.innerHTML = `<h3>${kmlFeature.properties.kml_name || 'Selected Area'}</h3><p style="text-align: center;">This area does not have historical data (POI) available. Information about visitor presence and demographic characteristics is only available for areas with associated historical records.</p>`;
        lastKmlTimelineHour = timelineHourIndex;
        return;
    }

    const kmlProperties = kmlFeature.properties;
    const poiName = kmlProperties.poi_name;
    const allPoiData = getPoiData();
    const poiRecords = allPoiData[poiName?.trim().toLowerCase()];

    if (!poiRecords || poiRecords.length === 0) {
        if (DEBUG_MODE) console.warn(`No POI records found for ${poiName}.`);
        const kmlName = kmlProperties.kml_name || "KML Area";
        clearSidebarContent(false, true);
        sidebarContentElement.innerHTML = `<h3>${kmlName}</h3><p style="text-align: center;">Associated data exists for this area, but no specific records were found. This could be due to a temporary issue accessing the data or a configuration error. Please try again later or contact the system administrator.</p>`;
        updateStatusMessage(`No POI data for ${kmlName}.`);
        lastKmlTimelineHour = timelineHourIndex;
        return;
    }

    const { jsDayOfWeek, hour } = getDateTimeFromIndex(timelineHourIndex);
    const currentTimelineLabel = hourToLabel(timelineHourIndex);

    // --- AGGIUNTA: filtro per range date selezionato ---
    let dateMin = null, dateMax = null;
    if (typeof window !== 'undefined' && window.selectedDateRange) {
        dateMin = window.selectedDateRange.min instanceof Date ? window.selectedDateRange.min : null;
        dateMax = window.selectedDateRange.max instanceof Date ? window.selectedDateRange.max : null;
    }

    let filteredRecords;
    if (dateMin && dateMax && ((dateMax - dateMin) / (1000 * 3600 * 24)) < 7) {
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
            const formattedDate = recordDate instanceof Date ? recordDate.toLocaleDateString() : 'N/A';
            
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
                        absoluteMinPresence.date = rec.parsedDate instanceof Date ? rec.parsedDate.toLocaleDateString() : 'N/A';
                        absoluteMinPresence.hour = h;
                    }
                    if (val > absoluteMaxPresence.value) {
                        absoluteMaxPresence.value = val;
                        absoluteMaxPresence.date = rec.parsedDate instanceof Date ? rec.parsedDate.toLocaleDateString() : 'N/A';
                        absoluteMaxPresence.hour = h;
                    }
                }
            }
        });
    }
    
    // Ora prepariamo il contenuto HTML
    const kmlName = kmlProperties.kml_name || "KML Area";
    
    // Determiniamo se stiamo aggiornando la stessa KML o cambiando area
    const isUpdateForSameKml = lastKmlTimelineHour !== -1 && selectedKmlFeature?.id === kmlFeature.id;

    if (!isUpdateForSameKml) {
        // Reset completo solo se cambiamo KML feature
        clearSidebarContent(false, true);

        let htmlContent = `<h3>${kmlName}</h3>`;
        htmlContent += `<p style="font-size: 0.9em; text-align:center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #f0f0f0;">
                            Showing average data for: <strong>${currentTimelineLabel}</strong><br>
                            (Based on ${count} matching day(s))
                            <br><span style="font-style: italic; font-size: 0.85em; opacity: 0.6;">Shows historical statistics for this area on selected day and time</span>
                        </p>`;

        if (count > 0) {
            htmlContent += `<style>
                                .chart-container {
                                    position: relative;
                                    width: 100%;
                                    margin-bottom: 20px;
                                }
                                .stat-details {
                                    font-size: 0.8em;
                                    margin: 10px 0;
                                    padding: 10px;
                                    background-color: #f5f5f5;
                                    border-radius: 5px;
                                    display: flex;
                                    justify-content: space-between;
                                }
                                .stat-min, .stat-max {
                                    flex: 1;
                                    text-align: center;
                                }
                                .stat-value {
                                    font-weight: bold;
                                }
                                .stat-date {
                                    font-size: 0.9em;
                                    color: #666;
                                }
                            </style>
                            <h4>Avg. Presence</h4>
                            <p class="chart-description">Average number of people detected in this area at this specific time of the week. This data represents the typical footfall based on historical observations.</p>
                            <p id="presenze-value" style="text-align: center;">
                                <strong>${averages.presenzeOra?.toFixed(1) || '0.0'}</strong>
                            </p>
                            <div class="stat-details">
                                <div class="stat-min">
                                    <div>Min: <span class="stat-value">${stats.presenzeOra.min.value.toFixed(1)}</span></div>
                                    <div class="stat-date">${stats.presenzeOra.min.date || 'N/A'}</div>
                                </div>
                                <div class="stat-max">
                                    <div>Max: <span class="stat-value">${stats.presenzeOra.max.value.toFixed(1)}</span></div>
                                    <div class="stat-date">${stats.presenzeOra.max.date || 'N/A'}</div>
                                </div>
                            </div>
                            <div class="stat-details">
                                <div class="stat-min">
                                    <div>Min assoluto: <span class="stat-value">${absoluteMinPresence.value !== Infinity ? absoluteMinPresence.value.toFixed(1) : 'N/A'}</span></div>
                                    <div class="stat-date">${absoluteMinPresence.date || 'N/A'} ${absoluteMinPresence.hour !== null ? ('- ' + absoluteMinPresence.hour + ':00') : ''}</div>
                                </div>
                                <div class="stat-max">
                                    <div>Max assoluto: <span class="stat-value">${absoluteMaxPresence.value !== -Infinity ? absoluteMaxPresence.value.toFixed(1) : 'N/A'}</span></div>
                                    <div class="stat-date">${absoluteMaxPresence.date || 'N/A'} ${absoluteMaxPresence.hour !== null ? ('- ' + absoluteMaxPresence.hour + ':00') : ''}</div>
                                </div>
                            </div>
                            <div id="real-presence-bar-chart" style="height: 180px; margin-bottom: 25px;"></div>
                            <div id="tag-cloud-placeholder"></div>
                            <h4>Average Interests</h4>
                            <p class="chart-description">Prevalent interest categories among visitors to the area, based on affinity indices. This data indicates the preferences, hobbies and purchasing behaviours of people who frequent this area.</p>
                            <div id="interests-chart" style="height: 280px; margin-bottom: 25px;"></div>
                            <h4>Average Demographics</h4>
                            <p class="chart-description">Demographic distribution of visitors by gender and age. The charts show the average percentages of men/women and the age breakdown of people who visit this area.</p>
                            <div class="chart-row">
                                <div id="gender-chart" style="width: 48%; height: 200px;"></div>
                                <div id="age-chart" style="width: 48%; height: 200px;"></div>
                            </div>
                            <div class="stat-details">
                                <div class="stat-min">
                                    <div>Min Male: <span class="stat-value">${stats.percM.min.value.toFixed(1)}%</span> (${stats.percM.min.date || 'N/A'})</div>
                                    <div>Min Female: <span class="stat-value">${stats.percF.min.value.toFixed(1)}%</span> (${stats.percF.min.date || 'N/A'})</div>
                                </div>
                                <div class="stat-max">
                                    <div>Max Male: <span class="stat-value">${stats.percM.max.value.toFixed(1)}%</span> (${stats.percM.max.date || 'N/A'})</div>
                                    <div>Max Female: <span class="stat-value">${stats.percF.max.value.toFixed(1)}%</span> (${stats.percF.max.date || 'N/A'})</div>
                                </div>
                            </div>
                            <div id="real-gender-bar-chart" style="height: 180px; margin-bottom: 25px;"></div>
                            <div id="real-age-bar-chart" style="height: 180px; margin-bottom: 25px;"></div>
                            <div id="nationality-chart" style="height: 200px; margin-bottom: 25px;"></div>
                            <div class="stat-details">
                                <div class="stat-min">
                                    <div>Min Italians: <span class="stat-value">${stats.percItaliani.min.value.toFixed(1)}%</span> (${stats.percItaliani.min.date || 'N/A'})</div>
                                    <div>Min Foreigners: <span class="stat-value">${stats.percStranieri.min.value.toFixed(1)}%</span> (${stats.percStranieri.min.date || 'N/A'})</div>
                                </div>
                                <div class="stat-max">
                                    <div>Max Italians: <span class="stat-value">${stats.percItaliani.max.value.toFixed(1)}%</span> (${stats.percItaliani.max.date || 'N/A'})</div>
                                    <div>Max Foreigners: <span class="stat-value">${stats.percStranieri.max.value.toFixed(1)}%</span> (${stats.percStranieri.max.date || 'N/A'})</div>
                                </div>
                            </div>
                            <div id="real-nationality-bar-chart" style="height: 180px; margin-bottom: 25px;"></div>
                            <h4>Average Origin (Top 6 Prov, Top 5 Nat)</h4>
                            <p class="chart-description">Geographic origin of visitors divided by Italian provinces (top 6) and countries (top 5). This data helps understand which geographic areas the visitors of the selected area come from.</p>
                            <div id="province-chart" style="height: 200px; margin-bottom: 20px;"></div>
                            <div id="country-chart" style="height: 200px; margin-bottom: 25px;"></div>
                            <h4>Average Visit Frequency</h4>
                            <p class="chart-description">Average frequency of repeat visits to this area. The chart shows how many people return once, twice, etc., providing an indication of visitor loyalty and habits.</p>
                            <div id="visits-chart" style="height: 200px; margin-bottom: 25px;"></div>
                            <div id="real-visits-bar-chart" style="height: 180px; margin-bottom: 25px;"></div>
                            `;
        } else {
             htmlContent += `<p style="text-align: center; opacity: 0.6; margin-top: 30px;">No historical data available for this specific day and time. Try selecting a different moment in the timeline to view statistics for other days or times.</p>`;
        }
        sidebarContentElement.innerHTML = htmlContent;
    } else {
        const timelineInfoEl = sidebarContentElement.querySelector('p[style*="border-bottom"]');
        if (timelineInfoEl) {
            timelineInfoEl.innerHTML = `Showing average data for: <strong>${currentTimelineLabel}</strong><br>
                                       (Based on ${count} matching day(s))
                                       <br><span style="font-style: italic; font-size: 0.85em; opacity: 0.6;">Shows historical statistics for this area on selected day and time</span>`;
        }

        const presenzeEl = document.getElementById('presenze-value');
        if (presenzeEl) {
            presenzeEl.innerHTML = `<strong>${averages.presenzeOra?.toFixed(1) || '0.0'}</strong>`;
        }
        
        // Aggiorna i dettagli delle statistiche
        const statDetailsElements = sidebarContentElement.querySelectorAll('.stat-details');
        if (statDetailsElements.length > 0) {
            // Aggiorna dettagli presenze
            const presenzeDetails = statDetailsElements[0];
            presenzeDetails.innerHTML = `
                <div class="stat-min">
                    <div>Min: <span class="stat-value">${stats.presenzeOra.min.value.toFixed(1)}</span></div>
                    <div class="stat-date">${stats.presenzeOra.min.date || 'N/A'}</div>
                </div>
                <div class="stat-max">
                    <div>Max: <span class="stat-value">${stats.presenzeOra.max.value.toFixed(1)}</span></div>
                    <div class="stat-date">${stats.presenzeOra.max.date || 'N/A'}</div>
                </div>
            `;
            
            // Aggiorna dettagli presenze assolute (min/max tra tutte le ore)
            if (statDetailsElements[1]) {
                // Il secondo elemento può essere quello delle presenze assolute
                // Verifica se contiene "Min assoluto" nel testo
                if (statDetailsElements[1].textContent.includes('Min assoluto')) {
                    statDetailsElements[1].innerHTML = `
                        <div class="stat-min">
                            <div>Min assoluto: <span class="stat-value">${absoluteMinPresence.value !== Infinity ? absoluteMinPresence.value.toFixed(1) : 'N/A'}</span></div>
                            <div class="stat-date">${absoluteMinPresence.date || 'N/A'} ${absoluteMinPresence.hour !== null ? ('- ' + absoluteMinPresence.hour + ':00') : ''}</div>
                        </div>
                        <div class="stat-max">
                            <div>Max assoluto: <span class="stat-value">${absoluteMaxPresence.value !== -Infinity ? absoluteMaxPresence.value.toFixed(1) : 'N/A'}</span></div>
                            <div class="stat-date">${absoluteMaxPresence.date || 'N/A'} ${absoluteMaxPresence.hour !== null ? ('- ' + absoluteMaxPresence.hour + ':00') : ''}</div>
                        </div>
                    `;
                }
            }
            
            // Aggiorna dettagli genere
            // Trova il box giusto per genere (può essere il secondo o terzo)
            const genderDetailsIndex = statDetailsElements[1].textContent.includes('Min Male') ? 1 : 
                                      (statDetailsElements[2] && statDetailsElements[2].textContent.includes('Min Male') ? 2 : -1);
            
            if (genderDetailsIndex !== -1 && statDetailsElements[genderDetailsIndex]) {
                statDetailsElements[genderDetailsIndex].innerHTML = `
                    <div class="stat-min">
                        <div>Min Male: <span class="stat-value">${stats.percM.min.value.toFixed(1)}%</span> (${stats.percM.min.date || 'N/A'})</div>
                        <div>Min Female: <span class="stat-value">${stats.percF.min.value.toFixed(1)}%</span> (${stats.percF.min.date || 'N/A'})</div>
                    </div>
                    <div class="stat-max">
                        <div>Max Male: <span class="stat-value">${stats.percM.max.value.toFixed(1)}%</span> (${stats.percM.max.date || 'N/A'})</div>
                        <div>Max Female: <span class="stat-value">${stats.percF.max.value.toFixed(1)}%</span> (${stats.percF.max.date || 'N/A'})</div>
                    </div>
                `;
            }
            
            // Aggiorna dettagli nazionalità
            // Trova il box giusto per nazionalità 
            const nationalityDetailsIndex = Array.from(statDetailsElements).findIndex(el => 
                el.textContent.includes('Min Italians'));
            
            if (nationalityDetailsIndex !== -1 && statDetailsElements[nationalityDetailsIndex]) {
                statDetailsElements[nationalityDetailsIndex].innerHTML = `
                    <div class="stat-min">
                        <div>Min Italians: <span class="stat-value">${stats.percItaliani.min.value.toFixed(1)}%</span> (${stats.percItaliani.min.date || 'N/A'})</div>
                        <div>Min Foreigners: <span class="stat-value">${stats.percStranieri.min.value.toFixed(1)}%</span> (${stats.percStranieri.min.date || 'N/A'})</div>
                    </div>
                    <div class="stat-max">
                        <div>Max Italians: <span class="stat-value">${stats.percItaliani.max.value.toFixed(1)}%</span> (${stats.percItaliani.max.date || 'N/A'})</div>
                        <div>Max Foreigners: <span class="stat-value">${stats.percStranieri.max.value.toFixed(1)}%</span> (${stats.percStranieri.max.date || 'N/A'})</div>
                    </div>
                `;
            }
            
            // Aggiorna dettagli visite
            // Trova il box giusto per visite
            const visitsDetailsIndex = Array.from(statDetailsElements).findIndex(el => 
                el.textContent.includes('Min 1 visit'));
            
            if (visitsDetailsIndex !== -1 && statDetailsElements[visitsDetailsIndex]) {
                statDetailsElements[visitsDetailsIndex].innerHTML = `
                    <div class="stat-min">
                        <div>Min 1 visit: <span class="stat-value">${stats.visite1.min.value.toFixed(1)}%</span></div>
                        <div>Min 2 visits: <span class="stat-value">${stats.visite2.min.value.toFixed(1)}%</span></div>
                        <div>Min 3 visits: <span class="stat-value">${stats.visite3.min.value.toFixed(1)}%</span></div>
                    </div>
                    <div class="stat-max">
                        <div>Max 1 visit: <span class="stat-value">${stats.visite1.max.value.toFixed(1)}%</span></div>
                        <div>Max 2 visits: <span class="stat-value">${stats.visite2.max.value.toFixed(1)}%</span></div>
                        <div>Max 3 visits: <span class="stat-value">${stats.visite3.max.value.toFixed(1)}%</span></div>
                    </div>
                `;
            }
        }
    }

    if (count > 0) {
        updateOrCreateDemographicCharts(averages);
        updateOrCreateGeographicCharts(averages);
        updateOrCreateVisitsChart(averages);
        // Sposto la tag cloud subito dopo il grafico delle presenze e prima del grafico degli interessi
        const tagCloudPlaceholder = document.getElementById('tag-cloud-placeholder');
        if (tagCloudPlaceholder) {
            // Rimuovo eventuali tag cloud esistenti
            const existingTagClouds = sidebarContentElement.querySelectorAll('.tag-cloud-container');
            existingTagClouds.forEach(cloud => cloud.remove());
            // Creo la tag cloud nel punto giusto
            updateTagCloud(timelineHourIndex, kmlFeature.id, tagCloudPlaceholder);
        }
        updateOrCreateInterestsChart(averages);
        createOrUpdateRealBarCharts(filteredRecords, hour);
        updateStatusMessage(`Sidebar averages for ${kmlName} (${currentTimelineLabel}) loaded.`);
    }

    lastKmlTimelineHour = timelineHourIndex;
    setTimeout(() => resizeActiveCharts(), 100);
}

function resizeActiveCharts() {
    if (sidebarContentElement) {
        sidebarContentElement.querySelectorAll('div[id$="-chart"]').forEach(chartEl => {
            const chartId = chartEl.id;
            if (kmlChartInstances[chartId]) {
                try { kmlChartInstances[chartId].resize(); } catch(e) { console.warn(`Error resizing chart ${chartId}:`, e.message); }
            }
        });
    }
}

function createAndRegisterChart(domId, options, errorMessage = "Data not available.") {
    const chartDom = document.getElementById(domId);
    if (!chartDom) return null;

    const hasValidData = (opts) => {
        if (!opts || !opts.series || !Array.isArray(opts.series)) return false;
        return opts.series.some(s => s && s.data && Array.isArray(s.data) && s.data.length > 0 &&
            (s.type !== 'pie' || s.data.some(d => (typeof d === 'number' && d > 0) || (typeof d === 'object' && d && d.value > 0))) &&
            (s.type === 'pie' || s.data.some(d => (typeof d === 'number') || (typeof d === 'object' && d && typeof d.value === 'number')))
        );
    };

    if (kmlChartInstances[domId]) {
        if (!hasValidData(options)) {
            chartDom.innerHTML = `<p style="text-align: center; opacity: 0.6; padding: 20px;">${errorMessage}</p>`;
            try { kmlChartInstances[domId].dispose(); } catch(e) {}
            delete kmlChartInstances[domId];
            return null;
        }

        try {
            options.animation = true;
            options.animationEasing = 'cubicInOut';

            // Apply elegant styling to all charts
            styleChartOptions(options);

            kmlChartInstances[domId].setOption(options, {
                notMerge: true,
                replaceMerge: ['series'],
                lazyUpdate: false,
            });
            return kmlChartInstances[domId];
        } catch (e) {
            console.error(`Error updating chart #${domId}:`, e);
            try { kmlChartInstances[domId].dispose(); } catch(e) {}
            delete kmlChartInstances[domId];
        }
    }

    chartDom.innerHTML = '';

    if (!hasValidData(options)) {
        chartDom.innerHTML = `<p style="text-align: center; opacity: 0.6; padding: 20px;">${errorMessage}</p>`;
        return null;
    }

    try {
        const chart = echarts.init(chartDom);
        options.animation = true;
        options.animationEasing = 'cubicInOut';
        
        // Apply elegant styling to the chart
        styleChartOptions(options);

        if (options.series && Array.isArray(options.series)) {
            options.series.forEach(series => {
                series.animation = true;
                series.animationEasing = 'cubicInOut';
                if (series.type === 'pie' || series.type === 'bar') {
                    series.animationDelay = idx => idx * 30;
                    series.animationDurationUpdate = 500;
                }
            });
        }

        chart.setOption(options);
        
        chart.on('click', () => {
            handleChartClick(domId);
        });

        kmlChartInstances[domId] = chart;
        return chart;
    } catch (e) {
        console.error(`Error creating chart #${domId}:`, e);
        chartDom.innerHTML = "<p style='opacity: 0.6; text-align: center;'>Error loading chart.</p>";
        kmlChartInstances[domId] = null;
        return null;
    }
}

// Function to enhance chart styling
function styleChartOptions(options) {
    // Style the title
    if (options.title) {
        options.title.textStyle = {
            fontSize: 13,
            fontWeight: 'normal',
            fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            color: '#000',
            opacity: 0.85
        };
        options.title.padding = [5, 0, 15, 0];
        options.title.left = 'left';
    }
    
    // Style the tooltip
    if (options.tooltip) {
        options.tooltip.backgroundColor = 'rgba(255, 255, 255, 0.95)';
        options.tooltip.borderColor = '#f0f0f0';
        options.tooltip.borderWidth = 1;
        options.tooltip.textStyle = {
            color: '#000',
            fontSize: 12
        };
        options.tooltip.shadowBlur = 5;
        options.tooltip.shadowColor = 'rgba(0, 0, 0, 0.05)';
        options.tooltip.shadowOffsetX = 0;
        options.tooltip.shadowOffsetY = 2;
    }
    
    // Style the legend
    if (options.legend) {
        options.legend.textStyle = {
            fontSize: 10, 
            color: '#000',
            opacity: 0.7
        };
        options.legend.itemWidth = 12;
        options.legend.itemHeight = 8;
        options.legend.itemGap = 8;
        options.legend.padding = [5, 5, 5, 5];
    }
    
    // Style the series
    if (options.series && Array.isArray(options.series)) {
        options.series.forEach(series => {
            if (series.type === 'pie') {
                series.itemStyle = {
                    borderRadius: 4,
                    borderColor: '#fff',
                    borderWidth: 1.5,
                    shadowBlur: 2,
                    shadowColor: 'rgba(0, 0, 0, 0.1)'
                };
                
                series.label = { show: false, position: 'center' };
                
                series.emphasis = { 
                    label: { 
                        show: true, 
                        fontSize: 13, 
                        fontWeight: 'normal',
                        color: '#000',
                        formatter: '{b}\n{c}%' 
                    },
                    itemStyle: {
                        shadowBlur: 5,
                        shadowColor: 'rgba(0, 0, 0, 0.1)'
                    }
                };
                
                series.labelLine = { show: false };
            } else if (series.type === 'bar') {
                // SOLO se non già definito, aggiungi itemStyle
                if (!series.itemStyle) {
                    series.itemStyle = {
                        borderRadius: [3, 3, 3, 3],
                        shadowBlur: 2,
                        shadowColor: 'rgba(0, 0, 0, 0.05)'
                    };
                } else {
                    // Non sovrascrivere color se già presente
                    series.itemStyle.borderRadius = [3, 3, 3, 3];
                    series.itemStyle.shadowBlur = 2;
                    series.itemStyle.shadowColor = 'rgba(0, 0, 0, 0.05)';
                }
            }
        });
    }
}

function updateOrCreateDemographicCharts(avgData) {
    const genderData = [
        { name: 'Male', value: parseFloat(avgData.percM?.toFixed(1)) || 0 },
        { name: 'Female', value: parseFloat(avgData.percF?.toFixed(1)) || 0 }
    ].filter(d => !isNaN(d.value));
    
    const genderOption = {
        title: { text: 'Avg. Gender (%)', left: 'left', textStyle: { fontSize: 14, fontWeight: 'normal' }, top: 0, padding: [5, 0, 0, 0] },
        tooltip: { trigger: 'item', formatter: '{b}: {c}%' },
        legend: { bottom: 0, left: 'center', data: genderData.map(d => d.name), itemGap: 10, textStyle: { fontSize: 10 } },
        color: [CHART_COLORS.GENDER_CHART.MALE, CHART_COLORS.GENDER_CHART.FEMALE],
        series: [{
            name: 'Avg. Gender', type: 'pie', radius: ['40%', '70%'], center: ['50%', '50%'], avoidLabelOverlap: false,
            itemStyle: {
                borderRadius: 5,
                borderColor: '#fff',
                borderWidth: 2
            },
            label: { show: false, position: 'center' }, 
            emphasis: { 
                label: { show: true, fontSize: '14', fontWeight: 'bold', formatter: '{b}\n{c}%' } 
            }, 
            labelLine: { show: false },
            data: genderData
        }],
        grid: { containLabel: true }
    };
    createAndRegisterChart('gender-chart', genderOption, "Gender data N/A.");

    const ageData = [
        { name: '18-24', value: parseFloat(avgData.perc18_24?.toFixed(1)) || 0 }, { name: '25-34', value: parseFloat(avgData.perc25_34?.toFixed(1)) || 0 },
        { name: '35-44', value: parseFloat(avgData.perc35_44?.toFixed(1)) || 0 }, { name: '45-54', value: parseFloat(avgData.perc45_54?.toFixed(1)) || 0 },
        { name: '55-64', value: parseFloat(avgData.perc55_64?.toFixed(1)) || 0 }, { name: '65+', value: parseFloat(avgData.perc65plus?.toFixed(1)) || 0 }
    ].filter(d => !isNaN(d.value));
    
    const ageOption = {
        title: { text: 'Avg. Age (%)', left: 'left', textStyle: { fontSize: 14, fontWeight: 'normal' }, top: 0, padding: [5, 0, 0, 0] },
        tooltip: { trigger: 'item', formatter: '{b}: {c}%' },
        legend: { bottom: 0, left: 'center', data: ageData.map(d => d.name), itemGap: 5, textStyle: { fontSize: 9 }, itemWidth: 15, itemHeight: 10 },
        color: Object.values(CHART_COLORS.AGE_CHART),
        series: [{
            name: 'Avg. Age', 
            type: 'pie', 
            radius: ['40%', '70%'], 
            center: ['50%', '50%'], 
            avoidLabelOverlap: false,
            itemStyle: {
                borderRadius: 5,
                borderColor: '#fff',
                borderWidth: 2
            },
            label: { show: false, position: 'center' }, 
            emphasis: { 
                label: { show: true, fontSize: '14', fontWeight: 'bold', formatter: '{b}\n{c}%' } 
            }, 
            labelLine: { show: false },
            data: ageData
        }],
        grid: { containLabel: true }
    };
    createAndRegisterChart('age-chart', ageOption, "Age data N/A.");

    const natData = [
        { name: 'Italians', value: parseFloat(avgData.percItaliani?.toFixed(1)) || 0 },
        { name: 'Foreigners', value: parseFloat(avgData.percStranieri?.toFixed(1)) || 0 }
    ].filter(d => !isNaN(d.value));
    
    const nationalityColors = [
        CHART_COLORS.NATIONALITY_CHART.ITALIANS,
        CHART_COLORS.NATIONALITY_CHART.FOREIGNERS
    ];
    const nationalityOption = {
        title: { text: 'Avg. Nationality (%)', left: 'left', textStyle: { fontSize: 14, fontWeight: 'normal' }, top: 0, padding: [5, 0, 0, 0] },
        tooltip: { trigger: 'item', formatter: '{b}: {c}%' },
        legend: { bottom: 0, left: 'center', data: natData.map(d => d.name), itemGap: 10, textStyle: { fontSize: 10 } },
        color: nationalityColors,
        series: [{
            name: 'Avg. Nationality', type: 'pie', radius: ['40%', '70%'], center: ['50%', '50%'], avoidLabelOverlap: false,
            itemStyle: {
                borderRadius: 5,
                borderColor: '#fff',
                borderWidth: 2
            },
            label: { show: false, position: 'center' }, 
            emphasis: { 
                label: { show: true, fontSize: '14', fontWeight: 'bold', formatter: '{b}\n{c}%' } 
            }, 
            labelLine: { show: false },
            data: natData
        }],
        grid: { containLabel: true }
    };
    createAndRegisterChart('nationality-chart', nationalityOption, "Nationality data N/A.");
}

function updateOrCreateGeographicCharts(avgData) {
    // Gestione Province
    let provincesData = Object.entries(avgData.provinces || {})
        .map(([name, value]) => ({ name, value: parseFloat(value?.toFixed(1)) || 0 }))
        .filter(d => !isNaN(d.value) && d.value > 0.1)
        .sort((a, b) => b.value - a.value);

    // Calcola la somma delle province esistenti
    const sumProvinces = provincesData.reduce((sum, p) => sum + p.value, 0);
    
    // Se non c'è Ascoli Piceno e la somma è minore di 100, aggiungiamo Ascoli
    if (!provincesData.some(p => p.name.toLowerCase().includes('ascoli')) && sumProvinces < 100) {
        provincesData.push({ 
            name: 'Ascoli Piceno', 
            value: parseFloat((100 - sumProvinces).toFixed(1))
        });
    }
    
    // Ordina per valore decrescente e prendi le prime 6
    provincesData = provincesData
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);

    const provinceOption = {
        title: { text: 'Avg. Provinces (Top 6)', left: 'left', textStyle: { fontSize: 14, fontWeight: 'normal' }, top: 0, padding: [5, 0, 0, 0] },
        tooltip: { trigger: 'item', formatter: '{b}: {c}%' },
        legend: { 
            bottom: 0, 
            left: 'center', 
            data: provincesData.map(p => p.name), 
            itemGap: 5, 
            textStyle: { fontSize: 9 },
            itemWidth: 15,
            itemHeight: 10,
            selected: Object.fromEntries(provincesData.map(p => [p.name, p.name !== 'Ascoli Piceno'])) // Ascoli Piceno spento di default
        },
        color: provincesData.map((p, index) => {
            if (p.name.toLowerCase().includes('ascoli')) {
                return CHART_COLORS.PROVINCE_CHART.ASCOLI_PICENO;
            }
            const provinceKeys = ['PROVINCE_1', 'PROVINCE_2', 'PROVINCE_3', 'PROVINCE_4', 'PROVINCE_5', 'PROVINCE_6'];
            return CHART_COLORS.PROVINCE_CHART[provinceKeys[index]] || '#ccc';
        }),
        series: [{
            name: 'Avg. Percentage', 
            type: 'pie', 
            radius: ['40%', '70%'], 
            center: ['50%', '50%'], 
            avoidLabelOverlap: false,
            itemStyle: {
                borderRadius: 5,
                borderColor: '#fff',
                borderWidth: 2
            },
            label: { show: false, position: 'center' }, 
            emphasis: { 
                label: { show: true, fontSize: '14', fontWeight: 'bold', formatter: '{b}\n{c}%' } 
            }, 
            labelLine: { show: false },
            data: provincesData
        }],
        grid: { containLabel: true }
    };
    createAndRegisterChart('province-chart', provinceOption, "Province data N/A.");

    // Gestione Countries
    let countriesData = Object.entries(avgData.countries || {})
        .map(([name, value]) => ({ name, value: parseFloat(value?.toFixed(1)) || 0 }))
        .filter(d => !isNaN(d.value) && d.value > 0.1)
        .sort((a, b) => b.value - a.value);
    
    // Calcola la somma dei paesi stranieri
    const sumCountries = countriesData.reduce((sum, c) => sum + c.value, 0);
    
    // Se la somma è minore di 100, aggiungiamo l'Italia
    if (sumCountries < 100) {
        countriesData.push({ 
            name: 'Italia', 
            value: parseFloat((100 - sumCountries).toFixed(1))
        });
    }
    
    // Ordina per valore decrescente e prendi i primi 5
    countriesData = countriesData
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

    const countryOption = {
        title: { text: 'Avg. Countries (Top 5)', left: 'left', textStyle: { fontSize: 14, fontWeight: 'normal' }, top: 0, padding: [5, 0, 0, 0] },
        tooltip: { trigger: 'item', formatter: '{b}: {c}%' },
        legend: { 
            bottom: 0, 
            left: 'center', 
            data: countriesData.map(c => c.name), 
            itemGap: 5, 
            textStyle: { fontSize: 9 },
            itemWidth: 15,
            itemHeight: 10,
            selected: Object.fromEntries(countriesData.map(c => [c.name, c.name !== 'Italia'])) // Italia spento di default
        },
        color: countriesData.map((c, index) => {
            if (c.name.toLowerCase() === 'italia') {
                return CHART_COLORS.COUNTRY_CHART.ITALY;
            }
            const countryKeys = ['COUNTRY_1', 'COUNTRY_2', 'COUNTRY_3', 'COUNTRY_4', 'COUNTRY_5'];
            return CHART_COLORS.COUNTRY_CHART[countryKeys[index]] || '#ccc';
        }),
        series: [{
            name: 'Avg. Percentage', 
            type: 'pie', 
            radius: ['40%', '70%'], 
            center: ['50%', '50%'], 
            avoidLabelOverlap: false,
            itemStyle: {
                borderRadius: 5,
                borderColor: '#fff',
                borderWidth: 2
            },
            label: { show: false, position: 'center' }, 
            emphasis: { 
                label: { show: true, fontSize: '14', fontWeight: 'bold', formatter: '{b}\n{c}%' } 
            }, 
            labelLine: { show: false },
            data: countriesData
        }],
        grid: { containLabel: true }
    };
    createAndRegisterChart('country-chart', countryOption, "Country data N/A.");
}

function updateOrCreateVisitsChart(avgData) {
    const visitData = [
        { name: '1 visit', value: parseFloat(avgData.visite1?.toFixed(1)) || 0 },
        { name: '2 visits', value: parseFloat(avgData.visite2?.toFixed(1)) || 0 },
        { name: '3 visits', value: parseFloat(avgData.visite3?.toFixed(1)) || 0 },
        { name: '4 visits', value: parseFloat(avgData.visite4?.toFixed(1)) || 0 },
        { name: '5+ visits', value: parseFloat(avgData.visite5?.toFixed(1)) || 0 }
    ].filter(d => !isNaN(d.value));
    const visitsColors = [
        CHART_COLORS.VISITS_CHART.VISIT_1,
        CHART_COLORS.VISITS_CHART.VISIT_2,
        CHART_COLORS.VISITS_CHART.VISIT_3,
        CHART_COLORS.VISITS_CHART.VISIT_4,
        CHART_COLORS.VISITS_CHART.VISIT_5
    ];
    const visitsOption = {
        title: { text: 'Number of visits (%)', left: 'left', textStyle: { fontSize: 14, fontWeight: 'normal' }, top: 0, padding: [5, 0, 0, 0] },
        tooltip: { trigger: 'item', formatter: '{b}: {c}%' },
        legend: { bottom: 0, left: 'center', data: visitData.map(d => d.name), itemGap: 5, textStyle: { fontSize: 9 }, itemWidth: 15, itemHeight: 10 },
        color: visitsColors,
        series: [{
            name: 'Visits', type: 'pie', radius: ['40%', '70%'], center: ['50%', '50%'], avoidLabelOverlap: false,
            itemStyle: {
                borderRadius: 5,
                borderColor: '#fff',
                borderWidth: 2
            },
            label: { show: false, position: 'center' }, 
            emphasis: { 
                label: { show: true, fontSize: '14', fontWeight: 'bold', formatter: '{b}\n{c}%' } 
            }, 
            labelLine: { show: false },
            data: visitData
        }],
        grid: { containLabel: true }
    };
    createAndRegisterChart('visits-chart', visitsOption, "Visits data not available.");
}

function updateOrCreateInterestsChart(avgData) {
    const interestData = Object.entries(avgData.interests || {})
        .map(([name, value]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' '),
            value: parseFloat(value?.toFixed(2)) || 0
        }))
        .filter(item => !isNaN(item.value))
        .sort((a, b) => a.value - b.value);
    
    const colors = interestData.map(item => {
        const interestName = item.name;
        return CHART_COLORS.INTERESTS_CHART[interestName] || '#ee6666';
    });
    
    const interestsOption = {
        title: { text: 'Avg. Interests (Affinity Index)', left: 'left', textStyle: { fontSize: 14, fontWeight: 'normal' }, top: 0, padding: [5, 0, 15, 0] },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: '{b}: {c}' },
        xAxis: { type: 'value', name: 'Avg. Index', nameLocation: 'end', nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 9 } },
        yAxis: { type: 'category', data: interestData.map(d => d.name), axisLabel: { fontSize: 9, interval: 0 } },
        series: [{ 
            name: 'Avg. Index', 
            type: 'bar', 
            data: interestData.map(d => d.value),
            itemStyle: {
                color: function(params) {
                    const interestName = interestData[params.dataIndex].name;
                    return CHART_COLORS.INTERESTS_CHART[interestName] || '#ee6666';
                },
                borderRadius: [5, 5, 5, 5]
            },
            barWidth: '60%' 
        }],
        grid: { left: '30%', right: '8%', bottom: '5%', top: '15%', containLabel: true },
        legend: { bottom: 0, left: 'center', show: false } // aggiunto per coerenza, ma nascosto
    };
    createAndRegisterChart('interests-chart', interestsOption, "Interest data N/A.");
}

function addChartClickListeners() {
    if (DEBUG_MODE) console.log("Inizializzazione dei listener per i grafici");
    const infoContent = document.getElementById('info-content');
    
    if (infoContent) {
        if (DEBUG_MODE) console.log("Aggiungo listener al contenitore dei grafici");
        infoContent.addEventListener('click', (event) => {
            // Trova il grafico più vicino al click
            const chartElement = event.target.closest('[id$="-chart"]');
            if (chartElement) {
                const chartId = chartElement.id;
                if (DEBUG_MODE) console.log(`Click rilevato su ${chartId}`);
                handleChartClick(chartId);
            }
        });
    } else {
        if (DEBUG_MODE) console.log("Contenitore dei grafici non trovato");
    }
}

function handleChartClick(chartId) {
    if (DEBUG_MODE) console.log("handleChartClick chiamata per:", chartId);
    
    if (!selectedKmlFeature) {
        if (DEBUG_MODE) console.log("Nessuna area KML selezionata");
        return;
    }

    const chart = kmlChartInstances[chartId];
    if (!chart) {
        if (DEBUG_MODE) console.log("Grafico non trovato:", chartId);
        return;
    }

    const chartData = chart.getOption().series[0].data;
    let colors = [];

    // Determina il tipo di grafico in base all'ID e assegna i colori corretti per ogni categoria
    if (chartId.includes('gender')) {
        colors = chartData.map(d => d && d.name ? CHART_COLORS.GENDER_CHART[d.name.toUpperCase()] : undefined);
    } else if (chartId.includes('age')) {
        colors = chartData.map(d => d && d.name ? CHART_COLORS.AGE_CHART[d.name] : undefined);
    } else if (chartId.includes('nationality')) {
        colors = chartData.map(d => d && d.name ? CHART_COLORS.NATIONALITY_CHART[d.name.toUpperCase()] : undefined);
    } else if (chartId.includes('province')) {
        colors = chartData.map(d => {
            if (d && d.name && d.name.toLowerCase().includes('ascoli')) {
                return CHART_COLORS.PROVINCE_CHART.ASCOLI_PICENO;
            }
            if (d && d.name) {
                const index = chartData.indexOf(d);
                const provinceKeys = ['PROVINCE_1', 'PROVINCE_2', 'PROVINCE_3', 'PROVINCE_4', 'PROVINCE_5', 'PROVINCE_6'];
                return CHART_COLORS.PROVINCE_CHART[provinceKeys[index]];
            }
            return undefined;
        });
    } else if (chartId.includes('country')) {
        colors = chartData.map(d => {
            if (d && d.name && d.name.toLowerCase() === 'italia') {
                return CHART_COLORS.COUNTRY_CHART.ITALY;
            }
            if (d && d.name) {
                const index = chartData.indexOf(d);
                const countryKeys = ['COUNTRY_1', 'COUNTRY_2', 'COUNTRY_3', 'COUNTRY_4', 'COUNTRY_5'];
                return CHART_COLORS.COUNTRY_CHART[countryKeys[index]];
            }
            return undefined;
        });
    } else if (chartId.includes('interests')) {
        colors = chartData.map(d => d && d.name ? CHART_COLORS.INTERESTS_CHART[d.name] || '#ee6666' : '#ee6666');
    } else if (chartId.includes('visits')) {
        colors = chartData.map((d, i) => CHART_COLORS.VISITS_CHART[`VISIT_${i + 1}`]);
    } else {
        colors = CHART_PALETTE;
    }

    if (DEBUG_MODE) console.log("Dati del grafico:", chartData);
    if (DEBUG_MODE) console.log("Colori selezionati:", colors);

    // Aggiorna i colori dei punti in base ai dati del grafico
    updatePresencePointsColors(selectedKmlFeature.id, chartData, colors);
}

function getPresencePointsForFeature(kmlFeature) {
    const map = getMapInstance();
    if (!map) return null;

    const source = map.getSource(PRESENCE_POINTS_SOURCE_ID);
    if (!source) return null;

    const data = source._data;
    if (!data || !data.features) return null;

    return data.features.filter(feature => feature.properties.kmlFeatureId === kmlFeature.id);
}

function updatePresencePointsColors(kmlFeatureId, chartData, colors) {
    if (DEBUG_MODE) console.log(`Inizio aggiornamento colori per KML Feature ID: ${kmlFeatureId}`);

    const map = getMapInstance();
    if (!map) {
        if (DEBUG_MODE) console.log("Istanza della mappa non trovata");
        return;
    }
    const source = map.getSource(PRESENCE_POINTS_SOURCE_ID);
    if (!source || !source._data || !source._data.features) {
        if (DEBUG_MODE) console.log("Source dei punti non trovata o vuota:", PRESENCE_POINTS_SOURCE_ID);
        return;
    }

    // Get ALL points from the source
    const allPoints = source._data.features;
    if (!allPoints || allPoints.length === 0) {
        if (DEBUG_MODE) console.log("Nessun punto presente nella source.");
        // Anche se non ci sono punti, potremmo dover 'pulire' la sorgente se setData è stato chiamato prima
        // con dati errati, ma in questo caso non facciamo nulla se è vuota.
        return;
    }

    // Filter points for the specific KML feature
    const pointsToColor = allPoints.filter(feature => feature.properties.kmlFeatureId === kmlFeatureId);
    if (DEBUG_MODE) console.log(`Trovati ${pointsToColor.length} punti da colorare per KML Feature ID: ${kmlFeatureId}`);

    if (!chartData || !colors) {
         if (DEBUG_MODE) console.log("Dati del grafico o colori mancanti, impossibile procedere con la colorazione.");
         // Non possiamo colorare, ma dobbiamo comunque aggiornare la mappa con tutti i punti
         // per evitare che scompaiano se pointsToColor fosse vuoto.
         // Tuttavia, se la funzione viene chiamata senza chartData/colors validi,
         // probabilmente c'è un errore a monte, quindi usciamo.
         return;
    }

    if (pointsToColor.length > 0) {
        // Calcola il numero di punti da colorare per ogni categoria
        const totalPointsToColor = pointsToColor.length;
        const pointsPerCategory = {};
        let assignedPoints = 0;

        // Calcola i punti per categoria e gestisci l'arrotondamento
        chartData.forEach((data, index) => {
            const percentage = data.value / 100;
            pointsPerCategory[data.name] = Math.floor(totalPointsToColor * percentage); // Usa floor per iniziare
            assignedPoints += pointsPerCategory[data.name];
        });

        // Distribuisci i punti rimanenti (dovuti all'arrotondamento)
        let remainingPointsToAssign = totalPointsToColor - assignedPoints;
        let categoryIndex = 0;
        while(remainingPointsToAssign > 0 && chartData.length > 0) {
             const categoryName = chartData[categoryIndex % chartData.length].name;
             pointsPerCategory[categoryName]++;
             remainingPointsToAssign--;
             categoryIndex++;
        }

        if (DEBUG_MODE) console.log("Distribuzione punti finale per categoria:", pointsPerCategory);

        // Resetta i colori solo per i punti da colorare (se necessario,
        // anche se l'assegnazione successiva sovrascriverà)
        pointsToColor.forEach(point => {
            point.properties.color = '#808080'; // Colore grigio di default o fallback
        });

        // Mescola l'array dei punti da colorare per una distribuzione casuale
        for (let i = pointsToColor.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pointsToColor[i], pointsToColor[j]] = [pointsToColor[j], pointsToColor[i]];
        }

        // Distribuisci i colori ai punti
        let currentPointIndex = 0;
        Object.entries(pointsPerCategory).forEach(([category, count]) => {
             // Trova l'indice corrispondente nei dati originali per ottenere il colore corretto
            const originalDataIndex = chartData.findIndex(d => d.name === category);
            if (originalDataIndex === -1) {
                if (DEBUG_MODE) console.warn(`Categoria ${category} non trovata nei dati del grafico originali.`);
                return; // Salta questa categoria se non trovata
            }
            const color = colors[originalDataIndex % colors.length]; // Usa l'indice originale per il colore
            if (DEBUG_MODE) console.log(`Assegno colore ${color} a ${count} punti per la categoria ${category}`);

            for (let i = 0; i < count; i++) {
                if (currentPointIndex < pointsToColor.length) {
                    pointsToColor[currentPointIndex].properties.color = color;
                    currentPointIndex++;
                } else {
                    if (DEBUG_MODE) console.warn("Indice punto fuori dai limiti durante l'assegnazione colore.");
                    break; // Esce dal loop interno se abbiamo esaurito i punti
                }
            }
        });

         // Verifica se tutti i punti sono stati colorati
         if (currentPointIndex !== pointsToColor.length) {
              if (DEBUG_MODE) console.warn(`Non tutti i punti (${currentPointIndex}/${pointsToColor.length}) sono stati colorati, potrebbero esserci discrepanze.`);
              // Potresti assegnare un colore di default ai rimanenti qui se necessario
              // while(currentPointIndex < pointsToColor.length) {
              //     pointsToColor[currentPointIndex].properties.color = '#FF0000'; // Rosso per debug
              //     currentPointIndex++;
              // }
         }

    } else {
        if (DEBUG_MODE) console.log("Nessun punto da colorare per questa feature KML.");
        // Non c'è bisogno di fare altro se non ci sono punti specifici da colorare,
        // ma dobbiamo comunque aggiornare la sorgente con allPoints.
    }

    // Aggiorna la source della mappa con TUTTI i punti (aggiornati e non)
    if (DEBUG_MODE) console.log("Aggiorno la source della mappa con TUTTI i punti.");
    source.setData({
        type: 'FeatureCollection',
        features: allPoints // Usa l'array completo di tutti i punti
    });
}

function createOrUpdateRealBarCharts(filteredRecords, hour) {
    if (!filteredRecords || filteredRecords.length === 0) return;
    // Presenze reali
    const presenceData = filteredRecords.map(rec => ({
        date: rec.parsedDate instanceof Date ? rec.parsedDate.toLocaleDateString() : 'N/A',
        value: parseFloat(rec[`presenze_${hour}`]) || 0
    }));
    const presenceOption = {
        title: { text: 'Actual presence', left: 'center', textStyle: { fontSize: 12 }, top: 0 },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: presenceData.map(d => d.date), axisLabel: { fontSize: 9 } },
        yAxis: { type: 'value', name: 'Presence', axisLabel: { fontSize: 9 } },
        series: [{
            name: 'Presence', type: 'bar', data: presenceData.map(d => d.value),
            itemStyle: { color: '#3498db', borderRadius: [3, 3, 0, 0] }, barWidth: '60%'
        }],
        grid: { left: '8%', right: '8%', bottom: '10%', top: '18%', containLabel: true }
    };
    createAndRegisterChart('real-presence-bar-chart', presenceOption, 'No actual presence data.');

    // Genere reale
    const genderData = filteredRecords.map(rec => ({
        date: rec.parsedDate instanceof Date ? rec.parsedDate.toLocaleDateString() : 'N/A',
        male: parseFloat(rec['% M']) || 0,
        female: parseFloat(rec['% F']) || 0
    }));
    const genderOption = {
        title: { text: 'Actual gender (%)', left: 'center', textStyle: { fontSize: 12 }, top: 0 },
        tooltip: { trigger: 'axis' },
        legend: { data: ['% M', '% F'], bottom: 0, textStyle: { fontSize: 9 } },
        xAxis: { type: 'category', data: genderData.map(d => d.date), axisLabel: { fontSize: 9 } },
        yAxis: { type: 'value', name: '%', axisLabel: { fontSize: 9 } },
        series: [
            { name: '% M', type: 'bar', stack: 'gender', data: genderData.map(d => d.male), itemStyle: { color: '#2980b9' }, barWidth: '40%' },
            { name: '% F', type: 'bar', stack: 'gender', data: genderData.map(d => d.female), itemStyle: { color: '#e67e22' }, barWidth: '40%' }
        ],
        grid: { left: '8%', right: '8%', bottom: '10%', top: '18%', containLabel: true }
    };
    createAndRegisterChart('real-gender-bar-chart', genderOption, 'No actual gender data.');

    // Età reale
    const ageKeys = ['% 18-24','% 25-34','% 35-44','% 45-54','% 55-64','% 65+'];
    const ageLabels = ['18-24','25-34','35-44','45-54','55-64','65+'];
    const ageColors = ageLabels.map(l => CHART_COLORS.AGE_CHART[l]);
    const ageData = filteredRecords.map(rec => {
        const date = rec.parsedDate instanceof Date ? rec.parsedDate.toLocaleDateString() : 'N/A';
        return { date, ...Object.fromEntries(ageKeys.map(k => [k, parseFloat(rec[k]) || 0])) };
    });
    const ageSeries = ageKeys.map((k, i) => ({
        name: ageLabels[i], type: 'bar', stack: 'age', data: ageData.map(d => d[k]),
        itemStyle: { color: ageColors[i] }, barWidth: '40%'
    }));
    const ageOption = {
        title: { text: 'Actual age (%)', left: 'center', textStyle: { fontSize: 12 }, top: 0 },
        tooltip: { trigger: 'axis' },
        legend: { data: ageLabels, bottom: 0, textStyle: { fontSize: 9 } },
        xAxis: { type: 'category', data: ageData.map(d => d.date), axisLabel: { fontSize: 9 } },
        yAxis: { type: 'value', axisLabel: { fontSize: 9 } },
        series: ageSeries,
        grid: { left: '8%', right: '8%', bottom: '10%', top: '18%', containLabel: true }
    };
    createAndRegisterChart('real-age-bar-chart', ageOption, 'No actual age data.');

    // Nazionalità reale
    const nationalityData = filteredRecords.map(rec => {
        const date = rec.parsedDate instanceof Date ? rec.parsedDate.toLocaleDateString() : 'N/A';
        const itaKey = Object.keys(rec).find(k => k.toLowerCase() === '% italiani' || k.toLowerCase() === 'perc_italiani');
        const strKey = Object.keys(rec).find(k => k.toLowerCase() === '% stranieri' || k.toLowerCase() === 'perc_stranieri');
        return {
            date,
            italians: itaKey ? parseFloat(rec[itaKey]) || 0 : 0,
            foreigners: strKey ? parseFloat(rec[strKey]) || 0 : 0
        };
    });
    const nationalityColors = [
        CHART_COLORS.NATIONALITY_CHART.ITALIANS,
        CHART_COLORS.NATIONALITY_CHART.FOREIGNERS
    ];
    const nationalityOption = {
        title: { text: 'Actual nationality (%)', left: 'center', textStyle: { fontSize: 12 }, top: 0 },
        tooltip: { trigger: 'axis' },
        legend: {
            data: ['Italians', 'Foreigners'],
            bottom: 0,
            textStyle: { fontSize: 9 },
            selected: { 'Italians': false, 'Foreigners': true } // Italians spento di default
        },
        xAxis: { type: 'category', data: nationalityData.map(d => d.date), axisLabel: { fontSize: 9 } },
        yAxis: { type: 'value', name: '%', axisLabel: { fontSize: 9 } },
        series: [
            { name: 'Italians', type: 'bar', stack: 'nationality', data: nationalityData.map(d => d.italians), itemStyle: { color: nationalityColors[0] }, barWidth: '40%' },
            { name: 'Foreigners', type: 'bar', stack: 'nationality', data: nationalityData.map(d => d.foreigners), itemStyle: { color: nationalityColors[1] }, barWidth: '40%' }
        ],
        grid: { left: '8%', right: '8%', bottom: '10%', top: '18%', containLabel: true }
    };
    createAndRegisterChart('real-nationality-bar-chart', nationalityOption, 'No actual nationality data.');

    // Visite reali
    const visitsData = filteredRecords.map(rec => {
        const date = rec.parsedDate instanceof Date ? rec.parsedDate.toLocaleDateString() : 'N/A';
        return {
            date,
            v1: parseFloat(rec['visite_1']) || 0,
            v2: parseFloat(rec['visite_2']) || 0,
            v3: parseFloat(rec['visite_3']) || 0,
            v4: parseFloat(rec['visite_4']) || 0,
            v5: parseFloat(rec['visite_5']) || 0
        };
    });
    const visitsColors = [
        CHART_COLORS.VISITS_CHART.VISIT_1,
        CHART_COLORS.VISITS_CHART.VISIT_2,
        CHART_COLORS.VISITS_CHART.VISIT_3,
        CHART_COLORS.VISITS_CHART.VISIT_4,
        CHART_COLORS.VISITS_CHART.VISIT_5
    ];
    const visitsOption = {
        title: { text: 'Actual visits (%)', left: 'center', textStyle: { fontSize: 12 }, top: 0 },
        tooltip: { trigger: 'axis' },
        legend: { data: ['1 visit', '2 visits', '3 visits', '4 visits', '5+ visits'], bottom: 0, textStyle: { fontSize: 9 } },
        xAxis: { type: 'category', data: visitsData.map(d => d.date), axisLabel: { fontSize: 9 } },
        yAxis: { type: 'value', axisLabel: { fontSize: 9 } },
        series: [
            { name: '1 visit', type: 'bar', stack: 'visits', data: visitsData.map(d => d.v1), itemStyle: { color: visitsColors[0] }, barWidth: '40%' },
            { name: '2 visits', type: 'bar', stack: 'visits', data: visitsData.map(d => d.v2), itemStyle: { color: visitsColors[1] }, barWidth: '40%' },
            { name: '3 visits', type: 'bar', stack: 'visits', data: visitsData.map(d => d.v3), itemStyle: { color: visitsColors[2] }, barWidth: '40%' },
            { name: '4 visits', type: 'bar', stack: 'visits', data: visitsData.map(d => d.v4), itemStyle: { color: visitsColors[3] }, barWidth: '40%' },
            { name: '5+ visits', type: 'bar', stack: 'visits', data: visitsData.map(d => d.v5), itemStyle: { color: visitsColors[4] }, barWidth: '40%' }
        ],
        grid: { left: '8%', right: '8%', bottom: '10%', top: '18%', containLabel: true }
    };
    createAndRegisterChart('real-visits-bar-chart', visitsOption, 'No actual visit data.');
    // RIMOSSO: Interessi reali
}

// --- AGGIUNTA: Bottone ed export CSV synthetic crowded points con stato avanzamento ---
function setExportProgressStatus(msg, percent = null) {
    let status = document.getElementById('export-synthetic-crowded-status');
    if (!status) {
        status = document.createElement('div');
        status.id = 'export-synthetic-crowded-status';
        status.style = 'margin-bottom: 6px; font-size: 0.98em; color: #333; min-height: 18px; text-align: left;';
        const btn = document.getElementById('export-synthetic-crowded-btn');
        if (btn && btn.parentNode) btn.parentNode.insertBefore(status, btn);
    }
    if (percent !== null && percent >= 0 && percent <= 100) {
        status.innerHTML = `${msg} <span style='color:#5a3ec8;font-weight:bold;'>${percent}%</span>`;
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
                if (window.Papa) {
                    const parsed = window.Papa.parse(csvText, { header: true });
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
        btn.style = 'margin: 10px 0; width: 95%; background: #5a3ec8; color: white; border: none; border-radius: 5px; padding: 10px; font-size: 1em; cursor: pointer;';
        btn.onclick = exportSyntheticCrowdedCSV;
        sidebarContainerElement.insertBefore(btn, sidebarContainerElement.firstChild);
    }
    // Aggiungi/crea lo stato sopra il bottone
    setExportProgressStatus('');
}