// node persone.mjs [still f1,f2,...] [nolli|toner]   (prima: npx vite --port 5179 dalla radice)
// Video della slide "Puntini che sembrano persone": registrazione vera della piattaforma, tempo virtuale a 30 fps.
// Tre inquadrature: 1) da vicino in piazza, il brulichio; 2) i colori (Color dots by); 3) le ore che passano.
import fs from 'node:fs';
import { launch, openApp, colorBy, jump, setHour, frame, settle, shot, sleep } from './piattaforma.mjs';

const args = process.argv.slice(2);
const still = args[0] === 'still' ? new Set(args[1].split(',').map(Number)) : null;
const STYLE = args.includes('toner') ? 'toner' : 'nolli';
const FPS = 30, DT = 1000 / FPS, FADE = 0.5;
const OUT = `frames-persone-${STYLE}`;
if (!still) { fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT); }

const SAB = 5 * 24; // settimana tipo: 0 = lunedì 00:00
const GIORNI = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];
const label = h => `${GIORNI[Math.floor(h / 24) % 7]} <b>${String(h % 24).padStart(2, '0')}:00</b>`;
const LEGENDE = {
  gender: ['Genere', ['uomini', 'donne']],
  age: ['Età', null],
  nationality: ['Nazionalità', ['italiani', 'stranieri']],
  visits: ['Visite', ['1', '2', '3', '4', '5+']]
};

const VIEW_CLOSE = { center: [13.5757, 42.8542], zoom: 17.3 };
const VIEW_COLOR = { center: [13.5752, 42.8540], zoom: 16 };
const VIEW_CITY = { center: [13.5755, 42.8535], zoom: 15.4 };

const t0 = Date.now();
const { browser, page } = await launch();
await openApp(page, { style: STYLE });
await page.evaluate(async () => {
  const url = p => performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes(p));
  window.__colors = await import(url('/src/map/presence-colors.js'));
  window.__ml = await import(url('/src/map/map-layers.js'));
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500&family=Space+Grotesk:wght@500;700&display=swap';
  document.head.appendChild(link);
  const css = document.createElement('style');
  css.textContent = `
    #rec-tab { position: fixed; left: 0; top: 0; z-index: 1000; background: #fff; color: #111; padding: 18px 28px 20px 0;
      font: 500 36px/1.1 'Space Grotesk', Arial, sans-serif; letter-spacing: -0.01em; }
    #rec-tab:empty { display: none; }
    #rec-tab b { font-weight: 700; }
    #rec-tab .leg { display: flex; gap: 22px; margin-top: 12px; font: 400 24px/1 'IBM Plex Sans', Arial, sans-serif; color: #111; }
    #rec-tab .leg span { display: flex; align-items: center; gap: 8px; }
    #rec-tab .leg i { width: 16px; height: 16px; border-radius: 50%; border: 1px solid #111; display: inline-block; }
    #rec-veil { position: fixed; inset: 0; z-index: 1001; background: #fff; opacity: 1; pointer-events: none; }`;
  document.head.appendChild(css);
  document.body.insertAdjacentHTML('beforeend', '<div id="rec-tab"></div><div id="rec-veil"></div>');
  await document.fonts.ready;
  await document.fonts.load("500 36px 'Space Grotesk'");
  await document.fonts.load("700 36px 'Space Grotesk'");
  await document.fonts.load("400 24px 'IBM Plex Sans'");
  // Come col Play della timeline: i puntini arrivano prima dell'ora successiva
  window.__ml.setPresenceMoveDuration(0.9 * 1300);
});
const tab = html => page.evaluate(h => { document.getElementById('rec-tab').innerHTML = h; }, html);
const veil = o => page.evaluate(o => { document.getElementById('rec-veil').style.opacity = String(o); }, o);
const legend = key => page.evaluate(([key, title, names]) => {
  const cats = window.__colors.PRESENCE_COLOR_VARIABLES[key].categories;
  const items = cats.map((c, i) => `<span><i style="background:${c.color}"></i>${names ? names[i] : c.name}</span>`).join('');
  document.getElementById('rec-tab').innerHTML = `${title}<div class="leg">${items}</div>`;
}, [key, ...LEGENDE[key]]);

let f = 0;
async function capture() {
  if (!still || still.has(f)) await shot(page, still ? `still-${STYLE}-${f}.png` : `${OUT}/f${String(f).padStart(4, '0')}.png`);
  f++;
}
// Un'inquadratura di `seconds` secondi: entra e esce dal bianco, onTime(t) a ogni fotogramma
async function take(seconds, onTime) {
  const n = Math.round(seconds * FPS);
  for (let i = 0; i < n; i++) {
    const t = i / FPS;
    if (onTime) await onTime(t, i);
    const v = Math.max(0, 1 - t / FADE, 1 - (seconds - t - 1 / FPS) / FADE);
    await veil(Math.min(1, v));
    await frame(page, DT);
    await capture();
  }
}
// Prepara l'inquadratura successiva a tempo fermo... quasi: qualche fotogramma non registrato perché tutto si assesti
async function preroll(seconds) {
  for (let i = 0; i < Math.round(seconds * FPS); i++) await frame(page, DT);
}

await setHour(page, SAB + 18);
await sleep(2000);
await page.evaluate(() => window.__vc.start());
await jump(page, VIEW_CLOSE);
await tab(label(SAB + 18));
await preroll(1.5);

// 1) Da vicino: il brulichio in piazza
await take(6);

// 2) I colori, tutti i quartieri
await jump(page, VIEW_COLOR);
await colorBy(page, 'gender'); await legend('gender');
await preroll(0.5);
await take(5.4, async (t, i) => {
  if (i === Math.round(2.6 * FPS)) { await colorBy(page, 'age'); await legend('age'); }
});

// 3) Le ore che passano: dal sabato sera alla notte
await colorBy(page, 'none');
await jump(page, VIEW_CITY);
await tab(label(SAB + 18));
await preroll(0.5);
const STEPS = 8, HOLD = 1.0, STEP = 1.3;
await take(HOLD + STEPS * STEP + 1.6, async (t, i) => {
  for (let s = 1; s <= STEPS; s++) {
    if (i === Math.round((HOLD + (s - 1) * STEP) * FPS)) {
      const h = SAB + 18 + s;
      await tab(label(h));
      await setHour(page, h);
    }
  }
});

console.log('fotogrammi', f, 'in', Math.round((Date.now() - t0) / 1000), 's');
await browser.close();
