import { MotoCatalogBrand, MotoCatalogModel, MotoCatalogState, MotoCatalogVersion, MotoCategory } from '../types';

export function normalizeMotoText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function buildYearRange(from: number, to: number): number[] {
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  const years: number[] = [];
  for (let y = end; y >= start; y--) {
    years.push(y);
  }
  return years;
}

export const MOTO_CATEGORIES: MotoCategory[] = [
  'Street',
  'Cub / Scooter',
  'Trail',
  'Big Trail',
  'Naked',
  'Esportiva',
  'Custom / Cruiser',
  'Touring',
  'Off-Road',
  'Elétrica',
  'Outro',
];

interface SeedVersionInput {
  name: string;
  from: number;
  to: number;
  cc?: number;
}

interface SeedModelInput {
  brandName: string;
  name: string;
  popularNames?: string[];
  cc: number;
  category: MotoCategory;
  from: number;
  to: number;
  versions: SeedVersionInput[];
}

const RAW_BRANDS: Omit<MotoCatalogBrand, 'id' | 'normalizedName' | 'active' | 'isCustom' | 'source'>[] = [
  { name: 'Aprilia', country: 'Itália', popular: false, brandColor: '#DC2626', monogram: 'AP' },
  { name: 'Bajaj', country: 'Índia', popular: true, brandColor: '#0284C7', monogram: 'BJ' },
  { name: 'Benelli', country: 'Itália', popular: false, brandColor: '#15803D', monogram: 'BN' },
  { name: 'BMW', country: 'Alemanha', popular: true, brandColor: '#1D4ED8', monogram: 'BMW' },
  { name: 'Bull Motors', country: 'Brasil', popular: false, brandColor: '#B45309', monogram: 'BM' },
  { name: 'CFMOTO', country: 'China', popular: false, brandColor: '#0F172A', monogram: 'CF' },
  { name: 'Dafra', country: 'Brasil', popular: true, brandColor: '#EA580C', monogram: 'DF' },
  { name: 'Ducati', country: 'Itália', popular: true, brandColor: '#B91C1C', monogram: 'DC' },
  { name: 'GasGas', country: 'Espanha', popular: false, brandColor: '#E11D48', monogram: 'GG' },
  { name: 'Haojue', country: 'China', popular: true, brandColor: '#1E293B', monogram: 'HJ' },
  { name: 'Harley-Davidson', country: 'EUA', popular: true, brandColor: '#EA580C', monogram: 'HD' },
  { name: 'Honda', country: 'Japão', popular: true, brandColor: '#DC2626', monogram: 'HD' },
  { name: 'Husqvarna', country: 'Suécia', popular: false, brandColor: '#1E3A8A', monogram: 'HQ' },
  { name: 'Indian', country: 'EUA', popular: false, brandColor: '#7F1D1D', monogram: 'IN' },
  { name: 'Kawasaki', country: 'Japão', popular: true, brandColor: '#16A34A', monogram: 'KW' },
  { name: 'KTM', country: 'Áustria', popular: true, brandColor: '#F97316', monogram: 'KTM' },
  { name: 'Kymco', country: 'Taiwan', popular: false, brandColor: '#0369A1', monogram: 'KY' },
  { name: 'Lifan', country: 'China', popular: false, brandColor: '#334155', monogram: 'LF' },
  { name: 'Loncin', country: 'China', popular: false, brandColor: '#475569', monogram: 'LC' },
  { name: 'Moto Guzzi', country: 'Itália', popular: false, brandColor: '#991B1B', monogram: 'MG' },
  { name: 'MV Agusta', country: 'Itália', popular: false, brandColor: '#9F1239', monogram: 'MV' },
  { name: 'Piaggio', country: 'Itália', popular: false, brandColor: '#0284C7', monogram: 'PG' },
  { name: 'Royal Enfield', country: 'Índia / Reino Unido', popular: true, brandColor: '#92400E', monogram: 'RE' },
  { name: 'Shineray', country: 'China / Brasil', popular: true, brandColor: '#B91C1C', monogram: 'SH' },
  { name: 'Suzuki', country: 'Japão', popular: true, brandColor: '#2563EB', monogram: 'SZ' },
  { name: 'Triumph', country: 'Reino Unido', popular: true, brandColor: '#111827', monogram: 'TR' },
  { name: 'Vespa', country: 'Itália', popular: false, brandColor: '#0D9488', monogram: 'VS' },
  { name: 'Yamaha', country: 'Japão', popular: true, brandColor: '#1D4ED8', monogram: 'YM' },
  { name: 'Zontes', country: 'China', popular: false, brandColor: '#312E81', monogram: 'ZT' },
];

export const SEED_MOTO_BRANDS: MotoCatalogBrand[] = [...RAW_BRANDS]
  .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  .map(b => ({
    ...b,
    id: `brand_${normalizeMotoText(b.name).replace(/\s+/g, '_')}`,
    normalizedName: normalizeMotoText(b.name),
    active: true,
    isCustom: false,
    source: 'seed' as const,
  }));

const BRAND_ID_BY_NORM = new Map<string, MotoCatalogBrand>(
  SEED_MOTO_BRANDS.map(b => [b.normalizedName, b])
);

