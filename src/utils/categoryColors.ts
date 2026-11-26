import type { AppModule } from '../context/AppContext';

export interface ModuleColorTheme {
  iconClass: string;
  iconBoxClass: string;
  cardIdleClass: string;
  cardActiveClass: string;
  accentBgClass: string;
  activeTextClass: string;
}

export const MODULE_COLOR_THEMES: Record<AppModule, ModuleColorTheme> = {
  dashboard: {
    iconClass: 'text-orange-600',
    iconBoxClass: 'bg-orange-100 text-orange-700 border border-orange-200/80',
    cardIdleClass: 'bg-orange-50/45 border-orange-200/70 text-slate-800 hover:bg-orange-50',
    cardActiveClass: 'bg-orange-100/90 border-orange-500 text-orange-950 font-bold ring-1 ring-orange-500/30',
    accentBgClass: 'bg-orange-600',
    activeTextClass: 'text-orange-700',
  },
  patio: {
    iconClass: 'text-sky-600',
    iconBoxClass: 'bg-sky-100 text-sky-700 border border-sky-200/80',
    cardIdleClass: 'bg-sky-50/45 border-sky-200/70 text-slate-800 hover:bg-sky-50',
    cardActiveClass: 'bg-sky-100/90 border-sky-500 text-sky-950 font-bold ring-1 ring-sky-500/30',
    accentBgClass: 'bg-sky-600',
    activeTextClass: 'text-sky-700',
  },
  agenda: {
    iconClass: 'text-amber-600',
    iconBoxClass: 'bg-amber-100 text-amber-700 border border-amber-200/80',
    cardIdleClass: 'bg-amber-50/45 border-amber-200/70 text-slate-800 hover:bg-amber-50',
    cardActiveClass: 'bg-amber-100/90 border-amber-500 text-amber-950 font-bold ring-1 ring-amber-500/30',
    accentBgClass: 'bg-amber-600',
    activeTextClass: 'text-amber-700',
  },
  ordens: {
    iconClass: 'text-orange-600',
    iconBoxClass: 'bg-orange-100 text-orange-700 border border-orange-200/80',
    cardIdleClass: 'bg-orange-50/50 border-orange-200/70 text-slate-800 hover:bg-orange-50',
    cardActiveClass: 'bg-orange-100/90 border-orange-500 text-orange-950 font-bold ring-1 ring-orange-500/30',
    accentBgClass: 'bg-orange-600',
    activeTextClass: 'text-orange-700',
  },
  empresa: {
    iconClass: 'text-yellow-600',
    iconBoxClass: 'bg-yellow-100 text-yellow-700 border border-yellow-200/80',
    cardIdleClass: 'bg-yellow-50/50 border-yellow-200/70 text-slate-800 hover:bg-yellow-50',
    cardActiveClass: 'bg-yellow-100/90 border-yellow-500 text-yellow-950 font-bold ring-1 ring-yellow-500/30',
    accentBgClass: 'bg-yellow-500',
    activeTextClass: 'text-yellow-700',
  },
  suporte: {
    iconClass: 'text-yellow-600',
    iconBoxClass: 'bg-yellow-100 text-yellow-700 border border-yellow-200/80',
    cardIdleClass: 'bg-yellow-50/50 border-yellow-200/70 text-slate-800 hover:bg-yellow-50',
    cardActiveClass: 'bg-yellow-100/90 border-yellow-500 text-yellow-950 font-bold ring-1 ring-yellow-500/30',
    accentBgClass: 'bg-yellow-500',
    activeTextClass: 'text-yellow-700',
  },
  mensagens: {
    iconClass: 'text-yellow-600',
    iconBoxClass: 'bg-yellow-100 text-yellow-700 border border-yellow-200/80',
    cardIdleClass: 'bg-yellow-50/50 border-yellow-200/70 text-slate-800 hover:bg-yellow-50',
    cardActiveClass: 'bg-yellow-100/90 border-yellow-500 text-yellow-950 font-bold ring-1 ring-yellow-500/30',
    accentBgClass: 'bg-yellow-500',
    activeTextClass: 'text-yellow-700',
  },
  instalar: {
    iconClass: 'text-yellow-600',
    iconBoxClass: 'bg-yellow-100 text-yellow-700 border border-yellow-200/80',
    cardIdleClass: 'bg-yellow-50/50 border-yellow-200/70 text-slate-800 hover:bg-yellow-50',
    cardActiveClass: 'bg-yellow-100/90 border-yellow-500 text-yellow-950 font-bold ring-1 ring-yellow-500/30',
    accentBgClass: 'bg-yellow-500',
    activeTextClass: 'text-yellow-700',
  },
  metas: {
    iconClass: 'text-yellow-600',
    iconBoxClass: 'bg-yellow-100 text-yellow-700 border border-yellow-200/80',
    cardIdleClass: 'bg-yellow-50/50 border-yellow-200/70 text-slate-800 hover:bg-yellow-50',
    cardActiveClass: 'bg-yellow-100/90 border-yellow-500 text-yellow-950 font-bold ring-1 ring-yellow-500/30',
    accentBgClass: 'bg-yellow-500',
    activeTextClass: 'text-yellow-700',
  },
  posvenda: {
    iconClass: 'text-yellow-600',
    iconBoxClass: 'bg-yellow-100 text-yellow-700 border border-yellow-200/80',
    cardIdleClass: 'bg-yellow-50/50 border-yellow-200/70 text-slate-800 hover:bg-yellow-50',
    cardActiveClass: 'bg-yellow-100/90 border-yellow-500 text-yellow-950 font-bold ring-1 ring-yellow-500/30',
    accentBgClass: 'bg-yellow-500',
    activeTextClass: 'text-yellow-700',
  },
  vitrine: {
    iconClass: 'text-yellow-600',
    iconBoxClass: 'bg-yellow-100 text-yellow-700 border border-yellow-200/80',
    cardIdleClass: 'bg-yellow-50/50 border-yellow-200/70 text-slate-800 hover:bg-yellow-50',
    cardActiveClass: 'bg-yellow-100/90 border-yellow-500 text-yellow-950 font-bold ring-1 ring-yellow-500/30',
    accentBgClass: 'bg-yellow-500',
    activeTextClass: 'text-yellow-700',
  },
  orcamentos: {
    iconClass: 'text-amber-600',
    iconBoxClass: 'bg-amber-100 text-amber-700 border border-amber-200/80',
    cardIdleClass: 'bg-amber-50/50 border-amber-200/70 text-slate-800 hover:bg-amber-50',
    cardActiveClass: 'bg-amber-100/90 border-amber-500 text-amber-950 font-bold ring-1 ring-amber-500/30',
    accentBgClass: 'bg-amber-600',
    activeTextClass: 'text-amber-700',
  },
  financeiro: {
    iconClass: 'text-emerald-600',
    iconBoxClass: 'bg-emerald-100 text-emerald-700 border border-emerald-200/80',
    cardIdleClass: 'bg-emerald-50/50 border-emerald-200/70 text-slate-800 hover:bg-emerald-50',
    cardActiveClass: 'bg-emerald-100/90 border-emerald-600 text-emerald-950 font-bold ring-1 ring-emerald-500/30',
    accentBgClass: 'bg-emerald-600',
    activeTextClass: 'text-emerald-700',
  },
  clientes: {
    iconClass: 'text-sky-600',
    iconBoxClass: 'bg-sky-100 text-sky-700 border border-sky-200/80',
    cardIdleClass: 'bg-sky-50/50 border-sky-200/70 text-slate-800 hover:bg-sky-50',
    cardActiveClass: 'bg-sky-100/90 border-sky-600 text-sky-950 font-bold ring-1 ring-sky-500/30',
    accentBgClass: 'bg-sky-600',
    activeTextClass: 'text-sky-700',
  },
  servicos: {
    iconClass: 'text-fuchsia-600',
    iconBoxClass: 'bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200/80',
    cardIdleClass: 'bg-fuchsia-50/50 border-fuchsia-200/70 text-slate-800 hover:bg-fuchsia-50',
    cardActiveClass: 'bg-fuchsia-100/90 border-fuchsia-600 text-fuchsia-950 font-bold ring-1 ring-fuchsia-500/30',
    accentBgClass: 'bg-fuchsia-600',
    activeTextClass: 'text-fuchsia-700',
  },
  funcionarios: {
    iconClass: 'text-indigo-600',
    iconBoxClass: 'bg-indigo-100 text-indigo-700 border border-indigo-200/80',
    cardIdleClass: 'bg-indigo-50/50 border-indigo-200/70 text-slate-800 hover:bg-indigo-50',
    cardActiveClass: 'bg-indigo-100/90 border-indigo-600 text-indigo-950 font-bold ring-1 ring-indigo-500/30',
    accentBgClass: 'bg-indigo-600',
    activeTextClass: 'text-indigo-700',
  },
  permissions: {
    iconClass: 'text-purple-600',
    iconBoxClass: 'bg-purple-100 text-purple-700 border border-purple-200/80',
    cardIdleClass: 'bg-purple-50/50 border-purple-200/70 text-slate-800 hover:bg-purple-50',
    cardActiveClass: 'bg-purple-100/90 border-purple-600 text-purple-950 font-bold ring-1 ring-purple-500/30',
    accentBgClass: 'bg-purple-600',
    activeTextClass: 'text-purple-700',
  },
  whatsapp: {
    iconClass: 'text-green-600',
    iconBoxClass: 'bg-green-100 text-green-700 border border-green-200/80',
    cardIdleClass: 'bg-green-50/50 border-green-200/70 text-slate-800 hover:bg-green-50',
    cardActiveClass: 'bg-green-100/90 border-green-600 text-green-950 font-bold ring-1 ring-green-500/30',
    accentBgClass: 'bg-green-600',
    activeTextClass: 'text-green-700',
  },
  relatorios: {
    iconClass: 'text-lime-700',
    iconBoxClass: 'bg-lime-100 text-lime-800 border border-lime-200/80',
    cardIdleClass: 'bg-lime-50/50 border-lime-200/70 text-slate-800 hover:bg-lime-50',
    cardActiveClass: 'bg-lime-100/90 border-lime-600 text-lime-950 font-bold ring-1 ring-lime-500/30',
    accentBgClass: 'bg-lime-600',
    activeTextClass: 'text-lime-800',
  },
};

