// Mappa sonora: mirino al centro della mappa, contorno della cella inquadrata e la scheda "Mappa sonora"
// in basso a sinistra (interruttore, stato in parole, tipo di musica, dettagli).
// Legge `mood`, `audioEnabled` e `musicMode` dallo store; scrive `audioEnabled` e `musicMode`.
import { mood, audioEnabled, musicMode } from '../state/store.js';
import { AUDIO_BASE } from '../data/config.js';
import { METRO, discomfort } from '../audio/metronomi.js';
import { regole } from '../audio/sottotraccia-regole.js';

const FOCUS_SOURCE_ID = 'compass-focus-source';
const FOCUS_LAYER_ID = 'compass-focus-layer';
const EMPTY = { type: 'FeatureCollection', features: [] };

const NOMI = {
    rifugio: 'Rifugio', passeggiata: 'Passeggiata', festa: 'Festa',
    attesa: 'Attesa', routine: 'Routine', corrente: 'Corrente',
    afa: 'Afa', fatica: 'Fatica', calca: 'Calca', notte: 'Notte'
};
// Una frase per stato, in parole semplici: energia = quanta gente intorno, piacevolezza = quanto si sta bene
const DESCRIZIONI = {
    rifugio: 'Poca gente e clima piacevole: un posto dove fermarsi.',
    passeggiata: 'Gente che cammina, clima piacevole.',
    festa: 'Molta gente, clima piacevole: allegria.',
    attesa: 'Poca gente, clima né bello né brutto: si aspetta.',
    routine: 'Gente al lavoro, ritmo normale, clima sopportabile.',
    corrente: 'Molta gente che scorre, clima sopportabile.',
    afa: 'Poca gente, ma caldo che pesa.',
    fatica: 'Gente e caldo: la città stanca.',
    calca: 'Tanta gente e caldo forte: la folla pesa.',
    notte: 'Buio e poca gente.'
};
const nome = s => NOMI[s] ?? '—';
const MODI = [
    ['ia', 'IA', 'Musica generata con un modello di IA'],
    ['classica', 'Classica', 'Brani di musica classica'],
    ['metronomi', 'Metronomi', 'Metronomi che battono insieme o no'],
    ['sottotraccia', 'Sottotraccia', 'Musica generata da regole']
];
// Fasce ufficiali di stress termico UTCI (soglia inferiore in °C)
const STRESS_UTCI = [
    [46, 'stress da caldo estremo'], [38, 'stress da caldo molto forte'], [32, 'stress da caldo forte'],
    [26, 'stress da caldo moderato'], [9, 'nessuno stress termico'], [0, 'leggero stress da freddo'],
    [-13, 'stress da freddo moderato'], [-27, 'stress da freddo forte'], [-40, 'stress da freddo molto forte'],
    [-Infinity, 'stress da freddo estremo']
];
const stress = u => STRESS_UTCI.find(([soglia]) => u >= soglia)[1];
const numero = (v, segno = false) => v.toLocaleString('it-IT', {
    minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: segno ? 'always' : 'auto'
});

function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
}

