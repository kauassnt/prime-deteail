import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.SLOW_BASE || 'http://127.0.0.1:3300';
const EMAIL = process.env.PDF_REPORT_EMAIL;
const PIN = process.env.PDF_REPORT_PIN;
const OUT = path.resolve('.tmp-perf');
fs.mkdirSync(OUT, { recursive: true });

const SLOW = { latency: 400, down: (400 * 1024) / 8, up: (400 * 1024) / 8 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function network(page, preset) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: preset?.latency ?? 0,
    downloadThroughput: preset?.down ?? -1,
    uploadThroughput: preset?.up ?? -1,
  });
  return cdp;
}

async function watch(page) {
  await page.addInitScript(() => {
    window.__shifts = [];
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            window.__shifts.push({
              value: entry.value,
              t: Math.round(entry.startTime),
              sources: (entry.sources || []).map((s) => ({
                node: s.node ? (s.node.id || s.node.className || s.node.tagName || '?').toString().slice(0, 40) : null,
                prev: s.previousRect ? `${Math.round(s.previousRect.x)},${Math.round(s.previousRect.y)} ${Math.round(s.previousRect.width)}x${Math.round(s.previousRect.height)}` : null,
                curr: s.currentRect ? `${Math.round(s.currentRect.x)},${Math.round(s.currentRect.y)} ${Math.round(s.currentRect.width)}x${Math.round(s.currentRect.height)}` : null,
              })),
            });
          }
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {}
  });
}

async function sample(page, name) {
  const shots = [];
  const samples = [];
  const t0 = Date.now();
  for (let i = 0; i < 10; i++) {
    const elapsed = Date.now() - t0;
    const state = await page
      .evaluate(() => {
        const bg = getComputedStyle(document.body).backgroundColor;
        const htmlBg = getComputedStyle(document.documentElement).backgroundColor;
        const root = document.getElementById('root');
        return {
          textLen: (document.body.innerText || '').trim().length,
          rootChildren: root ? root.children.length : 0,
          bodyBg: bg,
          htmlBg,
          docHeight: Math.round(document.documentElement.scrollHeight),
          shifts: window.__shifts || [],
        };
      })
      .catch(() => null);
    if (state) {
      samples.push({ t: elapsed, textLen: state.textLen, rootChildren: state.rootChildren, bodyBg: state.bodyBg, htmlBg: state.htmlBg, docHeight: state.docHeight });
    }
    const file = path.join(OUT, `${name}-${String(i).padStart(2, '0')}.png`);
    await page.screenshot({ path: file }).catch(() => {});
    shots.push(path.relative(process.cwd(), file));
    if (state && state.textLen > 0 && state.rootChildren > 0) {
      // espera estabilizar um pouco depois do primeiro conteúdo
      await sleep(700);
      const final = await page.evaluate(() => ({
        shifts: window.__shifts || [],
        docHeight: Math.round(document.documentElement.scrollHeight),
      })).catch(() => ({ shifts: [], docHeight: 0 }));
      samples.push({ t: Date.now() - t0, final: true, docHeight: final.docHeight });
      return { samples, shots, shifts: final.shifts };
    }
    await sleep(400);
  }
  const final = await page.evaluate(() => ({ shifts: window.__shifts || [] })).catch(() => ({ shifts: [] }));
  return { samples, shots, shifts: final.shifts };
}

const browser = await chromium.launch();
const result = {};

// ---------- A) visitante (login) ----------
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await watch(page);
  await network(page, SLOW);
  await page.goto(`${BASE}/login`, { waitUntil: 'commit' });
  result.login = await sample(page, 'login');

  // login para o próximo teste (sem throttle)
  await network(page, null);
  await page.waitForSelector('#login-password', { timeout: 30000 });
  await page.fill('#login-email', EMAIL);
  await page.fill('#login-password', PIN);
  await page.locator('form').first().evaluate((f) => f.requestSubmit());
  await page.waitForURL('**/dashboard', { timeout: 30000 }).catch(() => {});
  await page.waitForFunction(() => document.body.innerText.includes('MOTOS NO PÁTIO'), { timeout: 30000 });
  await ctx.close();
}

// ---------- B) usuário logado (dashboard) ----------
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#login-password', { timeout: 30000 });
  await page.fill('#login-email', EMAIL);
  await page.fill('#login-password', PIN);
  await page.locator('form').first().evaluate((f) => f.requestSubmit());
  await page.waitForURL('**/dashboard', { timeout: 30000 }).catch(() => {});
  await sleep(1200);

  const page2 = await ctx.newPage();
  await watch(page2);
  await network(page2, SLOW);
  await page2.goto(`${BASE}/dashboard`, { waitUntil: 'commit' });
  result.dashboard = await sample(page2, 'dashboard');
  await ctx.close();
}

await browser.close();

const summarize = (r) => ({
  cls: Math.round(r.shifts.reduce((s, x) => s + x.value, 0) * 1000) / 1000,
  shifts: r.shifts.slice(0, 6),
  frames: r.samples.map((s) => ({ t: s.t, text: s.textLen, children: s.rootChildren, bg: s.bodyBg, docH: s.docHeight })),
  shots: r.shots,
});

console.log(JSON.stringify({ login: summarize(result.login), dashboard: summarize(result.dashboard) }, null, 2));
