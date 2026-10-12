// Mappa sonora: mirino al centro della mappa, contorno della cella inquadrata e, a sinistra della timeline,
// un quadrante con la lancetta. Il tocco sul quadrante apre il pannello: interruttore, stato in parole,
// tipo di musica, dettagli. Legge `mood`, `audioEnabled`, `musicMode` e `volume` dallo store; scrive `audioEnabled`, `musicMode` e `volume`.
import { mood, audioEnabled, musicMode, volume, raggioAscolto, puntoAscolto, time } from '../state/store.js';
import { getDateTimeFromIndex } from '../utils/utils.js';
import { soleLuna } from './sole-luna.js';
import { AUDIO_BASE, DEBUG_MODE, FRAZIONE_ASCOLTO } from '../data/config.js';
import { METRO, discomfort } from '../audio/metronomi.js';
import { regole } from '../audio/sottotraccia-regole.js';
import { NOMI_STATI } from '../data/stati-nomi.js';
import { SOUND_STATE_COLORS } from '../data/sound-colors.js';
import { POSIZIONE_STATI } from '../compass/sound-color.js';
import { LCZ_NAMES } from '../map/map-layers.js';

const NOTTE_COLORE = SOUND_STATE_COLORS.notte;

const NOMI = NOMI_STATI;
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
    notte: 'Buio e poca gente: la città dorme.'
};
const nome = s => NOMI[s] ?? '—';
const MODI_TUTTI = [['ia', 'IA'], ['classica', 'Classica'], ['metronomi', 'Metronomi'], ['sottotraccia', 'Scale']];
// Al pubblico due modi: le scale (Sottotraccia) e la classica. IA e metronomi restano in DEBUG_MODE.
const MODI = DEBUG_MODE ? MODI_TUTTI : MODI_TUTTI.filter(([v]) => v === 'classica' || v === 'sottotraccia');
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


    // Cerchio d'ascolto: sta sul punto `puntoAscolto` (indipendente dalla telecamera), grande quanto i metri scelti a quello zoom.
    // Si sposta trascinando il puntino al centro; si allarga e si stringe trascinando il bordo (o la pallina) col mouse o col dito, o con le frecce sulla pallina.
    // Con la mappa inclinata un cerchio per terra diventa un'ellisse: lo si schiaccia di cos(inclinazione).
    const RAGGIO_MIN = 50, RAGGIO_MAX = 250, RAGGIO_PASSO = 5; // [S] da 50 m (la taratura) a 250 m; parte da 100 m (store.js)
    const cerchio = el('div', 'raggio-cerchio');
    const cerchioEtichetta = el('span', 'raggio-etichetta');
    const pallina = el('button', 'raggio-pallina');
    pallina.type = 'button';
    pallina.setAttribute('role', 'slider');
    pallina.setAttribute('aria-label', 'Raggio d\'ascolto della gente');
    pallina.setAttribute('aria-valuemin', String(RAGGIO_MIN));
    pallina.setAttribute('aria-valuemax', String(RAGGIO_MAX));
    // Anello più largo del tratteggio, trasparente, per afferrare il bordo anche col dito
    const SVG = 'http://www.w3.org/2000/svg';
    const anello = document.createElementNS(SVG, 'svg');
    anello.classList.add('raggio-anello');
    const anelloCerchio = document.createElementNS(SVG, 'circle');
    anello.append(anelloCerchio);
    const centro = el('button', 'raggio-centro');
    centro.type = 'button';
    centro.setAttribute('aria-label', 'Sposta il punto d\'ascolto (frecce)');
    cerchio.append(anello, cerchioEtichetta, pallina, centro);
    cerchio.hidden = true;
    container.appendChild(cerchio);
    const MX = 111320 * Math.cos(42.85 * Math.PI / 180); // metri per grado di longitudine, come in crowd.js
    let pxPerMetro = 1;
    const disegnaCerchio = () => {
        const punto = puntoAscolto.get();
        cerchio.hidden = !punto;
        if (!punto) return;
        const r = raggioAscolto.get(), c = { lng: punto[0], lat: punto[1] };
        const a = map.project(c), b = map.project([c.lng + r / MX, c.lat]);
        const raggioPx = Math.hypot(b.x - a.x, b.y - a.y);
        pxPerMetro = raggioPx / r;
        cerchio.style.width = cerchio.style.height = `${2 * raggioPx}px`;
        cerchio.style.left = `${a.x}px`;
        cerchio.style.top = `${a.y}px`;
        cerchio.style.margin = `${-raggioPx}px 0 0 ${-raggioPx}px`;
        cerchio.style.transform = `scaleY(${Math.cos(map.getPitch() * Math.PI / 180)})`;
        const lato = 2 * raggioPx + 40;
        anello.setAttribute('viewBox', `0 0 ${lato} ${lato}`);
        anelloCerchio.setAttribute('cx', String(lato / 2));
        anelloCerchio.setAttribute('cy', String(lato / 2));
        anelloCerchio.setAttribute('r', String(raggioPx));
        cerchioEtichetta.textContent = `${r} m`;
        // Sole di giorno, luna di notte: la pallina gira sul bordo con l'ora (mezzogiorno a sud, come il sole vero)
        const t = time.get(), { hour } = getDateTimeFromIndex(t.index);
        if (hour >= 0) {
            const { giorno, angolo } = soleLuna(hour, t.date, window.selectedDateRange);
            const ang = angolo - map.getBearing() * Math.PI / 180; // con la mappa ruotata il nord non è in alto
            const sx = Math.sin(ang), sy = -Math.cos(ang);
            pallina.classList.toggle('luna', !giorno);
            pallina.style.left = `${50 + 50 * sx}%`;
            pallina.style.top = `${50 + 50 * sy}%`;
            cerchioEtichetta.style.left = pallina.style.left;
            cerchioEtichetta.style.top = pallina.style.top;
            cerchioEtichetta.style.transform = `translate(-50%, -50%) translate(${34 * sx}px, ${22 * sy}px)`;
        }
        pallina.setAttribute('aria-valuenow', String(r));
        pallina.setAttribute('aria-valuetext', `${r} metri`);
    };
    map.on('move', disegnaCerchio);
    raggioAscolto.subscribe(disegnaCerchio);
    puntoAscolto.subscribe(disegnaCerchio);
    time.subscribe(disegnaCerchio);
    const imposta = (metri) => raggioAscolto.set(Math.max(RAGGIO_MIN, Math.min(RAGGIO_MAX, Math.round(metri / RAGGIO_PASSO) * RAGGIO_PASSO)));
    let trascina = null; // 'sposta' (il puntino al centro) o 'allarga' (bordo e pallina)
    cerchio.addEventListener('pointerdown', (e) => {
        if (e.button > 0) return;
        trascina = e.target === centro ? 'sposta' : 'allarga';
        cerchio.setPointerCapture(e.pointerId);
        cerchio.classList.add('sta-trascinando');
        e.preventDefault();
        e.stopPropagation();
    });
    cerchio.addEventListener('pointermove', (e) => {
        if (!trascina) return;
        const q = container.getBoundingClientRect();
        if (trascina === 'sposta') {
            const l = map.unproject([e.clientX - q.left, e.clientY - q.top]);
            puntoAscolto.set([l.lng, l.lat]);
            return;
        }
        const a = map.project({ lng: puntoAscolto.get()[0], lat: puntoAscolto.get()[1] });
        const dx = e.clientX - (q.left + a.x), dy = e.clientY - (q.top + a.y);
        const k = Math.max(0.2, Math.cos(map.getPitch() * Math.PI / 180));
        imposta(Math.hypot(dx, dy / k) / pxPerMetro);
    });
    const finisci = () => { trascina = null; cerchio.classList.remove('sta-trascinando'); };
    cerchio.addEventListener('pointerup', finisci);
    cerchio.addEventListener('pointercancel', finisci);
    // Frecce sul puntino: sposta di circa 1/20 dello schermo
    centro.addEventListener('keydown', (e) => {
        const d = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
        if (!d) return;
        const a = map.project({ lng: puntoAscolto.get()[0], lat: puntoAscolto.get()[1] }), q = container.getBoundingClientRect();
        const l = map.unproject([a.x + d[0] * q.width / 20, a.y + d[1] * q.width / 20]);
        puntoAscolto.set([l.lng, l.lat]);
        e.preventDefault();
    });
    pallina.addEventListener('keydown', (e) => {
        const passo = { ArrowRight: 10, ArrowUp: 10, ArrowLeft: -10, ArrowDown: -10 }[e.key];
        if (passo) { imposta(raggioAscolto.get() + passo); e.preventDefault(); }
    });

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

    // Volume: slider nativo (si muove anche col dito e con le frecce); si salva solo la scelta dell'utente
    const VOLUME_CHIAVE = 'cityrhythm-volume';
    try {
        const salvato = parseFloat(localStorage.getItem(VOLUME_CHIAVE));
        if (salvato >= 0 && salvato <= 1) volume.set(salvato);
    } catch (e) { /* senza memoria del browser resta il valore di partenza */ }
    const etichettaVolume = el('label', 'card-label', 'Volume');
    etichettaVolume.htmlFor = 'compass-volume';
    const slider = el('input', 'volume-slider');
    Object.assign(slider, { id: 'compass-volume', type: 'range', min: '0', max: '100', step: '1', value: String(Math.round(volume.get() * 100)) });
    slider.oninput = () => {
        volume.set(slider.value / 100);
        slider.setAttribute('aria-valuetext', `${slider.value} per cento`);
        valoreVolume.textContent = `${slider.value}%`;
    };
    slider.onchange = () => { try { localStorage.setItem(VOLUME_CHIAVE, String(volume.get())); } catch (e) { /* ok */ } };
    const valoreVolume = el('span', 'volume-value', `${slider.value}%`);
    const rigaVolume = el('div', 'volume-row');
    rigaVolume.append(slider, valoreVolume);
    const volumeBox = el('div', 'card-volume');
    volumeBox.append(etichettaVolume, rigaVolume);

    const dettagli = el('details', 'details');
    dettagli.append(el('summary', null, 'Dettagli'));
    const corpo = el('div', 'details-body');
    const elenco = el('dl', 'details-list');
    const note = el('div');
    // Come si legge: spiegazione fissa, sempre uguale (gente, benessere, nove stati e Quiete)
    const guida = el('div', 'details-guide');
    guida.append(
        el('h3', 'card-label', 'Come si legge'),
        el('p', 'details-note', 'Ogni punto della città ha due misure: la gente (quante persone fuori casa ci sono intorno) e il benessere (quanto il clima è piacevole, dalla temperatura percepita UTCI, che somma caldo, sole, vento e umidità). Dall\'incrocio nascono nove stati, e la musica cambia con lo stato.')
    );
    const elencoStati = el('dl', 'details-list');
    for (const k of ['rifugio', 'passeggiata', 'festa', 'attesa', 'routine', 'corrente', 'afa', 'fatica', 'calca']) {
        const dt = el('dt', 'stato-nome');
        const campione = el('span', 'stato-colore');
        campione.style.background = SOUND_STATE_COLORS[k];   // lo stesso colore della Sound map e del quadrante
        campione.setAttribute('aria-hidden', 'true');
        dt.append(campione, NOMI[k]);
        elencoStati.append(dt, el('dd', null, DESCRIZIONI[k]));
    }
    guida.append(
        elencoStati,
        el('p', 'details-note', `${NOMI.notte} (blu scuro): scatta solo quando è buio e c'è poca gente. Le sere piene di gente restano ${NOMI.festa}, ${NOMI.corrente} o ${NOMI.calca}.`)
    );
    guida.append(el('p', 'details-note', 'Fonti: lo schema a due assi (energia e piacevolezza) viene dal modello circomplesso delle emozioni di Russell (1980, Journal of Personality and Social Psychology 39, 1161–1178). La temperatura percepita è l\'UTCI, nella formula di Bröde e colleghi (2012, International Journal of Biometeorology 56, 481–494). I nove stati, i loro nomi e le soglie sono una scelta del progetto, non una classificazione della letteratura.'));
    // Come suona: come si compongono gli strati sonori e cosa viene dagli studi (parole semplici; scelte nostre dichiarate)
    const suono = el('div', 'details-guide');
    const studio = (autori, testo) => {
        const p = el('p', 'details-note');
        p.append(el('strong', null, autori + '. '), testo);
        return p;
    };
    // Due blocchi, uno per modo: si mostra solo quello del modo scelto
    const scale = el('div');
    const classica = el('div');
    suono.append(
        el('h3', 'card-label', 'Come suona'),
        el('p', 'details-note', 'Si sentono due strati insieme. Sotto c\'è la musica del modo scelto, sempre allo stesso volume, così non cambia da un punto all\'altro. Sopra ci sono i suoni della città: folla, traffico, parco, cicale e grilli. Ognuno entra più o meno forte secondo lo stato, ma resta sempre più piano della musica. Quando ti sposti, tutto passa da uno stato all\'altro in circa un secondo; fuori dalle celle c\'è silenzio.'),
        scale,
        classica
    );
    scale.append(
        el('h3', 'card-label', 'Scale: cosa abbiamo imparato dagli studi'),
        studio('Russell (1980) e Barrett & Russell (1998)', 'Le emozioni si ordinano su due assi indipendenti: quanta energia hanno e quanto sono piacevoli. Sono i nostri due assi, gente e benessere.'),
        studio('Axelsson e colleghi (2010)', 'Cento ascoltatori hanno giudicato 50 registrazioni di strade e piazze. Contano soprattutto piacevolezza e vivacità. I rumori tecnici, come il traffico, risultano sgradevoli, i suoni naturali piacevoli, quelli umani vivaci. Per questo traffico, natura e folla sono strati a parte, sopra la musica.'),
        studio('Plomp & Levelt (1965)', 'Due toni puri molto vicini «sfregano» fra loro. Lo sfregamento è massimo quando la distanza è circa un quarto della banda che l\'orecchio tratta insieme. Quando si sta male, Sottotraccia suona due toni (1000 e 1040 Hz) esattamente a quella distanza.'),
        studio('Arnal e colleghi (2015), Kumar e colleghi (2012)', 'I suoni ruvidi, come le urla, attivano l\'amigdala, la parte del cervello che si occupa del pericolo, e fanno reagire più in fretta. Per questo il disagio è reso con la ruvidezza e non solo con più volume.'),
        studio('Fastl & Zwicker (2007)', 'Sopra circa 15 colpi al secondo un ritmo si trasforma in ruvidità, e i suoni acuti e nitidi sono più aspri. Per questo il ritmo non supera i 180 battiti al minuto, e quando si sta bene il suono diventa più tondo e più scuro.'),
        el('h3', 'card-label', 'Scale: cosa è una nostra scelta'),
        el('p', 'details-note', 'Gli studi non dicono tutto. Questa parte è una scelta del progetto. I nove stati e le loro soglie. La scala: nei tre stati più piacevoli togliamo un tasto nero del pianoforte alla volta, fino a note tutte bianche, per far sentire sempre più «si sta bene». L\'idea viene dal consiglio di una musicista che ha ascoltato la mappa; nessuno degli studi letti parla di scale. Anche la nota di base più grave col caldo è un\'ipotesi. Gli studi riguardano suoni singoli e ascoltatori in laboratorio: che questa musica faccia provare le stesse emozioni a chi usa la mappa è un\'interpretazione, non una dimostrazione.')
    );
    const elencoBrani = el('dl', 'details-list');
    classica.append(
        el('h3', 'card-label', 'Classica: come l\'abbiamo scelta'),
        el('p', 'details-note', `Qui la musica non è generata: sono registrazioni di brani famosi, uno per ognuno dei nove stati più uno per ${NOMI.notte}. Il brano di ogni stato l'abbiamo scelto noi, perché ne richiama il carattere: calmo e luminoso per ${NOMI.rifugio}, vivace per ${NOMI.festa}, pesante per ${NOMI.fatica}. Nessuno studio dice quale brano corrisponde a quale stato: è una scelta del progetto, come i nove stati.`),
        el('p', 'details-note', `Di ogni brano si usa un tratto di circa 70–95 secondi, che poi riparte da capo con una dissolvenza di 2 secondi. L'inizio e la fine sono scelti con un calcolo, in due punti dove il suono è simile, così il giro non si sente. Per ${NOMI.fatica} si usa solo l'introduzione lenta e pesante dell'Egmont, senza l'Allegro che segue. Tutti i brani hanno lo stesso volume, come le scale.`),
        elencoBrani,
        el('p', 'details-note', 'Le registrazioni vengono dalla raccolta di Musopen, che le dichiara di pubblico dominio e chiede di citarla.')
    );
    corpo.append(elenco, note, guida, suono);
    dettagli.append(corpo);

    panel.replaceChildren(titolo, stato, volumeBox, musica, dettagli);

    // Titoli e autori dei brani classici (per la riga del modo e per la citazione obbligatoria)
    let brani = null;
    fetch(AUDIO_BASE + 'classica/manifest.json').then(r => r.json()).then(j => { brani = j; riempiBrani(); render(); }).catch(() => {});

    const riempiBrani = () => {
        elencoBrani.replaceChildren(...Object.entries(brani).filter(([k]) => NOMI[k]).flatMap(([k, b]) => {
            const dt = el('dt', 'stato-nome');
            const campione = el('span', 'stato-colore');
            campione.style.background = SOUND_STATE_COLORS[k];
            campione.setAttribute('aria-hidden', 'true');
            dt.append(campione, NOMI[k]);
            return [dt, el('dd', null, `${b.autore}, ${b.titolo}`)];
        }));
    };

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
        for (const [valore, b] of Object.entries(bottoniModi)) b.setAttribute('aria-pressed', String(valore === modo));
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

        scale.hidden = modo !== 'sottotraccia';
        classica.hidden = modo !== 'classica';
        lineaModo.textContent = descrizioneModo(modo, misura ? m : null);
        dettagli.hidden = !misura;
        if (misura) riempiDettagli(m);
    };

    // Il tocco sul quadrante accende e spegne; il pulsante sotto apre il pannello. Un solo pannello alla volta.
    // Toccare il quadrante con il pannello aperto non lo chiude: si può ascoltare mentre si scelgono i modi.
    dial.addEventListener('click', () => audioEnabled.update(on => !on));
    const apri = (aperto) => {
        panel.hidden = !aperto;
        apriBtn.setAttribute('aria-expanded', String(aperto));
        if (aperto) document.dispatchEvent(new CustomEvent('pannello-aperto', { detail: 'mappa-sonora' }));
    };
    apriBtn.addEventListener('click', () => apri(panel.hidden));
    document.addEventListener('pannello-aperto', (e) => { if (e.detail !== 'mappa-sonora') apri(false); });
    document.addEventListener('pointerdown', (e) => {
        if (panel.hidden || panel.contains(e.target) || apriBtn.contains(e.target) || dial.contains(e.target) || e.target.closest?.('.litepicker')) return;
        apri(false);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !panel.hidden) { apri(false); apriBtn.focus(); }
    });

    // All'accensione il cerchio parte dal centro della mappa; da lì si sposta a mano. Spenta la musica, sparisce.
    audioEnabled.subscribe((on) => {
        if (on && !puntoAscolto.get()) {
            const c = map.getCenter();
            puntoAscolto.set([c.lng, c.lat]);
            // Si avvicina finché il raggio occupa FRAZIONE_ASCOLTO del lato corto dello schermo: mai di più, mai allontanando
            const fermo = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            const q = container.getBoundingClientRect();
            const voluto = FRAZIONE_ASCOLTO * Math.min(q.width, q.height);
            const ora = raggioAscolto.get() * pxPerMetro; // pxPerMetro l'ha appena aggiornato disegnaCerchio
            const zoom = Math.min(map.getZoom() + Math.log2(voluto / ora), map.getMaxZoom());
            if (ora > 0 && zoom > map.getZoom()) map.easeTo({ zoom, duration: fermo ? 0 : 900 });
        }
        if (!on) puntoAscolto.set(null);
    });
    mood.subscribe(render);
    audioEnabled.subscribe(render);
    musicMode.subscribe(render);
}
