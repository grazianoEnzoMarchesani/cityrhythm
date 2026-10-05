// Dati serviti dal sito stesso (public/data/), non da servizi esterni
const DATA_BASE = import.meta.env.BASE_URL + 'data/';

export const KML_URL = DATA_BASE + 'cityrhythm_blimp_areas.kml';
export const POI_CSV_URL = DATA_BASE + 'cityrhythm_blimp.csv';
export const CROWDED_CSV_URL = DATA_BASE + 'cityrhythm_crowded_data.csv';
export const SPOTS_CSV_URL = DATA_BASE + 'cityrhythm_spotMapper.csv';
// Celle LCZ da 30 m, area dei quartieri (vedi sound-lab/estrai_lcz.py)
export const LCZ_GEOJSON_URL = DATA_BASE + 'lcz_ascoli.geojson';
// Bussola emotiva: parametri (scritti anche da sound-lab/compass.py) e meteo orario Open-Meteo
export const BUSSOLA_URL = DATA_BASE + 'bussola.json';
export const METEO_URL = DATA_BASE + 'meteo_ascoli.json';
export const HOME_SHARE_URL = DATA_BASE + 'quota_in_casa.json'; // quota in casa per giorno e ora (ISTAT via IPUMS MTUS)
// Brani, suoni urbani e mix della mappa sonora (preparati in sound-lab/)
export const AUDIO_BASE = import.meta.env.BASE_URL + 'audio/';

// Mappa di base, terreno ed edifici: file locali, solo Comune di Ascoli Piceno (vedi sound-lab/estrai_edifici_gba.py)
export const MAP_DATA_BASE = DATA_BASE + 'mappa/';

export const INITIAL_CENTER = [13.5786, 42.8545]; // Ascoli Piceno
export const INITIAL_ZOOM = 13;


export const KML_SOURCE_ID = 'kml-data-source';
export const KML_LAYER_ID = 'kml-data-layer';
export const PRESENCE_POINTS_SOURCE_ID = 'presence-points-source';
export const PRESENCE_POINTS_LAYER_ID = 'presence-points-layer';
export const CROWDED_SOURCE_ID = 'crowded-points-source';
export const CROWDED_LAYER_ID = 'crowded-points-layer';
export const SPOTS_SOURCE_ID = 'spots-points-source';
export const SPOTS_LAYER_ID = 'spots-points-layer';
export const SYNTHETIC_CROWDED_SOURCE_ID = 'synthetic-crowded-points-source'; // Aggiunto per coerenza
export const SYNTHETIC_CROWDED_LAYER_ID = 'synthetic-crowded-points-layer'; // Aggiunto per coerenza
export const LCZ_VITALITY_SOURCE_ID = 'lcz-vitality-source';
export const LCZ_VITALITY_LAYER_ID = 'lcz-vitality-layer';


export const PRESENCE_POINTS_DENSITY_FACTOR = 50;
export const MAX_PRESENCE_POINTS = 100;

export const ATTRACTION_MAX_SEARCH_RADIUS_KM = 2;

export const ATTRACTION_STRENGTH_FACTOR = 100;
export const ATTRACTION_MAX_DISPLACEMENT_KM = 2;
export const ATTRACTION_MIN_CROWDEDNESS = 1;
export const GRAVITATIONAL_DECAY = 2.5;

// Percentuale di presence point statici (non attratti dagli attractor)
export const PRESENCE_STATIC_POINTS_RATIO = 0.1;

// Gente in casa: quanti dipende dall'ora e dal giorno (regola in src/map/home-share.js, curva ISTAT in
// HOME_SHARE_URL); la casa è un edificio TUM del proprio quartiere scelto in proporzione ai residenti
// stimati da Meta (campo res, sound-lab/residenti_meta.py).
// Opacità relativa dei puntini di chi è in casa (1 = come gli altri): "dentro un edificio"
export const PRESENCE_HOME_OPACITY = 0.5;
// Durata dello spostamento dei puntini quando cambia l'ora (0 = salto senza animazione)
export const PRESENCE_MOVE_MS = 1000;
// Chi arriva in città o la lascia entra/esce da questo punto, oltre la sua posizione in direzione opposta al centro
export const PRESENCE_EXIT_METERS = 600;
// Partenze sfalsate: ognuno parte con un ritardo fino a questa quota dello spostamento (0 = tutti insieme)
export const PRESENCE_STAGGER = 0.4;
// Deviazione laterale massima del percorso (metri; al più il 20% della distanza)
export const PRESENCE_BEND_MAX_M = 60;
// Brulichio "a formichine" attorno al proprio posto: ~3 pixel sullo schermo, fra 1,5 e 15 metri
export const PRESENCE_WIGGLE_PX = 3;
export const PRESENCE_WIGGLE_MIN_M = 1.5;
export const PRESENCE_WIGGLE_MAX_M = 15;

