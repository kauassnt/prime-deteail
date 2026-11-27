import {
  MotoCatalogBrand,
  MotoCatalogModel,
  MotoCatalogState,
  MotoCatalogVersion,
  MotoCategory,
  Motorcycle,
} from '../types';
import {
  buildYearRange,
  createInitialMotoCatalogState,
  normalizeMotoText,
} from '../data/motorcycleCatalogSeed';
import { swrFetch } from '../core/networkCache';
import { notifyRealtimeKey } from './realtimeService';
import {
  ErrorReporter,
  NetworkError,
  safeJsonParse,
  sanitizeImageUrl,
} from '../core/errorHandler';

export const MOTO_CATALOG_STORAGE_KEY = 'pk_detail_moto_catalog_v1';
const FIPE_BASE_URL = 'https://parallelum.com.br/fipe/api/v1/motos';
const BRASIL_API_MARCAS_URL = 'https://brasilapi.com.br/api/fipe/marcas/v1/motos';

const DEFAULT_CURRENT_YEAR = new Date().getFullYear() + 1;

export interface FipeSyncProgress {
  phase: 'marcas' | 'modelos' | 'concluido' | 'erro';
  current: number;
  total: number;
  currentBrandName?: string;
  importedBrands: number;
  importedModels: number;
  errorsCount: number;
  message: string;
}

export interface CatalogCoverageSummary {
  totalBrands: number;
  activeBrands: number;
  totalModels: number;
  activeModels: number;
  fipeBrandsCount: number;
  fipeModelsCount: number;
  customBrandsCount: number;
  customModelsCount: number;
  brandsWithSyncedModels: number;
  lastSyncedAt?: string;
  sourceName: string;
  lastSyncNote?: string;
}

function getBrandColorAndMonogram(name: string): { brandColor: string; monogram: string } {
  const clean = name.trim();
  const words = clean.split(/\s+/).filter(Boolean);
  const monogram =
    words.length >= 2
      ? `${words[0][0]}${words[1][0]}`.toUpperCase()
      : clean.slice(0, 2).toUpperCase();

  const palette = ['#EA580C', '#1D4ED8', '#15803D', '#B91C1C', '#0F172A', '#0369A1', '#7C3AED', '#9A3412'];
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 31 + clean.charCodeAt(i)) % palette.length;
  }
  return { brandColor: palette[Math.abs(hash) % palette.length], monogram };
}

function formatBrandDisplayName(rawName: string): string {
  const trimmed = rawName.trim();
  if (!trimmed) return trimmed;
  // Preserve already mixed-case names from seed or intentional uppercase acronyms
  const upperKnown = new Set(['BMW', 'KTM', 'MV', 'CFMOTO', 'MXF', 'KYMCO']);
  if (upperKnown.has(trimmed.toUpperCase())) {
    if (trimmed.toUpperCase() === 'CFMOTO') return 'CFMOTO';
    if (trimmed.toUpperCase() === 'KYMCO') return 'Kymco';
    return trimmed.toUpperCase();
  }
  const lowerExceptions = new Set(['da', 'de', 'do', 'e']);
  const tokens = trimmed.split(/\s+/);
  return tokens
    .map((tok, i) => {
      if (tok.includes('-')) {
        return tok
          .split('-')
          .map(part =>
            part.length <= 3 && upperKnown.has(part.toUpperCase())
              ? part.toUpperCase()
              : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
          )
          .join('-');
      }
      if (upperKnown.has(tok.toUpperCase())) return tok.toUpperCase();
      if (i > 0 && lowerExceptions.has(tok.toLowerCase())) return tok.toLowerCase();
      return tok.charAt(0).toUpperCase() + tok.slice(1).toLowerCase();
    })
    .join(' ');
}

