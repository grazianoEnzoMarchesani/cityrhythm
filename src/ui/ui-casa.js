// ui-casa.js: «Chi sta a casa» nel gruppo Persone dei Livelli.
// Mostra la curva ISTAT (quota dei residenti in casa propria, ora per ora) del giorno della settimana della
// timeline, con l'ora corrente segnata. Legge lo store `time` e il file aggregato quota_in_casa.json: la regola
// sulla mappa sta in src/map/home-share.js e usa la stessa curva. Non dipende dal Periodo.
import { time } from '../state/store.js';
import { getDateTimeFromIndex } from '../utils/utils.js';
import { HOME_SHARE_URL } from '../data/config.js';
import { getBaseStyle } from '../map/map-setup.js';

const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
// Legenda dei puntini per stile di base: in Toner da vicino chi è fuori è bianco col bordo, e chi è in casa è solo più chiaro
const CHIAVE = {
    nolli: {
        fuori: 'Nero pieno: in giro, fuori casa.',
        casa: 'Vuoto, con solo il bordo bianco: in casa. Si vede sugli edifici scuri.'
    },
    toner: {
        fuori: 'Nero: in giro. Da vicino, vuoto con il bordo nero.',
        casa: 'Più chiaro, sbiadito: in casa.'
    }
};
// Unità del viewBox (260 di larghezza): a sinistra le percentuali, sotto le ore
const W = 260, H = 116, L = 30, R = 8, T = 12, B = 22;
const xOra = h => L + (h / 23) * (W - L - R);
const yQuota = q => T + (1 - q) * (H - T - B);
const percento = q => `${Math.round(q * 100)}%`;
const ora2 = h => String(h).padStart(2, '0') + ':00'; // stesso formato della timeline (Lun 06:00)

let curva = null;            // quota[giorno 0 = domenica][ora 0-23], da quota_in_casa.json
let giornoDisegnato = null;  // giorno per cui il grafico è già costruito
let grafico = null;          // contenitore del grafico
let lettura = null;          // frase con giorno, ora e quota
let minMax = null;           // riga sotto il grafico: minimo e massimo del giorno
let ora = null, punto = null, valore = null; // elementi SVG dell'ora corrente

export function setupCasaPanel() {
    grafico = document.getElementById('casa-chart');
    lettura = document.getElementById('casa-lettura');
    minMax = document.getElementById('casa-minmax');
    if (!grafico || !lettura) return;
    scriviChiave(getBaseStyle());
    // Cambio di stile di base (ui-map-tools.js): la legenda dei puntini segue lo stile
    document.addEventListener('stile-mappa', (e) => scriviChiave(e.detail));
    fetch(HOME_SHARE_URL)
        .then(r => r.json())
        .then(j => { curva = j.quota_in_casa; aggiorna(time.get()); })
        .catch(e => console.error('Curva in casa non caricata:', e));
    // Ogni cambio di ora (cursore, Play, frecce) passa da qui: solo aggiornamento di pochi elementi
    time.subscribe(aggiorna);
}

function scriviChiave(stile) {
    const frasi = CHIAVE[stile === 'toner' ? 'toner' : 'nolli'];
    const fuori = document.getElementById('dot-key-fuori');
    const casa = document.getElementById('dot-key-casa');
    if (fuori) fuori.textContent = frasi.fuori;
    if (casa) casa.textContent = frasi.casa;
    document.getElementById('dot-key')?.classList.toggle('stile-toner', stile === 'toner');
}

function aggiorna(t) {
    if (!curva || !t) return;
    const { jsDayOfWeek: giorno, hour } = getDateTimeFromIndex(t.index);
    if (giorno < 0 || hour < 0) return;
    if (giorno !== giornoDisegnato) disegnaGiorno(giorno);
    const q = curva[giorno][hour];
    const nome = GIORNI[giorno];
    lettura.textContent = `${nome[0].toUpperCase()}${nome.slice(1)}, ore ${ora2(hour)}. In casa: ${percento(q)} dei residenti.`;
    segnaOra(hour, q);
}

// Il grafico si costruisce una volta per giorno: area, linea, asse delle ore e dei valori
function disegnaGiorno(giorno) {
    giornoDisegnato = giorno;
    const valori = curva[giorno];
    const linea = valori.map((q, h) => `${xOra(h).toFixed(1)},${yQuota(q).toFixed(1)}`);
    const base = yQuota(0).toFixed(1);
    const area = `M${xOra(0).toFixed(1)},${base} L${linea.join(' L')} L${xOra(23).toFixed(1)},${base} Z`;
    const assiOre = [0, 6, 12, 18, 23].map(h => {
        const anchor = h === 0 ? 'start' : h === 23 ? 'end' : 'middle';
        return `<text class="casa-asse" x="${xOra(h).toFixed(1)}" y="${H - 4}" text-anchor="${anchor}">${ora2(h)}</text>`;
    }).join('');
    const assiQuote = [0, 0.5, 1].map(q => (
        `<text class="casa-asse" x="${L - 5}" y="${(yQuota(q) + 3.5).toFixed(1)}" text-anchor="end">${percento(q)}</text>`
    )).join('');
    grafico.innerHTML = `
        <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Quota di residenti in casa ora per ora, ${GIORNI[giorno]}">
            <path class="casa-area" d="${area}"/>
            <line class="casa-base" x1="${xOra(0)}" x2="${xOra(23)}" y1="${base}" y2="${base}"/>
            <polyline class="casa-curva" points="${linea.join(' ')}"/>
            <line class="casa-ora" x1="0" x2="0" y1="${T}" y2="${base}"/>
            <circle class="casa-punto" r="3.5" cx="0" cy="0"/>
            <text class="casa-valore" x="0" y="0"></text>
            ${assiQuote}${assiOre}
        </svg>`;
    const svg = grafico.querySelector('svg');
    ora = svg.querySelector('.casa-ora');
    punto = svg.querySelector('.casa-punto');
    valore = svg.querySelector('.casa-valore');
    const minimo = valori.indexOf(Math.min(...valori));
    const massimo = valori.indexOf(Math.max(...valori));
    if (minMax) minMax.textContent = `Nel giorno: minimo alle ${ora2(minimo)} (${percento(valori[minimo])}), massimo alle ${ora2(massimo)} (${percento(valori[massimo])}).`;
}

// Posizione dell'ora corrente: linea verticale, punto sulla curva e il valore accanto
function segnaOra(hour, q) {
    const cx = xOra(hour), cy = yQuota(q);
    ora.setAttribute('x1', cx.toFixed(1));
    ora.setAttribute('x2', cx.toFixed(1));
    punto.setAttribute('cx', cx.toFixed(1));
    punto.setAttribute('cy', cy.toFixed(1));
    valore.setAttribute('x', cx.toFixed(1));
    valore.setAttribute('y', (cy - 8).toFixed(1));
    // Vicino ai bordi il valore resta dentro il grafico
    valore.setAttribute('text-anchor', hour < 3 ? 'start' : hour > 20 ? 'end' : 'middle');
    valore.textContent = percento(q);
}
