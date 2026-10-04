// Interruttore della mappa sonora e bussola sulla mappa: mirino al centro, contorno della
// cella inquadrata e un riquadro con stato, energia e piacevolezza (visibili ad audio acceso).
// Legge `mood` e `audioEnabled` dallo store; scrive solo `audioEnabled`.
import { mood, audioEnabled } from '../state/store.js';

const FOCUS_SOURCE_ID = 'compass-focus-source';
const FOCUS_LAYER_ID = 'compass-focus-layer';
const EMPTY = { type: 'FeatureCollection', features: [] };

const NOMI = {
    rifugio: 'Rifugio', passeggiata: 'Passeggiata', festa: 'Festa',
    attesa: 'Attesa', routine: 'Routine', corrente: 'Corrente',
    afa: 'Afa', fatica: 'Fatica', calca: 'Calca', notte: 'Notte'
};
const nome = s => NOMI[s] ?? '—';
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
    const button = document.createElement('button');
    button.style.cssText = 'font:600 13px sans-serif;padding:5px 10px;border:1px solid #888;border-radius:4px;background:#fff;cursor:pointer';
    button.onclick = () => audioEnabled.update(on => !on);
    const info = document.createElement('div');
    info.style.marginTop = '6px';
    panel.append(button, info);
    container.appendChild(panel);

    map.addSource(FOCUS_SOURCE_ID, { type: 'geojson', data: EMPTY });
    map.addLayer({
        id: FOCUS_LAYER_ID, type: 'line', source: FOCUS_SOURCE_ID,
        paint: { 'line-color': '#111', 'line-width': 2.5 }
    });

    const render = () => {
        const on = audioEnabled.get(), m = mood.get();
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
            + `Energia ${segno(m.X)} · Piacevolezza ${m.settimanaTipo ? 'neutra' : segno(m.Y)}`
            + '<br>'
            + (m.T !== null ? `UTCI ≈ ${Math.round(m.T)} °C · ${stress(m.T)} <span style="color:#888">(stima)</span><br>` : '')
            + `Cella ${m.cella} (LCZ ${m.lcz}) · ${dove}`
            + (m.settimanaTipo ? '<br><i>Settimana tipo: scegli dei giorni per sentire il clima.</i>' : '');
    };
    mood.subscribe(render);
    audioEnabled.subscribe(render);
}