const RAW_MODELS: SeedModelInput[] = [
  // HONDA (antigas e atuais, nacionais e importadas)
  {
    brandName: 'Honda', name: 'CG 125', popularNames: ['Today', 'ML', 'Turuna', 'CG 125 Fan', 'CG 125 Titan'],
    cc: 125, category: 'Street', from: 1976, to: 2018,
    versions: [
      { name: 'Standard / Today / ML', from: 1976, to: 1999 },
      { name: 'Titan KS / ES / KSE', from: 1995, to: 2004 },
      { name: 'Fan KS / ES / ESD', from: 2005, to: 2015 },
      { name: 'i Fan / Cargo ES', from: 2016, to: 2018 },
    ],
  },
  {
    brandName: 'Honda', name: 'CG 150', popularNames: ['Titan 150', 'Fan 150', 'Job 150', 'Start 150'],
    cc: 150, category: 'Street', from: 2004, to: 2015,
    versions: [
      { name: 'Titan KS / ES / ESD / EX', from: 2004, to: 2015 },
      { name: 'Sport', from: 2005, to: 2008 },
      { name: 'Fan ESi / ESDi', from: 2010, to: 2015 },
      { name: 'Start / Cargo Flex', from: 2014, to: 2015 },
    ],
  },
  {
    brandName: 'Honda', name: 'CG 160', popularNames: ['Titan 160', 'Fan 160', 'Start 160', 'Cargo 160'],
    cc: 162, category: 'Street', from: 2016, to: 2026,
    versions: [
      { name: 'Start (CBS)', from: 2016, to: 2026 },
      { name: 'Fan ESDi / CBS', from: 2016, to: 2026 },
      { name: 'Titan EX / S / ABS', from: 2016, to: 2026 },
      { name: 'Cargo', from: 2016, to: 2026 },
    ],
  },
  {
    brandName: 'Honda', name: 'Biz 100', popularNames: ['C 100 Biz'],
    cc: 97, category: 'Cub / Scooter', from: 1998, to: 2015,
    versions: [
      { name: 'KS / ES / +', from: 1998, to: 2015 },
    ],
  },
  {
    brandName: 'Honda', name: 'Biz 110i', popularNames: ['Biz 110'],
    cc: 109, category: 'Cub / Scooter', from: 2016, to: 2025,
    versions: [
      { name: 'Flex / CBS', from: 2016, to: 2025 },
    ],
  },
  {
    brandName: 'Honda', name: 'Biz 125', popularNames: ['Biz 125 EX', 'Biz 125 ES'],
    cc: 125, category: 'Cub / Scooter', from: 2006, to: 2026,
    versions: [
      { name: 'KS / ES / +', from: 2006, to: 2015 },
      { name: 'EX Flex', from: 2011, to: 2024 },
      { name: 'ES / EX (Nova Geração)', from: 2025, to: 2026 },
    ],
  },
  {
    brandName: 'Honda', name: 'Pop 100', popularNames: ['Pop'],
    cc: 97, category: 'Cub / Scooter', from: 2007, to: 2015,
    versions: [{ name: 'Standard', from: 2007, to: 2015 }],
  },
  {
    brandName: 'Honda', name: 'Pop 110i', popularNames: ['Pop 110', 'Pop ES'],
    cc: 109, category: 'Cub / Scooter', from: 2016, to: 2026,
    versions: [
      { name: 'Standard CBS', from: 2016, to: 2024 },
      { name: 'ES Partida Elétrica', from: 2025, to: 2026 },
    ],
  },
  {
    brandName: 'Honda', name: 'NXR 150 Bros', popularNames: ['Bros 150'],
    cc: 150, category: 'Trail', from: 2003, to: 2014,
    versions: [
      { name: 'KS / ES / ESD', from: 2003, to: 2014 },
      { name: 'Mix / Flex', from: 2009, to: 2014 },
    ],
  },
  {
    brandName: 'Honda', name: 'NXR 160 Bros', popularNames: ['Bros 160'],
    cc: 162, category: 'Trail', from: 2015, to: 2026,
    versions: [
      { name: 'EDD / ESDD CBS', from: 2015, to: 2026 },
      { name: 'ABS / Special Edition', from: 2025, to: 2026 },
    ],
  },
  {
    brandName: 'Honda', name: 'XRE 190', popularNames: ['XRE 190 ABS'],
    cc: 184, category: 'Trail', from: 2016, to: 2026,
    versions: [
      { name: 'ABS / Adventure', from: 2016, to: 2026 },
    ],
  },
  {
    brandName: 'Honda', name: 'XRE 300', popularNames: ['XRE 300 Rally', 'XRE 300 Adventure'],
    cc: 291, category: 'Trail', from: 2010, to: 2023,
    versions: [
      { name: 'Standard / C-ABS', from: 2010, to: 2018 },
      { name: 'ABS / Rally / Adventure', from: 2019, to: 2023 },
    ],
  },
  {
    brandName: 'Honda', name: 'XRE 300 Sahara', popularNames: ['Sahara 300', 'Nova Sahara'],
    cc: 293, category: 'Trail', from: 2024, to: 2026,
    versions: [
      { name: 'Standard ABS', from: 2024, to: 2026 },
      { name: 'Rally ABS', from: 2024, to: 2026 },
      { name: 'Adventure ABS', from: 2024, to: 2026 },
    ],
  },
  {
    brandName: 'Honda', name: 'CB 300F Twister', popularNames: ['CB 300F', 'Twister 300'],
    cc: 293, category: 'Naked', from: 2023, to: 2026,
    versions: [
      { name: 'CBS', from: 2023, to: 2026 },
      { name: 'ABS', from: 2023, to: 2026 },
    ],
  },
  {
    brandName: 'Honda', name: 'CB 250F Twister', popularNames: ['CB Twister', 'Twister 250'],
    cc: 249, category: 'Naked', from: 2016, to: 2022,
    versions: [
      { name: 'CBS / STD', from: 2016, to: 2022 },
      { name: 'ABS / Special Edition', from: 2016, to: 2022 },
    ],
  },
  {
    brandName: 'Honda', name: 'CB 300R', popularNames: ['CB 300'],
    cc: 291, category: 'Naked', from: 2009, to: 2015,
    versions: [{ name: 'Standard / C-ABS / Limited', from: 2009, to: 2015 }],
  },
  {
    brandName: 'Honda', name: 'CB 500F', popularNames: ['500F'],
    cc: 471, category: 'Naked', from: 2014, to: 2026,
    versions: [{ name: 'STD / ABS', from: 2014, to: 2026 }],
  },
  {
    brandName: 'Honda', name: 'CB 500X', popularNames: ['500X', 'NX 500'],
    cc: 471, category: 'Big Trail', from: 2014, to: 2026,
    versions: [{ name: 'ABS / Touring', from: 2014, to: 2026 }],
  },
  {
    brandName: 'Honda', name: 'CB 650R Neo Sports', popularNames: ['CB 650R', 'CB650R'],
    cc: 649, category: 'Naked', from: 2020, to: 2026,
    versions: [
      { name: 'ABS', from: 2020, to: 2024 },
      { name: 'E-Clutch', from: 2025, to: 2026 },
    ],
  },
  {
    brandName: 'Honda', name: 'CBR 650R', popularNames: ['CBR650R'],
    cc: 649, category: 'Esportiva', from: 2020, to: 2026,
    versions: [{ name: 'ABS / E-Clutch', from: 2020, to: 2026 }],
  },
  {
    brandName: 'Honda', name: 'NC 750X', popularNames: ['NC750X', 'NC 750'],
    cc: 745, category: 'Big Trail', from: 2015, to: 2026,
    versions: [
      { name: 'MT (Manual)', from: 2015, to: 2026 },
      { name: 'DCT (Automática)', from: 2022, to: 2026 },
    ],
  },
  {
    brandName: 'Honda', name: 'CRF 1100L Africa Twin', popularNames: ['Africa Twin', 'Africa Twin 1000', 'CRF 1000L'],
    cc: 1084, category: 'Big Trail', from: 2016, to: 2026,
    versions: [
      { name: 'Standard MT / DCT', from: 2016, to: 2026 },
      { name: 'Adventure Sports ES / DCT', from: 2019, to: 2026 },
    ],
  },
  {
    brandName: 'Honda', name: 'CB 600F Hornet', popularNames: ['Hornet', 'Hornet 600', 'CB 750 Hornet'],
    cc: 599, category: 'Naked', from: 2004, to: 2026,
    versions: [
      { name: 'Carburada', from: 2004, to: 2007 },
      { name: 'Injetada STD / ABS', from: 2008, to: 2014 },
      { name: 'CB 750 / CB 500 Hornet', from: 2024, to: 2026 },
    ],
  },
  {
    brandName: 'Honda', name: 'PCX 160', popularNames: ['PCX 150', 'PCX'],
    cc: 156, category: 'Cub / Scooter', from: 2014, to: 2026,
    versions: [
      { name: 'CBS / DLX / Sport', from: 2014, to: 2022, cc: 149 },
      { name: '160 CBS / ABS / DLX', from: 2023, to: 2026, cc: 156 },
    ],
  },
  {
    brandName: 'Honda', name: 'ADV 150 / 160', popularNames: ['Honda ADV'],
    cc: 149, category: 'Cub / Scooter', from: 2021, to: 2026,
    versions: [{ name: 'ABS', from: 2021, to: 2026 }],
  },
  {
    brandName: 'Honda', name: 'CBR 1000RR-R Fireblade', popularNames: ['Fireblade', 'CBR 1000'],
    cc: 999, category: 'Esportiva', from: 2004, to: 2026,
    versions: [
      { name: 'Fireblade STD', from: 2004, to: 2026 },
      { name: 'SP', from: 2017, to: 2026 },
    ],
  },
  {
    brandName: 'Honda', name: 'XL 750 Transalp', popularNames: ['Transalp', 'XL 700V Transalp'],
    cc: 755, category: 'Big Trail', from: 2011, to: 2026,
    versions: [
      { name: 'XL 700V ABS', from: 2011, to: 2014, cc: 680 },
      { name: 'XL 750', from: 2024, to: 2026, cc: 755 },
    ],
  },

  // YAMAHA
  {
    brandName: 'Yamaha', name: 'Factor 125', popularNames: ['YBR 125 Factor', 'Factor 125i'],
    cc: 125, category: 'Street', from: 2009, to: 2025,
    versions: [
      { name: 'K / E / ED', from: 2009, to: 2016 },
      { name: '125i UBS', from: 2017, to: 2025 },
    ],
  },
  {
    brandName: 'Yamaha', name: 'Factor 150', popularNames: ['YBR 150 Factor', 'Factor 150 DX'],
    cc: 149, category: 'Street', from: 2016, to: 2026,
    versions: [
      { name: 'E / ED UBS', from: 2016, to: 2026 },
      { name: 'DX', from: 2025, to: 2026 },
    ],
  },
  {
    brandName: 'Yamaha', name: 'Fazer 150', popularNames: ['YS 150 Fazer', 'Fazer 150 UBS'],
    cc: 149, category: 'Street', from: 2014, to: 2026,
    versions: [{ name: 'SED / ED / UBS', from: 2014, to: 2026 }],
  },
  {
    brandName: 'Yamaha', name: 'Fazer 250', popularNames: ['YS 250 Fazer', 'FZ25'],
    cc: 249, category: 'Naked', from: 2006, to: 2026,
    versions: [
      { name: 'YS 250 / BlueFlex', from: 2006, to: 2017 },
      { name: 'FZ25 ABS / Connected', from: 2018, to: 2026 },
    ],
  },
  {
    brandName: 'Yamaha', name: 'FZ15', popularNames: ['Fazer FZ15', 'FZ 15'],
    cc: 149, category: 'Street', from: 2023, to: 2026,
    versions: [{ name: 'ABS / Connected', from: 2023, to: 2026 }],
  },
  {
    brandName: 'Yamaha', name: 'FZ25', popularNames: ['Fazer 250 FZ25'],
    cc: 249, category: 'Naked', from: 2018, to: 2026,
    versions: [{ name: 'ABS / Thor / Connected', from: 2018, to: 2026 }],
  },
  {
    brandName: 'Yamaha', name: 'Crosser 150', popularNames: ['XTZ 150 Crosser', 'Crosser S', 'Crosser Z'],
    cc: 149, category: 'Trail', from: 2014, to: 2026,
    versions: [
      { name: 'E / ED', from: 2014, to: 2018 },
      { name: 'S ABS / Z ABS', from: 2019, to: 2026 },
    ],
  },
  {
    brandName: 'Yamaha', name: 'Lander 250', popularNames: ['XTZ 250 Lander'],
    cc: 249, category: 'Trail', from: 2007, to: 2026,
    versions: [
      { name: 'XTZ 250', from: 2007, to: 2018 },
      { name: 'ABS / Connected', from: 2019, to: 2026 },
    ],
  },
  {
    brandName: 'Yamaha', name: 'XTZ 125', popularNames: ['XTZ 125E', 'XTZ 125K'],
    cc: 124, category: 'Trail', from: 2003, to: 2016,
    versions: [{ name: 'K / E / X', from: 2003, to: 2016 }],
  },
  {
    brandName: 'Yamaha', name: 'XTZ 250 Ténéré', popularNames: ['Ténéré 250', 'Tenere 250'],
    cc: 249, category: 'Trail', from: 2011, to: 2019,
    versions: [{ name: 'Standard / BlueFlex', from: 2011, to: 2019 }],
  },
  {
    brandName: 'Yamaha', name: 'MT-03', popularNames: ['MT03', 'MT 03'],
    cc: 321, category: 'Naked', from: 2017, to: 2026,
    versions: [{ name: 'ABS / Connected', from: 2017, to: 2026 }],
  },
  {
    brandName: 'Yamaha', name: 'MT-07', popularNames: ['MT07', 'MT 07'],
    cc: 689, category: 'Naked', from: 2015, to: 2026,
    versions: [{ name: 'ABS / Connected', from: 2015, to: 2026 }],
  },
  {
    brandName: 'Yamaha', name: 'MT-09', popularNames: ['MT09', 'MT 09', 'Tracer 900'],
    cc: 890, category: 'Naked', from: 2015, to: 2026,
    versions: [
      { name: 'ABS', from: 2015, to: 2026 },
      { name: 'SP', from: 2022, to: 2026 },
    ],
  },
  {
    brandName: 'Yamaha', name: 'YZF-R3', popularNames: ['R3', 'Yamaha R3'],
    cc: 321, category: 'Esportiva', from: 2016, to: 2026,
    versions: [{ name: 'ABS / Monster / Connected', from: 2016, to: 2026 }],
  },
  {
    brandName: 'Yamaha', name: 'YZF-R15', popularNames: ['R15', 'Yamaha R15'],
    cc: 155, category: 'Esportiva', from: 2024, to: 2026,
    versions: [{ name: 'ABS', from: 2024, to: 2026 }],
  },
  {
    brandName: 'Yamaha', name: 'YZF-R1', popularNames: ['R1', 'Yamaha R1'],
    cc: 998, category: 'Esportiva', from: 1998, to: 2026,
    versions: [
      { name: 'Standard', from: 1998, to: 2026 },
      { name: 'R1M', from: 2015, to: 2026 },
    ],
  },
  {
    brandName: 'Yamaha', name: 'Ténéré 700', popularNames: ['T7', 'Tenere 700'],
    cc: 689, category: 'Big Trail', from: 2020, to: 2026,
    versions: [{ name: 'Standard / World Raid', from: 2020, to: 2026 }],
  },
  {
    brandName: 'Yamaha', name: 'NMAX 160', popularNames: ['NMAX', 'N-Max'],
    cc: 155, category: 'Cub / Scooter', from: 2017, to: 2026,
    versions: [{ name: 'ABS / Connected', from: 2017, to: 2026 }],
  },
  {
    brandName: 'Yamaha', name: 'XMAX 250', popularNames: ['XMAX', 'X-Max'],
    cc: 249, category: 'Cub / Scooter', from: 2020, to: 2026,
    versions: [{ name: 'ABS / Connected', from: 2020, to: 2026 }],
  },

  // SUZUKI
  {
    brandName: 'Suzuki', name: 'Burgman 125', popularNames: ['Burgman 125i', 'AN 125'],
    cc: 125, category: 'Cub / Scooter', from: 2005, to: 2019,
    versions: [
      { name: 'Carburada', from: 2005, to: 2010 },
      { name: '125i Injetada', from: 2011, to: 2019 },
    ],
  },
  {
    brandName: 'Suzuki', name: 'Intruder 125', popularNames: ['GN 125', 'Intruder'],
    cc: 125, category: 'Custom / Cruiser', from: 2002, to: 2016,
    versions: [{ name: 'ED / Cargo', from: 2002, to: 2016 }],
  },
  {
    brandName: 'Suzuki', name: 'Yes 125', popularNames: ['EN 125 Yes'],
    cc: 125, category: 'Street', from: 2005, to: 2016,
    versions: [{ name: 'SE / ED', from: 2005, to: 2016 }],
  },
  {
    brandName: 'Suzuki', name: 'GSR 150i', popularNames: ['GSR 150'],
    cc: 149, category: 'Street', from: 2011, to: 2017,
    versions: [{ name: 'Injetada', from: 2011, to: 2017 }],
  },
  {
    brandName: 'Suzuki', name: 'GSX-S 750', popularNames: ['GSX-S750'],
    cc: 749, category: 'Naked', from: 2018, to: 2026,
    versions: [{ name: 'ABS / ZA', from: 2018, to: 2026 }],
  },
  {
    brandName: 'Suzuki', name: 'GSX-R 1000', popularNames: ['SRAD 1000', 'GSXR 1000'],
    cc: 999, category: 'Esportiva', from: 2001, to: 2026,
    versions: [
      { name: 'SRAD', from: 2001, to: 2016 },
      { name: 'GSX-R 1000R ABS', from: 2017, to: 2026 },
    ],
  },
  {
    brandName: 'Suzuki', name: 'V-Strom 650', popularNames: ['DL 650', 'V-Strom 650 XT'],
    cc: 645, category: 'Big Trail', from: 2009, to: 2026,
    versions: [
      { name: 'Standard ABS', from: 2009, to: 2026 },
      { name: 'XT Adventure', from: 2016, to: 2026 },
    ],
  },
  {
    brandName: 'Suzuki', name: 'V-Strom 1050', popularNames: ['V-Strom 1000', 'DL 1050'],
    cc: 1037, category: 'Big Trail', from: 2015, to: 2026,
    versions: [
      { name: 'V-Strom 1000 ABS', from: 2015, to: 2020, cc: 1037 },
      { name: '1050 XT / DE', from: 2021, to: 2026, cc: 1037 },
    ],
  },
  {
    brandName: 'Suzuki', name: 'GSX-1300R Hayabusa', popularNames: ['Hayabusa'],
    cc: 1340, category: 'Esportiva', from: 1999, to: 2026,
    versions: [{ name: 'ABS', from: 1999, to: 2026 }],
  },

  // KAWASAKI
  {
    brandName: 'Kawasaki', name: 'Ninja 300', popularNames: ['EX 300'],
    cc: 296, category: 'Esportiva', from: 2013, to: 2018,
    versions: [{ name: 'STD / ABS / KRT', from: 2013, to: 2018 }],
  },
  {
    brandName: 'Kawasaki', name: 'Ninja 400', popularNames: ['EX 400'],
    cc: 399, category: 'Esportiva', from: 2019, to: 2024,
    versions: [{ name: 'ABS / KRT', from: 2019, to: 2024 }],
  },
  {
    brandName: 'Kawasaki', name: 'Ninja 500', popularNames: ['EX 500'],
    cc: 451, category: 'Esportiva', from: 2024, to: 2026,
    versions: [{ name: 'Standard / SE KRT', from: 2024, to: 2026 }],
  },
  {
    brandName: 'Kawasaki', name: 'Ninja 650', popularNames: ['ER-6f', 'Ninja 650R'],
    cc: 649, category: 'Esportiva', from: 2012, to: 2026,
    versions: [{ name: 'ABS / KRT', from: 2012, to: 2026 }],
  },
  {
    brandName: 'Kawasaki', name: 'Ninja ZX-6R', popularNames: ['ZX6R', '636'],
    cc: 636, category: 'Esportiva', from: 2009, to: 2026,
    versions: [{ name: 'ABS / KRT', from: 2009, to: 2026 }],
  },
  {
    brandName: 'Kawasaki', name: 'Ninja ZX-10R', popularNames: ['ZX10R'],
    cc: 998, category: 'Esportiva', from: 2008, to: 2026,
    versions: [
      { name: 'ABS / KRT', from: 2008, to: 2026 },
      { name: 'ZX-10RR', from: 2017, to: 2026 },
    ],
  },
  {
    brandName: 'Kawasaki', name: 'Z300', popularNames: ['Kawasaki Z300'],
    cc: 296, category: 'Naked', from: 2016, to: 2019,
    versions: [{ name: 'STD / ABS', from: 2016, to: 2019 }],
  },
  {
    brandName: 'Kawasaki', name: 'Z400', popularNames: ['Kawasaki Z400'],
    cc: 399, category: 'Naked', from: 2020, to: 2024,
    versions: [{ name: 'ABS', from: 2020, to: 2024 }],
  },
  {
    brandName: 'Kawasaki', name: 'Z650', popularNames: ['ER-6n'],
    cc: 649, category: 'Naked', from: 2018, to: 2026,
    versions: [{ name: 'ABS / RS', from: 2018, to: 2026 }],
  },
  {
    brandName: 'Kawasaki', name: 'Z900', popularNames: ['Z900 RS', 'Z900 SE'],
    cc: 948, category: 'Naked', from: 2018, to: 2026,
    versions: [
      { name: 'ABS / Edition', from: 2018, to: 2026 },
      { name: 'SE / R Edition', from: 2022, to: 2026 },
      { name: 'RS (Retrô)', from: 2019, to: 2026 },
    ],
  },
  {
    brandName: 'Kawasaki', name: 'Versys-X 300', popularNames: ['Versys 300'],
    cc: 296, category: 'Big Trail', from: 2018, to: 2026,
    versions: [{ name: 'ABS / Tourer', from: 2018, to: 2026 }],
  },
  {
    brandName: 'Kawasaki', name: 'Versys 650', popularNames: ['Versys 650 Tourer'],
    cc: 649, category: 'Big Trail', from: 2011, to: 2026,
    versions: [{ name: 'ABS / Tourer / TR', from: 2011, to: 2026 }],
  },
  {
    brandName: 'Kawasaki', name: 'Vulcan S 650', popularNames: ['Vulcan S'],
    cc: 649, category: 'Custom / Cruiser', from: 2016, to: 2026,
    versions: [{ name: 'ABS / Café', from: 2016, to: 2026 }],
  },

  // BMW
  {
    brandName: 'BMW', name: 'G 310 R', popularNames: ['G310R'],
    cc: 313, category: 'Naked', from: 2017, to: 2026,
    versions: [{ name: 'ABS / Sport', from: 2017, to: 2026 }],
  },
  {
    brandName: 'BMW', name: 'G 310 GS', popularNames: ['G310GS'],
    cc: 313, category: 'Trail', from: 2018, to: 2026,
    versions: [{ name: 'ABS / Rallye / Triple Black', from: 2018, to: 2026 }],
  },
  {
    brandName: 'BMW', name: 'F 750 GS', popularNames: ['F750GS'],
    cc: 853, category: 'Big Trail', from: 2019, to: 2023,
    versions: [{ name: 'Sport / Premium', from: 2019, to: 2023 }],
  },
  {
    brandName: 'BMW', name: 'F 850 GS', popularNames: ['F850GS', 'F 800 GS'],
    cc: 853, category: 'Big Trail', from: 2019, to: 2024,
    versions: [
      { name: 'Premium / Sport / Triple Black', from: 2019, to: 2024 },
      { name: 'Adventure', from: 2019, to: 2024 },
    ],
  },
  {
    brandName: 'BMW', name: 'F 900 GS', popularNames: ['F900GS', 'F 900 R'],
    cc: 895, category: 'Big Trail', from: 2024, to: 2026,
    versions: [
      { name: 'GS Trophy / São Paulo', from: 2024, to: 2026 },
      { name: 'GS Adventure', from: 2024, to: 2026 },
    ],
  },
  {
    brandName: 'BMW', name: 'S 1000 RR', popularNames: ['S1000RR'],
    cc: 999, category: 'Esportiva', from: 2010, to: 2026,
    versions: [
      { name: 'Standard', from: 2010, to: 2026 },
      { name: 'M Motorsport / M Carbon', from: 2020, to: 2026 },
    ],
  },
  {
    brandName: 'BMW', name: 'S 1000 R', popularNames: ['S1000R'],
    cc: 999, category: 'Naked', from: 2014, to: 2026,
    versions: [{ name: 'Premium / M Package', from: 2014, to: 2026 }],
  },
  {
    brandName: 'BMW', name: 'R 1250 GS', popularNames: ['GS 1250', 'R 1250 GS Adventure', 'R 1200 GS'],
    cc: 1254, category: 'Big Trail', from: 2019, to: 2024,
    versions: [
      { name: 'Premium / Triple Black / Rallye', from: 2019, to: 2024 },
      { name: 'Adventure', from: 2019, to: 2024 },
    ],
  },
  {
    brandName: 'BMW', name: 'R 1300 GS', popularNames: ['GS 1300', 'R1300GS'],
    cc: 1300, category: 'Big Trail', from: 2024, to: 2026,
    versions: [
      { name: 'Standard / Plus', from: 2024, to: 2026 },
      { name: 'Trophy / Triple Black / Option 719', from: 2024, to: 2026 },
      { name: 'Adventure', from: 2025, to: 2026 },
    ],
  },

  // ROYAL ENFIELD
  {
    brandName: 'Royal Enfield', name: 'Hunter 350', popularNames: ['Hunter'],
    cc: 349, category: 'Street', from: 2023, to: 2026,
    versions: [
      { name: 'Dapper', from: 2023, to: 2026 },
      { name: 'Rebel', from: 2023, to: 2026 },
    ],
  },
  {
    brandName: 'Royal Enfield', name: 'Classic 350', popularNames: ['Classic'],
    cc: 349, category: 'Custom / Cruiser', from: 2022, to: 2026,
    versions: [
      { name: 'Halcyon / Signals / Dark / Chrome', from: 2022, to: 2026 },
    ],
  },
  {
    brandName: 'Royal Enfield', name: 'Meteor 350', popularNames: ['Meteor'],
    cc: 349, category: 'Custom / Cruiser', from: 2021, to: 2026,
    versions: [
      { name: 'Fireball / Stellar / Supernova / Aurora', from: 2021, to: 2026 },
    ],
  },
  {
    brandName: 'Royal Enfield', name: 'Himalayan 411 / 450', popularNames: ['Himalayan'],
    cc: 411, category: 'Trail', from: 2019, to: 2026,
    versions: [
      { name: '411 ABS / BS6', from: 2019, to: 2024, cc: 411 },
      { name: '450 Sherpa', from: 2025, to: 2026, cc: 452 },
    ],
  },
  {
    brandName: 'Royal Enfield', name: 'Scram 411', popularNames: ['Scram'],
    cc: 411, category: 'Street', from: 2023, to: 2025,
    versions: [{ name: 'ABS', from: 2023, to: 2025 }],
  },
  {
    brandName: 'Royal Enfield', name: 'Super Meteor 650', popularNames: ['Super Meteor'],
    cc: 648, category: 'Custom / Cruiser', from: 2024, to: 2026,
    versions: [{ name: 'Astral / Interstellar / Celestial', from: 2024, to: 2026 }],
  },
  {
    brandName: 'Royal Enfield', name: 'Interceptor 650', popularNames: ['INT 650'],
    cc: 648, category: 'Custom / Cruiser', from: 2020, to: 2026,
    versions: [{ name: 'Twin ABS / Alloy', from: 2020, to: 2026 }],
  },
  {
    brandName: 'Royal Enfield', name: 'Continental GT 650', popularNames: ['GT 650'],
    cc: 648, category: 'Custom / Cruiser', from: 2020, to: 2026,
    versions: [{ name: 'Café Racer ABS', from: 2020, to: 2026 }],
  },

  // DUCATI
  {
    brandName: 'Ducati', name: 'Monster', popularNames: ['Monster 797', 'Monster 821', 'Monster 937', 'Monster SP'],
    cc: 937, category: 'Naked', from: 2015, to: 2026,
    versions: [
      { name: '797 / 821 / 1200', from: 2015, to: 2021 },
      { name: '937 Plus / SP', from: 2022, to: 2026 },
    ],
  },
  {
    brandName: 'Ducati', name: 'Scrambler', popularNames: ['Scrambler Icon', 'Scrambler Full Throttle'],
    cc: 803, category: 'Naked', from: 2015, to: 2026,
    versions: [
      { name: 'Icon / Nightshift / Full Throttle 800', from: 2015, to: 2026 },
      { name: '1100 Pro / Sport', from: 2019, to: 2024, cc: 1079 },
    ],
  },
  {
    brandName: 'Ducati', name: 'Multistrada', popularNames: ['Multistrada V4', 'Multistrada 950', 'Multistrada V2'],
    cc: 1158, category: 'Big Trail', from: 2015, to: 2026,
    versions: [
      { name: '950 / V2 S', from: 2017, to: 2026, cc: 937 },
      { name: '1200 / 1260 S', from: 2015, to: 2021, cc: 1262 },
      { name: 'V4 / V4S / Rally / Pikes Peak', from: 2021, to: 2026, cc: 1158 },
    ],
  },
  {
    brandName: 'Ducati', name: 'Panigale', popularNames: ['Panigale V4', 'Panigale V2'],
    cc: 1103, category: 'Esportiva', from: 2015, to: 2026,
    versions: [
      { name: 'V2 (955)', from: 2020, to: 2026, cc: 955 },
      { name: 'V4 / V4S / V4R', from: 2018, to: 2026, cc: 1103 },
    ],
  },
  {
    brandName: 'Ducati', name: 'Diavel', popularNames: ['Diavel V4', 'Diavel 1260', 'XDiavel'],
    cc: 1158, category: 'Custom / Cruiser', from: 2015, to: 2026,
    versions: [
      { name: '1260 / 1260 S', from: 2019, to: 2023, cc: 1262 },
      { name: 'V4', from: 2023, to: 2026, cc: 1158 },
    ],
  },
  {
    brandName: 'Ducati', name: 'Streetfighter', popularNames: ['Streetfighter V4', 'Streetfighter V2'],
    cc: 1103, category: 'Naked', from: 2020, to: 2026,
    versions: [
      { name: 'V2', from: 2022, to: 2026, cc: 955 },
      { name: 'V4 / V4S', from: 2020, to: 2026, cc: 1103 },
    ],
  },
  {
    brandName: 'Ducati', name: 'DesertX', popularNames: ['Desert X'],
    cc: 937, category: 'Big Trail', from: 2023, to: 2026,
    versions: [{ name: 'Standard / Rally', from: 2023, to: 2026 }],
  },

  // TRIUMPH
  {
    brandName: 'Triumph', name: 'Speed 400', popularNames: ['Speed 400'],
    cc: 398, category: 'Naked', from: 2024, to: 2026,
    versions: [{ name: 'ABS', from: 2024, to: 2026 }],
  },
  {
    brandName: 'Triumph', name: 'Scrambler 400 X', popularNames: ['Scrambler 400'],
    cc: 398, category: 'Trail', from: 2024, to: 2026,
    versions: [{ name: 'ABS', from: 2024, to: 2026 }],
  },
  {
    brandName: 'Triumph', name: 'Trident 660', popularNames: ['Trident'],
    cc: 660, category: 'Naked', from: 2021, to: 2026,
    versions: [{ name: 'ABS / Triple Tribute', from: 2021, to: 2026 }],
  },
  {
    brandName: 'Triumph', name: 'Tiger Sport 660', popularNames: ['Tiger 660'],
    cc: 660, category: 'Big Trail', from: 2022, to: 2026,
    versions: [{ name: 'ABS / Tourer', from: 2022, to: 2026 }],
  },
  {
    brandName: 'Triumph', name: 'Tiger 900', popularNames: ['Tiger 800', 'Tiger 900 GT', 'Tiger 900 Rally'],
    cc: 888, category: 'Big Trail', from: 2020, to: 2026,
    versions: [
      { name: 'GT / GT Pro', from: 2020, to: 2026 },
      { name: 'Rally / Rally Pro / Aragón', from: 2020, to: 2026 },
    ],
  },
  {
    brandName: 'Triumph', name: 'Tiger 1200', popularNames: ['Tiger Explorer'],
    cc: 1160, category: 'Big Trail', from: 2018, to: 2026,
    versions: [
      { name: 'GT Pro / GT Explorer', from: 2022, to: 2026 },
      { name: 'Rally Pro / Rally Explorer', from: 2022, to: 2026 },
    ],
  },
  {
    brandName: 'Triumph', name: 'Street Triple 765', popularNames: ['Street Triple', 'Street Triple 675'],
    cc: 765, category: 'Naked', from: 2013, to: 2026,
    versions: [
      { name: 'R', from: 2013, to: 2026 },
      { name: 'RS / Moto2 Edition', from: 2018, to: 2026 },
    ],
  },
  {
    brandName: 'Triumph', name: 'Bonneville', popularNames: ['Bonneville T100', 'Bonneville T120', 'Bobber'],
    cc: 1200, category: 'Custom / Cruiser', from: 2016, to: 2026,
    versions: [
      { name: 'T100 (900)', from: 2016, to: 2026, cc: 900 },
      { name: 'T120 / Black', from: 2016, to: 2026, cc: 1200 },
      { name: 'Bobber / Speedmaster', from: 2017, to: 2026, cc: 1200 },
    ],
  },
  {
    brandName: 'Triumph', name: 'Daytona 660', popularNames: ['Daytona 675', 'Daytona'],
    cc: 660, category: 'Esportiva', from: 2013, to: 2026,
    versions: [
      { name: '675 / 675R', from: 2013, to: 2017, cc: 675 },
      { name: '660 ABS', from: 2024, to: 2026, cc: 660 },
    ],
  },

  // KTM
  {
    brandName: 'KTM', name: '390 Duke', popularNames: ['Duke 390'],
    cc: 399, category: 'Naked', from: 2015, to: 2026,
    versions: [{ name: 'ABS / Gen 3', from: 2015, to: 2026 }],
  },
  {
    brandName: 'KTM', name: '200 Duke', popularNames: ['Duke 200'],
    cc: 199, category: 'Naked', from: 2015, to: 2025,
    versions: [{ name: 'ABS', from: 2015, to: 2025 }],
  },
  {
    brandName: 'KTM', name: '390 Adventure', popularNames: ['Adventure 390'],
    cc: 373, category: 'Big Trail', from: 2020, to: 2026,
    versions: [{ name: 'ABS / SW', from: 2020, to: 2026 }],
  },
  {
    brandName: 'KTM', name: '1290 Super Duke R', popularNames: ['Super Duke', '1390 Super Duke'],
    cc: 1301, category: 'Naked', from: 2016, to: 2026,
    versions: [{ name: 'R / EVO', from: 2016, to: 2026 }],
  },
  {
    brandName: 'KTM', name: '350 EXC-F', popularNames: ['EXC 350', 'EXC 300'],
    cc: 349, category: 'Off-Road', from: 2014, to: 2026,
    versions: [{ name: 'Six Days / Standard', from: 2014, to: 2026 }],
  },

  // BAJAJ
  {
    brandName: 'Bajaj', name: 'Dominar 160', popularNames: ['Pulsar NS160'],
    cc: 160, category: 'Street', from: 2023, to: 2026,
    versions: [{ name: 'ABS / UG', from: 2023, to: 2026 }],
  },
  {
    brandName: 'Bajaj', name: 'Dominar 200', popularNames: ['Pulsar NS200'],
    cc: 199, category: 'Street', from: 2023, to: 2026,
    versions: [{ name: 'ABS', from: 2023, to: 2026 }],
  },
  {
    brandName: 'Bajaj', name: 'Dominar 250', popularNames: ['Dominar 250'],
    cc: 249, category: 'Naked', from: 2024, to: 2026,
    versions: [{ name: 'ABS', from: 2024, to: 2026 }],
  },
  {
    brandName: 'Bajaj', name: 'Dominar 400', popularNames: ['D400'],
    cc: 373, category: 'Touring', from: 2023, to: 2026,
    versions: [{ name: 'UG Touring ABS', from: 2023, to: 2026 }],
  },

  // HAOJUE
  {
    brandName: 'Haojue', name: 'DK 150', popularNames: ['DK150'],
    cc: 149, category: 'Street', from: 2018, to: 2024,
    versions: [{ name: 'S / CBS', from: 2018, to: 2024 }],
  },
  {
    brandName: 'Haojue', name: 'DK 160', popularNames: ['DK160'],
    cc: 162, category: 'Street', from: 2023, to: 2026,
    versions: [{ name: 'FI CBS', from: 2023, to: 2026 }],
  },
  {
    brandName: 'Haojue', name: 'DR 160', popularNames: ['DR160'],
    cc: 162, category: 'Naked', from: 2020, to: 2026,
    versions: [{ name: 'FI CBS', from: 2020, to: 2026 }],
  },
  {
    brandName: 'Haojue', name: 'Chopper Road 150', popularNames: ['Chopper 150'],
    cc: 149, category: 'Custom / Cruiser', from: 2018, to: 2026,
    versions: [{ name: 'CBS', from: 2018, to: 2026 }],
  },

  // DAFRA
  {
    brandName: 'Dafra', name: 'Citycom 300i', popularNames: ['Citycom HD 300'],
    cc: 263, category: 'Cub / Scooter', from: 2011, to: 2026,
    versions: [{ name: 'S / HD 300 ABS', from: 2011, to: 2026 }],
  },
  {
    brandName: 'Dafra', name: 'Cruisym 150 / 300', popularNames: ['Cruisym'],
    cc: 150, category: 'Cub / Scooter', from: 2021, to: 2026,
    versions: [
      { name: '150 CBS', from: 2021, to: 2026, cc: 150 },
      { name: '300 ABS', from: 2023, to: 2026, cc: 278 },
    ],
  },
  {
    brandName: 'Dafra', name: 'NH 190', popularNames: ['SYM NH 190'],
    cc: 183, category: 'Trail', from: 2020, to: 2026,
    versions: [{ name: 'CBS / ABS', from: 2020, to: 2026 }],
  },
  {
    brandName: 'Dafra', name: 'NH 300', popularNames: ['SYM NH 300'],
    cc: 278, category: 'Trail', from: 2023, to: 2026,
    versions: [{ name: 'ABS', from: 2023, to: 2026 }],
  },
  {
    brandName: 'Dafra', name: 'Apache RTR 200', popularNames: ['Apache 200'],
    cc: 197, category: 'Street', from: 2019, to: 2026,
    versions: [{ name: 'ABS / CBS', from: 2019, to: 2026 }],
  },

  // SHINERAY
  {
    brandName: 'Shineray', name: 'Worker 125 / 150', popularNames: ['Worker'],
    cc: 125, category: 'Street', from: 2021, to: 2026,
    versions: [
      { name: 'Worker 125', from: 2021, to: 2026, cc: 124 },
      { name: 'Worker Cross 150', from: 2022, to: 2026, cc: 149 },
    ],
  },
  {
    brandName: 'Shineray', name: 'JEF 150s', popularNames: ['JEF 150'],
    cc: 149, category: 'Street', from: 2022, to: 2026,
    versions: [{ name: 'EFI', from: 2022, to: 2026 }],
  },
  {
    brandName: 'Shineray', name: 'SHI 175', popularNames: ['SHI 175 EFI'],
    cc: 175, category: 'Trail', from: 2023, to: 2026,
    versions: [{ name: 'Carburada / EFI', from: 2023, to: 2026 }],
  },
  {
    brandName: 'Shineray', name: 'XY 50 Jet / Phoenix', popularNames: ['Jet 50', 'Phoenix 50', 'Cinquentinha'],
    cc: 49, category: 'Cub / Scooter', from: 2012, to: 2026,
    versions: [{ name: 'Jet 50 / Phoenix Gold / 125', from: 2012, to: 2026 }],
  },

  // HARLEY-DAVIDSON
  {
    brandName: 'Harley-Davidson', name: 'Iron 883', popularNames: ['Sportster 883'],
    cc: 883, category: 'Custom / Cruiser', from: 2009, to: 2021,
    versions: [{ name: 'Sportster ABS', from: 2009, to: 2021 }],
  },
  {
    brandName: 'Harley-Davidson', name: 'Fat Boy 114', popularNames: ['Fat Boy'],
    cc: 1868, category: 'Custom / Cruiser', from: 2018, to: 2026,
    versions: [{ name: '107 / 114 ABS', from: 2018, to: 2026 }],
  },
  {
    brandName: 'Harley-Davidson', name: 'Heritage Classic', popularNames: ['Heritage 114'],
    cc: 1868, category: 'Touring', from: 2018, to: 2026,
    versions: [{ name: '114 ABS', from: 2018, to: 2026 }],
  },
  {
    brandName: 'Harley-Davidson', name: 'Street Glide / Road Glide', popularNames: ['Street Glide', 'Road Glide'],
    cc: 1868, category: 'Touring', from: 2016, to: 2026,
    versions: [{ name: 'Special / ST / CVO', from: 2016, to: 2026 }],
  },
  {
    brandName: 'Harley-Davidson', name: 'Pan America 1250', popularNames: ['Pan America'],
    cc: 1252, category: 'Big Trail', from: 2021, to: 2026,
    versions: [{ name: 'Special', from: 2021, to: 2026 }],
  },

  // OUTRAS MARCAS NACIONAIS E INTERNACIONAIS SOLICITADAS
  {
    brandName: 'Kymco', name: 'Downtown 300i / 350i', popularNames: ['Downtown'],
    cc: 321, category: 'Cub / Scooter', from: 2016, to: 2025,
    versions: [{ name: 'ABS / TCS', from: 2016, to: 2025 }],
  },
  {
    brandName: 'Zontes', name: 'R310 / T310 / V310 / 350', popularNames: ['Zontes 310', 'Zontes 350', 'T350', 'E350'],
    cc: 348, category: 'Naked', from: 2023, to: 2026,
    versions: [
      { name: 'R310 / T310 / V310', from: 2023, to: 2024, cc: 312 },
      { name: 'R350 / T350X / V350 / E350', from: 2024, to: 2026, cc: 348 },
    ],
  },
  {
    brandName: 'Husqvarna', name: 'Svartpilen 401', popularNames: ['Vitpilen 401'],
    cc: 373, category: 'Naked', from: 2020, to: 2026,
    versions: [{ name: 'ABS', from: 2020, to: 2026 }],
  },
  {
    brandName: 'Husqvarna', name: 'Norden 901', popularNames: ['Norden'],
    cc: 889, category: 'Big Trail', from: 2022, to: 2026,
    versions: [{ name: 'Standard / Expedition', from: 2022, to: 2026 }],
  },
  {
    brandName: 'Aprilia', name: 'RS 660 / RSV4', popularNames: ['RS660', 'Tuono 660', 'RSV4'],
    cc: 659, category: 'Esportiva', from: 2021, to: 2026,
    versions: [
      { name: 'RS 660 / Tuono 660', from: 2021, to: 2026, cc: 659 },
      { name: 'RSV4 1100 Factory', from: 2021, to: 2026, cc: 1099 },
    ],
  },
  {
    brandName: 'MV Agusta', name: 'Brutale 800 RR', popularNames: ['Brutale 800', 'Dragster 800', 'F3 800'],
    cc: 798, category: 'Naked', from: 2016, to: 2026,
    versions: [{ name: 'RR / Rosso / SCS', from: 2016, to: 2026 }],
  },
  {
    brandName: 'Benelli', name: 'TRK 502 / 502X', popularNames: ['TRK 502'],
    cc: 500, category: 'Big Trail', from: 2018, to: 2026,
    versions: [{ name: 'ABS / X Adventure', from: 2018, to: 2026 }],
  },
  {
    brandName: 'Indian', name: 'Scout / Chief', popularNames: ['Scout Bobber', 'Indian Chief'],
    cc: 1133, category: 'Custom / Cruiser', from: 2016, to: 2026,
    versions: [{ name: 'Standard / Bobber / Dark Horse', from: 2016, to: 2026 }],
  },
  {
    brandName: 'CFMOTO', name: '450MT / 450SR / 800MT', popularNames: ['CF 450MT', 'CF 800MT'],
    cc: 449, category: 'Big Trail', from: 2023, to: 2026,
    versions: [
      { name: '450SR / 450NK / 450MT', from: 2023, to: 2026, cc: 449 },
      { name: '800MT Explore', from: 2023, to: 2026, cc: 799 },
    ],
  },
  {
    brandName: 'Piaggio', name: 'Beverly 400 / MP3', popularNames: ['Beverly'],
    cc: 399, category: 'Cub / Scooter', from: 2018, to: 2026,
    versions: [{ name: 'S ABS / HPE', from: 2018, to: 2026 }],
  },
  {
    brandName: 'Vespa', name: 'Primavera 150 / GTS 300', popularNames: ['Vespa Primavera', 'Vespa GTS'],
    cc: 155, category: 'Cub / Scooter', from: 2016, to: 2026,
    versions: [
      { name: 'Primavera 150 / Sprint 150', from: 2016, to: 2026, cc: 155 },
      { name: 'GTS 300 Super', from: 2018, to: 2026, cc: 278 },
    ],
  },
  {
    brandName: 'Loncin', name: 'Voge 300DS / 500DS', popularNames: ['Voge 300', 'Voge 500'],
    cc: 292, category: 'Big Trail', from: 2020, to: 2026,
    versions: [{ name: '300DS / 500DSX', from: 2020, to: 2026 }],
  },
  {
    brandName: 'Lifan', name: 'KPR 150 / 200', popularNames: ['LF 150', 'V16 250'],
    cc: 198, category: 'Street', from: 2015, to: 2024,
    versions: [{ name: 'Standard', from: 2015, to: 2024 }],
  },
  {
    brandName: 'GasGas', name: 'EC 300 / SM 700', popularNames: ['GasGas EC', 'ES 700'],
    cc: 293, category: 'Off-Road', from: 2021, to: 2026,
    versions: [
      { name: 'EC 250 / 300 Enduro', from: 2021, to: 2026, cc: 293 },
      { name: 'SM 700 / ES 700', from: 2022, to: 2026, cc: 693 },
    ],
  },
  {
    brandName: 'Moto Guzzi', name: 'V7 / V85 TT', popularNames: ['V85 TT'],
    cc: 853, category: 'Big Trail', from: 2019, to: 2026,
    versions: [{ name: 'Stone / Travel', from: 2019, to: 2026 }],
  },
  {
    brandName: 'Bull Motors', name: 'KCR 125 / Max 50', popularNames: ['Bull KCR'],
    cc: 124, category: 'Cub / Scooter', from: 2018, to: 2026,
    versions: [{ name: 'Standard', from: 2018, to: 2026 }],
  },
];

