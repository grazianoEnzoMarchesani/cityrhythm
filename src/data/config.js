// MAPBOX_TOKEN richiesto per Mapbox GL JS
export const MAPBOX_TOKEN = 'pk.eyJ1IjoiaW9ub25ob3Byb2JsZW1pIiwiYSI6ImNtYnFtb2dhazAxMmUyanM3bzEzdDc4bXQifQ.rmY4WI_G8YqBMpuuIsDV-A';

export const KML_URL = 'https://gist.githubusercontent.com/grazianoEnzoMarchesani/aad5e543d62ffd2478b0152348f39e0d/raw/305653b7b40f5858e0d8f83e11a99e921ac500a8/cityrhythm_blimp_areas.kml';
export const POI_CSV_URL = 'https://gist.githubusercontent.com/grazianoEnzoMarchesani/0ac7cac113479e704e2af0865e7f516d/raw/adb569636698d58b16a610dbc82f1b4936f9b2ad/cityrhythm_blimp.csv';
export const CROWDED_CSV_URL = 'https://gist.githubusercontent.com/grazianoEnzoMarchesani/d4574acad4dabf1e4b83fe2d68a59e91/raw/90bd98a5ff27ba9d968028ae374211f90025d284/cityrhythm_crowded_data.csv';
export const SPOTS_CSV_URL = 'https://gist.githubusercontent.com/grazianoEnzoMarchesani/c2813df8436ad6ebb91327d5e517f1ae/raw/296130747c07c88cb834d7860a1ceaee43502281/cityrhythm_spotMapper.csv';
export const LCZ_VITALITY_CSV_URL = 'https://gist.githubusercontent.com/grazianoEnzoMarchesani/bc2ad1bea5689e0195296daa57f9b893/raw/0ecce2a26b35c561e110a135638f4f5b84c8acd8/lcz_vitality.csv';

export const INITIAL_CENTER = [12.5674, 41.8719];
export const INITIAL_ZOOM = 5;
// MODIFICATO: Usa lo style Mapbox personalizzato
//export const MAP_STYLE = 'mapbox://styles/iononhoproblemi/cm9uelpgk01cg01quansz7pyz2';
export const MAP_STYLE = 'mapbox://styles/iononhoproblemi/cm9v60wy9000z01qq3nhhecur';


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
        TEXT_FONT: ['Open Sans Regular', 'Arial Unicode MS Regular'], // Aggiunto font di fallback comune
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
    CIRCLE_COLOR: [
      'interpolate', ['linear'], ['zoom'],
      14, 'rgb(0, 0, 0)',
      15, 'rgb(255, 255, 255)',

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

export const DEBUG_MODE = false;