// data-loader.js
import { POI_CSV_URL, KML_URL, CROWDED_CSV_URL, SPOTS_CSV_URL, DEBUG_MODE } from './config.js';
import { updateStatusMessage } from '../ui/ui-sidebar.js';

// Data structure for POIs: { "poi_name_normalized": [record1, record2, ...], ... }
let poiDataStore = {};
// Stores the original complete KML GeoJSON
let fullKmlGeoJson = null;
// Data store for crowded points - Array of records initially
let crowdedDataStore = [];
// Data store for spot mapper points
let spotMapperDataStore = [];

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
            worker: true,
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
 * Loads and parses Crowded Points data from the specified CSV URL.
 * Converts latitude/longitude and hourly data to numbers.
 * @returns {Promise<Array<object>>} A promise that resolves with the crowdedDataStore array.
 */
export function loadCrowdedData() {
    return new Promise((resolve, reject) => {
        updateStatusMessage("Loading crowded points data...");
        Papa.parse(CROWDED_CSV_URL, {
            download: true,
            header: true,
            dynamicTyping: true, // Let PapaParse handle basic types (numbers, booleans)
            skipEmptyLines: true,
            worker: true,
            complete: results => {
                // Manual trim of header fields and data keys (to replace transformHeader)
                if (results.meta?.fields && results.data) {
                    const trimmedFields = results.meta.fields.map(f => f.trim());
                    results.meta.fields = trimmedFields;
                    results.data = results.data.map(row => {
                        const newRow = {};
                        for (const key in row) {
                            newRow[key.trim()] = row[key];
                        }
                        return newRow;
                    });
                }
                if (DEBUG_MODE) {
                    console.log("Crowded CSV parsing completed:", results);
                    console.log("Crowded CSV headers found:", results.meta?.fields);
                }

                if (results.errors.length > 0) {
                    if (DEBUG_MODE) {
                        console.error("Errors during Crowded CSV parsing:", results.errors);
                        const firstError = results.errors[0];
                        // Adjust row number: +1 for header, +1 for 0-based index
                        const errMsg = `Crowded CSV parsing error: ${firstError.message} (row ${firstError.row + 2})`;
                        updateStatusMessage(errMsg, true);
                    }
                    reject(new Error("Crowded CSV parsing error"));
                    return;
                }
                if (!results.data || results.data.length === 0) {
                    updateStatusMessage("Crowded CSV file is empty or invalid.", true);
                    reject(new Error("Empty Crowded CSV file"));
                    return;
                }

                crowdedDataStore = []; // Reset store
                let loadedCount = 0;
                let processedCount = 0;
                let geoErrorCount = 0;

                results.data.forEach((row, index) => {
                    loadedCount++;
                    // Validate essential fields: latitude and longitude
                    if (row && typeof row.latitude === 'number' && typeof row.longitude === 'number' &&
                        !isNaN(row.latitude) && !isNaN(row.longitude)) {

                        // Optional: Ensure hourly data are numbers (PapaParse dynamicTyping should handle this, but good to verify)
                        // Example check for one column:
                        // if (typeof row['sunday-00'] !== 'number') {
                        //    console.warn(`Row ${index+2}: 'sunday-00' is not a number`, row['sunday-00']);
                        //    // Decide how to handle: skip row, set to 0, etc. Here we'll keep it simple.
                        // }

                        // Add unique ID based on row index for safety
                        row.id = `crowded_${index}`;
                        crowdedDataStore.push(row);
                        processedCount++;
                    } else {
                        // console.warn(`Skipping Crowded row ${index + 2} due to invalid lat/lon:`, row);
                        geoErrorCount++; // Skip row if essential geo data is invalid
                    }
                });

                if (DEBUG_MODE) {
                    console.log(`Read ${loadedCount} Crowded CSV rows.`);
                    console.log(`- Processed ${processedCount} rows with valid lat/lon.`);
                    console.log(`- Skipped ${geoErrorCount} rows for invalid lat/lon.`);
                }

                if (processedCount === 0 && loadedCount > 0) {
                    updateStatusMessage("No valid rows found in Crowded CSV file after lat/lon check.", true);
                    if (DEBUG_MODE) {
                        console.warn("Warning: No valid Crowded data loaded.");
                    }
                } else {
                     updateStatusMessage(`Loaded ${processedCount} crowded points.`);
                }

                resolve(crowdedDataStore); // Resolve with the array of records
            },
            error: error => {
                if (DEBUG_MODE) {
                    console.error("PapaParse Crowded CSV error:", error);
                    const errMsg = `Error loading/parsing Crowded CSV: ${error.message || error}`;
                    updateStatusMessage(errMsg, true);
                }
                reject(new Error("Error loading Crowded CSV"));
            }
        });
    });
}

/**
 * Returns the stored crowded points data.
 * @returns {Array<object>} The crowdedDataStore array.
 */
export function getCrowdedData() {
    return crowdedDataStore;
}

/**
 * Loads KML data, converts it to GeoJSON, enriches it with POI presence info,
 * and stores the full enriched GeoJSON. Dynamically loads toGeoJSON library if needed.
 * @returns {Promise<object|null>} A promise that resolves with the enriched GeoJSON FeatureCollection
 *                                   or null if no features were found or an error occurred.
 */