export const CHART_COLORS = {
    GENDER_CHART: {
      MALE: '#4A76E8',
      FEMALE: '#FF9F6B'
    },
    AGE_CHART: {
      '18-24': '#FF5722', // Arancione scuro
      '25-34': '#2196F3', // Blu
      '35-44': '#4CAF50', // Verde
      '45-54': '#FFC107', // Giallo
      '55-64': '#9C27B0', // Viola
      '65+': '#F44336'    // Rosso
    },
    NATIONALITY_CHART: {
      ITALIANS: '#4CAF50',
      FOREIGNERS: '#9575CD'
    },


    PROVINCE_CHART: {
      PROVINCE_1: '#1976D2',
      PROVINCE_2: '#43A047',
      PROVINCE_3: '#FFA000',
      PROVINCE_4: '#E53935',
      PROVINCE_5: '#7E57C2',
      PROVINCE_6: '#757575',
      ASCOLI_PICENO: '#5C8D9E' // Colore specifico per Ascoli Piceno
    },
    COUNTRY_CHART: {
      COUNTRY_1: '#F57C00',
      COUNTRY_2: '#795548',
      COUNTRY_3: '#546E7A',
      COUNTRY_4: '#8E24AA',
      COUNTRY_5: '#AFB42B',
      ITALY: '#1976D2' // Colore specifico per Italia
    },

    INTERESTS_CHART: {
      'Beauty': '#F87E60',
      'Book': '#4CAF50',
      'Culture': '#8BC34A',
      'Discount': '#FF7043',
      'Energy': '#5C6BC0',
      'Entertainment': '#EF5350',
      'Fashion': '#EC407A',
      'Fitness': '#26A69A',
      'Food': '#FDD835',
      'Free time': '#42A5F5',
      'Health': '#66BB6A',
      'Home appliance': '#9C27B0',
      'Homedecor': '#D7816A',
      'Insurance': '#616161',
      'Interior design': '#CDDC39',
      'Kids': '#FF5252',
      'Luxury': '#BF9E4D',
      'Motor': '#757575',
      'News': '#5C7CFA',
      'Pet': '#26C6DA',
      'Photography': '#AB47BC',
      'Sex': '#FF5722',
      'Streaming': '#7E57C2',
      'Tech': '#29B6F6',
      'Travel': '#26A69A'
    },
    VISITS_CHART: {
      VISIT_1: '#00BCD4',
      VISIT_2: '#8BC34A',
      VISIT_3: '#FBC02D',
      VISIT_4: '#F44336',
      VISIT_5: '#673AB7'
    }
  };

export const CHART_PALETTE = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc'];

