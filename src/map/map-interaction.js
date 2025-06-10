// map-interaction.js
import { getMapInstance } from './map-setup.js';
// MODIFICATO: Assicurati che KML_SOURCE_ID sia importato se usato nel fallback ID
import { KML_LAYER_ID, KML_SOURCE_ID } from '../data/config.js';
import { resetSidebar } from '../ui/ui-sidebar.js';
import { displayKmlFeatureInfoAndCalculateAverages } from '../ui/ui-sidebar.js';
import { getCurrentHour } from '../ui/ui-timeline.js';
import { fullSyntheticCrowdedGeoJson } from './map-layers.js'; // IMPORTANTE: aggiungi export a fullSyntheticCrowdedGeoJson in map-layers.js
import { DEBUG_MODE } from '../data/config.js';


// Variabile per tenere traccia dell'ID della feature correntemente in hover
let hoveredFeatureId = null;
// Variabile per tenere traccia delle animazioni attive per featureId
const hoverAnimations = {};

/**
 * Anima il valore di hoverAmount per una feature KML.
 * @param {string|number} featureId - L'ID della feature.
 * @param {number} target - Il valore finale (0 o 1).
 * @param {number} duration - Durata in ms.
 */
function animateHoverAmount(featureId, target, duration = 200) {
    const map = getMapInstance();
    if (!map || !map.isStyleLoaded() || !map.getSource(KML_SOURCE_ID)) return;
    // Se c'è già un'animazione su questa feature, cancella
    if (hoverAnimations[featureId]) {
        cancelAnimationFrame(hoverAnimations[featureId].rafId);
    }
    const state = map.getFeatureState({ source: KML_SOURCE_ID, id: featureId }) || {};
    const start = typeof state.hoverAmount === 'number' ? state.hoverAmount : 0;
    const startTime = performance.now();
    function step(now) {
        const t = Math.min((now - startTime) / duration, 1);
        // Ease in-out
        const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        const value = start + (target - start) * eased;
        try {
            map.setFeatureState({ source: KML_SOURCE_ID, id: featureId }, { hoverAmount: value });
        } catch (e) {}
        if (t < 1) {
            hoverAnimations[featureId].rafId = requestAnimationFrame(step);
        } else {
            try {
                map.setFeatureState({ source: KML_SOURCE_ID, id: featureId }, { hoverAmount: target });
            } catch (e) {}
            delete hoverAnimations[featureId];
        }
    }
    hoverAnimations[featureId] = { rafId: requestAnimationFrame(step) };
}

/**
 * Removes existing map listeners for KML interactions to prevent duplicates.
 * @param {mapboxgl.Map} map - The Mapbox map instance.
 */
function removeAllListeners(map) {
    // Rimuovi i listener solo se il layer esiste effettivamente
    const layerIdsToRemoveListeners = [
        KML_LAYER_ID,
        KML_LAYER_ID + '-outline',
        KML_LAYER_ID + '-base-outline'
    ].filter(id => map.getLayer(id)); // Filtra per layer esistenti

    layerIdsToRemoveListeners.forEach(layerId => {
        try { map.off('click', layerId, handleKmlClick); } catch (e) { if (DEBUG_MODE) console.warn(`Could not remove click listener for ${layerId}: ${e.message}`); }
        try { map.off('mouseenter', layerId, handleKmlMouseEnter); } catch (e) { if (DEBUG_MODE) console.warn(`Could not remove mouseenter listener for ${layerId}: ${e.message}`); }
        try { map.off('mouseleave', layerId, handleKmlMouseLeave); } catch (e) { if (DEBUG_MODE) console.warn(`Could not remove mouseleave listener for ${layerId}: ${e.message}`); }
    });

    // Rimuovi eventi generici
    try { map.off('mousemove', handleMouseMove); } catch (e) { if (DEBUG_MODE) console.warn(`Could not remove mousemove listener: ${e.message}`); }
    try { map.off('click', handleMapClick); } catch (e) { if (DEBUG_MODE) console.warn(`Could not remove map click listener: ${e.message}`); }
}

/**
 * Handles clicks on the KML layer (fill layer).
 * @param {MapLayerMouseEvent} e - The map event object from Mapbox.
 */