export const SEED_MOTO_MODELS: MotoCatalogModel[] = RAW_MODELS.map(m => {
  const brand = BRAND_ID_BY_NORM.get(normalizeMotoText(m.brandName))!;
  const modelSlug = normalizeMotoText(m.name).replace(/\s+/g, '_');
  const versions: MotoCatalogVersion[] = m.versions.map((v, idx) => ({
    id: `ver_${brand.id}_${modelSlug}_${idx + 1}`,
    name: v.name,
    cc: v.cc || m.cc,
    years: buildYearRange(v.from, v.to),
  }));

  return {
    id: `mod_${brand.id}_${modelSlug}`,
    brandId: brand.id,
    brandName: brand.name,
    name: m.name,
    normalizedName: normalizeMotoText(m.name),
    popularNames: m.popularNames,
    cc: m.cc,
    category: m.category,
    years: buildYearRange(m.from, m.to),
    versions,
    active: true,
    isCustom: false,
    source: 'seed' as const,
  };
});

export function createInitialMotoCatalogState(): MotoCatalogState {
  return {
    brands: SEED_MOTO_BRANDS.map(b => ({ ...b })),
    models: SEED_MOTO_MODELS.map(m => ({ ...m, versions: m.versions.map(v => ({ ...v })) })),
    sourceName: 'Base Inicial PK Detail (Pronta para sincronização FIPE)',
    fipeBrandsCount: 0,
    fipeModelsCount: 0,
    lastSyncNote: 'Base local carregada com fabricantes nacionais e importados.',
  };
}