export function inferMotoSpecsFromName(modelName: string): {
  cc: number;
  category: MotoCategory;
} {
  const upper = modelName.toUpperCase();
  let category: MotoCategory = 'Street';

  if (
    /SCOT|SCOOTER|BIZ|POP|PCX|NMAX|XMAX|BURGMAN|LEAD|ELITE|FLUO|NEO|CITYCOM|CRUISYM|VESPA|PRIMAVERA|BEVERLY|MP3|DOWNTOWN|LINDY|JET|PHOENIX|SH 150|ADV/.test(
      upper
    )
  ) {
    category = 'Cub / Scooter';
  } else if (
    /AFRICA TWIN|R 1200 GS|R 1250 GS|R 1300 GS|F 750 GS|F 800 GS|F 850 GS|F 900 GS|TIGER 900|TIGER 1200|TIGER 800|TIGER SPORT|V-STROM|VERSYS|MULTISTRADA|DESERTX|TENERE 700|TENERE 1200|SUPER TENERE|NORDEN|PAN AMERICA|TRANSALP|NC 750|NC750|CB 500X|TRK/.test(
      upper
    )
  ) {
    category = 'Big Trail';
  } else if (
    /BROS|NXR|XRE|SAHARA|LANDER|CROSSER|XTZ|XT 660|TORNADO|FALCON|XR 250|HIMALAYAN|SCRAMBLER 400|NH 190|NH 300|G 310 GS|TENERE 250|TÉNÉRÉ 250|CRF 250F|DR 160|SHI 175/.test(
      upper
    )
  ) {
    category = 'Trail';
  } else if (/CRF|YZ|KX|EXC|SX|FC|FE|EC |TC |TE |RMZ/.test(upper)) {
    category = 'Off-Road';
  } else if (
    /NINJA|CBR|YZF|R1|R3|R6|R15|GSX-R|GSXR|SRAD|S 1000 RR|S1000RR|PANIGALE|DAYTONA|RSV4|RS 660|RS 457|HAYABUSA|ZX-6|ZX-10|ZX-4|450SR/.test(
      upper
    )
  ) {
    category = 'Esportiva';
  } else if (
    /HARLEY|IRON 883|FAT BOY|HERITAGE|ROAD KING|SPORTSTER|SOFTAIL|DYNA|INTRUDER|CHOPPER|METEOR|CLASSIC 350|INTERCEPTOR|CONTINENTAL GT|BONNEVILLE|VULCAN|SHADOW|BOULEVARD|DIAVEL|SCOUT|CHIEF|ROCKET 3|MASTER RIDE|TITANIUM/.test(
      upper
    )
  ) {
    category = 'Custom / Cruiser';
  } else if (/GOLD WING|GL 1800|STREET GLIDE|ROAD GLIDE|K 1600|TRACER|DOMINAR 400/.test(upper)) {
    category = 'Touring';
  } else if (
    /MT-0|MT0|HORNET|CB 300|CB 500F|CB 650|CB 1000|TWISTER|FAZER 250|FZ25|Z300|Z400|Z500|Z650|Z900|Z1000|GSX-S|DUKE|MONSTER|STREETFIGHTER|STREET TRIPLE|SPEED TRIPLE|TRIDENT|SPEED 400|G 310 R|BRUTALE|DRAGSTER|SVARTPILEN|VITPILEN|NK|ZONTES/.test(
      upper
    )
  ) {
    category = 'Naked';
  } else if (/ELETRICA|ELÉTRICA|VOLTZ|EVS|EV1|NIU|SUPER SOCO|WATTS/.test(upper)) {
    category = 'Elétrica';
  }

  // Extract engine displacement safely
  const explicitCcMatch = upper.match(/\b(\d{2,4})\s?(?:CC|CM3)\b/);
  let cc = explicitCcMatch ? Number(explicitCcMatch[1]) : 0;

  if (!cc) {
    const knownTokens = upper.match(/\b(\d{2,4})\b/g);
    if (knownTokens) {
      for (const tok of knownTokens) {
        const val = Number(tok);
        if (val >= 48 && val <= 2500 && !(val >= 1970 && val <= 2030)) {
          cc = val;
          break;
        }
      }
    }
  }

  if (!cc) {
    if (/1000|R1\b|FIREBLADE|S 1000/.test(upper)) cc = 999;
    else if (/1250/.test(upper)) cc = 1254;
    else if (/1300|HAYABUSA/.test(upper)) cc = 1300;
    else if (/R3\b/.test(upper)) cc = 321;
    else if (/R15\b/.test(upper)) cc = 155;
    else if (/HORNET/.test(upper)) cc = 599;
    else cc = 160;
  }

  return { cc, category };
}

function normalizeBrandAlias(normName: string): string {
  const aliases: Record<string, string> = {
    'harley davidson': 'harley davidson',
    'harley-davidson': 'harley davidson',
    'mv agusta': 'mv agusta',
    'royal enfield': 'royal enfield',
    'moto guzzi': 'moto guzzi',
    'bull motors': 'bull motors',
    'bull': 'bull motors',
    'cf moto': 'cfmoto',
    'cfmoto': 'cfmoto',
    'haojue': 'haojue',
    'gas gas': 'gasgas',
    'gasgas': 'gasgas',
  };
  return aliases[normName] || normName;
}

