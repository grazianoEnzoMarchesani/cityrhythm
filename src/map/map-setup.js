import { INITIAL_CENTER, INITIAL_ZOOM, MAP_STYLE, KML_SOURCE_ID, MAPBOX_TOKEN } from '../data/config.js';

let mapInstance = null;
let currentSelectedKmlFeatureId = null;

export function initializeMap(containerId) {
    if (mapInstance) {
        return mapInstance;
    }

    try {
        // MODIFICATO: Imposto mapboxgl.accessToken
        mapboxgl.accessToken = MAPBOX_TOKEN;

        // MODIFICATO: Usato mapboxgl
        mapInstance = new mapboxgl.Map({
            container: containerId,
            style: MAP_STYLE,
            center: INITIAL_CENTER,
            zoom: INITIAL_ZOOM,
            trackResize: true,
        });

        // MODIFICATO: Usato mapboxgl
        mapInstance.addControl(new mapboxgl.NavigationControl());

        mapInstance.on('error', (e) => {
            console.error("Mapbox Error:", e);
            // Gestione specifica per errori di caricamento stile/tile
            if (e.error && (e.error.message.includes('Failed to fetch') || e.error.message.includes('style'))) {
                 console.error("Could not load map style or tiles. Check style URL and network connection.");
                 // Potresti mostrare un messaggio all'utente qui
                 const mapContainer = document.getElementById(containerId);
                 if (mapContainer && !mapContainer.querySelector('.map-error-message')) {
                     const errorDiv = document.createElement('div');
                     errorDiv.className = 'map-error-message';
                     errorDiv.style.position = 'absolute';
                     errorDiv.style.top = '0';
                     errorDiv.style.left = '0';
                     errorDiv.style.width = '100%';
                     errorDiv.style.padding = '10px';
                     errorDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
                     errorDiv.style.color = 'white';
                     errorDiv.style.textAlign = 'center';
                     errorDiv.style.zIndex = '1000';
                     errorDiv.textContent = 'Error loading map style. Please check the console for details.';
                     mapContainer.appendChild(errorDiv);
                 }
            }
        });

        return mapInstance;

    } catch (error) {
         console.error("Failed to initialize map:", error);
         const mapContainer = document.getElementById(containerId);
         if (mapContainer) {
             mapContainer.innerHTML = `<div style="padding: 20px; color: red; background: #fdd; border: 1px solid red;">Failed to initialize map: ${error.message}. Please ensure Mapbox GL JS is loaded correctly.</div>`;
         }
         throw error; // Rilancia l'errore per bloccare eventualmente l'esecuzione
    }
}

export function getMapInstance() {
    // Nessuna modifica necessaria qui, ma ora ritorna un'istanza mapboxgl.Map
    if (!mapInstance) {
        // Considera un messaggio di errore più robusto o un ritorno gestito
        console.error("Map instance is not available. Was initializeMap called successfully?");
        throw new Error("Map instance is not available.");
    }
    return mapInstance;
}

export function setKmlFeatureSelectedState(featureId) {
    // Nessuna modifica necessaria qui, usa l'API standard setFeatureState
    if (!mapInstance || !mapInstance.isStyleLoaded()) {
        // Considera un logging o un tentativo di ritardo se lo stile non è caricato
        console.warn("setKmlFeatureSelectedState called before style loaded or map not ready.");
        return;
    }

    const sourceId = KML_SOURCE_ID;

    // Verifica se la source esiste prima di interagire
    if (!mapInstance.getSource(sourceId)) {
        console.warn(`Source ${sourceId} not found. Cannot set feature state.`);
        currentSelectedKmlFeatureId = null;
        return;
    }

    const previousFeatureId = currentSelectedKmlFeatureId;

    // Deseleziona il feature precedente, se esiste
    if (previousFeatureId !== null && previousFeatureId !== undefined) {
        try {
            // Verifica se il feature state esiste prima di tentare di impostarlo a false
             if (mapInstance.getFeatureState({ source: sourceId, id: previousFeatureId })?.selected) {
                mapInstance.setFeatureState(
                    { source: sourceId, id: previousFeatureId },
                    { selected: false }
                );
             }
        } catch (e) {
            // Logga errori meno comuni, ignora errori "not found" che possono accadere
            if (!e.message?.includes('not found') && !e.message?.includes('No feature with ID')) {
                console.warn(`Minor error deselecting previous feature ${previousFeatureId}: ${e.message}`);
            }
        }
    }

    // Seleziona il nuovo feature, se fornito
    if (featureId !== null && featureId !== undefined) {
         // Non c'è bisogno di distinguere se è lo stesso del precedente,
         // setFeatureState sovrascrive o imposta lo stato.
        try {
             mapInstance.setFeatureState(
                 { source: sourceId, id: featureId },
                 { selected: true }
             );
             currentSelectedKmlFeatureId = featureId;
        } catch (e) {
             if (!e.message?.includes('not found') && !e.message?.includes('No feature with ID')) {
                 console.error(`Error setting feature state for ID ${featureId}: ${e.message}`);
             } else {
                 console.warn(`Feature with ID ${featureId} not found in source ${sourceId}. Cannot select.`);
             }
             // Se fallisce la selezione, assicurati che non rimanga selezionato
             currentSelectedKmlFeatureId = null;
        }
    } else {
        // Se featureId è null o undefined, nessun feature è selezionato
        currentSelectedKmlFeatureId = null;
    }
}