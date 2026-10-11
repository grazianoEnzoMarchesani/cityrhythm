// Scheda "Area": la struttura si costruisce una volta per area (e quando cambia se ci sono dati),
// poi a ogni ora si aggiornano solo i numeri e i grafici. I calcoli stanno in ui-sidebar.js.
import { createChart } from '../charts/charts.js';
import { CHART_COLORS, DEBUG_MODE } from '../data/config.js';
import { PRESENCE_COLOR_VARIABLES, getPresenceColorBy } from '../map/presence-colors.js';
import { getPresenceDots, redrawPresenceDots } from '../map/map-layers.js';
import { setPresenceColorSelection } from './ui-layer-controls.js';

const TOP_INTERESSI = 8;
const TOP_LUOGHI = 6;
const COLORE_GIORNI = '#7d8590';   // barre per giorno: grigio medio, 3,7:1 su bianco
const COLORE_ALTRO = '#cfcfcf';    // il resto dei puntini: non è un numero mostrato
const COLORE_TESTO = '#111111';
const COLORE_TESTO_2 = '#444444';
const COLORE_TESTO_3 = '#5f5f5f';
const COLORE_GRIGLIA = '#eeeeee';

// Medie per il blocco "Chi frequenta": per ogni variabile di colore, le chiavi di `averages` nell'ordine delle categorie
const CHIAVI_GRUPPI = {
    gender: ['percM', 'percF'],
    age: ['perc18_24', 'perc25_34', 'perc35_44', 'perc45_54', 'perc55_64', 'perc65plus'],
    nationality: ['percItaliani', 'percStranieri'],
    visits: ['visite1', 'visite2', 'visite3', 'visite4', 'visite5']
};

const fmtInt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 });
const fmtUno = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const numero = v => (Number.isFinite(v) ? fmtInt.format(v) : 'n.d.');
const decimale = v => (Number.isFinite(v) ? fmtUno.format(v) : 'n.d.');
const percento = v => (Number.isFinite(v) ? `${fmtUno.format(v)}%` : 'n.d.');
const limite = v => Math.min(100, Math.max(0, v));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let contenitore = null;
let vista = null;           // ultimo stato calcolato per la scheda
let chiaveMostrata = null;  // area + presenza di dati: se cambia, la struttura si rifà
const istanze = {};        // grafici ECharts per id del contenitore

// --- ASCOLTO E CICLO DI VITA ---
export function initAreaPanel(elemento) {
    contenitore = elemento;
    contenitore.addEventListener('click', alClic);
    // Il "toggle" non risale il DOM: si ascolta in fase di cattura. Aprire un dettaglio disegna i suoi grafici.
    contenitore.addEventListener('toggle', () => { disegnaGrafici(); resizeAreaCharts(); }, true);
}

// Scheda svuotata o cambio di area: i grafici vanno eliminati prima che il loro DOM sparisca
export function resetAreaPanel() {
    disposeCharts();
    chiaveMostrata = null;
    vista = null;
}

// Dati già calcolati da ui-sidebar.js: `medie` e `statistiche` sono gli oggetti di calculateAndDisplayAverages
export function paintAreaPanel(nuovaVista) {
    if (!contenitore) return;
    nuovaVista.province = vociTop(nuovaVista.medie.provinces, 6, (nome, i) => (
        nome.toLowerCase().includes('ascoli') ? CHART_COLORS.PROVINCE_CHART.ASCOLI_PICENO : (CHART_COLORS.PROVINCE_CHART[`PROVINCE_${i + 1}`] || '#cccccc')
    ));
    nuovaVista.nazioni = vociTop(nuovaVista.medie.countries, 5, (nome, i) => (
        nome.toLowerCase() === 'italia' ? CHART_COLORS.COUNTRY_CHART.ITALY : (CHART_COLORS.COUNTRY_CHART[`COUNTRY_${i + 1}`] || '#cccccc')
    ));
    nuovaVista.interessi = vociInteressi(nuovaVista.medie.interests);
    vista = nuovaVista;

    const chiave = `${nuovaVista.featureId}|${nuovaVista.count > 0}`;
    if (chiave !== chiaveMostrata) {
        disposeCharts();
        contenitore.innerHTML = scheletro(nuovaVista);
        chiaveMostrata = chiave;
    }
    if (nuovaVista.count === 0) return;
    aggiornaTesti();
    disegnaGrafici();
}