export function loadMotoCatalog(): MotoCatalogState {
  const seed = createInitialMotoCatalogState();
  try {
    const raw = localStorage.getItem(MOTO_CATALOG_STORAGE_KEY);
    if (!raw) {
      return seed;
    }
    const parsed = safeJsonParse<Partial<MotoCatalogState> | null>(raw, null);
    if (!parsed || !Array.isArray(parsed.brands) || !Array.isArray(parsed.models)) {
      return seed;
    }
    // Ensure any newly introduced seed brands/models exist without duplicating user/fipe items
    const brandByNorm = new Map<string, MotoCatalogBrand>();
    parsed.brands.forEach(b => {
      const norm = normalizeBrandAlias(b.normalizedName || normalizeMotoText(b.name));
      brandByNorm.set(norm, { ...b, normalizedName: norm });
    });
    seed.brands.forEach(sb => {
      const norm = normalizeBrandAlias(sb.normalizedName);
      if (!brandByNorm.has(norm)) {
        brandByNorm.set(norm, sb);
      }
    });

    const brands = Array.from(brandByNorm.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR')
    );
    const brandMapByName = new Map(brands.map(b => [normalizeBrandAlias(b.normalizedName), b]));

    const modelKey = (brandNorm: string, modelNorm: string) => `${brandNorm}::${modelNorm}`;
    const modelMap = new Map<string, MotoCatalogModel>();
    parsed.models.forEach(m => {
      const bNorm = normalizeBrandAlias(normalizeMotoText(m.brandName));
      const mNorm = m.normalizedName || normalizeMotoText(m.name);
      const matchedBrand = brandMapByName.get(bNorm);
      modelMap.set(modelKey(bNorm, mNorm), {
        ...m,
        brandId: matchedBrand?.id || m.brandId,
        brandName: matchedBrand?.name || m.brandName,
        normalizedName: mNorm,
      });
    });

    seed.models.forEach(sm => {
      const bNorm = normalizeBrandAlias(normalizeMotoText(sm.brandName));
      const k = modelKey(bNorm, sm.normalizedName);
      if (!modelMap.has(k)) {
        const matchedBrand = brandMapByName.get(bNorm);
        modelMap.set(k, {
          ...sm,
          brandId: matchedBrand?.id || sm.brandId,
          brandName: matchedBrand?.name || sm.brandName,
        });
      }
    });

    return {
      brands,
      models: Array.from(modelMap.values()),
      lastSyncedAt: parsed.lastSyncedAt,
      sourceName: parsed.sourceName || seed.sourceName,
      fipeBrandsCount: parsed.fipeBrandsCount || brands.filter(b => b.fipeCode).length,
      fipeModelsCount: parsed.fipeModelsCount || Array.from(modelMap.values()).filter(m => m.source === 'fipe').length,
      lastSyncNote: parsed.lastSyncNote || seed.lastSyncNote,
    };
  } catch (err) {
    console.error('Erro ao carregar catálogo de motocicletas:', err);
    return seed;
  }
}

export function saveMotoCatalog(catalog: MotoCatalogState): void {
  try {
    const serialized = JSON.stringify(catalog);
    localStorage.setItem(MOTO_CATALOG_STORAGE_KEY, serialized);
    // Persiste no Supabase e sincroniza o catálogo entre dispositivos.
    notifyRealtimeKey(MOTO_CATALOG_STORAGE_KEY, serialized);
  } catch (err) {
    console.error('Erro ao salvar cache do catálogo de motocicletas:', err);
  }
}

export function clearMotoCatalogCache(): MotoCatalogState {
  try {
    localStorage.removeItem(MOTO_CATALOG_STORAGE_KEY);
  } catch {}
  const fresh = createInitialMotoCatalogState();
  saveMotoCatalog(fresh);
  return fresh;
}

export function getCatalogCoverageSummary(catalog: MotoCatalogState): CatalogCoverageSummary {
  const activeBrands = catalog.brands.filter(b => b.active);
  const activeModels = catalog.models.filter(m => m.active);
  return {
    totalBrands: catalog.brands.length,
    activeBrands: activeBrands.length,
    totalModels: catalog.models.length,
    activeModels: activeModels.length,
    fipeBrandsCount: catalog.brands.filter(b => Boolean(b.fipeCode)).length,
    fipeModelsCount: catalog.models.filter(m => m.source === 'fipe' || Boolean(m.fipeCode)).length,
    customBrandsCount: catalog.brands.filter(b => b.isCustom).length,
    customModelsCount: catalog.models.filter(m => m.isCustom).length,
    brandsWithSyncedModels: catalog.brands.filter(b => Boolean(b.modelsSyncedAt)).length,
    lastSyncedAt: catalog.lastSyncedAt,
    sourceName: catalog.sourceName,
    lastSyncNote: catalog.lastSyncNote,
  };
}

