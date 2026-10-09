// Interruttore della mappa sonora, selettore della musica e bussola sulla mappa: mirino al centro,
// contorno della cella inquadrata e un riquadro con stato, energia e piacevolezza (visibili ad audio acceso).
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
const nome = s => NOMI[s] ?? '—';
const MODI = [['ia', 'Musica IA'], ['classica', 'Musica classica'], ['metronomi', 'Metronomi'], ['sottotraccia', 'Sottotraccia']];
// Fasce ufficiali di stress termico UTCI (soglia inferiore in °C)
const STRESS_UTCI = [
    [46, 'stress da caldo estremo'], [38, 'stress da caldo molto forte'], [32, 'stress da caldo forte'],
    [26, 'stress da caldo moderato'], [9, 'nessuno stress termico'], [0, 'leggero stress da freddo'],
    [-13, 'stress da freddo moderato'], [-27, 'stress da freddo forte'], [-40, 'stress da freddo molto forte'],
    [-Infinity, 'stress da freddo estremo']
];
const stress = u => STRESS_UTCI.find(([soglia]) => u >= soglia)[1];
const segno = v => (v >= 0 ? '+' : '') + v.toFixed(2);

export function initCompassUI(map) {
    const container = map.getContainer();

    const cross = document.createElement('div');
    cross.style.cssText = 'position:absolute;left:50%;top:50%;width:22px;height:22px;margin:-11px 0 0 -11px;pointer-events:none;z-index:2;'
        + 'background:linear-gradient(#222,#222) center/2px 100% no-repeat,linear-gradient(#222,#222) center/100% 2px no-repeat;opacity:.7';
    container.appendChild(cross);

    const panel = document.createElement('div');
    panel.style.cssText = 'position:absolute;left:10px;bottom:34px;z-index:2;max-width:300px;padding:8px 10px;border-radius:6px;'
        + 'background:rgba(255,255,255,.92);box-shadow:0 1px 4px rgba(0,0,0,.25);font:12px/1.4 sans-serif;color:#222';
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap';
    const button = document.createElement('button');
    button.style.cssText = 'font:600 13px sans-serif;padding:5px 10px;border:1px solid #888;border-radius:4px;background:#fff;cursor:pointer';
    button.onclick = () => audioEnabled.update(on => !on);
    const select = document.createElement('select');
    select.title = 'Da dove viene la musica';
    select.style.cssText = 'font:13px sans-serif;padding:4px;border:1px solid #888;border-radius:4px;background:#fff';
    for (const [valore, testo] of MODI) select.add(new Option(testo, valore));
    select.onchange = () => musicMode.set(select.value);
    row.append(button, select);
    const info = document.createElement('div');
    info.style.marginTop = '6px';
    panel.append(row, info);
    container.appendChild(panel);

    // Titoli e autori dei brani classici (per la riga sotto la bussola e per la citazione obbligatoria).
    let brani = null;
    fetch(AUDIO_BASE + 'classica/manifest.json').then(r => r.json()).then(j => { brani = j; render(); }).catch(() => {});

    map.addSource(FOCUS_SOURCE_ID, { type: 'geojson', data: EMPTY });
    map.addLayer({
        id: FOCUS_LAYER_ID, type: 'line', source: FOCUS_SOURCE_ID,
        paint: { 'line-color': '#111', 'line-width': 2.5 }
    });

    const render = () => {
        const on = audioEnabled.get(), m = mood.get(), modo = musicMode.get();
        select.value = modo;
        button.textContent = on ? '🔊 Mappa sonora attiva' : '🔈 Attiva mappa sonora';
        cross.style.display = info.style.display = on ? '' : 'none';
        map.getSource(FOCUS_SOURCE_ID)?.setData(on && m?.geometry ? { type: 'Feature', geometry: m.geometry, properties: {} } : EMPTY);
        if (!on) return;
        if (!m) {
            info.innerHTML = 'Bussola in caricamento…';
            return;
        }
        if (m.fuori) {
            info.innerHTML = `<b>Bussola: ${nome(m.stato)}</b><br>Il centro della mappa è fuori dalle celle LCZ: silenzio.`;
            return;
        }
        const quartiere = m.quartiere.replace(/^Ascoli - /, '');
        const dove = m.distanzaQuartiere > 0 ? `a ${m.distanzaQuartiere} m da ${quartiere}` : quartiere;
        info.innerHTML = `<div style="font-size:14px"><b>Bussola: ${nome(m.stato)}</b>`
            + (m.proposto ? ` <span style="color:#888">→ ${nome(m.proposto)}?</span>` : '') + '</div>'
            + `Energia ${segno(m.X)} · Piacevolezza ${segno(m.Y)}`
            + `<br>≈ ${Math.round(m.people)} persone in giro entro ${m.raggio} m<br>`
            + (m.T !== null ? `UTCI ≈ ${Math.round(m.T)} °C · ${stress(m.T)} <span style="color:#888">(stima)</span><br>` : '')
            + `Cella ${m.cella} (LCZ ${m.lcz}) · ${dove}`
            + (m.giorni ? `<br><i>Settimana tipo: meteo del ${new Date(m.giorni.scelto).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}, `
                + `una giornata calda per questa cella: solo 1 su 10 dei ${m.giorni.totale} giorni dell'intervallo è stata più calda.</i>` : '')
            + musica(m, modo);
    };
    // Riga della musica: il brano (con autore e citazione) o, per i metronomi, quanto disagio c'è.
    const musica = (m, modo) => {
        if (modo === 'classica') {
            const b = brani?.[m.stato];
            return b ? `<br><i>Brano: ${b.titolo}, ${b.autore}. Registrazione Musopen, licenza dichiarata: pubblico dominio.</i>` : '';
        }
        if (modo === 'sottotraccia') {
            const r = regole({ X: m.X, Y: m.Y, H: Number.isFinite(m.H) ? m.H : 0, I: 0 });
            return `<br><i>Sottotraccia: ${Math.round(r.bpm)} battiti al minuto, registro ${Math.round(r.radice_Hz)} Hz (più grave con il caldo).</i>`;
        }
        if (modo === 'metronomi') {
            return `<br><i>Metronomi: disagio ${discomfort(m).toFixed(2)} su 1 (0 = battono insieme, 1 = ognuno per conto suo; ${METRO.N} metronomi).</i>`;
        }
        return '';
    };
    mood.subscribe(render);
    audioEnabled.subscribe(render);
    musicMode.subscribe(render);
}