export function getModuleColorTheme(moduleId: AppModule): ModuleColorTheme {
  return MODULE_COLOR_THEMES[moduleId] || MODULE_COLOR_THEMES.ordens;
}

export interface ServiceCategoryColorTheme {
  badgeClass: string;
  barClass: string;
  dotClass: string;
  pillIdleClass: string;
  pillActiveClass: string;
  cardHoverBorderClass: string;
  iconClass: string;
}

const SERVICE_COLOR_PALETTE: ServiceCategoryColorTheme[] = [
  {
    badgeClass: 'bg-sky-100 text-sky-800 border border-sky-200/80',
    barClass: 'bg-sky-600',
    dotClass: 'bg-sky-600',
    pillIdleClass: 'bg-sky-50 text-sky-800 border border-sky-200/80 hover:bg-sky-100',
    pillActiveClass: 'bg-sky-600 text-white border border-sky-600 font-bold shadow-xs',
    cardHoverBorderClass: 'hover:border-sky-400/70',
    iconClass: 'text-sky-600',
  },
  {
    badgeClass: 'bg-blue-100 text-blue-800 border border-blue-200/80',
    barClass: 'bg-blue-600',
    dotClass: 'bg-blue-600',
    pillIdleClass: 'bg-blue-50 text-blue-800 border border-blue-200/80 hover:bg-blue-100',
    pillActiveClass: 'bg-blue-600 text-white border border-blue-600 font-bold shadow-xs',
    cardHoverBorderClass: 'hover:border-blue-400/70',
    iconClass: 'text-blue-600',
  },
  {
    badgeClass: 'bg-teal-100 text-teal-800 border border-teal-200/80',
    barClass: 'bg-teal-600',
    dotClass: 'bg-teal-600',
    pillIdleClass: 'bg-teal-50 text-teal-800 border border-teal-200/80 hover:bg-teal-100',
    pillActiveClass: 'bg-teal-600 text-white border border-teal-600 font-bold shadow-xs',
    cardHoverBorderClass: 'hover:border-teal-400/70',
    iconClass: 'text-teal-600',
  },
  {
    badgeClass: 'bg-amber-100 text-amber-800 border border-amber-200/80',
    barClass: 'bg-amber-600',
    dotClass: 'bg-amber-600',
    pillIdleClass: 'bg-amber-50 text-amber-800 border border-amber-200/80 hover:bg-amber-100',
    pillActiveClass: 'bg-amber-600 text-white border border-amber-600 font-bold shadow-xs',
    cardHoverBorderClass: 'hover:border-amber-400/70',
    iconClass: 'text-amber-600',
  },
  {
    badgeClass: 'bg-purple-100 text-purple-800 border border-purple-200/80',
    barClass: 'bg-purple-600',
    dotClass: 'bg-purple-600',
    pillIdleClass: 'bg-purple-50 text-purple-800 border border-purple-200/80 hover:bg-purple-100',
    pillActiveClass: 'bg-purple-600 text-white border border-purple-600 font-bold shadow-xs',
    cardHoverBorderClass: 'hover:border-purple-400/70',
    iconClass: 'text-purple-600',
  },
  {
    badgeClass: 'bg-emerald-100 text-emerald-800 border border-emerald-200/80',
    barClass: 'bg-emerald-600',
    dotClass: 'bg-emerald-600',
    pillIdleClass: 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 hover:bg-emerald-100',
    pillActiveClass: 'bg-emerald-600 text-white border border-emerald-600 font-bold shadow-xs',
    cardHoverBorderClass: 'hover:border-emerald-400/70',
    iconClass: 'text-emerald-600',
  },
  {
    badgeClass: 'bg-orange-100 text-orange-800 border border-orange-200/80',
    barClass: 'bg-orange-600',
    dotClass: 'bg-orange-600',
    pillIdleClass: 'bg-orange-50 text-orange-800 border border-orange-200/80 hover:bg-orange-100',
    pillActiveClass: 'bg-orange-600 text-white border border-orange-600 font-bold shadow-xs',
    cardHoverBorderClass: 'hover:border-orange-400/70',
    iconClass: 'text-orange-600',
  },
  {
    badgeClass: 'bg-indigo-100 text-indigo-800 border border-indigo-200/80',
    barClass: 'bg-indigo-600',
    dotClass: 'bg-indigo-600',
    pillIdleClass: 'bg-indigo-50 text-indigo-800 border border-indigo-200/80 hover:bg-indigo-100',
    pillActiveClass: 'bg-indigo-600 text-white border border-indigo-600 font-bold shadow-xs',
    cardHoverBorderClass: 'hover:border-indigo-400/70',
    iconClass: 'text-indigo-600',
  },
  {
    badgeClass: 'bg-rose-100 text-rose-800 border border-rose-200/80',
    barClass: 'bg-rose-600',
    dotClass: 'bg-rose-600',
    pillIdleClass: 'bg-rose-50 text-rose-800 border border-rose-200/80 hover:bg-rose-100',
    pillActiveClass: 'bg-rose-600 text-white border border-rose-600 font-bold shadow-xs',
    cardHoverBorderClass: 'hover:border-rose-400/70',
    iconClass: 'text-rose-600',
  },
  {
    badgeClass: 'bg-cyan-100 text-cyan-800 border border-cyan-200/80',
    barClass: 'bg-cyan-600',
    dotClass: 'bg-cyan-600',
    pillIdleClass: 'bg-cyan-50 text-cyan-800 border border-cyan-200/80 hover:bg-cyan-100',
    pillActiveClass: 'bg-cyan-600 text-white border border-cyan-600 font-bold shadow-xs',
    cardHoverBorderClass: 'hover:border-cyan-400/70',
    iconClass: 'text-cyan-600',
  },
  {
    badgeClass: 'bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200/80',
    barClass: 'bg-fuchsia-600',
    dotClass: 'bg-fuchsia-600',
    pillIdleClass: 'bg-fuchsia-50 text-fuchsia-800 border border-fuchsia-200/80 hover:bg-fuchsia-100',
    pillActiveClass: 'bg-fuchsia-600 text-white border border-fuchsia-600 font-bold shadow-xs',
    cardHoverBorderClass: 'hover:border-fuchsia-400/70',
    iconClass: 'text-fuchsia-600',
  },
  {
    badgeClass: 'bg-slate-200/80 text-slate-800 border border-slate-300/80',
    barClass: 'bg-slate-600',
    dotClass: 'bg-slate-600',
    pillIdleClass: 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200/70',
    pillActiveClass: 'bg-slate-800 text-white border border-slate-800 font-bold shadow-xs',
    cardHoverBorderClass: 'hover:border-slate-400',
    iconClass: 'text-slate-600',
  },
];

