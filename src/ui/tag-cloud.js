// tag-cloud.js
import { getCrowdedData, getFullKmlGeoJson, getSpotMapperData } from '../data/data-loader.js';
import { getCrowdednessColumnName, generateSyntheticCrowdedPointsGeoJson } from '../map/map-layers.js';
import { DEBUG_MODE } from '../data/config.js';


// Name of the element where the tag cloud will be rendered
const TAG_CLOUD_CONTAINER = 'tag-cloud-container';

/**
 * Extracts all unique tags from crowded data with counts and crowdedness values.
 * @param {string} columnName - Name of the crowdedness column for the current hour.
 * @param {string|null} kmlFeatureId - Optional KML feature ID selected to filter tags.
 * @returns {Array<object>} Array of tag objects with name, count, and total crowdedness.
 */


function extractTagsFromAttractorMode(columnName, kmlFeatureId = null) {
    // Forza la modalità synthetic
    const mode = 'synthetic';
    let real = [];
    let synthetic = [];
    if (mode === 'real' || mode === 'both') {
        real = getCrowdedData() || [];
    }
    if (mode === 'synthetic' || mode === 'both') {
        const spots = getSpotMapperData() || [];
        const crowded = getCrowdedData() || [];
        const syntheticGeo = generateSyntheticCrowdedPointsGeoJson(spots, crowded, columnName);
        if (syntheticGeo && syntheticGeo.features?.length) {
            synthetic = syntheticGeo.features.map(f => ({
                TAG: f.properties.TAG,
                synthetic_crowdedness: f.properties.synthetic_crowdedness,
                Longitudine: f.geometry.coordinates[0],
                Latitudine: f.geometry.coordinates[1]
            }));
        }
    }
    let records = [];
    if (mode === 'real') records = real;
    else if (mode === 'synthetic') records = synthetic;
    else records = [...real, ...synthetic];
    // Filtro per area se serve
    if (kmlFeatureId) {
        const kmlGeoJson = getFullKmlGeoJson();
        const selectedFeature = kmlGeoJson?.features?.find(f => f.id === kmlFeatureId);
        if (selectedFeature && window.turf && window.turf.area(selectedFeature) > 0) {
            records = records.filter(record => {
                const lon = record.longitude ?? record.Longitudine;
                const lat = record.latitude ?? record.Latitudine;
                if (!lon || !lat) return false;
                const point = turf.point([lon, lat]);
                return turf.booleanPointInPolygon(point, selectedFeature);
            });
        }
    }
    // Calcolo tag
    const tagMap = new Map();
    records.forEach(record => {
        const tagField = record.TAG;
        if (!tagField || typeof tagField !== 'string') return;
        const value = (record.synthetic_crowdedness !== undefined)
            ? record.synthetic_crowdedness
            : (record.crowdedness !== undefined ? record.crowdedness : 0);
        const crowdednessValue = (record.synthetic_crowdedness !== undefined)
            ? record.synthetic_crowdedness
            : (record.crowdedness !== undefined ? record.crowdedness : 0);
        const tags = tagField.split(',').map(tag => tag.trim()).filter(tag => tag);
        tags.forEach(tag => {
            if (!tagMap.has(tag)) {
                tagMap.set(tag, { count: 0, totalCrowdedness: 0 });
            }
            const tagData = tagMap.get(tag);
            tagData.count += 1;
            tagData.totalCrowdedness += crowdednessValue;
        });
    });
    // LOG: Stampo tutti i TAG unici processati per debug
    if (DEBUG_MODE) console.log('[TAG-CLOUD] TAG unici nella word cloud:', Array.from(tagMap.keys()));
    return Array.from(tagMap.entries())
        .map(([name, data]) => ({
            text: name,
            count: data.count,
            value: data.totalCrowdedness,
            avgCrowdedness: data.count > 0 ? data.totalCrowdedness / data.count : 0
        }))
        .sort((a, b) => b.value - a.value);
}