// Configurazioni estetiche per i layer della mappa
// Questi stili dovrebbero essere compatibili con MapLibre, in quanto usano la specifica standard
export const MAP_STYLES = {
  // KML Layer Style
  KML_LAYER: {
    BASE_OUTLINE: {
      'line-color': 'rgba(255, 255, 255, 0.2)',
      'line-width': 1.5
    },
    FILL: {
      HOVER: 'rgba(255, 200, 80, 0.3)',
      SELECTED: 'transparent', // Era 'rgba(0, 0, 0, 0.1)' - Manteniamo trasparente per selezione
      DEFAULT: 'transparent' // Era 'rgba(0, 0, 0, 0)'
    },
    OPACITY: { // Opacità del fill
      HOVER: 1, // Era 0.8
      SELECTED: 0.2, // Era 0.5
      DEFAULT: 0
    },
    OUTLINE: {
      HOVER_COLOR: '#000',
      SELECTED_COLOR: '#000',
      DEFAULT_COLOR: 'transparent',
      HOVER_WIDTH: 3,
      SELECTED_WIDTH: 1, // Era 1.5
      DEFAULT_WIDTH: 0,
      HOVER_OPACITY: 1,
      SELECTED_OPACITY: 1,
      DEFAULT_OPACITY: 0
    }
  },



  // Crowded Points Layer Style
  CROWDED_POINTS: {
    CIRCLE_RADIUS: [ // Invariato
      'interpolate', ['linear'], ['get', 'current_crowdedness'],
      
      10, 0,
      50, 2,
      100, 4
    ],
    CIRCLE_COLOR: [ // Invariato
      'interpolate', ['linear'], ['get', 'current_crowdedness'],
      0, '#ffffcc', // Giallo pallido
      25, '#a1dab4', // Verde acqua chiaro
      50, '#41b6c4', // Turchese
      75, '#2c7fb8', // Blu medio
      100, '#253494' // Blu scuro
    ],
    CIRCLE_OPACITY: 0.8, // Invariato
    CIRCLE_STROKE_WIDTH: 1, // Invariato
    CIRCLE_STROKE_COLOR: '#ffffff', // Invariato
    CIRCLE_STROKE_OPACITY: 0.9 // Invariato
  },

  // Synthetic Crowded Points Layer Style
  SYNTHETIC_CROWDED_POINTS: {
      CIRCLE_RADIUS: [ // Invariato
          'interpolate', ['linear'], ['get', 'synthetic_crowdedness'],

          10, 0,
          50, 2,
          100, 4
      ],
      CIRCLE_COLOR: [ // Invariato - palette viola
          'interpolate', ['linear'], ['get', 'synthetic_crowdedness'],
          0, '#e0e0ff', // Viola molto chiaro
          25, '#a1a1e6', // Viola chiaro
          50, '#6c6cc1', // Viola medio
          75, '#3a3a99', // Viola scuro
          100, '#1a1461' // Viola molto scuro
      ],
      CIRCLE_OPACITY: 0.7, // Invariato
      CIRCLE_STROKE_WIDTH: 1, // Invariato
      CIRCLE_STROKE_COLOR: '#222266', // Stroke più scuro per contrasto
      CIRCLE_STROKE_OPACITY: 0.8 // Invariato
  },

  // Spots Layer Style
  SPOTS: {
    CIRCLE_RADIUS: 3, // Invariato
    CIRCLE_COLOR: [ // Mappa colori invariata
      'match',
      ['get', 'tipo'],
       'restaurant', '#FF5733',       // Arancione Rosso
       'lodging', '#33A1FF',          // Blu Chiaro
       'clothing_store', '#FF33A8',   // Rosa Fucsia
       'art_gallery', '#A833FF',      // Viola
       'health', '#33FF57',          // Verde Chiaro
       'point_of_interest', '#FFDD33',// Giallo
       'home_goods_store', '#3498DB', // Blu
       'city_hall', '#E74C3C',        // Rosso Mattone
       'library', '#2ECC71',        // Verde Smeraldo
       'bar', '#F39C12',            // Arancione
       'insurance_agency', '#9B59B6', // Viola Ametista
       'doctor', '#1ABC9C',          // Turchese
       'meal_delivery', '#D35400',    // Arancione Bruciato
       'bank', '#27AE60',            // Verde Scuro
       'veterinary_care', '#8E44AD', // Viola Scuro
       'bicycle_store', '#F1C40F',    // Giallo Girasole
       'hospital', '#E74C3C',        // Rosso (come city hall)
       'store', '#16A085',          // Verde Mare Scuro
       'supermarket', '#2980B9',     // Blu Scuro
       'pharmacy', '#C0392B',        // Rosso Scuro
       'florist', '#F39C12',        // Arancione (come bar)
       'cafe', '#D35400',            // Arancione Bruciato (come meal_delivery)
       'accounting', '#7F8C8D',      // Grigio Ardesia
       'museum', '#E67E22',          // Arancione Carota
       'tourist_attraction', '#3498DB',// Blu (come home_goods_store)
       'parking', '#BDC3C7',        // Grigio Argento
       'movie_theater', '#E74C3C',    // Rosso (come hospital)
       'car_repair', '#7F8C8D',      // Grigio (come accounting)
       'electrician', '#F39C12',     // Arancione (come florist)
       'park', '#2ECC71',            // Verde (come library)
       'hair_care', '#9B59B6',      // Viola (come insurance)
       'car_rental', '#34495E',      // Blu Notte
       'lawyer', '#7F8C8D',          // Grigio (come car_repair)
       'church', '#3498DB',          // Blu (come tourist_attraction)
       'jewelry_store', '#F1C40F',    // Giallo (come bicycle_store)
       'general_contractor', '#95A5A6',// Grigio Chiaro
       'bakery', '#E67E22',          // Arancione (come museum)
       'place_of_worship', '#9B59B6', // Viola (come hair_care)
       'finance', '#2980B9',         // Blu (come supermarket)
       'shoe_store', '#E74C3C',       // Rosso (come movie_theater)
       'furniture_store', '#16A085',  // Verde (come store)
       'plumber', '#7F8C8D',         // Grigio (come lawyer)
       'police', '#3498DB',           // Blu (come church)
       'transit_station', '#95A5A6',   // Grigio (come general_contractor)
       'liquor_store', '#D35400',     // Arancione (come cafe)
       'university', '#2980B9',      // Blu (come finance)
       'gym', '#F39C12',             // Arancione (come electrician)
       'travel_agency', '#3498DB',    // Blu (come police)
       'dentist', '#E74C3C',          // Rosso (come shoe_store)
       'local_government_office', '#7F8C8D', // Grigio (come plumber)
       'school', '#2ECC71',           // Verde (come park)
       'beauty_salon', '#E67E22',     // Arancione (come bakery)
       'electronics_store', '#9B59B6',// Viola (come place_of_worship)
       'cemetery', '#7F8C8D',         // Grigio (come local_government_office)
       'moving_company', '#95A5A6',   // Grigio (come transit_station)
       'real_estate_agency', '#3498DB',// Blu (come travel_agency)
       'storage', '#7F8C8D',         // Grigio (come cemetery)
       'gas_station', '#F39C12',      // Arancione (come gym)
       'car_wash', '#16A085',         // Verde (come furniture_store)
       'food', '#D35400',             // Arancione (come liquor_store)
       'shopping_mall', '#9B59B6',    // Viola (come electronics_store)
       'atm', '#2980B9',             // Blu (come university)
       'primary_school', '#2ECC71',    // Verde (come school)
       'secondary_school', '#27AE60', // Verde Scuro (come bank)
       'grocery_or_supermarket', '#2980B9', // Blu (come atm)
       'laundry', '#7F8C8D',         // Grigio (come storage)
       'train_station', '#95A5A6',    // Grigio (come moving_company)
       'book_store', '#2980B9',       // Blu (come grocery)
       'post_office', '#E74C3C',      // Rosso (come dentist)
       'meal_takeaway', '#D35400',    // Arancione (come food)
       'landmark', '#F1C40F',         // Giallo (come jewelry_store)
       'night_club', '#8E44AD',       // Viola Scuro (come veterinary_care)
       'roofing_contractor', '#7F8C8D',// Grigio (come laundry)
       'courthouse', '#3498DB',       // Blu (come real_estate_agency)
       'spa', '#9B59B6',             // Viola (come shopping_mall)
       'car_dealer', '#16A085',       // Verde (come car_wash)
       'drugstore', '#C0392B',        // Rosso Scuro (come pharmacy)
       'stadium', '#2980B9',          // Blu (come book_store)
       'physiotherapist', '#1ABC9C',  // Turchese (come doctor)
       'department_store', '#9B59B6', // Viola (come spa)
       'hardware_store', '#7F8C8D',   // Grigio (come roofing_contractor)
       'locksmith', '#95A5A6',        // Grigio (come train_station)
       'rv_park', '#27AE60',          // Verde Scuro (come secondary_school)
       'zoo', '#D35400',             // Arancione (come meal_takeaway)
       'funeral_home', '#7F8C8D',     // Grigio (come hardware_store)
       'pet_store', '#9B59B6',        // Viola (come department_store)
       'amusement_park', '#F1C40F',   // Giallo (come landmark)
       'convenience_store', '#16A085',// Verde (come car_dealer)
       'bus_station', '#95A5A6',      // Grigio (come locksmith)
       'bowling_alley', '#8E44AD',    // Viola Scuro (come night_club)
       'campground', '#2ECC71',       // Verde (come primary_school)
       '#AAAAAA' // Default Grigio
    ],
    CIRCLE_OPACITY: 0.5, // Invariato
    CIRCLE_STROKE_WIDTH: 1, // Invariato
    CIRCLE_STROKE_COLOR: '#000', // Invariato
    CIRCLE_STROKE_OPACITY: 0.5, // Invariato

    // Labels
    LABELS: {
        TEXT_FONT: ['Noto Sans Regular'], // unico font ospitato in public/data/mappa/fonts
        TEXT_SIZE: 10, // Invariato
        TEXT_OFFSET: [0, 1.5], // Invariato
        TEXT_ALLOW_OVERLAP: false, // Invariato
        TEXT_IGNORE_PLACEMENT: false, // Invariato
        TEXT_OPTIONAL: true, // Invariato
        TEXT_COLOR: '#333333', // Invariato
        TEXT_HALO_COLOR: '#FFFFFF', // Invariato
        TEXT_HALO_WIDTH: 1 // Invariato
    }
  },

  PRESENCE_POINTS_COLOR: { // <-- nuovo stile per chi ha 'color'
    CIRCLE_RADIUS: [
      'interpolate', ['linear'], ['zoom'],
      10, 1,
      13, 2,
      16, 6,
      18, 8
    ],
    CIRCLE_COLOR: ['get', 'color'],
    CIRCLE_OPACITY: 1,
    CIRCLE_STROKE_WIDTH: 1,
    CIRCLE_STROKE_COLOR: [
      'interpolate', ['linear'], ['zoom'],
      14, 'rgba(0, 0, 0, 0)',
      15, 'rgb(0, 0, 0)'
    ],
    CIRCLE_STROKE_OPACITY: 1
  },

  PRESENCE_POINTS_ZOOM: { // <-- nuovo stile per chi NON ha 'color'
    CIRCLE_RADIUS: [
      'interpolate', ['linear'], ['zoom'],
      10, 1,
      13, 2,
      16, 6,
      18, 8
    ],
    // Da vicino chi è fuori diventa bianco, chi è in casa resta nero (homeT: 0 fuori → 1 in casa)
    CIRCLE_COLOR: [
      'interpolate', ['linear'], ['zoom'],
      14, 'rgb(0, 0, 0)',
      15, ['interpolate', ['linear'], ['coalesce', ['get', 'homeT'], ['case', ['==', ['get', 'atHome'], true], 1, 0]],
        0, 'rgb(255, 255, 255)',
        1, 'rgb(0, 0, 0)']
    ],
    CIRCLE_OPACITY: 1,
    CIRCLE_STROKE_WIDTH: 1,
    CIRCLE_STROKE_COLOR: [
      'interpolate', ['linear'], ['zoom'],
      14, 'rgba(0, 0, 0, 0)',
      15, 'rgb(0, 0, 0)'
    ],
    CIRCLE_STROKE_OPACITY: 1
  },

  // LCZ Vitality Layer Style
  LCZ_VITALITY: {
    FILL_OPACITY: 0.7,
    STROKE_WIDTH: 1,
    STROKE_COLOR: '#ffffff',
    STROKE_OPACITY: 0.8,
    // LCZ Color mapping - using case expression for better error handling
    LCZ_COLORS: [
      'case',
      ['==', ['get', 'LCZ'], '1'], '#8B0000', // Compact high-rise - Rosso scuro
      ['==', ['get', 'LCZ'], '2'], '#cf0201', // Compact midrise - Rosso
      ['==', ['get', 'LCZ'], '3'], '#fe0100', // Compact low-rise - Rosso chiaro
      ['==', ['get', 'LCZ'], '4'], '#bd4d01', // Open high-rise - Arancione
      ['==', ['get', 'LCZ'], '5'], '#ff6600', // Open midrise - Arancione
      ['==', ['get', 'LCZ'], '6'], '#ff9957', // Open low-rise - Arancione chiaro
      ['==', ['get', 'LCZ'], '7'], '#f9ef00', // Lightweight low-rise - Giallo
      ['==', ['get', 'LCZ'], '8'], '#bcbcbc', // Large low-rise - Grigio chiaro
      ['==', ['get', 'LCZ'], '9'], '#fecca9', // Sparsely built - Pesca/Beige
      ['==', ['get', 'LCZ'], '10'], '#555555', // Heavy industry - Grigio scuro
      ['==', ['get', 'LCZ'], 'A'], '#016901', // Dense trees - Verde scuro
      ['==', ['get', 'LCZ'], 'B'], '#06aa02', // Scattered trees - Verde
      ['==', ['get', 'LCZ'], 'C'], '#638526', // Bush, scrub - Verde chiaro/Cachi
      ['==', ['get', 'LCZ'], 'D'], '#badb7a', // Low plants - Verde lime
      ['==', ['get', 'LCZ'], 'E'], '#000000', // Bare rock or paved - Nero
      ['==', ['get', 'LCZ'], 'F'], '#fbf5ad', // Bare soil or sand - Giallo paglierino
      ['==', ['get', 'LCZ'], 'G'], '#6a6afe', // Water - Blu
      ['==', ['get', 'LCZ'], 'UNKNOWN'], '#888888', // Unknown/Invalid LCZ - Grigio
      '#888888' // Default color for any other value
    ],
    // UHI Risk Color mapping - using case expression for better error handling
    UHI_COLORS: [
      'case',
      ['==', ['get', 'UHI risk'], 'Very Low'], '#c1e4f5',
      ['==', ['get', 'UHI risk'], 'Low'], '#c0f0c8',
      ['==', ['get', 'UHI risk'], 'Low-Medium'], '#d9f2d0',
      ['==', ['get', 'UHI risk'], 'Medium-Low'], '#fae2d6',
      ['==', ['get', 'UHI risk'], 'Medium'], '#f6c6ac',
      ['==', ['get', 'UHI risk'], 'High'], '#e97131',
      ['==', ['get', 'UHI risk'], 'Very High'], '#ff5150',
      '#cccccc' // Default color for any other value
    ]
  }
};