function handleKmlClick(e) {
    if (e.features && e.features.length > 0) {
        const kmlFeature = e.features[0];
        // Verifica la validità della feature prima di processarla
        if (kmlFeature && kmlFeature.geometry && kmlFeature.properties) {
            // Ottieni l'ID della feature in modo sicuro
            const featureId = kmlFeature.id ?? kmlFeature.properties?.id;
             if (featureId !== undefined) {
                if (DEBUG_MODE) console.debug(`KML Layer clicked. Feature ID: ${featureId}, Properties:`, kmlFeature.properties);
                displayKmlFeatureInfoAndCalculateAverages(kmlFeature, getCurrentHour());
                // --- LOG SYNTHETIC CROWDED POINTS ATTRACTIVENESS ---
                if (fullSyntheticCrowdedGeoJson && fullSyntheticCrowdedGeoJson.features?.length) {
                    const inside = fullSyntheticCrowdedGeoJson.features.filter(f => {
                        return turf.booleanPointInPolygon(f, kmlFeature.geometry);
                    });
                    const values = inside.map(f => f.properties?.synthetic_crowdedness ?? null).filter(v => v !== null);
                    if (DEBUG_MODE) console.log(`Synthetic crowded points in area ${featureId}:`, values);
                } else {
                    if (DEBUG_MODE) console.log('No synthetic crowded points loaded.');
                }
                // ---
             } else {
                 if (DEBUG_MODE) console.warn("Clicked on KML layer but feature ID is missing:", kmlFeature);
             }
        } else {
            if (DEBUG_MODE) console.warn("Clicked on KML layer but feature data is invalid:", kmlFeature);
        }
    } else {
        if (DEBUG_MODE) console.log("Clicked on KML layer but no features found in event.");
    }
    // Impedisci la propagazione per evitare che handleMapClick deselezioni subito
    e.preventDefault();
}

/**
 * Handles clicks on the map outside of KML layers to deselect all areas.
 * @param {MapMouseEvent} e - The map event object from Mapbox.
 */
function handleMapClick(e) {
    const map = getMapInstance();
    if (!map) return;

    // MODIFICATO: Dinamicamente costruisci la lista dei layer KML *esistenti* da interrogare
    const existingKmlLayers = [
        KML_LAYER_ID,
        KML_LAYER_ID + '-outline',
        KML_LAYER_ID + '-base-outline'
    ].filter(id => map.getLayer(id)); // Controlla se il layer esiste

    // Se non ci sono layer KML sulla mappa, non fare nulla (o resetta se necessario)
    if (existingKmlLayers.length === 0) {
        // console.log("Map click: No KML layers present, resetting sidebar.");
        resetSidebar();
        return;
    }

    // Interroga solo i layer KML che esistono
    const features = map.queryRenderedFeatures(e.point, {
        layers: existingKmlLayers
    });

    // Se non ci sono features KML sotto il punto cliccato, deseleziona
    if (!features || features.length === 0) {
        // console.log("Map click: Click outside KML features, resetting sidebar.");
        resetSidebar();
    } else {
        // console.log("Map click: Click inside a KML feature area (handled by layer-specific click).");
        // Il click sulla feature è gestito da handleKmlClick, non fare nulla qui
    }
}

/**
 * Changes the map cursor style.
 * @param {mapboxgl.Map} map - The Mapbox map instance.
 * @param {string} style - The CSS cursor style (e.g., 'pointer', '').
 */
function changeCursor(map, style) {
     if (map && map.getCanvas()) {
        map.getCanvas().style.cursor = style;
     }
}

/**
 * Sets a hover state on a KML feature using an animated hoverAmount.
 * @param {string|number|undefined} featureId - The ID of the feature to set hover state on. Pass null to clear hover.
 */
function setHoveredFeatureState(featureId) {
    const map = getMapInstance();
    if (!map || !map.isStyleLoaded() || !map.getSource(KML_SOURCE_ID)) {
        return;
    }
    // Rimuovi hover dal precedente feature, se diverso dal nuovo e valido
    if (hoveredFeatureId !== null && hoveredFeatureId !== undefined && hoveredFeatureId !== featureId) {
        animateHoverAmount(hoveredFeatureId, 0, 220);
    }
    // Imposta hover sulla nuova feature, se valida
    if (featureId !== null && featureId !== undefined) {
        animateHoverAmount(featureId, 1, 220);
    }
    hoveredFeatureId = featureId;
}

/**
 * Handles mouse entering a KML layer (changes cursor and sets hover state).
 * @param {MapLayerMouseEvent} e - The map event object from Mapbox.
 */