export function loadKMLLayer() {
    return new Promise(async (resolve, reject) => {
        updateStatusMessage("Loading KML...");
        if (typeof toGeoJSON === 'undefined') {
            if (DEBUG_MODE) {
                console.log("Loading toGeoJSON library...");
            }
            try {
                await loadScript('https://unpkg.com/@mapbox/togeojson@0.16.0/togeojson.js');
                if (DEBUG_MODE) {
                    console.log("toGeoJSON library loaded.");
                }
            } catch (error) {
                console.error("Error loading toGeoJSON:", error);
                updateStatusMessage("Error: cannot load KML library.", true);
                reject(new Error("Error loading toGeoJSON")); return;
            }
        }

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
            const geoJson = toGeoJSON.kml(kmlDom);
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

/**
 * Helper function to load a script dynamically.
 * @param {string} src - The URL of the script to load.
 * @returns {Promise<void>} A promise that resolves when the script loads or rejects on error.
 */
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
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
 * Loads and parses spot mapper data from the specified CSV URL.
 * Converts latitude/longitude to numbers.
 * @returns {Promise<Array<object>>} A promise that resolves with the spotMapperDataStore array.
 */
export function loadSpotMapperData() {
    return new Promise((resolve, reject) => {
        updateStatusMessage("Loading spot mapper data...");
        Papa.parse(SPOTS_CSV_URL, {
            download: true,
            header: true,
            dynamicTyping: true, // Let PapaParse handle basic types (numbers, booleans)
            skipEmptyLines: true,
            worker: true,
            complete: results => {
                // Manual trim of header fields and data keys (to replace transformHeader)
                if (results.meta?.fields && results.data) {
                    const trimmedFields = results.meta.fields.map(f => f.trim());
                    results.meta.fields = trimmedFields;
                    results.data = results.data.map(row => {
                        const newRow = {};
                        for (const key in row) {
                            newRow[key.trim()] = row[key];
                        }
                        return newRow;
                    });
                }
                if (DEBUG_MODE) {
                    console.log("Spot Mapper CSV parsing completed:", results);
                    console.log("Spot Mapper CSV headers found:", results.meta?.fields);
                }

                if (results.errors.length > 0) {
                    if (DEBUG_MODE) {
                        console.error("Errors during Spot Mapper CSV parsing:", results.errors);
                        const firstError = results.errors[0];
                        // Adjust row number: +1 for header, +1 for 0-based index
                        const errMsg = `Spot Mapper CSV parsing error: ${firstError.message} (row ${firstError.row + 2})`;
                        updateStatusMessage(errMsg, true);
                    }
                    reject(new Error("Spot Mapper CSV parsing error"));
                    return;
                }
                if (!results.data || results.data.length === 0) {
                    updateStatusMessage("Spot Mapper CSV file is empty or invalid.", true);
                    reject(new Error("Empty Spot Mapper CSV file"));
                    return;
                }

                spotMapperDataStore = []; // Reset store
                let loadedCount = 0;
                let processedCount = 0;
                let geoErrorCount = 0;

                results.data.forEach((row, index) => {
                    loadedCount++;
                    // Validate essential fields: latitude and longitude
                    if (row && typeof row.Latitudine === 'number' && typeof row.Longitudine === 'number' &&
                        !isNaN(row.Latitudine) && !isNaN(row.Longitudine)) {

                        // Add unique ID based on row index for safety
                        row.id = `spot_${index}`;
                        spotMapperDataStore.push(row);
                        processedCount++;
                    } else {
                        if (DEBUG_MODE) {
                            console.warn(`Skipping Spot Mapper row ${index + 2} due to invalid lat/lon:`, row);
                        }
                        geoErrorCount++; // Skip row if essential geo data is invalid
                    }
                });

                if (DEBUG_MODE) {
                    console.log(`Read ${loadedCount} Spot Mapper CSV rows.`);
                    console.log(`- Processed ${processedCount} rows with valid lat/lon.`);
                    console.log(`- Skipped ${geoErrorCount} rows for invalid lat/lon.`);
                }

                if (processedCount === 0 && loadedCount > 0) {
                    updateStatusMessage("No valid rows found in Spot Mapper CSV file after lat/lon check.", true);
                    if (DEBUG_MODE) {
                        console.warn("Warning: No valid Spot Mapper data loaded.");
                    }
                } else {
                     updateStatusMessage(`Loaded ${processedCount} spot points.`);
                }

                resolve(spotMapperDataStore); // Resolve with the array of records
            },
            error: error => {
                if (DEBUG_MODE) {
                    console.error("PapaParse Spot Mapper CSV error:", error);
                    const errMsg = `Error loading/parsing Spot Mapper CSV: ${error.message || error}`;
                    updateStatusMessage(errMsg, true);
                }
                reject(new Error("Error loading Spot Mapper CSV"));
            }
        });
    });
}

/**
 * Returns the stored spot mapper data.
 * @returns {Array<object>} The spotMapperDataStore array.
 */
export function getSpotMapperData() {
    return spotMapperDataStore;
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