// --- CRUD HELPERS (with duplicate protection) ---
export function upsertCatalogBrand(
  catalog: MotoCatalogState,
  input: {
    id?: string;
    name: string;
    country?: string;
    brandColor?: string;
    monogram?: string;
    logoUrl?: string;
    active?: boolean;
    isCustom?: boolean;
    popular?: boolean;
  }
): { catalog: MotoCatalogState; brand: MotoCatalogBrand; created: boolean } {
  const cleanName = input.name.trim();
  const norm = normalizeBrandAlias(normalizeMotoText(cleanName));
  const existing = catalog.brands.find(
    b => (input.id && b.id === input.id) || normalizeBrandAlias(b.normalizedName) === norm
  );

  const safeLogoUrl =
    input.logoUrl !== undefined ? sanitizeImageUrl(input.logoUrl) || undefined : undefined;

  if (existing) {
    const updatedBrand: MotoCatalogBrand = {
      ...existing,
      name: cleanName,
      normalizedName: normalizeMotoText(cleanName),
      country: input.country ?? existing.country,
      brandColor: input.brandColor || existing.brandColor,
      monogram: input.monogram || existing.monogram,
      logoUrl: input.logoUrl !== undefined ? safeLogoUrl : existing.logoUrl,
      active: input.active !== undefined ? input.active : existing.active,
      popular: input.popular !== undefined ? input.popular : existing.popular,
    };
    const nextBrands = catalog.brands
      .map(b => (b.id === existing.id ? updatedBrand : b))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    const nextModels = catalog.models.map(m =>
      m.brandId === existing.id ? { ...m, brandName: updatedBrand.name } : m
    );
    const nextCatalog = { ...catalog, brands: nextBrands, models: nextModels };
    saveMotoCatalog(nextCatalog);
    return { catalog: nextCatalog, brand: updatedBrand, created: false };
  }

  const visuals = getBrandColorAndMonogram(cleanName);
  const newBrand: MotoCatalogBrand = {
    id: `brand_custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: cleanName,
    normalizedName: normalizeMotoText(cleanName),
    country: input.country?.trim() || 'Nacional / Importada',
    popular: input.popular ?? true,
    brandColor: input.brandColor || visuals.brandColor,
    monogram: input.monogram || visuals.monogram,
    logoUrl: safeLogoUrl,
    active: input.active ?? true,
    isCustom: input.isCustom ?? true,
    source: 'custom',
  };

  const nextBrands = [...catalog.brands, newBrand].sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR')
  );
  const nextCatalog = { ...catalog, brands: nextBrands };
  saveMotoCatalog(nextCatalog);
  return { catalog: nextCatalog, brand: newBrand, created: true };
}

export function toggleCatalogBrandActive(
  catalog: MotoCatalogState,
  brandId: string
): MotoCatalogState {
  const nextBrands = catalog.brands.map(b =>
    b.id === brandId ? { ...b, active: !b.active } : b
  );
  const nextCatalog = { ...catalog, brands: nextBrands };
  saveMotoCatalog(nextCatalog);
  return nextCatalog;
}

export function upsertCatalogModel(
  catalog: MotoCatalogState,
  input: {
    id?: string;
    brandId: string;
    name: string;
    popularNames?: string[];
    cc: number;
    category: MotoCategory;
    years: number[];
    versions?: MotoCatalogVersion[];
    active?: boolean;
    isCustom?: boolean;
  }
): { catalog: MotoCatalogState; model: MotoCatalogModel; created: boolean } {
  const brand = catalog.brands.find(b => b.id === input.brandId) || catalog.brands[0];
  const cleanName = input.name.trim();
  const norm = normalizeMotoText(cleanName);

  const existing = catalog.models.find(
    m =>
      (input.id && m.id === input.id) ||
      (m.brandId === brand.id && m.normalizedName === norm)
  );

  const uniqueYears = Array.from(new Set(input.years.filter(y => y >= 1950 && y <= DEFAULT_CURRENT_YEAR + 1))).sort(
    (a, b) => b - a
  );
  const safeYears = uniqueYears.length > 0 ? uniqueYears : buildYearRange(2015, DEFAULT_CURRENT_YEAR);

  if (existing) {
    const updatedModel: MotoCatalogModel = {
      ...existing,
      brandId: brand.id,
      brandName: brand.name,
      name: cleanName,
      normalizedName: norm,
      popularNames: input.popularNames ?? existing.popularNames,
      cc: Number(input.cc) || existing.cc,
      category: input.category || existing.category,
      years: safeYears,
      versions: input.versions && input.versions.length > 0 ? input.versions : existing.versions,
      active: input.active !== undefined ? input.active : existing.active,
    };
    const nextModels = catalog.models.map(m => (m.id === existing.id ? updatedModel : m));
    const nextCatalog = { ...catalog, models: nextModels };
    saveMotoCatalog(nextCatalog);
    return { catalog: nextCatalog, model: updatedModel, created: false };
  }

  const newModel: MotoCatalogModel = {
    id: `mod_custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    brandId: brand.id,
    brandName: brand.name,
    name: cleanName,
    normalizedName: norm,
    popularNames: input.popularNames,
    cc: Number(input.cc) || 160,
    category: input.category || 'Street',
    years: safeYears,
    versions:
      input.versions && input.versions.length > 0
        ? input.versions
        : [
            {
              id: `ver_custom_${Date.now()}`,
              name: 'Standard',
              cc: Number(input.cc) || 160,
              years: safeYears,
            },
          ],
    active: input.active ?? true,
    isCustom: input.isCustom ?? true,
    source: 'custom',
  };

  const nextModels = [...catalog.models, newModel].sort((a, b) =>
    `${a.brandName} ${a.name}`.localeCompare(`${b.brandName} ${b.name}`, 'pt-BR')
  );
  const nextCatalog = { ...catalog, models: nextModels };
  saveMotoCatalog(nextCatalog);
  return { catalog: nextCatalog, model: newModel, created: true };
}

export function toggleCatalogModelActive(
  catalog: MotoCatalogState,
  modelId: string
): MotoCatalogState {
  const nextModels = catalog.models.map(m =>
    m.id === modelId ? { ...m, active: !m.active } : m
  );
  const nextCatalog = { ...catalog, models: nextModels };
  saveMotoCatalog(nextCatalog);
  return nextCatalog;
}

// --- EXTERNAL VEHICLE API (FIPE) INTEGRATION ---
interface FipeBrandItem {
  codigo: string;
  nome: string;
}

interface FipeModelItem {
  codigo: number | string;
  nome: string;
}