// Altre mappe delle celle LCZ, una per parametro di costruzione (selettore "Show" sotto LCZ Vitality).
// Scale continue in tinte che non compaiono fra i colori LCZ né UHI (blu notte, ciano, viola, magenta, ardesia).
// stops: [valore, colore] crescenti, scelti sui percentili 5–95 per non farsi schiacciare dagli estremi;
// celle senza valore (o con il valore di difetto `missing`) trasparenti.
export const LCZ_DATA_VIEWS = {
  svf_mean: {
    label: 'Sky view factor', unit: '0–1', missing: 0,
    note: 'Share of sky visible from the street: dark = narrow alleys, light = open space',
    stops: [[0.2, '#0d1a3a'], [0.4, '#2d4a8a'], [0.55, '#3f86b4'], [0.7, '#7fc3d6'], [0.9, '#e3f5fa']]
  },
  aspect_ratio: {
    label: 'Street canyon (H/W)', unit: '',
    note: 'Building height ÷ street width: deep purple = deep, shaded canyons',
    stops: [[0, '#efedf5'], [0.3, '#bcbddc'], [0.7, '#9e9ac8'], [1.2, '#756bb1'], [2, '#3f007d']]
  },
  building_frac: {
    label: 'Built surface', unit: '%',
    note: 'Ground covered by buildings',
    stops: [[0, '#eef0f8'], [15, '#b7bde0'], [35, '#7a83c4'], [60, '#4a4f98'], [100, '#1d1f56']]
  },
  impervious_frac: {
    label: 'Sealed surface', unit: '%',
    note: 'Asphalt and paving: water cannot soak in',
    stops: [[0, '#f1edf3'], [15, '#c9bcd3'], [35, '#9580aa'], [60, '#5e4a78'], [100, '#2a1c40']]
  },
  pervious_frac: {
    label: 'Permeable surface', unit: '%',
    note: 'Soil, grass and trees: ground that breathes and cools',
    stops: [[0, '#e8f6f5'], [25, '#a3dcd6'], [50, '#4fb7b0'], [75, '#178a8a'], [100, '#0b4f58']]
  },
  z_h: {
    label: 'Height of buildings and trees', unit: 'm',
    note: 'Average height of what stands on the cell',
    stops: [[0, '#f2eefa'], [6, '#c7c0ea'], [12, '#8f86d6'], [18, '#5a4cb0'], [26, '#2b1d72']]
  },
  terrain_rough: {
    label: 'Roughness class', unit: '1–8',
    note: 'Davenport classes: how much the cell brakes the wind (8 = city centre)',
    stops: [[2, '#e0f7fa'], [4, '#80deea'], [6, '#26c6da'], [7, '#00838f'], [8, '#004d57']]
  },
  z0_value: {
    label: 'Roughness length z0', unit: 'm',
    note: 'Wind brake used for the sound compass: dark = sheltered, light = windy',
    stops: [[0.005, '#e0f7fa'], [0.1, '#a5e8f1'], [0.5, '#26c6da'], [1, '#00838f'], [2, '#004d57']]
  },
  admittance: {
    label: 'Thermal admittance', unit: 'J m⁻² s⁻½ K⁻¹',
    note: 'How much heat the materials store by day and release at night',
    stops: [[1000, '#f6eef7'], [1200, '#d4b9da'], [1400, '#c994c7'], [1600, '#a8509e'], [1800, '#5b1a63']]
  },
  albedo: {
    label: 'Albedo', unit: '0–1',
    note: 'Sunlight reflected: dark = absorbs and heats, light = reflects',
    stops: [[0.2, '#1b1b3a'], [0.25, '#45446e'], [0.28, '#7b78a6'], [0.31, '#b8b5d6'], [0.36, '#f1f0fa']]
  },
  anthro_heat: {
    label: 'Human-made heat', unit: 'W/m²',
    note: 'Heat from traffic, heating and air conditioning',
    stops: [[0, '#f9e8f2'], [2, '#e6a0c8'], [10, '#c9479b'], [30, '#7d1d72'], [100, '#2c0b3f']]
  },
  industry_heat: {
    label: 'Industrial heat', unit: 'W/m²',
    note: 'Only the 48 industrial cells; the rest is transparent',
    stops: [[0, '#f9e8f2'], [5, '#e6a0c8'], [30, '#c9479b'], [70, '#7d1d72'], [150, '#2c0b3f']]
  },
  lcz_matches: {
    label: 'Classification agreement', unit: 'of 10',
    note: 'How many of the 10 parameters agree with the assigned class: dark = reliable',
    stops: [[3, '#eceaf6'], [5, '#b8b3dc'], [7, '#7c74bd'], [9, '#4b3f99'], [10, '#1e1660']]
  }
};

