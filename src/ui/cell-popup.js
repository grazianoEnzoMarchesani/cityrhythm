// Scheda della cella LCZ (popup al clic con «Solo celle» acceso). Costruisce solo l'HTML: la mappa la apre map-layers.js.
// Icone: disegni isometrici dell'autore (public/lcz-icone/, ricavati dalla sua presentazione sulle Local Climate Zones).
import { MAP_STYLES } from '../data/config.js';

// Nomi delle classi LCZ (Stewart & Oke) e del rischio isola di calore
export const LCZ_NAMES = {
    '1': 'Compatto alto', '2': 'Compatto medio', '3': 'Compatto basso', '4': 'Aperto alto',
    '5': 'Aperto medio', '6': 'Aperto basso', '7': 'Leggero basso', '8': 'Grandi edifici bassi',
    '9': 'Edificato sparso', '10': 'Industria pesante', 'A': 'Alberi fitti', 'B': 'Alberi sparsi',
    'C': 'Arbusti e macchia', 'D': 'Piante basse', 'E': 'Roccia o pavimentato', 'F': 'Suolo nudo',
    'G': 'Acqua'
};
// Dal più basso al più alto (l'ordine delle fasce nella scala)
const UHI_ORDER = ['Very Low', 'Low', 'Low-Medium', 'Medium-Low', 'Medium', 'High', 'Very High'];
export const UHI_NAMES = {
    'Very Low': 'Molto basso', 'Low': 'Basso', 'Low-Medium': 'Basso-medio', 'Medium-Low': 'Medio-basso',
    'Medium': 'Medio', 'High': 'Alto', 'Very High': 'Molto alto'
};

// I colori stanno in config.js come espressioni MapLibre ['case', [cond, valore], ...]: li riporto in una tabella
function coloriDaCase(expr) {
    const out = {};
    for (let i = 1; i + 1 < expr.length; i += 2) out[expr[i][2]] = expr[i + 1];
    return out;
}
const LCZ_HEX = coloriDaCase(MAP_STYLES.LCZ_VITALITY.LCZ_COLORS);
const UHI_HEX = coloriDaCase(MAP_STYLES.LCZ_VITALITY.UHI_COLORS);

const nf = (max) => new Intl.NumberFormat('it-IT', { maximumFractionDigits: max });
const n2 = nf(2), n1 = nf(1), n0 = nf(0);
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ha = (v) => typeof v === 'number' && Number.isFinite(v);

// Parametri nel blocco «Dettagli»: [campo, nome, cosa vuol dire, formato, unità]
const DETTAGLI = [
    ['svf_mean', 'Cielo visibile', 'quanto cielo si vede da terra (1 = tutto)', n2, ''],
    ['aspect_ratio', 'Altezza / larghezza', 'altezza degli edifici rispetto alla larghezza della strada', n2, ''],
    ['z_h', 'Altezza media', 'di edifici e alberi', n1, 'm'],
    ['terrain_rough', 'Rugosità', 'quanto il terreno frena il vento, da 1 a 8 (classi di Davenport)', n0, ''],
    ['albedo', 'Albedo', 'quanta luce del sole viene rimandata indietro (1 = tutta)', n2, ''],
    ['admittance', 'Ammettenza termica', 'quanto calore accumulano i materiali', n0, 'J m⁻² s⁻½ K⁻¹'],
    ['anthro_heat', 'Calore umano', 'prodotto da traffico, impianti e persone', n1, 'W/m²'],
    ['industry_heat', 'Calore industriale', 'prodotto da attività industriali', n1, 'W/m²']
];

/** Barra a tre parti: edifici, altro impermeabile, permeabile (solo se le tre quote chiudono a 100). */
function composizione(p) {
    const b = p.building_frac, i = p.impervious_frac, v = p.pervious_frac;
    if (![b, i, v].every(ha) || Math.abs(b + i + v - 100) > 1) return '';
    const parti = [['Edifici', b, 'edifici'], ['Impermeabile', i, 'imp'], ['Permeabile', v, 'perm']];
    return `<div class="cp-sez">
        <div class="cp-tit">Com'è fatta la cella</div>
        <div class="cp-comp" role="img" aria-label="${parti.map(([n, q]) => `${n} ${n1.format(q)}%`).join(', ')}">
            ${parti.filter(([, q]) => q > 0).map(([, q, c]) => `<span class="cp-${c}" style="flex:${q}"></span>`).join('')}
        </div>
        <ul class="cp-leg">${parti.map(([n, q, c]) => `<li><i class="cp-${c}"></i>${n} <b>${n1.format(q)}%</b></li>`).join('')}</ul>
    </div>`;
}

