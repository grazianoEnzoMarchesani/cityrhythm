// Mappa sonora: mirino al centro della mappa, contorno della cella inquadrata e, a sinistra della timeline,
// un quadrante con la lancetta. Il tocco sul quadrante apre il pannello: interruttore, stato in parole,
// tipo di musica, dettagli. Legge `mood`, `audioEnabled` e `musicMode` dallo store; scrive `audioEnabled` e `musicMode`.
import { mood, audioEnabled, musicMode } from '../state/store.js';
import { AUDIO_BASE } from '../data/config.js';
import { METRO, discomfort } from '../audio/metronomi.js';
import { regole } from '../audio/sottotraccia-regole.js';
import { SOUND_STATE_COLORS } from '../data/sound-colors.js';
import { POSIZIONE_STATI } from '../compass/sound-color.js';
import { LCZ_NAMES } from '../map/map-layers.js';

const FOCUS_SOURCE_ID = 'compass-focus-source';
const FOCUS_LAYER_ID = 'compass-focus-layer';
const EMPTY = { type: 'FeatureCollection', features: [] };
const NOTTE_COLORE = SOUND_STATE_COLORS.notte;

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
const MODI = [['ia', 'IA'], ['classica', 'Classica'], ['metronomi', 'Metronomi'], ['sottotraccia', 'Sottotraccia']];
// Fasce della temperatura percepita (UTCI), in parole semplici; soglia inferiore in °C
const FASCE_TERMICHE = [
    [46, 'caldo estremo'], [38, 'caldo molto forte'], [32, 'caldo forte'], [26, 'caldo moderato'],
    [9, 'nessun disagio termico'], [0, 'freddo lieve'], [-13, 'freddo moderato'], [-27, 'freddo forte'],
    [-40, 'freddo molto forte'], [-Infinity, 'freddo estremo']
];
const fascia = t => FASCE_TERMICHE.find(([soglia]) => t >= soglia)[1];

