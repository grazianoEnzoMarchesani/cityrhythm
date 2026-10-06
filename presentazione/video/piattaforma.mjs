// Registrazione della piattaforma con un orologio virtuale: il tempo della pagina avanza solo quando lo dico io,
// così ogni fotogramma è completo (tessere dei puntini già tornate dal worker) e il video è fluido.
import puppeteer from 'puppeteer-core';

const exe = `${process.env.HOME}/.cache/puppeteer/chrome/mac_arm-152.0.7977.42/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
export const URL_APP = 'http://localhost:5179/';
export const sleep = ms => new Promise(r => setTimeout(r, ms));

const CLOCK = `(() => {
  const realNow = performance.now.bind(performance);
  const realRaf = window.requestAnimationFrame.bind(window);
  const realCaf = window.cancelAnimationFrame.bind(window);
  const C = window.__vc = { manual: false, t: 0, q: new Map(), id: 1e7 };
  performance.now = () => C.manual ? C.t : realNow();
  window.requestAnimationFrame = cb => {
    if (!C.manual) return realRaf(cb);
    const id = ++C.id; C.q.set(id, cb); return id;
  };
  window.cancelAnimationFrame = id => { if (C.q.has(id)) C.q.delete(id); else realCaf(id); };
  const run = () => { const cbs = [...C.q.values()]; C.q.clear(); for (const cb of cbs) { try { cb(C.t); } catch (e) { console.error(e); } } return cbs.length; };
  C.start = () => { if (!C.manual) { C.t = realNow(); C.manual = true; } };
  C.tick = dt => { C.t += dt; return run(); };
  C.flush = run;
  // Niente "riduci movimento" e niente preferenze salvate da altre sessioni
  try { localStorage.clear(); } catch (e) {}
})();`;

export async function launch({ width = 1664, height = 640, dpr = 2 } = {}) {
  const browser = await puppeteer.launch({
    executablePath: exe, headless: true,
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars'],
    protocolTimeout: 600000
  });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('[console]', m.text().slice(0, 200)); });
  await page.setViewport({ width, height, deviceScaleFactor: dpr });
  await page.evaluateOnNewDocument(CLOCK);
  return { browser, page };
}

// Apre la piattaforma, lascia solo la mappa a tutto schermo e i puntini (niente quartieri, luoghi, spot)
export async function openApp(page, { style = 'toner' } = {}) {
  await page.goto(URL_APP, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => performance.getEntriesByType('resource').some(e => e.name.includes('/src/map/map-setup.js')), { timeout: 60000 });
  await page.evaluate(async () => {
    const url = p => performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes(p));
    const setup = await import(url('/src/map/map-setup.js'));
    await new Promise(r => setup.whenMapReady(r));
    window.__setup = setup;
    window.__map = setup.getMapInstance();
    window.__timeline = await import(url('/src/ui/ui-timeline.js'));
    window.__layers = await import(url('/src/ui/ui-layer-controls.js'));
  });
  // Dati e puntini dell'avvio
  await page.waitForFunction(() => window.__map.getSource('presence-points-source'), { timeout: 120000 });
  await sleep(3000);
  await page.evaluate(() => {
    ['toggle-kml', 'toggle-crowded', 'toggle-spots'].forEach(id => { const el = document.getElementById(id); if (el?.checked) el.click(); });
    const css = document.createElement('style');
    css.textContent = `
      #sidebar, .timeline-container, #map > div:not(.maplibregl-canvas-container) { display: none !important; }
      .container, #map { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; margin: 0 !important; }
      body { margin: 0; overflow: hidden; }`;
    document.head.appendChild(css);
    window.__map.resize();
  });
  await setStyle(page, style);
  await sleep(1500);
}

export async function setStyle(page, style) {
  await page.evaluate(s => {
    const b = [...document.querySelectorAll('#map-style button')].find(b => b.textContent.trim().toLowerCase() === s);
    b?.click();
  }, style);
}

export async function colorBy(page, key) {
  await page.evaluate(k => { const b = document.querySelector(`#presence-color-by button[data-color-by="${k}"]`); b?.click(); }, key);
}

export async function jump(page, { center, zoom, bearing = 0, pitch = 0 }) {
  await page.evaluate(o => window.__map.jumpTo(o), { center, zoom, bearing, pitch });
}

export async function setHour(page, h) {
  await page.evaluate(h => window.__timeline.setHour(h), h);
}

// Aspetta che MapLibre abbia tutte le tessere e i dati, poi ridisegna allo stesso istante
export async function settle(page, maxMs = 3000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const ok = await page.evaluate(() => {
      const m = window.__map;
      return m.areTilesLoaded() && Object.keys(m.style.sourceCaches ?? m.style.tileManagers ?? {}).every(id => m.isSourceLoaded(id));
    });
    if (ok) break;
    await sleep(4);
  }
  await page.evaluate(() => window.__vc.flush());
}

export async function frame(page, dt) {
  await page.evaluate(dt => window.__vc.tick(dt), dt);
  await settle(page);
}

export async function shot(page, path, type = 'png') {
  await page.screenshot({ path, type, optimizeForSpeed: true });
}