export function resizeAreaCharts() {
    Object.values(istanze).forEach(chart => {
        try { chart?.resize(); } catch (e) { if (DEBUG_MODE) console.warn('Ridimensionamento grafico:', e); }
    });
}

// --- STRUTTURA (una volta per area) ---
function scheletro(v) {
    if (v.count === 0) {
        return '<p class="note note-center note-gap">Nessun dato storico per questo giorno e quest’ora. Prova un altro momento sulla timeline.</p>';
    }
    return `
    <div class="ap">
        <header class="ap-testata">
            <p class="ap-quando" id="ap-quando"></p>
            <p class="ap-numero" id="ap-numero"></p>
            <p class="ap-numero-nota">persone in media in quest’ora</p>
            <p class="ap-periodo" id="ap-periodo"></p>
        </header>

        <section class="ap-sez">
            <h4>Giorno per giorno</h4>
            <p class="ap-nota">Presenze in quest’ora, una barra per giorno. Linea tratteggiata: media. Numeri: minimo e massimo.</p>
            <div id="presenze-giorno-chart" class="ap-chart ap-chart-giorno"></div>
        </section>

        <section class="ap-sez">
            <h4>Chi frequenta</h4>
            <p class="ap-nota">Quota media di ogni gruppo. Clic su una voce per colorare i puntini sulla mappa.</p>
            <div id="ap-chi"></div>
        </section>

        <section class="ap-sez">
            <h4>Da dove vengono</h4>
            <p class="ap-nota">Le prime sei province e le prime cinque nazioni dell’elenco: le altre non sono elencate. Clic su una riga per colorare i puntini.</p>
            <div id="ap-dove"></div>
        </section>

        <section class="ap-sez">
            <h4>Interessi</h4>
            <p class="ap-nota">Categorie più diffuse fra chi frequenta l’area, da indici di affinità medi.</p>
            <div id="interessi-chart" class="ap-chart ap-chart-interessi"></div>
            <details class="ap-altri" id="ap-interessi-altri">
                <summary id="ap-interessi-titolo">Tutti gli interessi</summary>
                <div id="interessi-tutti-chart" class="ap-chart ap-chart-tutti"></div>
            </details>
        </section>

        <section class="ap-sez">
            <h4>Tipi di luogo</h4>
            <p class="ap-nota">Luoghi con affollamento simulato in quest’ora. La barra è l’affollamento sommato per tipo. Non cambia con il Periodo.</p>
            <div id="ap-luoghi"></div>
            <details class="ap-altri" id="ap-luoghi-altri">
                <summary id="ap-luoghi-altri-titolo">Altri tipi</summary>
                <div id="ap-luoghi-resto"></div>
            </details>
        </section>

        <details class="ap-altri ap-dettaglio" id="ap-dettaglio">
            <summary>Dettaglio: giorno per giorno e minimi</summary>
            <div class="ap-det">
                <p class="ap-mm" id="ap-mm-presenze"></p>
            </div>
            <div class="ap-det">
                <h5 class="ap-sub">Genere</h5>
                <div id="dettaglio-genere-chart" class="ap-chart ap-chart-piccolo"></div>
                <p class="ap-mm" id="ap-mm-genere"></p>
            </div>
            <div class="ap-det">
                <h5 class="ap-sub">Età</h5>
                <div id="dettaglio-eta-chart" class="ap-chart ap-chart-piccolo"></div>
            </div>
            <div class="ap-det">
                <h5 class="ap-sub">Nazionalità</h5>
                <div id="dettaglio-nazionalita-chart" class="ap-chart ap-chart-piccolo"></div>
                <p class="ap-mm" id="ap-mm-nazionalita"></p>
            </div>
            <div class="ap-det">
                <h5 class="ap-sub">Visite</h5>
                <div id="dettaglio-visite-chart" class="ap-chart ap-chart-piccolo"></div>
                <p class="ap-mm" id="ap-mm-visite"></p>
            </div>
        </details>
    </div>`;
}