/** Scala del rischio isola di calore: sette fasce, quella della cella piena e con un segno sotto. */
function scalaRischio(rischio) {
    const k = UHI_ORDER.indexOf(rischio);
    const nome = UHI_NAMES[rischio] ?? rischio;
    return `<div class="cp-sez">
        <div class="cp-tit">Rischio isola di calore: <b>${esc(nome)}</b></div>
        <div class="cp-uhi" role="img" aria-label="Rischio isola di calore ${esc(nome)}, fascia ${k + 1} di 7">
            ${UHI_ORDER.map((r, j) => `<span class="${j === k ? 'is-qui' : ''}" style="background:${UHI_HEX[r]}"></span>`).join('')}
        </div>
        <div class="cp-uhi-agli"><span>basso</span><span>alto</span></div>
    </div>`;
}

/**
 * @param {object} p proprietà della cella (lcz_ascoli.geojson)
 * @param {{utci: number|null, fascia: string|null, stato: string|null, colore: string|null, persone: number}|null} adesso
 *        quello che la bussola dice di questa cella nell'ora scelta, o null
 * @returns {string} HTML del popup
 */
export function cellPopupHtml(p, adesso) {
    const classe = String(p.lcz_class);
    const nome = LCZ_NAMES[classe] ?? 'sconosciuta';
    const colore = LCZ_HEX[classe] ?? '#888888';
    const icona = LCZ_NAMES[classe]
        ? `<img class="cp-icona" src="./lcz-icone/${encodeURIComponent(classe)}.webp" width="400" height="333" alt="Disegno isometrico della zona LCZ ${esc(classe)}: ${esc(nome)}" decoding="async">`
        : '';
    const ora = adesso ? `<div class="cp-ora">
        <div class="cp-tit">In quest'ora</div>
        <ul>
            ${ha(adesso.utci) ? `<li><span class="cp-chiave">Temperatura percepita</span><b>≈ ${n0.format(adesso.utci)} °C</b>${adesso.fascia ? `<small>${esc(adesso.fascia)} (stima)</small>` : ''}</li>` : ''}
            <li><span class="cp-chiave">Mappa sonora</span><b>${adesso.colore ? `<i class="cp-punto" style="background:${esc(adesso.colore)}"></i>` : ''}${adesso.stato ? esc(adesso.stato[0].toUpperCase() + adesso.stato.slice(1)) : '—'}</b></li>
            <li><span class="cp-chiave">Persone in giro qui intorno</span><b>≈ ${n0.format(adesso.persone)}</b></li>
        </ul></div>` : '';
    const righe = DETTAGLI.filter(([k]) => ha(p[k])).map(([k, nom, spiega, f, u]) =>
        `<dt>${nom}</dt><dd><b>${f.format(p[k])}</b>${u ? ` ${u}` : ''}<small>${spiega}</small></dd>`).join('');
    const fix = p.lcz_esa_fix && p.lcz_esa_fix !== '-' ? `<dt>Classe corretta</dt><dd>${esc(p.lcz_esa_fix)}<small>con ESA WorldCover</small></dd>` : '';
    return `<article class="cp">
        <header class="cp-testa">
            ${icona}
            <div>
                <div class="cp-sigla"><i class="cp-campione" style="background:${colore}"></i>LCZ ${esc(classe)}</div>
                <h3 class="cp-nome">${esc(nome)}</h3>
            </div>
        </header>
        ${p.lcz_vulnerability ? scalaRischio(p.lcz_vulnerability) : ''}
        ${composizione(p)}
        ${ora}
        <details class="cp-dettagli">
            <summary>Dettagli</summary>
            <dl>${righe}${fix}</dl>
            <p class="cp-cella">Cella ${esc(p.id)} · 30 × 30 m</p>
        </details>
    </article>`;
}