interface FipeYearItem {
  codigo: string;
  nome: string;
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 12000, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', onAbort, { once: true });
    }
  }
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new NetworkError(
        `HTTP ${res.status} ao consultar API FIPE`,
        'Tabela FIPE temporariamente indisponível. Usando catálogo local.',
        res.status
      );
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
    if (signal) {
      signal.removeEventListener('abort', onAbort);
    }
  }
}

export async function syncBrandsFromFipe(
  catalog: MotoCatalogState,
  signal?: AbortSignal
): Promise<{ catalog: MotoCatalogState; addedBrands: number; matchedBrands: number; sourceUsed: string }> {
  let rawBrands: FipeBrandItem[] = [];
  let sourceUsed = 'Tabela FIPE (parallelum.com.br)';

  try {
    rawBrands = await swrFetch<FipeBrandItem[]>(
      'fipe:motos:marcas',
      sig => fetchJsonWithTimeout<FipeBrandItem[]>(`${FIPE_BASE_URL}/marcas`, 12000, sig),
      {
        staleMs: 15 * 60 * 1000,
        maxAgeMs: 24 * 60 * 60 * 1000,
        persistKey: 'pk_detail_swr_fipe_marcas_v1',
        signal,
        validate: items => Array.isArray(items) && items.length > 0,
      }
    );
  } catch (primaryErr) {
    if (signal?.aborted) throw primaryErr;
    ErrorReporter.report(primaryErr, { endpoint: 'fipe/marcas', silentOnAbort: true });
    // Fallback to BrasilAPI FIPE mirror if primary fails
    const brasilBrands = await swrFetch<{ valor: string; nome: string }[]>(
      'fipe:motos:marcas:brasilapi',
      sig => fetchJsonWithTimeout<{ valor: string; nome: string }[]>(BRASIL_API_MARCAS_URL, 12000, sig),
      {
        staleMs: 15 * 60 * 1000,
        maxAgeMs: 24 * 60 * 60 * 1000,
        signal,
        validate: items => Array.isArray(items) && items.length > 0,
      }
    );
    rawBrands = brasilBrands.map(b => ({ codigo: b.valor, nome: b.nome }));
    sourceUsed = 'Tabela FIPE (BrasilAPI)';
    if (!rawBrands.length) throw primaryErr;
  }

  const byNorm = new Map<string, MotoCatalogBrand>();
  catalog.brands.forEach(b => {
    byNorm.set(normalizeBrandAlias(b.normalizedName), { ...b });
  });

  let addedBrands = 0;
  let matchedBrands = 0;

  for (const item of rawBrands) {
    const rawName = (item.nome || '').trim();
    if (!rawName) continue;
    const norm = normalizeBrandAlias(normalizeMotoText(rawName));
    const existing = byNorm.get(norm);

    if (existing) {
      matchedBrands++;
      byNorm.set(norm, {
        ...existing,
        fipeCode: String(item.codigo),
      });
    } else {
      addedBrands++;
      const displayName = formatBrandDisplayName(rawName);
      const visuals = getBrandColorAndMonogram(displayName);
      byNorm.set(norm, {
        id: `brand_fipe_${String(item.codigo)}`,
        name: displayName,
        normalizedName: normalizeMotoText(displayName),
        country: 'Importada / Nacional',
        popular: false,
        fipeCode: String(item.codigo),
        brandColor: visuals.brandColor,
        monogram: visuals.monogram,
        active: true,
        isCustom: false,
        source: 'fipe',
      });
    }
  }

  const nextBrands = Array.from(byNorm.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR')
  );

  // Remap any models whose brandId pointed to seed IDs cleanly (IDs preserved)
  const nowIso = new Date().toISOString();
  const nextCatalog: MotoCatalogState = {
    ...catalog,
    brands: nextBrands,
    lastSyncedAt: nowIso,
    sourceName: sourceUsed,
    fipeBrandsCount: nextBrands.filter(b => Boolean(b.fipeCode)).length,
    fipeModelsCount: catalog.models.filter(m => m.source === 'fipe' || Boolean(m.fipeCode)).length,
    lastSyncNote: `${rawBrands.length} marcas obtidas da FIPE (${addedBrands} novas, ${matchedBrands} vinculadas sem duplicidade).`,
  };

  saveMotoCatalog(nextCatalog);
  return { catalog: nextCatalog, addedBrands, matchedBrands, sourceUsed };
}