function handleKmlMouseEnter(e) {
    const map = getMapInstance();
    if (!map) return;

    changeCursor(map, 'pointer');

    if (e.features && e.features.length > 0) {
        const feature = e.features[0];
        // Prova a ottenere l'ID in modo robusto
        let featureId = feature.id ?? feature.properties?.id;

        // Fallback se l'ID non è presente né come ID top-level né nelle proprietà
        if (featureId === undefined) {
             if (DEBUG_MODE) console.warn("MouseEnter: Feature ID missing, attempting fallback search.");
             const source = map.getSource(KML_SOURCE_ID); // Usa costante
             if (source && source._data && source._data.features) {
                const featureGeom = JSON.stringify(feature.geometry);
                const matchingFeatureIndex = source._data.features.findIndex(f =>
                    JSON.stringify(f.geometry) === featureGeom ||
                    (feature.properties && f.properties &&
                     feature.properties.name === f.properties.name) // Fallback su nome se presente
                );

                if (matchingFeatureIndex !== -1) {
                    // Assicurati che la feature trovata abbia un ID
                    featureId = source._data.features[matchingFeatureIndex].id ?? source._data.features[matchingFeatureIndex].properties?.id;
                    // Se ancora manca, genera un ID fallback (meno ideale)
                    if (featureId === undefined) {
                        featureId = `fallback_${matchingFeatureIndex}`;
                    }
                    if (DEBUG_MODE) console.log("MouseEnter: ID trovato tramite fallback:", featureId);
                } else {
                     if (DEBUG_MODE) console.warn("MouseEnter: Fallback failed to find matching feature.");
                }
             }
        }

        // Se abbiamo un ID valido e non è già quello in hover, impostiamo lo stato
        if (featureId !== undefined && featureId !== hoveredFeatureId) {
            // console.log("Setting hover state for feature ID (MouseEnter):", featureId);
            // Usa la funzione setFeatureState per gestire lo stato di hover
             setHoveredFeatureState(featureId);
        } else if (featureId === undefined) {
            if (DEBUG_MODE) console.warn("MouseEnter: Feature ID is still undefined after all attempts.");
        }
    } else {
        // Questo non dovrebbe accadere con 'mouseenter' su un layer specifico, ma per sicurezza:
        // console.warn("No features found in KML mouseenter event", e);
        // Potrebbe essere necessario resettare lo stato hover qui se può accadere
        // setHoveredFeatureState(null); // Deseleziona se nessun feature viene rilevato all'ingresso
    }
}

/**
 * Handles mouse leaving a KML layer (resets cursor and removes hover state).
 */
function handleKmlMouseLeave() {
    const map = getMapInstance();
    if (!map) return;
    // console.log("Mouse leave da layer KML, clearing hover state.");
    changeCursor(map, '');
    // Rimuovi lo stato hover solo se c'era uno stato hover attivo
    if (hoveredFeatureId !== null) {
        setHoveredFeatureState(null);
    }
}

/**
 * Adds interaction listeners (click, hover) to the map for existing KML layers.
 * Removes previous listeners first.
 * @param {mapboxgl.Map} map - The Mapbox map instance.
 */
export function addMapInteraction(map) {
    if (!map || typeof map.on !== 'function') {
        if (DEBUG_MODE) console.error("Attempted to add interaction to an invalid map instance.");
        return;
    }

    // Rimuovi prima tutti i listener potenzialmente duplicati
    removeAllListeners(map);

    // Aggiungi listener solo ai layer KML che esistono effettivamente
    const mainKmlLayerId = KML_LAYER_ID;
    const outlineLayerId = KML_LAYER_ID + '-outline';
    const baseOutlineLayerId = KML_LAYER_ID + '-base-outline';

    if (map.getLayer(mainKmlLayerId)) {
        map.on('click', mainKmlLayerId, handleKmlClick);
        map.on('mouseenter', mainKmlLayerId, handleKmlMouseEnter);
        map.on('mouseleave', mainKmlLayerId, handleKmlMouseLeave);
    } else {
        if (DEBUG_MODE) console.warn(`Main KML layer ${mainKmlLayerId} not found. Interactions not added.`);
    }

    // Aggiungi listener agli outline solo se esistono
    if (map.getLayer(outlineLayerId)) {
        map.on('mouseenter', outlineLayerId, handleKmlMouseEnter); // Per hover sull'outline
        map.on('mouseleave', outlineLayerId, handleKmlMouseLeave); // Per lasciare l'outline
        map.on('click', outlineLayerId, handleKmlClick); // Permetti click anche sull'outline
    } else {
         console.warn(`KML outline layer ${outlineLayerId} not found. Interactions not added.`);
    }

    if (map.getLayer(baseOutlineLayerId)) {
        map.on('mouseenter', baseOutlineLayerId, handleKmlMouseEnter);
        map.on('mouseleave', baseOutlineLayerId, handleKmlMouseLeave);
        map.on('click', baseOutlineLayerId, handleKmlClick);
    } else {
         console.warn(`KML base outline layer ${baseOutlineLayerId} not found. Interactions not added.`);
    }

    // Aggiungi listener globali per mousemove (per rilevare hover) e click (per deselezionare)
    map.on('mousemove', handleMouseMove);
    map.on('click', handleMapClick); // Listener per click sulla mappa (fuori dalle feature)

    console.log("Map interaction listeners added/updated for existing KML layers.");
}