export function getServiceCategoryTheme(categoryName: string): ServiceCategoryColorTheme {
  const norm = categoryName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (norm.includes('simples')) return SERVICE_COLOR_PALETTE[0]; // sky
  if (norm.includes('detalhada') || norm === 'lavagem') return SERVICE_COLOR_PALETTE[1]; // blue
  if (norm.includes('higieniz')) return SERVICE_COLOR_PALETTE[2]; // teal
  if (norm.includes('polimento')) return SERVICE_COLOR_PALETTE[3]; // amber
  if (norm.includes('ceram') || norm.includes('vitrific')) return SERVICE_COLOR_PALETTE[4]; // purple
  if (norm.includes('protec')) return SERVICE_COLOR_PALETTE[5]; // emerald
  if (norm.includes('desengrax')) return SERVICE_COLOR_PALETTE[6]; // orange
  if (norm.includes('acabamento')) return SERVICE_COLOR_PALETTE[7]; // indigo
  if (norm.includes('acessor')) return SERVICE_COLOR_PALETTE[8]; // rose
  if (norm.includes('combo') || norm.includes('pacote')) return SERVICE_COLOR_PALETTE[9]; // cyan
  if (norm.includes('pintura') || norm.includes('restaur')) return SERVICE_COLOR_PALETTE[10]; // fuchsia
  if (norm.includes('outro')) return SERVICE_COLOR_PALETTE[11]; // slate

  let hash = 0;
  for (let i = 0; i < norm.length; i++) {
    hash = (hash * 31 + norm.charCodeAt(i)) >>> 0;
  }
  return SERVICE_COLOR_PALETTE[hash % SERVICE_COLOR_PALETTE.length];
}