/**
 * Creates or updates the word cloud in the sidebar
 * @param {number} timelineHourIndex - Index of the current hour in the timeline
 * @param {string|null} kmlFeatureId - Optional selected KML feature ID
 * @param {HTMLElement|null} parentElement - Parent element to add the tag cloud container
 */
export function updateTagCloud(timelineHourIndex, kmlFeatureId = null, parentElement = null) {
    const columnName = getCrowdednessColumnName(timelineHourIndex);
    if (!columnName) return;
    
    const tagData = extractTagsFromAttractorMode(columnName, kmlFeatureId);
    if (!tagData || tagData.length === 0) return;
    
    // Create the container only if there is data
    const container = createTagCloudElement();
    if (parentElement) parentElement.appendChild(container);
    
    // Recreate the title
    const newTitle = document.createElement('h4');
    newTitle.textContent = 'Interest';
    container.appendChild(newTitle);
    
    // Container dimensions
    const width = container.clientWidth || 300;
    const height = Math.max(container.clientHeight || 200, 200);
    
    // Create the word cloud
    createWordCloud(container, tagData, width, height);
}

/**
 * Creates a DOM element for the tag cloud
 * @returns {HTMLElement} Container element for the tag cloud
 */
export function createTagCloudElement() {
    const container = document.createElement('div');
    container.id = TAG_CLOUD_CONTAINER;
    container.className = 'tag-cloud-container';
    return container;
}

/**
 * Creates a word cloud using D3.js
 * @param {HTMLElement} container - DOM container element
 * @param {Array<object>} words - Array of words with text and value properties
 * @param {number} width - Container width
 * @param {number} height - Container height
 */
function createWordCloud(container, words, width, height) {
    if (!words || words.length === 0) {
        const message = document.createElement('p');
        message.textContent = 'No tags available for this area/time.';
        message.style.textAlign = 'center';
        message.style.color = '#888';
        message.style.padding = '20px';
        container.appendChild(message);
        return;
    }
    
    try {
        // Limit the number of words to 500 for performance
        const maxWords = 500;
        const topWords = words.slice(0, maxWords);
        
        // Define the colour scale based on value
        const colorScale = d3.scaleLinear()
            .domain([0, d3.max(topWords, d => d.value)])
            .range(['rgb(180, 180, 180)', '#000']);
        
        // Create the word cloud layout
        const layout = d3.layout.cloud()
            .size([width, height])
            .words(topWords.map(d => ({ 
                text: d.text, 
                size: Math.sqrt(d.value)/2 ,
                value: d.value,
                count: d.count,
                avgCrowdedness: d.avgCrowdedness
            })))
            .padding(2)
            .rotate(() => {
                const angles = [0, 45, -45, 90];
                return angles[Math.floor(Math.random() * angles.length)];
            })
            .fontSize(d => d.size)
            .on("end", draw);
        
        layout.start();
        
        // Function to draw the word cloud
        function draw(words) {
            const svg = d3.select(container).append("svg")
                .attr("width", width)
                .attr("height", height)
                .attr("viewBox", [0, 0, width, height])
                .attr("style", "max-width: 100%; height: auto;");
            
            svg.append("g")
                .attr("transform", `translate(${width/2},${height/2})`)
                .selectAll("text")
                .data(words)
                .enter().append("text")
                .style("font-size", d => `${d.size}px`)
                .style("font-family", "Arial, sans-serif")
                .style("fill", d => colorScale(d.value))
                .style("cursor", "pointer")
                .attr("text-anchor", "middle")
                .attr("transform", d => `translate(${d.x},${d.y}) rotate(${d.rotate})`)
                .text(d => d.text)
                .append("title")
                .text(d => `${d.text}: ${Math.round(d.avgCrowdedness)} average crowdedness (${d.count} points)`);
        }
    } catch (error) {
        if (DEBUG_MODE) console.error("Error creating tag cloud:", error);
        const message = document.createElement('p');
        message.textContent = 'Error displaying tags.';
        message.style.textAlign = 'center';
        message.style.color = 'red';
        message.style.padding = '20px';
        container.appendChild(message);
    }
} 