/**
 * Handles global mouse movement over the map to detect hovering over KML features.
 * Uses feature state for hover effect.
 * @param {MapMouseEvent} e - The map event object from Mapbox.
 */
function handleMouseMove(e) {
    const map = getMapInstance();
    // Esci subito se la mappa non è pronta o non è in interazione
    if (!map || !map.isStyleLoaded() || map.isMoving() || map.isZooming() || map.isRotating()) {
        return;
    }

    try {
        // MODIFICATO: Interroga solo i layer KML *esistenti*
        const existingKmlLayers = [
            KML_LAYER_ID,
            KML_LAYER_ID + '-outline',
            KML_LAYER_ID + '-base-outline'
        ].filter(id => map.getLayer(id));

        // Se non ci sono layer KML, esci e assicurati che l'hover sia resettato
        if (existingKmlLayers.length === 0) {
             if (hoveredFeatureId !== null) {
                 setHoveredFeatureState(null);
                 changeCursor(map, '');
             }
            return;
        }

        // Interroga le feature sotto il cursore solo sui layer KML esistenti
        const features = map.queryRenderedFeatures(e.point, {
            layers: existingKmlLayers
        });

        if (features.length > 0) {
            const feature = features[0];
            // Ottieni l'ID in modo robusto
            let featureId = feature.id ?? feature.properties?.id;

            // Fallback se ID manca (come in handleKmlMouseEnter)
             if (featureId === undefined) {
                 const source = map.getSource(KML_SOURCE_ID);
                 if (source && source._data && source._data.features) {
                    const featureGeom = JSON.stringify(feature.geometry);
                    const matchingFeatureIndex = source._data.features.findIndex(f =>
                        JSON.stringify(f.geometry) === featureGeom ||
                        (feature.properties && f.properties && f.properties.name === feature.properties.name)
                    );
                    if (matchingFeatureIndex !== -1) {
                        featureId = source._data.features[matchingFeatureIndex].id ?? source._data.features[matchingFeatureIndex].properties?.id ?? `fallback_${matchingFeatureIndex}`;
                    }
                 }
             }

            // Se troviamo un ID valido e non è quello già in hover, aggiorna lo stato
            if (featureId !== undefined && hoveredFeatureId !== featureId) {
                // console.log("Trovata feature sotto il cursore (mousemove):", featureId);
                setHoveredFeatureState(featureId);
                changeCursor(map, 'pointer');
            } else if (featureId === undefined) {
                 // Se troviamo una feature ma non riusciamo a identificarla, non fare nulla o resetta hover?
                 // Per ora, non facciamo nulla per evitare flickering.
                 console.warn("MouseMove: Feature found but could not determine ID.", feature);
            }
             // Se è lo stesso feature, non fare nulla (già in hover)

        } else if (hoveredFeatureId !== null) {
            // Se non ci sono feature sotto il cursore E c'era un feature in hover, resetta lo stato
            // console.log("MouseMove: No features found, clearing hover.");
            setHoveredFeatureState(null);
            changeCursor(map, '');
        }
        // Se non ci sono feature e non c'era hover, non fare nulla.

    } catch (error) {
        console.error("Errore durante l'elaborazione del movimento del mouse:", error);
        // Reset sicuro in caso di errore
        if (hoveredFeatureId !== null) {
            try { setHoveredFeatureState(null); changeCursor(map, ''); } catch (resetError) {}
        }
    }
}