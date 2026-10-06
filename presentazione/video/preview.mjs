// node preview.mjs <slide.html> <out.png>: anteprima approssimata di una slide (1920x1080).
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const [src, out] = process.argv.slice(2);
const exe = `${process.env.HOME}/.cache/puppeteer/chrome/mac_arm-152.0.7977.42/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
let html = fs.readFileSync(src, 'utf8').replace(/<aside>[\s\S]*?<\/aside>/, '').replace('<section', '<div class="s"').replace('</section>', '</div>');
html = `<!doctype html><html><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=block" rel="stylesheet"><style>*{margin:0;box-sizing:border-box}.s{position:relative;width:1920px;height:1080px;overflow:hidden}p,h2,h3{margin:0}</style></head><body>${html}</body></html>`;
const b = await puppeteer.launch({ executablePath: exe, headless: true });
const p = await b.newPage(); await p.setViewport({ width: 1920, height: 1080 });
await p.setContent(html, { waitUntil: 'networkidle0' }); await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: out }); await b.close();