// --- TESTI E NUMERI (ogni ora) ---
function aggiornaTesti() {
    const v = vista;
    testo('ap-quando', `${v.etichetta} · media di ${v.count} ${v.count === 1 ? 'giorno' : 'giorni'}`);
    testo('ap-numero', numero(v.medie.presenzeOra));
    testo('ap-periodo', `Nei giorni considerati, in tutte le ore: da ${numero(v.assoluto.min.value)} (${quando(v.assoluto.min)}) a ${numero(v.assoluto.max.value)} (${quando(v.assoluto.max)}).`);

    html('ap-chi', blocchiChi(v));
    html('ap-dove', blocchiDove(v));

    const massimoLuogo = v.luoghi[0]?.valore ?? 0;
    html('ap-luoghi', righeLuoghi(v.luoghi.slice(0, TOP_LUOGHI), massimoLuogo));
    html('ap-luoghi-resto', righeLuoghi(v.luoghi.slice(TOP_LUOGHI), massimoLuogo));
    const altriLuoghi = v.luoghi.length - TOP_LUOGHI;
    const altriBox = document.getElementById('ap-luoghi-altri');
    if (altriBox) altriBox.hidden = altriLuoghi <= 0;
    testo('ap-luoghi-altri-titolo', `Altri tipi (${Math.max(0, altriLuoghi)})`);
    testo('ap-interessi-titolo', `Tutti gli interessi (${v.interessi.length})`);

    const mm = minimiMassimi(v);
    html('ap-mm-presenze', mm.presenze);
    html('ap-mm-genere', mm.genere);
    html('ap-mm-nazionalita', mm.nazionalita);
    html('ap-mm-visite', mm.visite);
    aggiornaStatoColori();
}

function quando(punto) {
    const data = punto.date || 'n.d.';
    return punto.hour === null ? data : `${data}, ore ${punto.hour}:00`;
}

function blocchiChi(v) {
    const attiva = getPresenceColorBy();
    return ['gender', 'age', 'nationality', 'visits'].map(chiave => {
        const categorie = PRESENCE_COLOR_VARIABLES[chiave].categories;
        const valori = CHIAVI_GRUPPI[chiave].map(k => v.medie[k] || 0);
        const totale = valori.reduce((somma, x) => somma + x, 0) || 1;
        return `
        <div class="ap-quota">
            <h5 class="ap-sub">${PRESENCE_COLOR_VARIABLES[chiave].label}</h5>
            <div class="ap-barra" aria-hidden="true">
                ${categorie.map((c, i) => `<span style="width:${(valori[i] / totale * 100).toFixed(2)}%;background:${c.color}"></span>`).join('')}
            </div>
            <div class="ap-legenda">
                ${categorie.map((c, i) => `
                <button type="button" class="ap-voce" data-color-by="${chiave}" aria-pressed="${attiva === chiave}">
                    <span class="ap-punto" style="background:${c.color}"></span>${esc(c.name)} <b>${percento(valori[i])}</b>
                </button>`).join('')}
            </div>
        </div>`;
    }).join('');
}

function blocchiDove(v) {
    return `
    <div class="ap-gruppo">
        <h5 class="ap-sub">Province</h5>
        ${righeQuote(v.province, 'province')}
    </div>
    <div class="ap-gruppo">
        <h5 class="ap-sub">Nazioni</h5>
        ${righeQuote(v.nazioni, 'nazioni')}
    </div>`;
}

function righeQuote(voci, gruppo) {
    if (!voci.length) return '<p class="ap-vuoto">Nessun dato.</p>';
    return voci.map(x => `
        <button type="button" class="ap-riga" data-color-once="${gruppo}">
            <span class="ap-riga-nome">${esc(x.nome)}</span>
            <span class="ap-traccia"><span style="width:${limite(x.valore)}%;background:${x.colore}"></span></span>
            <span class="ap-riga-val">${percento(x.valore)}</span>
        </button>`).join('');
}

