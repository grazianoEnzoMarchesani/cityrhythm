// Prova di Sottotraccia dentro l'app, nel browser (come sound-lab/prova_audio.mjs):
//   CHROME_BIN=<percorso del browser> node sound-lab/sottotraccia/prova_app.mjs [url] [cartella screenshot]
// Attiva la mappa sonora, sceglie il modo Sottotraccia, conta gli oscillatori che partono per 6 s,
// poi torna a Musica IA e verifica che il suono generato si spenga. Segnala errori e avvisi in console.
import puppeteer from 'puppeteer-core';
import { join } from 'node:path';

const URL = process.argv[2] ?? 'http://localhost:5179/';
const OUT = process.argv[3];
const CHROME = process.env.CHROME_BIN;
const pausa = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900 });
const errori = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errori.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => errori.push(`[pageerror] ${e.message}`));

// Conta gli avvii di oscillatori e di sorgenti a campione (la musica IA usa sorgenti a campione).
await page.evaluateOnNewDocument(() => {
    window.__osc = 0;
    window.__campioni = 0;
    const o1 = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...a) { window.__osc++; return o1.apply(this, a); };
    const o2 = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...a) { window.__campioni++; return o2.apply(this, a); };
});

await page.goto(URL, { waitUntil: 'load' });
await page.waitForSelector('canvas.maplibregl-canvas', { timeout: 60000 });
await pausa(12000);

const selettore = () => page.evaluate(() => [...document.querySelectorAll('select')].find(x => [...x.options].some(o => o.text === 'Sottotraccia')));
const opzioni = await page.evaluate(() => {
    const s = [...document.querySelectorAll('select')].find(x => [...x.options].some(o => o.text === 'Sottotraccia'));
    return s ? [...s.options].map(o => o.text) : null;
});
console.log('Opzioni del selettore:', JSON.stringify(opzioni));

await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Attiva mappa sonora'))?.click());
await pausa(3000);
await page.evaluate(() => { const s = [...document.querySelectorAll('select')].find(x => [...x.options].some(o => o.text === 'Sottotraccia')); s.value = 'sottotraccia'; s.dispatchEvent(new Event('change')); });
await pausa(2500);
const a = await page.evaluate(() => window.__osc);
await pausa(6000);
const b = await page.evaluate(() => window.__osc);
console.log(`Sottotraccia: oscillatori avviati in 6 s = ${b - a} (atteso: molti, decine per secondo quando c'è una cella)`);

const info = await page.evaluate(() => [...document.querySelectorAll('div')].map(d => d.innerText).filter(t => t && t.includes('Sottotraccia')).slice(-1)[0] ?? '(riga Sottotraccia non trovata)');
console.log('Riga sotto la bussola:', info.slice(0, 300));
if (OUT) await page.screenshot({ path: join(OUT, 'sottotraccia.png'), clip: { x: 0, y: 500, width: 700, height: 400 } });

// Torna a Musica IA: il generatore deve fermarsi (gli oscillatori non partono più).
await page.evaluate(() => { const s = [...document.querySelectorAll('select')].find(x => [...x.options].some(o => o.text === 'Sottotraccia')); s.value = 'ia'; s.dispatchEvent(new Event('change')); });
await pausa(3000);
const c = await page.evaluate(() => window.__osc);
await pausa(3000);
const d = await page.evaluate(() => window.__osc);
console.log(`Tornato a Musica IA: nuovi oscillatori in 3 s = ${d - c} (atteso 0)`);

console.log('\nERRORI E AVVISI IN CONSOLE:');
console.log(errori.length ? errori.join('\n') : '(nessuno)');
await browser.close();
