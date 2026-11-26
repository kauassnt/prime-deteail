import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const BASE = process.env.PDF_REPORT_BASE || 'http://127.0.0.1:3000';
const OUT_DIR = path.resolve('.tmp-pdf');
const TABS = ['Visão Geral', 'Clientes', 'Conversões'];
// Credenciais só via ambiente: nunca deixar login no código do projeto.
const EMAIL = process.env.PDF_REPORT_EMAIL;
const PIN = process.env.PDF_REPORT_PIN;
if (!EMAIL || !PIN) {
  console.error('Defina PDF_REPORT_EMAIL e PDF_REPORT_PIN para autenticar no app.');
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

/** Conta páginas e decodifica texto dos streams do PDF gerado pelo Chromium. */
function analyzePdf(file) {
  const buf = fs.readFileSync(file);
  const latin = buf.toString('latin1');
  const pageCount = (latin.match(/\/Type\s*\/Page(?![s])/g) || []).length;
  const streams = [];
  const re = /stream\r?\n/g;
  let m;
  while ((m = re.exec(latin))) {
    const start = m.index + m[0].length;
    const end = latin.indexOf('endstream', start);
    if (end < 0) continue;
    try {
      streams.push(zlib.inflateSync(Buffer.from(latin.slice(start, end), 'latin1')).toString('latin1'));
    } catch {}
  }
  const joined = streams.join('\n');
  const textOps = (joined.match(/\bT[Jj]\b/g) || []).length;

  // Mapa glyph -> unicode a partir dos CMaps ToUnicode embutidos.
  const glyphs = new Map();
  const hex = (h) => parseInt(h, 16);
  for (const s of streams) {
    for (const block of s.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
      for (const p of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
        glyphs.set(hex(p[1]), String.fromCharCode(hex(p[2])));
      }
    }
    for (const block of s.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
      for (const p of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
        const from = hex(p[1]);
        const to = hex(p[2]);
        const dst = hex(p[3]);
        for (let c = from; c <= to && c - from < 400; c++) glyphs.set(c, String.fromCharCode(dst + (c - from)));
      }
    }
  }
  const decode = (h) => {
    let out = '';
    for (let i = 0; i + 4 <= h.length; i += 4) out += glyphs.get(hex(h.slice(i, i + 4))) ?? '';
    return out;
  };
  const pieces = [];
  for (const s of streams) {
    for (const show of s.matchAll(/\[([^\]]{0,4000})\]\s*TJ/g)) {
      for (const str of show[1].matchAll(/<([0-9A-Fa-f]+)>/g)) pieces.push(decode(str[1]));
    }
    for (const show of s.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) pieces.push(decode(show[1]));
  }
  const text = pieces.join('').replace(/\s+/g, ' ').trim();
  return { pageCount, textOps, text, bytes: buf.length, streams: streams.length };
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

// Captura o HTML do relatório em vez de abrir o pop-up real de impressão.
await context.addInitScript(() => {
  const originalOpen = window.open;
  window.open = function () {
    const div = { open() {}, write(h) { window.__pdfHtml = (window.__pdfHtml || '') + h; }, close() {} };
    return { document: div, focus() {}, print() {} };
  };
  window.__originalOpen = originalOpen;
});

const page = await context.newPage();
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
if (await page.locator('#login-password').count()) {
  await page.fill('#login-email', EMAIL);
  await page.fill('#login-password', PIN);
  await page.locator('form.auth-form, form').first().evaluate((f) => f.requestSubmit());
  await page.waitForTimeout(3000);
}
await page.goto(`${BASE}/relatorios`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

const results = [];
for (const tab of TABS) {
  await page.locator('main button', { hasText: new RegExp(`^${tab}$`) }).first().click();
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    window.__pdfHtml = '';
  });
  await page.getByRole('button', { name: /salvar como PDF/i }).click();
  await page.waitForFunction(() => (window.__pdfHtml || '').includes('<!doctype html>'), { timeout: 15000 });
  await page.waitForTimeout(1200);
  const raw = await page.evaluate(() => window.__pdfHtml);
  const start = raw.lastIndexOf('<!doctype html>');
  const html = raw.slice(start);

  const printPage = await context.newPage();
  await printPage.setViewportSize({ width: 703, height: 1000 });
  await printPage.emulateMedia({ media: 'print' });
  await printPage.setContent(html, { waitUntil: 'load' });
  await printPage.waitForTimeout(300);

  const layout = await printPage.evaluate(() => {
    const body = document.body;
    const wrap = document.querySelector('.table-wrap');
    const table = document.querySelector('table');
    const cards = [...document.querySelectorAll('.kpi')];
    const footer = document.querySelector('footer');
    const header = document.querySelector('header');
    const right = (el) => Math.round(el.getBoundingClientRect().right);
    return {
      contentWidth: Math.round(body.clientWidth),
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      table: table
        ? {
            width: Math.round(table.getBoundingClientRect().width),
            wrapClient: wrap.clientWidth,
            wrapScroll: wrap.scrollWidth,
            clipped: wrap.scrollWidth > wrap.clientWidth + 1,
            headers: [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim()),
            rows: table.querySelectorAll('tbody tr').length,
          }
        : null,
      tables: document.querySelectorAll('table').length,
      cards: cards.length,
      cardsRight: cards.length ? Math.max(...cards.map(right)) : null,
      headerRight: right(header),
      footerRight: right(footer),
      footerBelow: footer ? Math.round(footer.getBoundingClientRect().top) : null,
      height: Math.round(body.scrollHeight),
    };
  });

  const file = path.join(OUT_DIR, `relatorio-${tab.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').toLowerCase()}.pdf`);
  await printPage.pdf({ path: file, printBackground: true, preferCSSPageSize: true });
  const analysis = analyzePdf(file);
  await printPage.close();

  results.push({ tab, file: path.relative(process.cwd(), file), layout, ...analysis, textSample: analysis.text.slice(0, 400) });
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