function righeLuoghi(voci, massimo) {
    return voci.map(x => `
        <div class="ap-riga">
            <span class="ap-riga-nome">${esc(x.nome)}</span>
            <span class="ap-traccia"><span style="width:${massimo > 0 ? (x.valore / massimo * 100).toFixed(1) : 0}%;background:${COLORE_GIORNI}"></span></span>
            <span class="ap-riga-val">${numero(x.conteggio)} ${x.conteggio === 1 ? 'punto' : 'punti'}</span>
        </div>`).join('');
}

// Minimi e massimi giorno per giorno: stessi dati di prima, scritti una riga per categoria
function minimiMassimi(v) {
    const s = v.statistiche;
    const riga = (nome, chiave, fmt) => `${nome}: minimo ${fmt(s[chiave].min.value)} (${s[chiave].min.date || 'n.d.'}), massimo ${fmt(s[chiave].max.value)} (${s[chiave].max.date || 'n.d.'})`;
    return {
        presenze: riga('Presenze in quest’ora', 'presenzeOra', numero),
        genere: [riga('Uomini', 'percM', percento), riga('Donne', 'percF', percento)].join('<br>'),
        nazionalita: [riga('Italiani', 'percItaliani', percento), riga('Stranieri', 'percStranieri', percento)].join('<br>'),
        visite: [riga('1 visita', 'visite1', percento), riga('2 visite', 'visite2', percento), riga('3 visite', 'visite3', percento)].join('<br>')
    };
}

function aggiornaStatoColori() {
    const attiva = getPresenceColorBy();
    contenitore?.querySelectorAll('[data-color-by]').forEach(voce => {
        voce.setAttribute('aria-pressed', String(voce.dataset.colorBy === attiva));
    });
}

// --- CLIC: colorazione dei puntini ---
function alClic(e) {
    const voce = e.target.closest('[data-color-by], [data-color-once]');
    if (!voce || !vista) return;
    if (voce.dataset.colorBy) setPresenceColorSelection(voce.dataset.colorBy);
    else coloraUnaVolta(voce.dataset.colorOnce);
    aggiornaStatoColori();
}

// Province o nazioni: i puntini si colorano una volta, secondo le quote. Il resto è grigio e non è un numero mostrato
function coloraUnaVolta(gruppo) {
    const voci = gruppo === 'province' ? vista.province : vista.nazioni;
    if (!voci.length) return;
    const resto = Math.max(0, 100 - voci.reduce((somma, x) => somma + x.valore, 0));
    setPresenceColorSelection('none', false);
    updatePresencePointsColors(
        vista.featureId,
        [...voci.map(x => ({ name: x.nome, value: x.valore })), { name: 'Altro', value: resto }],
        [...voci.map(x => x.colore), COLORE_ALTRO]
    );
}