export async function syncModelsForBrandFromFipe(
  catalog: MotoCatalogState,
  brandId: string,
  signal?: AbortSignal
): Promise<{ catalog: MotoCatalogState; importedCount: number; brandName: string }> {
  const brand = catalog.brands.find(b => b.id === brandId);
  if (!brand) {
    throw new Error('Marca não encontrada no catálogo.');
  }
  if (!brand.fipeCode) {
    throw new Error(`Marca "${brand.name}" ainda não possui código FIPE vinculado. Execute "Sincronizar Marcas FIPE" primeiro.`);
  }

  const payload = await swrFetch<{ modelos: FipeModelItem[]; anos?: FipeYearItem[] }>(
    `fipe:motos:modelos:${brand.fipeCode}`,
    sig =>
      fetchJsonWithTimeout<{ modelos: FipeModelItem[]; anos?: FipeYearItem[] }>(
        `${FIPE_BASE_URL}/marcas/${encodeURIComponent(brand.fipeCode || '')}/modelos`,
        14000,
        sig
      ),
    {
      staleMs: 15 * 60 * 1000,
      maxAgeMs: 24 * 60 * 60 * 1000,
      signal,
      validate: res => Array.isArray(res?.modelos) && res.modelos.length > 0,
    }
  );

  const fipeModels = Array.isArray(payload?.modelos) ? payload.modelos : [];
  const defaultYearsFromBrand = Array.isArray(payload?.anos)
    ? Array.from(
        new Set(
          payload.anos
            .map(a => parseInt(String(a.nome).slice(0, 4), 10))
            .filter(y => !isNaN(y) && y >= 1950 && y <= DEFAULT_CURRENT_YEAR + 1)
        )
      ).sort((a, b) => b - a)
    : [];

  const modelsByNorm = new Map<string, MotoCatalogModel>();
  const otherModels: MotoCatalogModel[] = [];

  for (const m of catalog.models) {
    if (m.brandId === brand.id) {
      modelsByNorm.set(m.normalizedName, { ...m });
    } else {
      otherModels.push(m);
    }
  }

  let importedCount = 0;

  for (const fm of fipeModels) {
    const cleanModelName = String(fm.nome || '').trim();
    if (!cleanModelName) continue;
    const norm = normalizeMotoText(cleanModelName);
    const fipeCode = String(fm.codigo);

    const existing =
      modelsByNorm.get(norm) ||
      Array.from(modelsByNorm.values()).find(m => m.fipeCode === fipeCode);

    if (existing) {
      modelsByNorm.set(existing.normalizedName, {
        ...existing,
        fipeCode: existing.fipeCode || fipeCode,
      });
      continue;
    }

    importedCount++;
    const inferred = inferMotoSpecsFromName(cleanModelName);
    const initialYears =
      defaultYearsFromBrand.length > 0
        ? defaultYearsFromBrand
        : buildYearRange(2005, DEFAULT_CURRENT_YEAR);

    modelsByNorm.set(norm, {
      id: `mod_fipe_${brand.fipeCode}_${fipeCode}`,
      brandId: brand.id,
      brandName: brand.name,
      name: cleanModelName,
      normalizedName: norm,
      cc: inferred.cc,
      category: inferred.category,
      years: initialYears,
      versions: [
        {
          id: `ver_fipe_${brand.fipeCode}_${fipeCode}_std`,
          name: cleanModelName,
          cc: inferred.cc,
          years: initialYears,
        },
      ],
      fipeCode,
      active: true,
      isCustom: false,
      source: 'fipe',
    });
  }

  const nowIso = new Date().toISOString();
  const nextBrands = catalog.brands.map(b =>
    b.id === brand.id ? { ...b, modelsSyncedAt: nowIso } : b
  );
  const brandModels = Array.from(modelsByNorm.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR')
  );
  const nextModels = [...otherModels, ...brandModels];

  const nextCatalog: MotoCatalogState = {
    ...catalog,
    brands: nextBrands,
    models: nextModels,
    lastSyncedAt: nowIso,
    sourceName: catalog.sourceName.includes('FIPE') ? catalog.sourceName : 'Tabela FIPE (parallelum.com.br)',
    fipeBrandsCount: nextBrands.filter(b => Boolean(b.fipeCode)).length,
    fipeModelsCount: nextModels.filter(m => m.source === 'fipe' || Boolean(m.fipeCode)).length,
    lastSyncNote: `${brand.name}: ${fipeModels.length} registros na FIPE (${importedCount} novos adicionados sem duplicidade).`,
  };

  saveMotoCatalog(nextCatalog);
  return { catalog: nextCatalog, importedCount, brandName: brand.name };
}