// Numeri in formato italiano: virgola decimale, meno tipografico (−), spazio indivisibile prima dell'unità
const MENO = '−', SPAZIO = ' ';
const decimale = (v, conSegno = false) => v.toLocaleString('it-IT', {
    minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: conSegno ? 'exceptZero' : 'auto'
}).replace('-', MENO);
const gradi = t => `≈${SPAZIO}${Math.round(t)}${SPAZIO}°C`;
const dataLunga = iso => new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const giornoSettimana = iso => new Date(iso).toLocaleDateString('it-IT', { weekday: 'long', timeZone: 'UTC' });
const persone = (m) => {
    const n = Math.round(m.people);
    if (n === 0) return `nessuna entro ${m.raggio} m`;
    if (n === 1) return `1 persona entro ${m.raggio} m`;
    return `circa ${n} persone entro ${m.raggio} m`;
};

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

    // --- Il quadrante, nel riquadro della timeline ---
    // Il quadrante accende e spegne la musica con un tocco; il pulsante sotto apre il pannello dei modi e dei dettagli
    const dial = document.getElementById('compass-button');
    const square = dial.querySelector('.dial-square');
    const apriBtn = document.getElementById('compass-open');
    const etichetta = apriBtn.querySelector('.dial-label');
    // Nove caselle con i colori degli stati, sulle loro posizioni: piacevolezza alta in alto, energia alta a destra
    const celle = {};
    for (const [stato, [X, Y]] of Object.entries(POSIZIONE_STATI)) {
        const c = el('span', 'dial-cell');
        c.style.gridColumn = String(X + 2);
        c.style.gridRow = String(2 - Y);
        square.append(c);
        celle[stato] = c;
    }
    // Lancetta e punto stanno su un unico braccio che ruota dal centro: così si muovono insieme in ogni istante
    // (se fossero animati ciascuno per conto suo, il punto si staccherebbe dalla punta durante il movimento)
    const braccio = el('span', 'dial-arm');
    const lancetta = el('span', 'dial-needle');
    const punto = el('span', 'dial-dot');
    braccio.append(lancetta, punto);
    square.append(braccio);
    // L'angolo si accumula invece di tornare fra -180 e 180: così la lancetta gira sempre per il tratto corto
    let angolo = 0;

    // Braccio verso (X, Y), entrambi in -1..+1. Lo schermo ha l'asse verticale rivolto in giù: il segno si inverte.
    const muoviLancetta = (X, Y) => {
        const x = Math.max(-1, Math.min(1, X)), y = Math.max(-1, Math.min(1, Y));
        const lunghezza = Math.hypot(x, y);
        // Vicino al centro la direzione non si legge: la lancetta resta come era
        if (lunghezza > 0.02) {
            const bersaglio = Math.atan2(-y, x) * 180 / Math.PI;
            angolo += ((bersaglio - angolo) % 360 + 540) % 360 - 180;
        }
        braccio.style.setProperty('--a', `${angolo}deg`);
        braccio.style.setProperty('--k', String(lunghezza));
    };

    const aggiornaQuadrante = (on, m) => {
        const misura = Boolean(on && m && !m.fuori && Number.isFinite(m.X) && Number.isFinite(m.Y));
        const notte = misura && m.stato === 'notte';
        square.classList.toggle('is-spento', !misura);
        square.classList.toggle('is-notte', notte);
        for (const [stato, c] of Object.entries(celle)) {
            c.style.setProperty('--c', notte ? NOTTE_COLORE : SOUND_STATE_COLORS[stato]);
            c.classList.toggle('on', misura && (notte || stato === m.stato));
        }
        if (misura) muoviLancetta(m.X, m.Y);
        const testo = !on ? 'Spenta' : !m ? 'In caricamento…' : m.fuori ? 'Silenzio' : nome(m.stato);
        etichetta.textContent = testo;
        dial.setAttribute('aria-checked', String(on));
        apriBtn.setAttribute('aria-label', `Modi e dettagli, ${testo.toLowerCase()}`);
    };

    // --- Il pannello: intestazione, stato, musica, dettagli ---
    const panel = document.getElementById('compass-panel');

    const titolo = el('h2', 'card-title', 'Mappa sonora');

    const nomeStato = el('span', 'state-name');
    const descStato = el('p', 'state-desc');
    const stato = el('div', 'card-state');
    stato.append(nomeStato, descStato);

    const etichettaMusica = el('p', 'card-label', 'Musica');
    etichettaMusica.id = 'compass-music-label';
    const modi = el('div', 'modes');
    modi.setAttribute('role', 'group');
    modi.setAttribute('aria-labelledby', 'compass-music-label');
    const bottoniModi = {};
    for (const [valore, testo] of MODI) {
        const b = el('button', null, testo);
        b.type = 'button';
        b.setAttribute('aria-pressed', 'false');
        b.onclick = () => musicMode.set(valore);
        bottoniModi[valore] = b;
        modi.append(b);
    }
    const lineaModo = el('p', 'mode-desc');
    const musica = el('div', 'card-music');
    musica.append(etichettaMusica, modi, lineaModo);

    const dettagli = el('details', 'details');
    dettagli.append(el('summary', null, 'Dettagli'));
    const corpo = el('div', 'details-body');
    const elenco = el('dl', 'details-list');
    const note = el('div');
    corpo.append(elenco, note);
    dettagli.append(corpo);

    panel.replaceChildren(titolo, stato, musica, dettagli);

    // Titoli e autori dei brani classici (per la riga del modo e per la citazione obbligatoria)
    let brani = null;
    fetch(AUDIO_BASE + 'classica/manifest.json').then(r => r.json()).then(j => { brani = j; render(); }).catch(() => {});

    map.addSource(FOCUS_SOURCE_ID, { type: 'geojson', data: EMPTY });
    map.addLayer({
        id: FOCUS_LAYER_ID, type: 'line', source: FOCUS_SOURCE_ID,
        paint: { 'line-color': '#111', 'line-width': 2.5 }
    });

    // Riga sotto la griglia: il modo scelto, con il brano o il ritmo di quest'ora quando c'è una misura
    const descrizioneModo = (modo, m) => {
        if (modo === 'classica') {
            const b = m && brani?.[m.stato];
            return b ? `Brano: ${b.titolo}, ${b.autore}. Registrazione Musopen, licenza dichiarata: pubblico dominio.` : 'Brani di musica classica, uno per stato.';
        }
        if (modo === 'sottotraccia') {
            if (!m) return 'Musica generata da regole: ritmo e tono cambiano con la città.';
            const r = regole({ X: m.X, Y: m.Y, H: Number.isFinite(m.H) ? m.H : 0, I: 0 });
            return `${Math.round(r.bpm)} battiti al minuto, nota di base ${Math.round(r.radice_Hz)} Hz (più grave col caldo).`;
        }
        if (modo === 'metronomi') {
            return m
                ? `${METRO.N} metronomi. Disagio ${decimale(discomfort(m))} su 1: a 0 battono insieme, a 1 ognuno per conto suo.`
                : `${METRO.N} metronomi: a 0 battono insieme, a 1 ognuno per conto suo.`;
        }
        return 'Un brano per stato, fatto con un modello di IA.';
    };

    // Dettagli di questa cella e di quest'ora, in parole semplici
    const riempiDettagli = (m) => {
        const quartiere = m.quartiere.replace(/^Ascoli - /, '');
        const dove = m.distanzaQuartiere > 0 ? `a ${m.distanzaQuartiere} m da ${quartiere}` : quartiere;
        const voci = [
            ['Persone', persone(m)],
            ...(m.T !== null ? [['Temperatura percepita', `${gradi(m.T)}, ${fascia(m.T)}`]] : []),
            ['Zona', dove],
            ['Tipo di zona', LCZ_NAMES[m.lcz] ?? 'non classificata'],
            ['Gente', decimale(m.X, true)],
            ['Benessere', decimale(m.Y, true)],
            ...(m.giorni ? [['Meteo usato', dataLunga(m.giorni.scelto)]] : []),
        ];
        elenco.replaceChildren(...voci.flatMap(([etichetta, valore]) => [el('dt', null, etichetta), el('dd', null, valore)]));
        const avvisi = [el('p', 'details-note', 'Gente e Benessere vanno da −1 a +1: è dove punta la lancetta.')];
        if (m.giorni) {
            avvisi.push(el('p', 'details-note', `Giornata calda scelta apposta: tra i ${m.giorni.totale} ${giornoSettimana(m.giorni.scelto)} del periodo, solo 1 su 10 è stato più caldo.`));
        }
        note.replaceChildren(...avvisi);
    };

    const render = () => {
        const on = audioEnabled.get(), m = mood.get(), modo = musicMode.get();
        const misura = Boolean(on && m && !m.fuori && Number.isFinite(m.X) && Number.isFinite(m.Y));
        cross.hidden = !on;
        for (const [valore, b] of Object.entries(bottoniModi)) b.setAttribute('aria-pressed', String(valore === modo));
        map.getSource(FOCUS_SOURCE_ID)?.setData(on && m?.geometry ? { type: 'Feature', geometry: m.geometry, properties: {} } : EMPTY);
        aggiornaQuadrante(on, m);

        // Stato: nome e frase, a seconda di cosa c'è da dire
        if (!on) {
            nomeStato.hidden = true;
            descStato.textContent = 'Tocca il quadrante per accenderla: si sente il punto al centro della mappa.';
        } else if (!m) {
            nomeStato.hidden = false;
            nomeStato.textContent = 'In caricamento…';
            descStato.textContent = 'Un momento: arrivano i dati di quest\'ora.';
        } else if (m.fuori) {
            nomeStato.hidden = false;
            nomeStato.textContent = 'Silenzio';
            descStato.textContent = 'Il centro della mappa è fuori dalla zona studiata: qui non suona niente.';
        } else {
            nomeStato.hidden = false;
            nomeStato.textContent = nome(m.stato);
            descStato.textContent = DESCRIZIONI[m.stato] ?? '';
        }

        musica.hidden = !on;
        lineaModo.textContent = descrizioneModo(modo, misura ? m : null);
        dettagli.hidden = !misura;
        if (misura) riempiDettagli(m);
    };

    // Il tocco sul quadrante accende e spegne; il pulsante sotto apre il pannello. Un solo pannello della timeline
    // aperto alla volta. Toccare il quadrante con il pannello aperto non lo chiude: si può ascoltare mentre si scelgono i modi.
    dial.addEventListener('click', () => audioEnabled.update(on => !on));
    const apri = (aperto) => {
        panel.hidden = !aperto;
        apriBtn.setAttribute('aria-expanded', String(aperto));
        if (aperto) document.dispatchEvent(new CustomEvent('timeline-popover', { detail: 'mappa-sonora' }));
    };
    apriBtn.addEventListener('click', () => apri(panel.hidden));
    document.addEventListener('timeline-popover', (e) => { if (e.detail !== 'mappa-sonora') apri(false); });
    document.addEventListener('pointerdown', (e) => {
        if (panel.hidden || panel.contains(e.target) || apriBtn.contains(e.target) || dial.contains(e.target) || e.target.closest?.('.litepicker')) return;
        apri(false);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !panel.hidden) { apri(false); apriBtn.focus(); }
    });

    mood.subscribe(render);
    audioEnabled.subscribe(render);
    musicMode.subscribe(render);
}
