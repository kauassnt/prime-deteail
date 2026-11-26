import type { BrandLogoFormat } from '../types';

export const BRAND_LOGO_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_BRAND_LOGO_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
]);

export function sanitizeBrandFileName(rawName: string): string {
  const base = rawName.split(/[/\\]/).pop() || 'logo';
  const cleaned = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(0, 80);
  return cleaned || 'logo';
}

export function inferBrandFormatFromFile(
  fileName: string,
  mimeType: string
): { format: BrandLogoFormat; mimeType: string; ext: string } | null {
  const lowerMime = (mimeType || '').toLowerCase().trim();
  const ext = (fileName.split('.').pop() || '').toLowerCase().trim();

  if (lowerMime === 'image/png' || (!lowerMime && ext === 'png')) {
    return { format: 'PNG', mimeType: 'image/png', ext: 'png' };
  }
  if (lowerMime === 'image/jpeg' || lowerMime === 'image/jpg' || ext === 'jpg' || ext === 'jpeg') {
    if (ext === 'jpg') {
      return { format: 'JPG', mimeType: 'image/jpeg', ext: 'jpg' };
    }
    return { format: 'JPEG', mimeType: 'image/jpeg', ext: 'jpg' };
  }
  if (lowerMime === 'image/webp' || (!lowerMime && ext === 'webp')) {
    return { format: 'WEBP', mimeType: 'image/webp', ext: 'webp' };
  }
  if (lowerMime === 'image/svg+xml' || (!lowerMime && ext === 'svg')) {
    return { format: 'SVG', mimeType: 'image/svg+xml', ext: 'svg' };
  }
  return null;
}

export function verifyRasterMagicBytes(bytes: Uint8Array, mimeType: string): boolean {
  if (bytes.length < 12) return false;
  if (mimeType === 'image/png') {
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }
  if (mimeType === 'image/jpeg') {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === 'image/webp') {
    const riff =
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
    const webp =
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
    return riff && webp;
  }
  return false;
}

const FORBIDDEN_SVG_TAGS = [
  'script',
  'foreignObject',
  'iframe',
  'object',
  'embed',
  'applet',
  'frame',
  'frameset',
  'meta',
  'link',
  'base',
  'audio',
  'video',
  'portal',
];

