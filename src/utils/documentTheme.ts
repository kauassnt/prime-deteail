// Cor institucional dos documentos (PDFs reais: OS, comprovante/recibo e orçamento).
export const DEFAULT_DOCUMENT_COLOR = '#111827';

const HEX_PATTERN = /^#([0-9a-f]{6}|[0-9a-f]{3})$/i;

export function resolveDocumentColor(raw?: string | null): string {
  if (!raw) return DEFAULT_DOCUMENT_COLOR;
  const value = raw.trim();
  if (!HEX_PATTERN.test(value)) return DEFAULT_DOCUMENT_COLOR;
  if (value.length === 4) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toUpperCase();
  }
  return value.toUpperCase();
}

function channelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const color = resolveDocumentColor(hex);
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

/** Texto legível por cima da cor escolhida (cabeçalhos de tabela, barras). */
export function documentOnAccent(raw?: string | null): string {
  return relativeLuminance(resolveDocumentColor(raw)) > 0.45 ? '#111827' : '#FFFFFF';
}

/** Versão da cor que pode ser usada como texto sobre fundo branco. */
export function documentAccentInk(raw?: string | null): string {
  const color = resolveDocumentColor(raw);
  return relativeLuminance(color) > 0.6 ? '#111827' : color;
}

/** Gradiente da faixa superior dos documentos, mantendo o acabamento escuro à direita. */
export function documentBarGradient(raw?: string | null): string {
  const color = resolveDocumentColor(raw);
  return `linear-gradient(to right, ${color}, ${color}, #171717)`;
}