export function initCompassUI(map) {
    const container = map.getContainer();

    const cross = el('div', 'crosshair');
    cross.hidden = true;
    container.appendChild(cross);

    // --- La scheda ---
    const panel = document.getElementById('compass-panel');
    const head = el('div', 'card-head');
    const titolo = el('span', 'card-title', 'Mappa sonora');
    titolo.id = 'compass-title';
    head.append(titolo);
    const sw = el('button', 'switch');
    sw.type = 'button';
    sw.setAttribute('role', 'switch');
    sw.setAttribute('aria-labelledby', 'compass-title');
    sw.setAttribute('aria-checked', 'false');
    sw.append(el('span', 'switch-track'), el('span', 'switch-label', 'Spenta'));
    sw.onclick = () => audioEnabled.update(on => !on);
    head.append(sw);

    const off = el('p', 'card-off', 'Accendila e ascolta la città attorno al mirino, al centro della mappa.');
    const stato = el('div', 'card-state');
    const nomeStato = el('span', 'state-name');
    const descStato = el('span', 'state-desc');
    stato.append(nomeStato, descStato);

    const modi = el('div', 'modes seg');
    modi.setAttribute('role', 'group');
    modi.setAttribute('aria-label', 'Tipo di musica');
    const bottoniModi = {};
    for (const [valore, testo, titolo] of MODI) {
        const b = el('button', null, testo);
        b.type = 'button';
        b.title = titolo;
        b.setAttribute('aria-pressed', 'false');
        b.onclick = () => musicMode.set(valore);
        bottoniModi[valore] = b;
        modi.append(b);
    }

    const dettagli = el('details', 'details');
    dettagli.append(el('summary', null, 'Dettagli'));
    const corpo = el('div', 'details-body');
    dettagli.append(corpo);

    panel.replaceChildren(head, off, stato, modi, dettagli);

    // Titoli e autori dei brani classici (per la riga dei dettagli e per la citazione obbligatoria)
    let brani = null;
    fetch(AUDIO_BASE + 'classica/manifest.json').then(r => r.json()).then(j => { brani = j; render(); }).catch(() => {});

    map.addSource(FOCUS_SOURCE_ID, { type: 'geojson', data: EMPTY });
    map.addLayer({
        id: FOCUS_LAYER_ID, type: 'line', source: FOCUS_SOURCE_ID,
        paint: { 'line-color': '#111', 'line-width': 2.5 }
    });

    // Una riga di testo; i pezzi in grassetto sono scritti come { b: 'testo' }
    const riga = (pezzi) => {
        const p = el('p');
        p.append(...pezzi.map(t => typeof t === 'string' ? document.createTextNode(t) : el('b', null, t.b)));
        return p;
    };

    const render = () => {
        const on = audioEnabled.get(), m = mood.get(), modo = musicMode.get();
        sw.setAttribute('aria-checked', String(on));
        sw.querySelector('.switch-label').textContent = on ? 'Accesa' : 'Spenta';
        cross.hidden = !on;
        for (const [valore, b] of Object.entries(bottoniModi)) b.setAttribute('aria-pressed', String(valore === modo));
        map.getSource(FOCUS_SOURCE_ID)?.setData(on && m?.geometry ? { type: 'Feature', geometry: m.geometry, properties: {} } : EMPTY);

        off.hidden = on;
        stato.hidden = modi.hidden = dettagli.hidden = !on;
        if (!on) return;

        corpo.replaceChildren();
        if (!m) {
            nomeStato.textContent = 'In caricamento…';
            descStato.textContent = '';
            return;
        }
        if (m.fuori) {
            nomeStato.textContent = 'Silenzio';
            descStato.textContent = 'Il centro della mappa è fuori dalle celle LCZ.';
            return;
        }
        nomeStato.textContent = nome(m.stato);
        descStato.textContent = DESCRIZIONI[m.stato] ?? '';
        if (m.proposto) {
            descStato.textContent += ` Sta per passare a ${nome(m.proposto)}.`;
        }

        const quartiere = m.quartiere.replace(/^Ascoli - /, '');
        const dove = m.distanzaQuartiere > 0 ? `a ${m.distanzaQuartiere} m da ${quartiere}` : quartiere;
        corpo.append(riga(['Gente intorno: circa ', { b: `${Math.round(m.people)} persone` }, ` entro ${m.raggio} m.`]));
        corpo.append(riga([`Energia ${numero(m.X, true)} · Piacevolezza ${numero(m.Y, true)}`]));
        if (m.T !== null) {
            corpo.append(riga(['Temperatura percepita (UTCI, stima): ', { b: `≈ ${Math.round(m.T)} °C` }, ` · ${stress(m.T)}.`]));
        }
        corpo.append(riga([`Cella ${m.cella} (LCZ ${m.lcz}) · ${dove}.`]));
        if (m.giorni) {
            const data = new Date(m.giorni.scelto).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
            corpo.append(el('p', 'details-note', `Settimana tipo: meteo del ${data}, una giornata calda per questa cella (solo 1 giorno su 10, dei ${m.giorni.totale} del periodo, è stato più caldo).`));
        }
        const musicaRiga = musica(m, modo);
        if (musicaRiga) corpo.append(musicaRiga);
    };

    // Riga della musica: il brano (con autore e citazione), la musica a regole o quanto disagio c'è.
    const musica = (m, modo) => {
        if (modo === 'classica') {
            const b = brani?.[m.stato];
            return b ? el('p', null, `Brano: ${b.titolo}, ${b.autore}. Registrazione Musopen, licenza dichiarata: pubblico dominio.`) : null;
        }
        if (modo === 'sottotraccia') {
            const r = regole({ X: m.X, Y: m.Y, H: Number.isFinite(m.H) ? m.H : 0, I: 0 });
            return el('p', null, `Sottotraccia: ${Math.round(r.bpm)} battiti al minuto, registro ${Math.round(r.radice_Hz)} Hz (più grave con il caldo).`);
        }
        if (modo === 'metronomi') {
            return el('p', null, `Metronomi: disagio ${numero(discomfort(m))} su 1 (0 = battono insieme, 1 = ognuno per conto suo; ${METRO.N} metronomi).`);
        }
        return null;
    };

    mood.subscribe(render);
    audioEnabled.subscribe(render);
    musicMode.subscribe(render);
}