function updatePresencePointsColors(kmlFeatureId, chartData, colors) {
    if (DEBUG_MODE) console.log(`Inizio aggiornamento colori per KML Feature ID: ${kmlFeatureId}`);

    // Una voce per persona (nella sorgente della mappa i puntini uguali sono raggruppati)
    const allPoints = getPresenceDots();
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
        // Gli altri quartieri tornano senza colore (potevano averne uno dal selettore)
        allPoints.forEach(point => {
            if (point.properties.kmlFeatureId !== kmlFeatureId) delete point.properties.color;
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

    // Ridisegna i puntini coi nuovi colori
    redrawPresenceDots();
}

// --- GRAFICI ---
function disegnaGrafici() {
    const v = vista;
    if (!v || v.count === 0) return;
    disegnaGrafico('presenze-giorno-chart', presenzeOption(v), 'Nessun dato sulle presenze.');
    disegnaGrafico('interessi-chart', interessiOption(v.interessi.slice(0, TOP_INTERESSI)), 'Nessun dato sugli interessi.');
    // I grafici dentro un dettaglio chiuso si disegnano solo all'apertura: ECharts in un contenitore a 0×0 resta vuoto
    if (apertoId('ap-interessi-altri')) disegnaGrafico('interessi-tutti-chart', interessiOption(v.interessi), 'Nessun dato sugli interessi.');
    if (apertoId('ap-dettaglio')) {
        disegnaGrafico('dettaglio-genere-chart', barreGiornoOption(v.registri, 'gender', 100), 'Nessun dato sul genere.');
        disegnaGrafico('dettaglio-eta-chart', barreGiornoOption(v.registri, 'age', 100), 'Nessun dato sull’età.');
        disegnaGrafico('dettaglio-nazionalita-chart', barreGiornoOption(v.registri, 'nationality', 100), 'Nessun dato sulla nazionalità.');
        disegnaGrafico('dettaglio-visite-chart', barreGiornoOption(v.registri, 'visits'), 'Nessun dato sulle visite.');
    }
}

function disegnaGrafico(id, opzioni, messaggio) {
    const el = document.getElementById(id);
    if (!el) return;
    const conDati = opzioni.series.some(s => Array.isArray(s.data) && s.data.length > 0);
    try {
        if (!conDati) {
            istanze[id]?.dispose();
            delete istanze[id];
            el.innerHTML = `<p class="ap-vuoto">${messaggio}</p>`;
            return;
        }
        if (!istanze[id]) {
            el.innerHTML = '';
            istanze[id] = createChart(el);
        }
        istanze[id].setOption(opzioni, { notMerge: true });
    } catch (e) {
        console.error(`Grafico #${id}:`, e);
        delete istanze[id];
        el.innerHTML = '<p class="ap-vuoto">Errore nel caricamento del grafico.</p>';
    }
}

function disposeCharts() {
    Object.keys(istanze).forEach(id => {
        try { istanze[id]?.dispose(); } catch (e) { /* già eliminato con il suo contenitore */ }
        delete istanze[id];
    });
}

function presenzeOption(v) {
    const valori = v.registri.map(r => valoreCampo(r, [`presenze_${v.ora}`]));
    const media = v.medie.presenzeOra;
    return {
        grid: { left: 4, right: 8, top: 26, bottom: 6, containLabel: true },
        tooltip: { trigger: 'axis', formatter: p => `${esc(p[0].name)}: ${numero(p[0].value)} persone` },
        xAxis: {
            type: 'category', data: v.registri.map(dataIt), axisTick: { show: false },
            axisLabel: { color: COLORE_TESTO_3, fontSize: 10, hideOverlap: true }
        },
        yAxis: {
            type: 'value', axisLabel: { color: COLORE_TESTO_3, fontSize: 10, formatter: x => numero(x) },
            splitLine: { lineStyle: { color: COLORE_GRIGLIA } }
        },
        series: [{
            type: 'bar', data: valori, barMaxWidth: 12,
            itemStyle: { color: COLORE_GIORNI, borderRadius: [2, 2, 0, 0] },
            markLine: {
                silent: true, symbol: 'none',
                lineStyle: { color: COLORE_TESTO, type: 'dashed', width: 1 },
                label: {
                    formatter: `media ${numero(media)}`, position: 'insideEndTop', color: COLORE_TESTO, fontSize: 11,
                    backgroundColor: '#ffffff', padding: [1, 4]
                },
                data: [{ yAxis: media }]
            },
            markPoint: {
                symbol: 'circle', symbolSize: 6, itemStyle: { color: COLORE_TESTO },
                label: { color: COLORE_TESTO, fontSize: 11, formatter: p => numero(p.value) },
                data: [{ type: 'min', label: { position: 'top' } }, { type: 'max', label: { position: 'top' } }]
            }
        }]
    };
}

// Interessi: il primo dato sta in basso, quindi l'elenco arriva rovesciato. Un solo colore: niente legenda
function interessiOption(lista) {
    const righe = [...lista].reverse();
    return {
        grid: { left: 4, right: 40, top: 4, bottom: 4, containLabel: true },
        tooltip: { trigger: 'axis', axisPointer: { type: 'none' }, formatter: p => `${esc(p[0].name)}: ${decimale(p[0].value)}` },
        // Sotto lo zero serve spazio per le etichette dei valori negativi, che non devono toccare i nomi.
        // Il minimo va arrotondato all'intero più basso: così le graduazioni restano numeri leggibili
        xAxis: {
            type: 'value', min: v => (v.min < 0 ? Math.floor(v.min * 1.25) : 0),
            axisLabel: { color: COLORE_TESTO_3, fontSize: 10 }, splitLine: { lineStyle: { color: COLORE_GRIGLIA } }
        },
        yAxis: {
            type: 'category', data: righe.map(r => r.nome), axisTick: { show: false },
            axisLine: { show: false, onZero: false }, axisLabel: { color: COLORE_TESTO, fontSize: 11 }
        },
        series: [{
            type: 'bar', barMaxWidth: 12, itemStyle: { color: COLORE_GIORNI },
            data: righe.map(r => ({ value: r.valore, label: { position: r.valore < 0 ? 'left' : 'right' } })),
            label: { show: true, color: COLORE_TESTO_2, fontSize: 10, formatter: p => decimale(p.value) }
        }]
    };
}

// Barre per giorno impilate, con le categorie e i colori dei puntini (così scheda e mappa coincidono)
function barreGiornoOption(registri, chiave, massimo) {
    const categorie = PRESENCE_COLOR_VARIABLES[chiave].categories;
    const opzioni = {
        grid: { left: 4, right: 8, top: 26, bottom: 6, containLabel: true },
        tooltip: { trigger: 'axis' },
        legend: {
            top: 0, right: 0, itemWidth: 10, itemHeight: 8, itemGap: 10,
            textStyle: { color: COLORE_TESTO_2, fontSize: 10 }, data: categorie.map(c => c.name)
        },
        xAxis: {
            type: 'category', data: registri.map(dataIt), axisTick: { show: false },
            axisLabel: { color: COLORE_TESTO_3, fontSize: 10, hideOverlap: true }
        },
        yAxis: {
            type: 'value', axisLabel: { color: COLORE_TESTO_3, fontSize: 10, formatter: x => `${x}%` },
            splitLine: { lineStyle: { color: COLORE_GRIGLIA } }
        },
        series: categorie.map(c => ({
            name: c.name, type: 'bar', stack: chiave, barMaxWidth: 12,
            itemStyle: { color: c.color },
            data: registri.map(r => valoreCampo(r, c.fields))
        }))
    };
    if (massimo) opzioni.yAxis.max = massimo;
    return opzioni;
}

// --- UTILITÀ ---
function vociTop(mappa, n, colore) {
    return Object.entries(mappa || {})
        .map(([nome, valore]) => ({ nome, valore: parseFloat(valore?.toFixed(1)) || 0 }))
        .filter(x => x.valore > 0.1)
        .sort((a, b) => b.valore - a.valore)
        .slice(0, n)
        .map((x, i) => ({ ...x, colore: colore(x.nome, i) }));
}

function vociInteressi(interessi) {
    return Object.entries(interessi || {})
        .map(([nome, valore]) => ({
            nome: nome.charAt(0).toUpperCase() + nome.slice(1).replace(/_/g, ' '),
            valore: parseFloat(valore?.toFixed(2)) || 0
        }))
        .filter(x => !isNaN(x.valore))
        .sort((a, b) => b.valore - a.valore);
}

// Primo campo presente nel record (alcuni file hanno nomi alternativi), letto come numero
function valoreCampo(record, campi) {
    const campo = campi.find(c => record[c] !== undefined);
    return campo === undefined ? 0 : parseFloat(record[campo]) || 0;
}

function dataIt(record) {
    return record.parsedDate instanceof Date ? record.parsedDate.toLocaleDateString('it-IT', { timeZone: 'UTC' }) : 'n.d.';
}

function apertoId(id) {
    return document.getElementById(id)?.open === true;
}

function testo(id, valore) {
    const el = document.getElementById(id);
    if (el) el.textContent = valore;
}

function html(id, valore) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = valore;
}