// Mappe orarie calcolate dalla bussola (src/compass/cell-map.js), lette dal feature-state delle celle.
// UTCI: 10 fasce ufficiali di stress termico [soglia inferiore in °C, colore, nome, nome italiano].
export const UTCI_BANDS = [
  [-Infinity, '#0b1847', 'Extreme cold stress', 'stress da freddo estremo'],
  [-40, '#16367f', 'Very strong cold stress', 'stress da freddo molto forte'],
  [-27, '#2364b4', 'Strong cold stress', 'stress da freddo forte'],
  [-13, '#4f9bd9', 'Moderate cold stress', 'stress da freddo moderato'],
  [0, '#a6d8f0', 'Slight cold stress', 'leggero stress da freddo'],
  [9, '#66bd63', 'No thermal stress', 'nessuno stress termico'],
  [26, '#fdae61', 'Moderate heat stress', 'stress da caldo moderato'],
  [32, '#f46d43', 'Strong heat stress', 'stress da caldo forte'],
  [38, '#d7191c', 'Very strong heat stress', 'stress da caldo molto forte'],
  [46, '#6e0000', 'Extreme heat stress', 'stress da caldo estremo']
];
// Scala continua della mappa UTCI: soglie ufficiali, verde pieno a metà della fascia senza stress.
// [°C, colore, etichetta nella legenda (null = nessuna)]
export const UTCI_RAMP = [
  [-13, '#2364b4', '−13'], [0, '#8cc8ec', '0'], [9, '#b9e0a5', '9'], [17.5, '#66bd63', null],
  [26, '#fee08b', '26'], [32, '#f46d43', '32'], [38, '#d7191c', '38'], [46, '#6e0000', '46 °C']
];
// Stati della bussola: riga = piacevolezza (sereno verde-azzurro, neutro grigio-viola, opprimente arancio-rosso),
// colonna = energia (poca gente chiaro, tanta gente scuro). Stessa griglia di bussola.json.
export const SOUND_STATE_COLORS = {
  rifugio: '#b8e3d6', passeggiata: '#4fb39a', festa: '#17725c',
  attesa: '#ddd8e8', routine: '#9a8fb5', corrente: '#5d4f85',
  afa: '#fdc9a0', fatica: '#f0803c', calca: '#b33a0e',
  notte: '#14204a'
};

export const DEBUG_MODE = false;