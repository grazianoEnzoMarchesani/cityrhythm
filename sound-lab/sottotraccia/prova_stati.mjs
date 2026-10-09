// Prova di Sottotraccia per stati, nel browser, con la bussola pilotata a mano (sound-lab/sottotraccia/prova_stati.html):
//   CHROME_BIN=<browser> node sound-lab/sottotraccia/prova_stati.mjs [url]
// Per ogni scenario conta gli oscillatori che partono in 3 s, dopo un secondo di transizione.
// Festa e Calca hanno cassa e hi-hat; Afa e Calca hanno la coppia stonata; il caldo abbassa il registro.
import puppeteer from 'puppeteer-core';

const URL = process.argv[2] ?? 'http://localhost:5179/sound-lab/sottotraccia/prova_stati.html';
const CHROME = process.env.CHROME_BIN;
const pausa = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--no-sandbox'],
});
const page = await browser.newPage();
const errori = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errori.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => errori.push(`[pageerror] ${e.message}`));

await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction('window.preparato === true', { timeout: 60000 });
await page.evaluate(() => { window.prova.accendi(); window.prova.modo('sottotraccia'); });
await pausa(1500);

// Scenari: X (energia), Y (piacevolezza), T (UTCI °C: il calore con segno è calore(T))
const scenari = [
    ['Festa',          1,  1, 20, 'festa'],
    ['Calca',          1, -1, 20, 'calca'],
    ['Calca calda',    1, -1, 34, 'calca'],
    ['Afa',           -1, -1, 32, 'afa'],
    ['Rifugio',       -1,  1, 20, 'rifugio'],
    ['Corrente',       0,  0, 20, 'corrente'],
];
console.log('Scenario        | oscillatori in 3 s');
for (const [nome, X, Y, T, stato] of scenari) {
    await page.evaluate((X, Y, T, stato) => window.prova.bussola(X, Y, T, stato), X, Y, T, stato);
    await pausa(1000);                                  // transizione: gli ingressi scorrono in circa 1 s
    const a = await page.evaluate(() => window.prova.oscillatori());
    await page.evaluate(() => window.prova.frequenze());
    await pausa(3000);
    const b = await page.evaluate(() => window.prova.oscillatori());
    const freq = await page.evaluate(() => window.prova.frequenze());
    const st = await page.evaluate(() => window.prova.stato());
    console.log(`${nome.padEnd(16)}| ${b - a}   stato X ${st && st.X.toFixed(2)} Y ${st && st.Y.toFixed(2)} H ${st && st.H.toFixed(2)}   frequenze: ${JSON.stringify(freq)}`);
}
// Fuori dalle celle: silenzio
await page.evaluate(() => window.prova.fuori());
await pausa(2500);
const c = await page.evaluate(() => window.prova.oscillatori());
await pausa(2000);
const d = await page.evaluate(() => window.prova.oscillatori());
console.log(`${'Fuori (silenzio)'.padEnd(16)}| ${d - c} (atteso 0)`);

console.log('\nErrori e avvisi in console:');
console.log(errori.length ? errori.join('\n') : '(nessuno)');
await browser.close();