export async function syncYearsForModelFromFipe(
  catalog: MotoCatalogState,
  modelId: string,
  signal?: AbortSignal
): Promise<{ catalog: MotoCatalogState; model: MotoCatalogModel | null }> {
  const model = catalog.models.find(m => m.id === modelId);
  if (!model || !model.fipeCode) return { catalog, model: model || null };

  const brand = catalog.brands.find(b => b.id === model.brandId);
  if (!brand?.fipeCode) return { catalog, model };

  const rawYears = await swrFetch<FipeYearItem[]>(
    `fipe:motos:anos:${brand.fipeCode}:${model.fipeCode}`,
    sig =>
      fetchJsonWithTimeout<FipeYearItem[]>(
        `${FIPE_BASE_URL}/marcas/${encodeURIComponent(brand.fipeCode || '')}/modelos/${encodeURIComponent(model.fipeCode || '')}/anos`,
        12000,
        sig
      ),
    {
      staleMs: 15 * 60 * 1000,
      maxAgeMs: 24 * 60 * 60 * 1000,
      signal,
      validate: res => Array.isArray(res) && res.length > 0,
    }
  );

  if (!Array.isArray(rawYears) || rawYears.length === 0) {
    return { catalog, model };
  }

  const parsedYears: number[] = [];
  const fipeCodes: string[] = [];
  const labelSet = new Set<string>();

  for (const item of rawYears) {
    const label = String(item.nome || '').trim();
    const yr = parseInt(label.slice(0, 4), 10);
    // FIPE uses 32000 for "Zero KM"
    if (yr === 3200) {
      const zeroYr = new Date().getFullYear();
      parsedYears.push(zeroYr);
      labelSet.add('0 km (Atual)');
    } else if (!isNaN(yr) && yr >= 1950 && yr <= DEFAULT_CURRENT_YEAR + 1) {
      parsedYears.push(yr);
      const rest = label.slice(4).trim();
      if (rest) labelSet.add(rest);
    }
    if (item.codigo) fipeCodes.push(String(item.codigo));
  }

  const uniqueYears =
    model.source === 'fipe' && !model.isCustom && parsedYears.length > 0
      ? Array.from(new Set(parsedYears)).sort((a, b) => b - a)
      : Array.from(new Set([...parsedYears, ...model.years])).sort((a, b) => b - a);

  const fipeVersionName =
    labelSet.size > 0
      ? `${model.name} (${Array.from(labelSet).slice(0, 2).join(' / ')})`
      : model.versions[0]?.name || 'Standard';

  const existingVersions = model.versions || [];
  const hasFipeVer = existingVersions.some(
    v => v.id.startsWith(`ver_fipe_years_${model.fipeCode}`) || v.id.startsWith(`ver_fipe_${brand.fipeCode}_${model.fipeCode}`)
  );
  const nextVersions: MotoCatalogVersion[] = hasFipeVer
    ? existingVersions.map(v =>
        v.id.startsWith(`ver_fipe_years_${model.fipeCode}`) ||
        v.id.startsWith(`ver_fipe_${brand.fipeCode}_${model.fipeCode}`)
          ? {
              ...v,
              name: v.id.startsWith(`ver_fipe_years_`) || fipeVersionName.includes('(') ? fipeVersionName : v.name,
              years: uniqueYears,
              fipeYearCodes: fipeCodes,
            }
          : v
      )
    : [
        ...existingVersions.map(v => ({
          ...v,
          years: v.years.length > 0 ? v.years : uniqueYears,
        })),
        ...(existingVersions.length === 0
          ? [
              {
                id: `ver_fipe_years_${model.fipeCode}`,
                name: fipeVersionName,
                cc: model.cc,
                years: uniqueYears,
                fipeYearCodes: fipeCodes,
              },
            ]
          : []),
      ];

  const updatedModel: MotoCatalogModel = {
    ...model,
    years: uniqueYears,
    versions: nextVersions,
    yearsSyncedAt: new Date().toISOString(),
  };

  const nextCatalog: MotoCatalogState = {
    ...catalog,
    models: catalog.models.map(m => (m.id === model.id ? updatedModel : m)),
  };
  saveMotoCatalog(nextCatalog);
  return { catalog: nextCatalog, model: updatedModel };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function syncFullFipeCatalog(
  initialCatalog: MotoCatalogState,
  onProgress?: (p: FipeSyncProgress) => void,
  signal?: AbortSignal
): Promise<MotoCatalogState> {
  onProgress?.({
    phase: 'marcas',
    current: 0,
    total: 1,
    importedBrands: 0,
    importedModels: 0,
    errorsCount: 0,
    message: 'Importando todas as marcas de motocicletas da Tabela FIPE...',
  });

  const brandSync = await syncBrandsFromFipe(initialCatalog, signal);
  let currentCatalog = brandSync.catalog;

  // Prioritize popular/unsynced brands first, then sync ALL remaining FIPE brands
  const fipeBrands = [
    ...currentCatalog.brands.filter(b => b.fipeCode && b.popular),
    ...currentCatalog.brands.filter(b => b.fipeCode && !b.popular),
  ];

  let totalNewModels = 0;
  let errorsCount = 0;

  for (let i = 0; i < fipeBrands.length; i++) {
    if (signal?.aborted) break;
    const brand = fipeBrands[i];

    onProgress?.({
      phase: 'modelos',
      current: i + 1,
      total: fipeBrands.length,
      currentBrandName: brand.name,
      importedBrands: brandSync.addedBrands,
      importedModels: totalNewModels,
      errorsCount,
      message: `Importando modelos FIPE: ${brand.name} (${i + 1}/${fipeBrands.length})`,
    });

    try {
      const res = await syncModelsForBrandFromFipe(currentCatalog, brand.id, signal);
      currentCatalog = res.catalog;
      totalNewModels += res.importedCount;
    } catch (err) {
      if (signal?.aborted) break;
      errorsCount++;
      // Small backoff on rate limit and continue gracefully
      await sleep(350);
    }

    // Gentle pacing to avoid HTTP 429 on free public FIPE endpoints
    if (i < fipeBrands.length - 1 && !signal?.aborted) {
      await sleep(110);
    }
  }

  const finalCatalog: MotoCatalogState = {
    ...currentCatalog,
    lastSyncedAt: new Date().toISOString(),
    lastSyncNote: signal?.aborted
      ? `Sincronização interrompida parcialmente (${totalNewModels} novos modelos salvos em cache).`
      : `Sincronização FIPE concluída: ${fipeBrands.length} marcas consultadas, ${totalNewModels} novos modelos adicionados${
          errorsCount > 0 ? ` (${errorsCount} marca(s) ignorada(s) por limite da API)` : ''
        }.`,
  };
  saveMotoCatalog(finalCatalog);

  onProgress?.({
    phase: 'concluido',
    current: fipeBrands.length,
    total: fipeBrands.length,
    importedBrands: brandSync.addedBrands,
    importedModels: totalNewModels,
    errorsCount,
    message: finalCatalog.lastSyncNote || 'Sincronização concluída.',
  });

  return finalCatalog;
}

// --- SMART SEARCH ENGINE ---
export interface SmartSearchCatalogResult {
  registeredMatches: Motorcycle[];
  modelMatches: MotoCatalogModel[];
  brandMatches: MotoCatalogBrand[];
}

export function smartSearchCatalog(params: {
  query: string;
  catalog: MotoCatalogState;
  registeredMotorcycles?: Motorcycle[];
  selectedBrandId?: string;
  selectedBrandName?: string;
  maxResults?: number;
}): SmartSearchCatalogResult {
  const {
    query,
    catalog,
    registeredMotorcycles = [],
    selectedBrandId,
    selectedBrandName,
    maxResults = 25,
  } = params;

  const qNorm = normalizeMotoText(query);
  const qCompact = query.toUpperCase().replace(/[^A-Z0-9]/g, '');

  const activeBrands = catalog.brands.filter(b => b.active);
  const scopedBrand = selectedBrandId
    ? activeBrands.find(b => b.id === selectedBrandId)
    : selectedBrandName
      ? activeBrands.find(
          b => normalizeBrandAlias(b.normalizedName) === normalizeBrandAlias(normalizeMotoText(selectedBrandName))
        )
      : undefined;

  // Strictly scope models when a brand is selected
  const poolModels = scopedBrand
    ? catalog.models.filter(m => m.active && m.brandId === scopedBrand.id)
    : catalog.models.filter(m => m.active);

  if (!qNorm && !qCompact) {
    return {
      registeredMatches: scopedBrand
        ? registeredMotorcycles.filter(
            m =>
              normalizeBrandAlias(normalizeMotoText(m.brand)) ===
              normalizeBrandAlias(scopedBrand.normalizedName)
          )
        : registeredMotorcycles.slice(0, maxResults),
      modelMatches: poolModels.slice(0, maxResults),
      brandMatches: activeBrands.slice(0, maxResults),
    };
  }

  const tokens = qNorm.split(/\s+/).filter(Boolean);

  const registeredMatches = registeredMotorcycles
    .filter(m => {
      if (
        scopedBrand &&
        normalizeBrandAlias(normalizeMotoText(m.brand)) !==
          normalizeBrandAlias(scopedBrand.normalizedName)
      ) {
        return false;
      }
      const plateCompact = m.plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const haystack = normalizeMotoText(
        `${m.brand} ${m.model} ${m.version || ''} ${m.cc} ${m.plate} ${m.clientName || ''}`
      );
      return (
        (qCompact.length >= 2 && plateCompact.includes(qCompact)) ||
        tokens.every(t => haystack.includes(t))
      );
    })
    .slice(0, maxResults);

  const brandMatches = activeBrands
    .filter(b => {
      const h = `${b.normalizedName} ${normalizeMotoText(b.country)}`;
      return tokens.every(t => h.includes(t));
    })
    .slice(0, maxResults);

  const scoredModels = poolModels
    .map(m => {
      const popularJoined = (m.popularNames || []).map(p => normalizeMotoText(p)).join(' ');
      const haystack = `${m.normalizedName} ${normalizeMotoText(m.brandName)} ${popularJoined} ${m.cc}cc ${m.cc} ${normalizeMotoText(m.category)}`;
      const matchesAll = tokens.every(t => haystack.includes(t));
      if (!matchesAll) return null;

      let score = 0;
      if (m.normalizedName.startsWith(qNorm)) score += 100;
      else if (m.normalizedName.includes(qNorm)) score += 60;
      if (popularJoined.includes(qNorm)) score += 40;
      if (String(m.cc) === qNorm) score += 35;
      if (m.source === 'seed') score += 10;
      return { model: m, score };
    })
    .filter((item): item is { model: MotoCatalogModel; score: number } => item !== null)
    .sort((a, b) => b.score - a.score || a.model.name.localeCompare(b.model.name, 'pt-BR'))
    .slice(0, maxResults)
    .map(item => item.model);

  return {
    registeredMatches,
    modelMatches: scoredModels,
    brandMatches,
  };
}

export function getVersionsForModelAndYear(
  model: MotoCatalogModel | undefined | null,
  year?: number
): MotoCatalogVersion[] {
  if (!model) return [];
  const versions = model.versions || [];
  if (!year) return versions;
  const matching = versions.filter(v => v.years.length === 0 || v.years.includes(year));
  return matching.length > 0 ? matching : versions;
}