export function sanitizeSvgMarkup(rawSvg: string): { ok: true; svg: string } | { ok: false; error: string } {
  if (!rawSvg || typeof rawSvg !== 'string') {
    return { ok: false, error: 'Conteúdo SVG vazio.' };
  }
  if (rawSvg.includes('\u0000')) {
    return { ok: false, error: 'Arquivo SVG contém bytes inválidos.' };
  }

  let cleaned = rawSvg
    .replace(/^\uFEFF/, '')
    .replace(/<\?[\s\S]*?\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<!ENTITY[\s\S]*?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();

  // Reject if no root <svg ...> tag exists
  const svgStart = cleaned.search(/<svg[\s>]/i);
  const svgEnd = cleaned.toLowerCase().lastIndexOf('</svg>');
  if (svgStart === -1 || svgEnd === -1 || svgEnd <= svgStart) {
    return { ok: false, error: 'Arquivo não possui estrutura SVG válida.' };
  }
  cleaned = cleaned.slice(svgStart, svgEnd + 6);

  // Strip dangerous executable or external container tags (paired and self-closing)
  for (const tag of FORBIDDEN_SVG_TAGS) {
    const pairedRe = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
    const selfRe = new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi');
    cleaned = cleaned.replace(pairedRe, '').replace(selfRe, '');
  }

  // Strip all inline event handlers (on*)
  cleaned = cleaned
    .replace(/\s+on[a-zA-Z0-9_-]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\s+on[a-zA-Z0-9_-]+\s*=\s*'[^']*'/gi, '')
    .replace(/\s+on[a-zA-Z0-9_-]+\s*=\s*[^\s>]+/gi, '');

  // Strip dangerous URI attributes & external links inside SVG
  cleaned = cleaned.replace(
    /\s+((?:xlink:)?href|src|action|formaction)\s*=\s*("([^"]*)"|'([^']*)')/gi,
    (_full, attr: string, _quoted: string, dqVal?: string, sqVal?: string) => {
      const val = (dqVal ?? sqVal ?? '').trim();
      if (!val || val.startsWith('#')) {
        return ` ${attr}="${val}"`;
      }
      // Allow safe raster embedded images only; block javascript:, vbscript:, data:text/html, external URLs
      if (/^data:image\/(?:png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/i.test(val)) {
        return ` ${attr}="${val}"`;
      }
      return '';
    }
  );

  // Sanitize inline <style> blocks and style="..." attributes against CSS script/external URLs
  cleaned = cleaned.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_m, cssBody: string) => {
    const safeCss = cssBody
      .replace(/@import[^;]*;?/gi, '')
      .replace(/expression\s*\([^)]*\)/gi, '')
      .replace(/javascript\s*:/gi, '')
      .replace(/url\s*\(\s*['"]?(?!#)[^)]*\)/gi, 'none');
    return `<style>${safeCss}</style>`;
  });

  cleaned = cleaned.replace(/\s+style\s*=\s*("([^"]*)"|'([^']*)')/gi, (_m, _q, dq?: string, sq?: string) => {
    const styleVal = (dq ?? sq ?? '')
      .replace(/expression\s*\([^)]*\)/gi, '')
      .replace(/javascript\s*:/gi, '')
      .replace(/url\s*\(\s*['"]?(?!#)[^)]*\)/gi, 'none');
    return ` style="${styleVal}"`;
  });

  // Verify basic graphic content remains inside <svg>...</svg>
  const inner = cleaned.replace(/^<svg\b[^>]*>/i, '').replace(/<\/svg>$/i, '').trim();
  if (!inner) {
    return { ok: false, error: 'SVG inválido ou bloqueado pela sanitização de segurança.' };
  }

  return { ok: true, svg: cleaned };
}

export async function validateAndPrepareBrandLogoFile(file: File): Promise<
  | {
      ok: true;
      fileName: string;
      format: BrandLogoFormat;
      mimeType: string;
      sizeBytes: number;
      dataBase64: string;
      previewDataUrl: string;
    }
  | { ok: false; error: string }
> {
  if (!file) {
    return { ok: false, error: 'Nenhum arquivo selecionado.' };
  }
  if (file.size === 0) {
    return { ok: false, error: 'O arquivo selecionado está vazio.' };
  }
  if (file.size > BRAND_LOGO_MAX_BYTES) {
    return {
      ok: false,
      error: `O arquivo excede o limite máximo de 5 MB (${(file.size / (1024 * 1024)).toFixed(2)} MB).`,
    };
  }

  const inferred = inferBrandFormatFromFile(file.name, file.type);
  if (!inferred) {
    return {
      ok: false,
      error: 'Formato não suportado. Utilize apenas PNG, JPG/JPEG, WEBP ou SVG.',
    };
  }

  const sanitizedName = sanitizeBrandFileName(file.name);

  if (inferred.format === 'SVG') {
    const text = await file.text();
    const svgCheck = sanitizeSvgMarkup(text);
    if (!svgCheck.ok) {
      return { ok: false, error: svgCheck.error };
    }
    const encodedBytes = new TextEncoder().encode(svgCheck.svg);
    let binary = '';
    for (let i = 0; i < encodedBytes.length; i++) {
      binary += String.fromCharCode(encodedBytes[i]);
    }
    const base64 = btoa(binary);
    return {
      ok: true,
      fileName: sanitizedName,
      format: 'SVG',
      mimeType: 'image/svg+xml',
      sizeBytes: encodedBytes.length,
      dataBase64: base64,
      previewDataUrl: `data:image/svg+xml;base64,${base64}`,
    };
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  if (!verifyRasterMagicBytes(bytes, inferred.mimeType)) {
    return {
      ok: false,
      error: `Assinatura binária inválida para ${inferred.format}. Verifique se a imagem não está corrompida ou renomeada.`,
    };
  }

  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const base64 = btoa(binary);

  return {
    ok: true,
    fileName: sanitizedName,
    format: inferred.format,
    mimeType: inferred.mimeType,
    sizeBytes: bytes.length,
    dataBase64: base64,
    previewDataUrl: `data:${inferred.mimeType};base64,${base64}`,
  };
}
