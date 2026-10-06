// node record.mjs <energia|piacevolezza> [still t1,t2,...]
// Senza "still": registra tutti i fotogrammi a 30 fps in frames-<v>/ e il fotogramma di copertina <v>-poster.png.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.dirname(new URL(import.meta.url).pathname);
const exe = `${process.env.HOME}/.cache/puppeteer/chrome/mac_arm-152.0.7977.42/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const [v, mode, list] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: exe, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1664, height: 640 });
await page.goto(`file://${dir}/anim.html?v=${v}`);
await page.waitForFunction('window.READY === true', { timeout: 60000 });
const grab = async t => Buffer.from(await page.evaluate(t => { render(t); return document.getElementById('c').toDataURL('image/png').split(',')[1]; }, t), 'base64');

if (mode === 'still') {
  for (const t of list.split(',').map(Number)) fs.writeFileSync(`${dir}/still-${v}-${t}.png`, await grab(t));
} else {
  const fps = 30, D = await page.evaluate('DURATION'), out = `${dir}/frames-${v}`;
  fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out);
  for (let i = 0; i < Math.round(D * fps); i++) fs.writeFileSync(`${out}/f${String(i).padStart(4, '0')}.png`, await grab(i / fps));
  fs.writeFileSync(`${dir}/${v}-poster.png`, await grab(await page.evaluate('POSTER')));
}
await browser.close();
