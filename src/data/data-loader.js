import Papa from 'papaparse';
import { kml } from '@tmcw/togeojson';
// data-loader.js
import { POI_CSV_URL, KML_URL, LUOGHI_URL, PROFILI_LUOGHI_URL, LCZ_GEOJSON_URL, QUARTIERI_DISEGNO_URL, DEBUG_MODE } from './config.js';
import { updateStatusMessage } from '../ui/ui-sidebar.js';
import { preparaLuoghi } from './luoghi-core.js';

// Data structure for POIs: { "poi_name_normalized": [record1, record2, ...], ... }
let poiDataStore = {};
// Stores the original complete KML GeoJSON
let fullKmlGeoJson = null;
// Confini di disegno per nome di quartiere: solo per la mappa; i calcoli leggono fullKmlGeoJson (il KML originale)
let displayGeometries = new Map();
// Luoghi che attirano persone (OpenStreetMap) con l'affluenza per ora della settimana (luoghi-core.js)
let luoghiStore = [];
// Data store for LCZ vitality polygons
let lczVitalityDataStore = [];

// --- FUNZIONI ESPORTATE ---

/**
 * Loads and parses POI data from the specified CSV URL.
 * Normalizes POI names and parses dates.
 * @returns {Promise<object>} A promise that resolves with the poiDataStore object.
 */
export function loadPoiData() {
    return new Promise((resolve, reject) => {
        updateStatusMessage("Loading POI data...");
        Papa.parse(POI_CSV_URL, {
            download: true,
            header: true,
            dynamicTyping: true, // Automatically converts numbers, booleans
            skipEmptyLines: true,
            complete: results => {
                 if (DEBUG_MODE) {
                     console.log("POI CSV parsing completed:", results);
                     console.log("POI CSV headers found:", results.meta?.fields);
                 }

                if (results.errors.length > 0) {
                    if (DEBUG_MODE) {
                        console.error("Errors during POI CSV parsing:", results.errors);
                        const firstError = results.errors[0];
                        // Adjust row number: +1 for header, +1 for 0-based index
                        const errMsg = `POI CSV parsing error: ${firstError.message} (row ${firstError.row + 2})`;
                        updateStatusMessage(errMsg, true);
                    }
                    reject(new Error("POI CSV parsing error"));
                    return;
                 }
                if (!results.data || results.data.length === 0) {
                    updateStatusMessage("POI CSV file is empty or invalid.", true);
                    reject(new Error("Empty POI CSV file")); return;
                }

                poiDataStore = {}; // Reset store
                let loadedCount = 0;
                let processedCount = 0;
                let dateErrorCount = 0;
                let nameErrorCount = 0;

                results.data.forEach((row) => {
                    loadedCount++;
                    // Validate POI name
                    if (row && typeof row.poi_name === 'string' && row.poi_name.trim()) {
                        const normalizedName = row.poi_name.trim().toLowerCase();
                        // Validate and parse date
                        try {
                            const dateString = row.date;
                            if (typeof dateString !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
                                throw new Error(`Invalid date format: '${dateString}'`);
                            }
                            const dateParts = dateString.split('-');
                            row.parsedDate = new Date(Date.UTC(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2])));
                            if (isNaN(row.parsedDate.getTime())) {
                                throw new Error(`Invalid date value after parsing: '${dateString}'`);
                            }
                        } catch (dateError) {
                            // console.warn(`Skipping POI row due to date error: ${dateError.message}`, row);
                            dateErrorCount++;
                            return; // Skip row if date is invalid
                        }

                        // Add valid record to store
                        if (!poiDataStore[normalizedName]) {
                            poiDataStore[normalizedName] = [];
                        }
                        poiDataStore[normalizedName].push(row);
                        processedCount++;
                    } else {
                         // console.warn("Skipping POI row due to invalid 'poi_name':", row);
                         nameErrorCount++; // Skip row if name is invalid
                    }
                });

                if (DEBUG_MODE) {
                    console.log(`Read ${loadedCount} POI CSV rows.`);
                    console.log(`- Processed ${processedCount} rows with valid name and date.`);
                    console.log(`- Skipped ${nameErrorCount} rows for invalid 'poi_name'.`);
                    console.log(`- Skipped ${dateErrorCount} rows for invalid 'date'.`);
                    const uniquePoiCount = Object.keys(poiDataStore).length;
                    console.log(`Stored data for ${uniquePoiCount} unique POIs.`);
                }

                if (processedCount === 0 && loadedCount > 0) {
                     updateStatusMessage("No valid rows found in POI CSV file after name and date check.", true);
                     if (DEBUG_MODE) {
                         console.warn("Warning: No valid POI data loaded.");
                     }
                } else {
                    updateStatusMessage(`Loaded historical data for ${Object.keys(poiDataStore).length} POI areas.`);
                }
                resolve(poiDataStore);
            },
            error: error => {
                if (DEBUG_MODE) {
                    console.error("PapaParse POI CSV error:", error);
                    const errMsg = `Error loading/parsing POI CSV: ${error.message || error}`;
                    updateStatusMessage(errMsg, true);
                }
                reject(new Error("Error loading POI CSV"));
             }
        });
    });
}

