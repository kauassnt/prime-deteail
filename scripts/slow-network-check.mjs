import { chromium } from 'playwright';

const BASE = process.env.SLOW_BASE || 'http://127.0.0.1:3300';
const EMAIL = process.env.PDF_REPORT_EMAIL;
const PIN = process.env.PDF_REPORT_PIN;
if (!EMAIL || !PIN) {
  console.error('Defina PDF_REPORT_EMAIL e PDF_REPORT_PIN.');
  process.exit(1);
}

const SCENARIOS = {
  'Slow 3G (400 kbps, 400 ms)': { latency: 400, down: (400 * 1024) / 8, up: (400 * 1024) / 8 },
  'Fast 3G (1.6 Mbps, 150 ms)': { latency: 150, down: (1600 * 1024) / 8, up: (750 * 1024) / 8 },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function applyNetwork(page, preset) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  // Cache desligado: mede o pior caso (primeira visita, sem service worker).
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: preset?.latency ?? 0,
    downloadThroughput: preset?.down ?? -1,
    uploadThroughput: preset?.up ?? -1,
  });
  return cdp;
}

const browser = await chromium.launch();
const results = {};

for (const [name, preset] of Object.entries(SCENARIOS)) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    serviceWorkers: 'block',
  });
  const page = await ctx.newPage();

  // 1) Carga inicial da tela de login, já com throttling.
  await applyNetwork(page, preset);
  const t0 = Date.now();
  await page.goto(`${BASE}/login`, { waitUntil: 'commit' });

  let firstTextMs = null;
  let loginFormMs = null;
  let fcpMs = null;
  while (Date.now() - t0 < 45000) {
    const state = await page
      .evaluate(() => ({
        textLen: (document.body?.innerText || '').trim().length,
        hasForm: !!document.querySelector('#login-password'),
        fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
      }))
      .catch(() => ({ textLen: 0, hasForm: false, fcp: null }));
    const elapsed = Date.now() - t0;
    if (fcpMs === null && state.fcp !== null) fcpMs = Math.round(state.fcp);
    if (firstTextMs === null && state.textLen > 0) firstTextMs = elapsed;
    if (loginFormMs === null && state.hasForm) loginFormMs = elapsed;
    if (state.hasForm) break;
    await sleep(100);
  }

  const coldLoad = {
    fcpMs,
    firstTextMs,
    loginFormMs,
    blankScreenMs: firstTextMs,
  };

  // 2) Login sem throttling.
  await applyNetwork(page, null);
  await page.waitForSelector('#login-password', { timeout: 30000 });
  await page.fill('#login-email', EMAIL);
  await page.fill('#login-password', PIN);
  await page.locator('form').first().evaluate((f) => f.requestSubmit());
  await page.waitForURL('**/dashboard', { timeout: 30000 }).catch(() => {});
  await page.waitForFunction(() => document.body.innerText.includes('MOTOS NO PÁTIO'), { timeout: 30000 });

  // 3) Abertura de módulos com chunk frio e rede lenta.
  const modules = [
    { label: 'Relatórios', marker: 'Analise serviços' },
    { label: 'Financeiro', marker: 'Acompanhe o faturamento' },
    { label: 'Clientes', marker: 'Gerencie os relacionamentos' },
  ];
  const moduleResults = [];

  for (const mod of modules) {
    const cdp = await applyNetwork(page, preset);
    await cdp.send('Network.clearBrowserCache');
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body.innerText.includes('MOTOS NO PÁTIO'), { timeout: 40000 });
    await sleep(600);

    const start = Date.now();
    await page.getByRole('button', { name: new RegExp(`^${mod.label}$`) }).first().click();

    let contentAt = null;
    let markerAt = null;
    let blankSamples = 0;
    let samples = 0;
    while (Date.now() - start < 40000) {
      const state = await page
        .evaluate(
          (marker) => ({
            mainLen: (document.querySelector('main')?.innerText || '').trim().length,
            hasMarker: document.body.innerText.includes(marker),
          }),
          mod.marker
        )
        .catch(() => ({ mainLen: 0, hasMarker: false }));
      const elapsed = Date.now() - start;
      samples += 1;
      if (state.mainLen === 0) blankSamples += 1;
      if (contentAt === null && state.mainLen > 0) contentAt = elapsed;
      if (state.hasMarker) {
        markerAt = elapsed;
        break;
      }
      await sleep(100);
    }

    moduleResults.push({
      modulo: mod.label,
      url: page.url().replace(BASE, ''),
      telaVaziaAteMs: contentAt,
      moduloVisivelMs: markerAt,
      amostrasVazias: `${blankSamples}/${samples}`,
    });
  }

  results[name] = { coldLoad, modules: moduleResults };
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