/**
 * Returns the stored POI data.
 * @returns {object} The poiDataStore object.
 */
export function getPoiData() {
    return poiDataStore;
}

/**
 * Carica i luoghi OSM e i profili orari dei diari ISTAT e calcola l'affluenza di ogni luogo per le 168 ore
 * della settimana tipo (src/data/luoghi-core.js). Prende il posto dei vecchi spot e dei loro affollamenti.
 * @returns {Promise<Array<object>>} luoghi con id, nome, categoria, nomeCategoria, lon, lat, affluenza (Float32Array 168)
 */
export async function loadLuoghi() {
    updateStatusMessage("Carico i luoghi della città…");
    const [luoghi, profili] = await Promise.all([LUOGHI_URL, PROFILI_LUOGHI_URL].map(async url => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status} per ${url}`);
        return response.json();
    }));
    luoghiStore = preparaLuoghi(luoghi, profili);
    if (DEBUG_MODE) console.log(`Luoghi con affluenza: ${luoghiStore.length} su ${luoghi.features.length}`);
    return luoghiStore;
}

/**
 * Luoghi caricati da loadLuoghi (vuoto finché non sono pronti).
 * @returns {Array<object>}
 */
export function getLuoghi() {
    return luoghiStore;
}

/**
 * Loads KML data, converts it to GeoJSON, enriches it with POI presence info,
 * and stores the full enriched GeoJSON.
 * @returns {Promise<object|null>} A promise that resolves with the enriched GeoJSON FeatureCollection
 *                                   or null if no features were found or an error occurred.
 */
export function loadKMLLayer() {
    return new Promise(async (resolve, reject) => {
        updateStatusMessage("Loading KML...");
        try {
            if (DEBUG_MODE) {
                console.log("Fetching KML from:", KML_URL);
            }
            const response = await fetch(KML_URL);
            if (!response.ok) throw new Error(`HTTP error ${response.status} for KML`);
            const kmlText = await response.text();
            if (!kmlText?.trim()) throw new Error("KML file is empty.");

            const kmlDom = (new DOMParser()).parseFromString(kmlText, 'text/xml');
            // Check for XML parsing errors
            const parserErrors = kmlDom.getElementsByTagName('parsererror');
            if (parserErrors.length > 0) {
                const errorDetails = parserErrors[0].textContent;
                if (DEBUG_MODE) {
                    console.error("KML XML parsing error:", errorDetails);
                    const shortErrorMsg = errorDetails.split('\n')[0];
                    throw new Error(`KML XML parsing error: ${shortErrorMsg}`);
                }
            }
            const geoJson = kml(kmlDom);
            if (DEBUG_MODE) {
                console.log("KML conversion completed.");
            }

            // Check if conversion resulted in usable features
            if (!geoJson || !geoJson.features || geoJson.features.length === 0) {
               if (DEBUG_MODE) {
                   console.warn("KML does not contain displayable features.");
                   updateStatusMessage("KML loaded but contains no areas.", false);
               }
               fullKmlGeoJson = { type: 'FeatureCollection', features: [] }; // Store empty but valid
               resolve(null); // Resolve with null to indicate no layer to add
               return;
            }

            // Enrich GeoJSON with POI info and IDs before storing
            enrichGeoJsonWithPoiDataPresence(geoJson, getPoiData());
            // Store the complete, enriched KML GeoJSON
            fullKmlGeoJson = geoJson;
            if (DEBUG_MODE) {
                console.log(`Original (enriched) KML GeoJSON stored with ${fullKmlGeoJson.features.length} features.`); // MODIFIED log
            }

            updateStatusMessage("KML areas loaded and processed.", false);
            await caricaConfiniDisegno();
            // Resolve with the enriched GeoJSON to add it to the map
            resolve(geoJson);

        } catch (error) {
            if (DEBUG_MODE) {
                console.error("Error loading/processing KML:", error);
                updateStatusMessage(`Error loading KML: ${error.message}`, true);
            }
            reject(error);
        }
    });
}

/** Carica i confini di disegno. Se il file manca o non si legge, la mappa usa il disegno del KML. */
async function caricaConfiniDisegno() {
    try {
        const response = await fetch(QUARTIERI_DISEGNO_URL);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        const data = await response.json();
        // Nomi senza spazi finali: nel KML qualche nome ne ha uno (es. «Porta Cartara »)
        displayGeometries = new Map(data.features.map(f => [f.properties.name.trim(), f.geometry]));
    } catch (error) {
        if (DEBUG_MODE) console.warn("Confini di disegno non caricati, resta il KML:", error);
        displayGeometries = new Map();
    }
}

/**
 * Confine da disegnare per un quartiere, per nome. Null se non c'è: si usa il confine del KML.
 * @param {string} name - Nome del quartiere (properties.name del KML).
 * @returns {object|null} Geometria GeoJSON o null.
 */
export function getDisplayGeometry(name) {
    return displayGeometries.get(name?.trim()) ?? null;
}

/**
 * Enriches KML GeoJSON features with POI availability information and assigns unique IDs.
 * Modifies the input geoJson object directly.
 * @param {object} geoJson - The GeoJSON FeatureCollection to enrich.
 * @param {object} poiData - The POI data store.
 */
function enrichGeoJsonWithPoiDataPresence(geoJson, poiData) {
    if (!geoJson || !geoJson.features) {
        if (DEBUG_MODE) {
            console.warn("Attempted to enrich invalid KML GeoJSON.");
        }
        return;
    }
    const hasPoiData = poiData && Object.keys(poiData).length > 0;
    if (!hasPoiData) {
        if (DEBUG_MODE) {
            console.log("No POI data available, skipping KML enrichment (adding IDs only).");
        }
    }

    let matchCount = 0;
    geoJson.features.forEach((feature, index) => {
        if (!feature.properties) feature.properties = {};

        // Assign an ID if missing
        // Ensure the ID is suitable for feature state (number or string)
        const potentialId = feature.properties.id || feature.id || `kml_feature_${index}`;
        feature.id = String(potentialId); // Convert to string just in case

        const kmlName = typeof feature.properties.name === 'string' ? feature.properties.name.trim() : null;
        feature.properties.kml_name = kmlName; // Store original name for display

        // Check for corresponding POI data only if POI data exists
        if (hasPoiData && kmlName) {
            const normalizedKmlName = kmlName.toLowerCase();
            if (poiData[normalizedKmlName] && poiData[normalizedKmlName].length > 0) {
                feature.properties.poi_data_available = true;
                // Store the canonical POI name from the POI data for consistency
                feature.properties.poi_name = poiData[normalizedKmlName][0].poi_name;
                matchCount++;
            } else {
                feature.properties.poi_data_available = false;
                feature.properties.poi_name = null;
            }
        } else {
             feature.properties.poi_data_available = false;
             feature.properties.poi_name = null;
        }
    });
    if (DEBUG_MODE) {
        console.log(`Checked POI data availability for ${geoJson.features.length} KML areas (IDs added/ensured). Found data for ${matchCount} areas.`);
    }
}

/**
 * Exports the stored, complete (and enriched) KML GeoJSON.
 * Useful if other parts of the application need the entire KML dataset.
 * @returns {object | null} The stored GeoJSON FeatureCollection or null.
 */
export function getFullKmlGeoJson() {
    return fullKmlGeoJson;
}

/**
 * Returns the minimum and maximum date found in the POI data store.
 * @returns {{min: Date|null, max: Date|null}} An object with min and max Date, or null if no data.
 */
export function getPoiDateRange() {
    let minDate = null;
    let maxDate = null;
    Object.values(poiDataStore).forEach(records => {
        records.forEach(row => {
            if (row.parsedDate instanceof Date && !isNaN(row.parsedDate.getTime())) {
                if (!minDate || row.parsedDate < minDate) minDate = row.parsedDate;
                if (!maxDate || row.parsedDate > maxDate) maxDate = row.parsedDate;
            }
        });
    });
    return { min: minDate, max: maxDate };
}

/**
 * Loads the LCZ cells (30 m vector grid, GeoJSON from sound-lab/estrai_lcz.py).
 * Copies lcz_class -> LCZ and lcz_vulnerability -> 'UHI risk' for the map styles;
 * all other fields are kept for the cell popup.
 * @returns {Promise<Array<object>>} A promise that resolves with the lczVitalityDataStore array.
 */
export async function loadLczVitalityData() {
    updateStatusMessage("Loading LCZ data...");
    const validLczValues = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];
    try {
        const response = await fetch(LCZ_GEOJSON_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const geojson = await response.json();
        lczVitalityDataStore = geojson.features.map(feature => {
            const p = feature.properties;
            const lcz = validLczValues.includes(p.lcz_class) ? p.lcz_class : 'UNKNOWN';
            return { ...feature, properties: { ...p, LCZ: lcz, 'UHI risk': p.lcz_vulnerability } };
        });
        updateStatusMessage(`Loaded ${lczVitalityDataStore.length} LCZ cells.`);
        return lczVitalityDataStore;
    } catch (error) {
        console.error("Error loading LCZ GeoJSON:", error);
        updateStatusMessage(`Error loading LCZ data: ${error.message}`, true);
        throw error;
    }
}

/**
 * Returns the stored LCZ Vitality data.
 * @returns {Array<object>} The lczVitalityDataStore array.
 */
export function getLczVitalityData() {
    return lczVitalityDataStore;
}
