import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  ChevronDown,
  Plus,
  Check,
  Bike,
  Loader2,
  Sparkles,
  Edit3,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MotoCategory, Motorcycle } from '../../types';
import { MOTO_CATEGORIES, normalizeMotoText } from '../../data/motorcycleCatalogSeed';
import {
  getVersionsForModelAndYear,
  smartSearchCatalog,
} from '../../services/motorcycleCatalogService';
import { MotoBrandBadge } from './MotoBrandBadge';
import {
  focusElementSafely,
  parseSafeNumber,
  preventInvalidNumericKeys,
  sanitizePlateInput,
  validateMotorcycleDraft,
} from '../../utils/inputValidation';
import { createLatestRequestGuard } from '../../core/networkCache';

export interface MotorcycleFormDraft {
  brand: string;
  model: string;
  version: string;
  year: number;
  manufactureYear: number;
  modelYear: number;
  cc: number;
  category: MotoCategory | string;
  color: string;
  plate: string;
  mileage: number;
  notes: string;
  catalogBrandId?: string;
  catalogModelId?: string;
  isManualEntry?: boolean;
  catalogSource?: string;
}

interface SmartMotorcycleSelectorProps {
  value: MotorcycleFormDraft;
  onChange: (next: MotorcycleFormDraft) => void;
  registeredMotorcycles?: Motorcycle[];
  onSelectRegisteredMoto?: (moto: Motorcycle) => void;
  variant?: 'full' | 'compact' | 'portal';
  showPlateAndColor?: boolean;
  showMileageAndNotes?: boolean;
  allowCatalogSave?: boolean;
  plateRequired?: boolean;
  externalErrors?: Record<string, string>;
  showValidation?: boolean;
}

const CURRENT_YEAR = new Date().getFullYear() + 1;
const ALL_YEARS_DESC = Array.from({ length: CURRENT_YEAR - 1969 }, (_, i) => CURRENT_YEAR - i);

export const SmartMotorcycleSelector: React.FC<SmartMotorcycleSelectorProps> = ({
  value,
  onChange,
  registeredMotorcycles = [],
  onSelectRegisteredMoto,
  variant = 'full',
  showPlateAndColor = true,
  showMileageAndNotes = variant === 'full',
  allowCatalogSave = true,
  plateRequired = true,
  externalErrors = {},
  showValidation = false,
}) => {
  const {
    motoCatalog,
    upsertCatalogBrand,
    upsertCatalogModel,
    syncCatalogModelsForBrand,
    syncCatalogYearsForModel,
  } = useApp();

  // Unified Smart Search
  const [smartQuery, setSmartQuery] = useState('');
  const [smartOpen, setSmartOpen] = useState(false);

  // Brand Picker state
  const [brandOpen, setBrandOpen] = useState(false);
  const [brandSearch, setBrandSearch] = useState('');
  const [manualBrandMode, setManualBrandMode] = useState(false);

  // Model Picker state
  const [modelOpen, setModelOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const [manualModelMode, setManualModelMode] = useState(false);

  // Background FIPE sync tracking per brand/model
  const [loadingBrandModelsId, setLoadingBrandModelsId] = useState<string | null>(null);
  const [loadingModelYearsId, setLoadingModelYearsId] = useState<string | null>(null);
  const attemptedBrandSyncRef = useRef<Set<string>>(new Set());
  const attemptedModelYearsRef = useRef<Set<string>>(new Set());
  const brandSyncGuardRef = useRef(createLatestRequestGuard());
  const modelYearsGuardRef = useRef(createLatestRequestGuard());
  const brandSearchInputRef = useRef<HTMLInputElement>(null);
  const modelSearchInputRef = useRef<HTMLInputElement>(null);
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const brandGuard = brandSyncGuardRef.current;
    const yearsGuard = modelYearsGuardRef.current;
    return () => {
      brandGuard.cancelCurrent();
      yearsGuard.cancelCurrent();
    };
  }, []);

  useEffect(() => {
    if (brandOpen) {
      focusElementSafely(brandSearchInputRef.current, { skipOnTouch: true });
    }
  }, [brandOpen]);

  useEffect(() => {
    if (modelOpen) {
      focusElementSafely(modelSearchInputRef.current, { skipOnTouch: true });
    }
  }, [modelOpen]);

  const markTouched = (field: string) => {
    setTouchedFields(prev => (prev[field] ? prev : { ...prev, [field]: true }));
  };

  const liveValidation = useMemo(
    () =>
      validateMotorcycleDraft(value, {
        plateRequired: showPlateAndColor && plateRequired,
      }),
    [value, showPlateAndColor, plateRequired]
  );

  const getFieldError = (field: string): string | undefined => {
    if (externalErrors[field]) return externalErrors[field];
    if (showValidation || touchedFields[field]) return liveValidation.errors[field];
    return undefined;
  };

  const activeBrands = useMemo(
    () =>
      motoCatalog.brands
        .filter(b => b.active)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [motoCatalog.brands]
  );

  const selectedBrandObj = useMemo(() => {
    if (value.catalogBrandId) {
      const byId = activeBrands.find(b => b.id === value.catalogBrandId);
      if (byId) return byId;
    }
    const norm = normalizeMotoText(value.brand || '');
    if (!norm) return undefined;
    return activeBrands.find(b => b.normalizedName === norm);
  }, [activeBrands, value.catalogBrandId, value.brand]);

  const brandModels = useMemo(() => {
    if (!selectedBrandObj) return [];
    return motoCatalog.models
      .filter(m => m.active && m.brandId === selectedBrandObj.id)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [motoCatalog.models, selectedBrandObj]);

  const selectedModelObj = useMemo(() => {
    if (!selectedBrandObj) return undefined;
    if (value.catalogModelId) {
      const byId = brandModels.find(m => m.id === value.catalogModelId);
      if (byId) return byId;
    }
    const norm = normalizeMotoText(value.model || '');
    if (!norm) return undefined;
    return brandModels.find(m => m.normalizedName === norm);
  }, [selectedBrandObj, brandModels, value.catalogModelId, value.model]);

  // Auto-sync FIPE models when a FIPE-linked brand hasn't been synced yet (race-condition guarded)
  useEffect(() => {
    if (!selectedBrandObj?.fipeCode) return;
    if (selectedBrandObj.modelsSyncedAt) return;
    if (attemptedBrandSyncRef.current.has(selectedBrandObj.id)) return;

    const brandId = selectedBrandObj.id;
    attemptedBrandSyncRef.current.add(brandId);
    const { token, signal } = brandSyncGuardRef.current.next();
    setLoadingBrandModelsId(brandId);

    syncCatalogModelsForBrand(brandId, signal)
      .catch(() => {
        // Silent fallback: curated seed + manual entry still work offline
      })
      .finally(() => {
        if (brandSyncGuardRef.current.isLatest(token)) {
          setLoadingBrandModelsId(curr => (curr === brandId ? null : curr));
        }
      });
  }, [selectedBrandObj, syncCatalogModelsForBrand]);

  // Auto-sync FIPE years when a FIPE-linked model is chosen (race-condition guarded)
  useEffect(() => {
    if (!selectedModelObj?.fipeCode) return;
    if (selectedModelObj.yearsSyncedAt) return;
    if (attemptedModelYearsRef.current.has(selectedModelObj.id)) return;

    const modelId = selectedModelObj.id;
    attemptedModelYearsRef.current.add(modelId);
    const { token, signal } = modelYearsGuardRef.current.next();
    setLoadingModelYearsId(modelId);

    syncCatalogYearsForModel(modelId, signal)
      .catch(() => {})
      .finally(() => {
        if (modelYearsGuardRef.current.isLatest(token)) {
          setLoadingModelYearsId(curr => (curr === modelId ? null : curr));
        }
      });
  }, [selectedModelObj, syncCatalogYearsForModel]);

  const filteredBrands = useMemo(() => {
    const q = normalizeMotoText(brandSearch);
    if (!q) return activeBrands;
    return activeBrands.filter(
      b =>
        b.normalizedName.includes(q) ||
        normalizeMotoText(b.country).includes(q)
    );
  }, [activeBrands, brandSearch]);

  const filteredModels = useMemo(() => {
    const q = normalizeMotoText(modelSearch);
    if (!q) return brandModels;
    const tokens = q.split(/\s+/).filter(Boolean);
    return brandModels.filter(m => {
      const pop = (m.popularNames || []).map(p => normalizeMotoText(p)).join(' ');
      const hay = `${m.normalizedName} ${pop} ${m.cc}cc ${normalizeMotoText(m.category)}`;
      return tokens.every(t => hay.includes(t));
    });
  }, [brandModels, modelSearch]);

  const availableYearsForModel = useMemo(() => {
    if (!selectedModelObj || selectedModelObj.years.length === 0) {
      return ALL_YEARS_DESC;
    }
    const merged = Array.from(new Set([...selectedModelObj.years, value.year || new Date().getFullYear()])).sort(
      (a, b) => b - a
    );
    return merged;
  }, [selectedModelObj, value.year]);

  const filteredVersions = useMemo(
    () => getVersionsForModelAndYear(selectedModelObj, value.modelYear || value.year),
    [selectedModelObj, value.modelYear, value.year]
  );

  // Unified smart suggestions (strictly scopes catalog models if brand is already picked!)
  const smartResults = useMemo(
    () =>
      smartSearchCatalog({
        query: smartQuery,
        catalog: motoCatalog,
        registeredMotorcycles,
        selectedBrandId: smartQuery.trim() ? undefined : selectedBrandObj?.id,
        maxResults: 14,
      }),
    [smartQuery, motoCatalog, registeredMotorcycles, selectedBrandObj?.id]
  );

  const brandModelCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of motoCatalog.models) {
      if (!m.active) continue;
      counts.set(m.brandId, (counts.get(m.brandId) || 0) + 1);
    }
    return counts;
  }, [motoCatalog.models]);

  const handleSelectBrand = (brandId: string, brandName: string) => {
    const isSameBrand = normalizeMotoText(value.brand) === normalizeMotoText(brandName);
    onChange({
      ...value,
      brand: brandName,
      catalogBrandId: brandId,
      model: isSameBrand ? value.model : '',
      catalogModelId: isSameBrand ? value.catalogModelId : undefined,
      version: isSameBrand ? value.version : '',
      isManualEntry: false,
    });
    setBrandOpen(false);
    setBrandSearch('');
    setManualBrandMode(false);
    if (!isSameBrand) {
      setModelOpen(true);
    }
  };

  const handleRegisterCustomBrand = (rawName: string) => {
    const clean = rawName.trim();
    if (!clean) return;
    if (allowCatalogSave) {
      const { brand } = upsertCatalogBrand({ name: clean, isCustom: true, active: true });
      handleSelectBrand(brand.id, brand.name);
      setManualModelMode(true);
    } else {
      onChange({
        ...value,
        brand: clean,
        catalogBrandId: undefined,
        model: '',
        catalogModelId: undefined,
        version: '',
        isManualEntry: true,
      });
      setBrandOpen(false);
      setBrandSearch('');
      setManualModelMode(true);
    }
  };

  const handleSelectModel = (modelId: string) => {
    const m = motoCatalog.models.find(item => item.id === modelId);
    if (!m) return;
    const latestYear = m.years[0] || value.year || new Date().getFullYear();
    const vers = getVersionsForModelAndYear(m, latestYear);
    const firstVer = vers[0];

    onChange({
      ...value,
      brand: m.brandName,
      catalogBrandId: m.brandId,
      model: m.name,
      catalogModelId: m.id,
      version: firstVer?.name || '',
      year: latestYear,
      manufactureYear: latestYear,
      modelYear: latestYear,
      cc: firstVer?.cc || m.cc,
      category: m.category,
      isManualEntry: m.isCustom,
      catalogSource: m.source,
    });
    setModelOpen(false);
    setModelSearch('');
    setManualModelMode(false);
  };

  const handleRegisterCustomModel = (rawModelName: string) => {
    const clean = rawModelName.trim();
    if (!clean) return;
    if (allowCatalogSave && selectedBrandObj) {
      const { model } = upsertCatalogModel({
        brandId: selectedBrandObj.id,
        name: clean,
        cc: Number(value.cc) || 160,
        category: (value.category as MotoCategory) || 'Street',
        years: [Number(value.year) || new Date().getFullYear()],
        isCustom: true,
      });
      onChange({
        ...value,
        brand: selectedBrandObj.name,
        catalogBrandId: selectedBrandObj.id,
        model: model.name,
        catalogModelId: model.id,
        isManualEntry: true,
        catalogSource: 'custom',
      });
      setModelOpen(false);
      setModelSearch('');
      setManualModelMode(false);
    } else {
      onChange({
        ...value,
        model: clean,
        catalogModelId: undefined,
        isManualEntry: true,
      });
      setModelOpen(false);
      setModelSearch('');
    }
  };

  const handleSelectVersion = (verName: string) => {
    const found = filteredVersions.find(v => v.name === verName);
    onChange({
      ...value,
      version: verName,
      cc: found?.cc || value.cc,
    });
  };

  const handleYearChange = (kind: 'manufacture' | 'model', yr: number) => {
    const nextManufacture = kind === 'manufacture' ? yr : value.manufactureYear || yr;
    const nextModelYear = kind === 'model' ? yr : value.modelYear || yr;
    onChange({
      ...value,
      year: nextModelYear,
      manufactureYear: nextManufacture,
      modelYear: nextModelYear,
    });
  };

  const isPortal = variant === 'portal';

  return (
    <div className="space-y-3 text-xs min-w-0 w-full">
      {/* PESQUISA INTELIGENTE (Marca, Modelo, Popular, CC ou Placa) */}
      <div className="relative min-w-0">
        <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#EA580C] shrink-0" />
            <span>
              {isPortal
                ? 'Pesquisa Rápida de Motocicleta'
                : 'Pesquisa Inteligente (Marca, Modelo, Cilindrada ou Placa)'}
            </span>
          </span>
          <span className="text-[10px] font-semibold text-slate-400 tabular-nums hidden sm:inline">
            {activeBrands.length} marcas · {motoCatalog.models.filter(m => m.active).length} modelos
          </span>
        </label>

        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={smartQuery}
            onFocus={() => setSmartOpen(true)}
            onChange={e => {
              setSmartQuery(e.target.value);
              setSmartOpen(true);
            }}
            placeholder={
              registeredMotorcycles.length > 0 && !isPortal
                ? 'Ex: CG 160, MT-07, Hornet, 650, ou placa BRA-2E19...'
                : 'Ex: CG 160, Biz 125, MT-07, Tiger 900, R 1250 GS...'
            }
            className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-8 py-2.5 text-xs font-medium text-slate-900 focus:bg-white focus:border-[#EA580C] focus:outline-hidden"
          />
          {smartQuery && (
            <button
              type="button"
              onClick={() => {
                setSmartQuery('');
                setSmartOpen(false);
              }}
              aria-label="Limpar pesquisa rápida"
              className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {smartOpen && smartQuery.trim().length > 0 && (
          <div className="mt-1.5 w-full bg-white border border-slate-200 rounded-2xl shadow-lg max-h-64 overflow-y-auto pk-scroll-compact divide-y divide-slate-100 z-30 pk-dropdown-enter">
            <div className="px-3 py-1.5 bg-slate-50 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500 sticky top-0">
              <span>Sugestões do Catálogo</span>
              <button
                type="button"
                onClick={() => setSmartOpen(false)}
                className="text-[#9A3412] hover:underline font-bold"
              >
                Fechar
              </button>
            </div>

            {/* Registered customer fleet matches first */}
            {smartResults.registeredMatches.length > 0 && (
              <div className="p-1.5 space-y-1 bg-[#FFEDD5]/30">
                <span className="text-[10px] font-extrabold text-[#9A3412] uppercase px-2 block">
                  Motos Já Cadastradas (1 clique para reutilizar)
                </span>
                {smartResults.registeredMatches.map(rm => (
                  <button
                    key={rm.id}
                    type="button"
                    onClick={() => {
                      if (onSelectRegisteredMoto) {
                        onSelectRegisteredMoto(rm);
                      } else {
                        onChange({
                          ...value,
                          brand: rm.brand,
                          model: rm.model,
                          version: rm.version || '',
                          year: rm.year,
                          manufactureYear: rm.manufactureYear || rm.year,
                          modelYear: rm.modelYear || rm.year,
                          cc: rm.cc,
                          category: rm.category || 'Street',
                          color: rm.color,
                          plate: rm.plate,
                          mileage: rm.mileage || 0,
                          notes: rm.notes || '',
                        });
                      }
                      setSmartQuery('');
                      setSmartOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-[#FFEDD5]/70 flex items-center justify-between gap-2 transition"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[11px] font-black bg-slate-900 text-white px-2 py-0.5 rounded shrink-0">
                        {rm.plate}
                      </span>
                      <span className="font-bold text-slate-900 truncate">
                        {rm.brand} {rm.model}
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500 shrink-0">
                      {rm.clientName || `${rm.cc}cc`}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Catalog model matches */}
            {smartResults.modelMatches.length > 0 ? (
              <div className="p-1.5 space-y-1">
                {smartResults.modelMatches.map(m => {
                  const br = activeBrands.find(b => b.id === m.brandId);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        handleSelectModel(m.id);
                        setSmartQuery('');
                        setSmartOpen(false);
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-slate-100 flex items-center justify-between gap-2 transition"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <MotoBrandBadge brand={br} brandName={m.brandName} size="xs" />
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 block truncate">
                            {m.brandName} {m.name}
                          </span>
                          <span className="text-[10px] text-slate-500 block truncate">
                            {m.category} · {m.cc} cc · {m.years[m.years.length - 1] || ''}–{m.years[0] || ''}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-[#EA580C] shrink-0">
                        Selecionar
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              smartResults.registeredMatches.length === 0 && (
                <div className="p-3 text-center space-y-2 text-slate-500">
                  <p>Nenhum modelo exato encontrado para "{smartQuery}".</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSmartOpen(false);
                      setManualModelMode(true);
                      onChange({ ...value, model: smartQuery.trim(), isManualEntry: true });
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-bold text-[11px] hover:bg-[#9A3412] transition"
                  >
                    Usar "{smartQuery.trim()}" manualmente
                  </button>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* 1. MARCA DA MOTOCICLETA & 2. MODELO DA MOTOCICLETA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 min-w-0">
        {/* MARCA */}
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-1 mb-1">
            <label className="font-bold text-slate-700 truncate">
              MARCA DA MOTOCICLETA *
            </label>
            <button
              type="button"
              onClick={() => {
                setManualBrandMode(prev => !prev);
                setBrandOpen(false);
              }}
              className="text-[10px] font-bold text-[#9A3412] hover:underline shrink-0 flex items-center gap-0.5"
            >
              <Edit3 className="w-3 h-3" />
              <span>{manualBrandMode ? 'Lista de marcas' : 'Digitar manual'}</span>
            </button>
          </div>

          {manualBrandMode ? (
            <>
              <input
                type="text"
                autoComplete="off"
                value={value.brand}
                onBlur={() => markTouched('brand')}
                onChange={e =>
                  onChange({
                    ...value,
                    brand: e.target.value,
                    catalogBrandId: undefined,
                    isManualEntry: true,
                  })
                }
                placeholder="Digite a marca manualmente"
                className={`w-full bg-slate-50 border rounded-xl p-2.5 font-semibold text-slate-900 focus:bg-white focus:outline-hidden ${
                  getFieldError('brand') ? 'border-rose-500' : 'border-slate-300 focus:border-[#EA580C]'
                }`}
              />
              {getFieldError('brand') && (
                <p className="text-[11px] font-semibold text-rose-600 mt-1">{getFieldError('brand')}</p>
              )}
            </>
          ) : (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setBrandOpen(prev => !prev);
                  setModelOpen(false);
                }}
                className={`w-full min-h-[40px] bg-slate-50 hover:bg-white border rounded-xl px-2.5 py-2 flex items-center justify-between gap-2 text-left transition ${
                  getFieldError('brand') ? 'border-rose-500' : 'border-slate-300 focus:border-[#EA580C]'
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  {value.brand ? (
                    <>
                      <MotoBrandBadge brand={selectedBrandObj} brandName={value.brand} size="xs" />
                      <span className="font-bold text-slate-900 truncate">{value.brand}</span>
                    </>
                  ) : (
                    <span className="text-slate-400 font-medium truncate">
                      Selecionar fabricante...
                    </span>
                  )}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-150 ${brandOpen ? 'rotate-180' : ''}`} />
              </button>
              {getFieldError('brand') && (
                <p className="text-[11px] font-semibold text-rose-600 mt-1">{getFieldError('brand')}</p>
              )}

              {brandOpen && (
                <div className="mt-1.5 w-full bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden z-30 pk-dropdown-enter">
                  <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <input
                      ref={brandSearchInputRef}
                      type="text"
                      inputMode="search"
                      autoComplete="off"
                      value={brandSearch}
                      onChange={e => setBrandSearch(e.target.value)}
                      placeholder="Pesquisar fabricante (A-Z)..."
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:border-[#EA580C] focus:outline-hidden"
                    />
                  </div>
                  <div className="max-h-56 overflow-y-auto pk-scroll-compact p-1 space-y-0.5">
                    {filteredBrands.map(b => {
                      const isSel = normalizeMotoText(b.name) === normalizeMotoText(value.brand);
                      const count = brandModelCounts.get(b.id) || 0;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => handleSelectBrand(b.id, b.name)}
                          className={`w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between gap-2 transition ${
                            isSel
                              ? 'bg-[#FFEDD5] text-[#9A3412] font-bold'
                              : 'hover:bg-slate-100 text-slate-800'
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <MotoBrandBadge brand={b} size="xs" />
                            <span className="truncate font-semibold">{b.name}</span>
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0 flex items-center gap-1">
                            {count > 0 && <span>{count} mod.</span>}
                            {isSel && <Check className="w-3.5 h-3.5 text-[#EA580C]" />}
                          </span>
                        </button>
                      );
                    })}

                    {brandSearch.trim() &&
                      !filteredBrands.some(
                        b => normalizeMotoText(b.name) === normalizeMotoText(brandSearch)
                      ) && (
                        <button
                          type="button"
                          onClick={() => handleRegisterCustomBrand(brandSearch)}
                          className="w-full text-left px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-[#9A3412] text-white font-bold flex items-center gap-2 transition mt-1"
                        >
                          <Plus className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">
                            Cadastrar marca "{brandSearch.trim()}"
                          </span>
                        </button>
                      )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* MODELO DA MOTOCICLETA (Estritamente filtrado pela marca) */}
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-1 mb-1">
            <label className="font-bold text-slate-700 truncate flex items-center gap-1">
              <span>Modelo *</span>
              {loadingBrandModelsId === selectedBrandObj?.id && (
                <Loader2 className="w-3 h-3 animate-spin text-[#EA580C]" />
              )}
            </label>
            <button
              type="button"
              onClick={() => {
                setManualModelMode(prev => !prev);
                setModelOpen(false);
              }}
              className="text-[10px] font-bold text-[#9A3412] hover:underline shrink-0 flex items-center gap-0.5"
            >
              <Edit3 className="w-3 h-3" />
              <span>{manualModelMode ? 'Lista da marca' : 'Cadastro manual'}</span>
            </button>
          </div>

          {manualModelMode || !selectedBrandObj ? (
            <>
              <input
                type="text"
                autoComplete="off"
                value={value.model}
                onBlur={() => markTouched('model')}
                onChange={e =>
                  onChange({
                    ...value,
                    model: e.target.value,
                    catalogModelId: undefined,
                    isManualEntry: true,
                  })
                }
                placeholder={value.brand ? `Digite o modelo ${value.brand}` : 'Ex: CG 160 Titan'}
                className={`w-full bg-slate-50 border rounded-xl p-2.5 font-semibold text-slate-900 focus:bg-white focus:outline-hidden ${
                  getFieldError('model') ? 'border-rose-500' : 'border-slate-300 focus:border-[#EA580C]'
                }`}
              />
              {getFieldError('model') && (
                <p className="text-[11px] font-semibold text-rose-600 mt-1">{getFieldError('model')}</p>
              )}
            </>
          ) : (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setModelOpen(prev => !prev);
                  setBrandOpen(false);
                }}
                className={`w-full min-h-[40px] bg-slate-50 hover:bg-white border rounded-xl px-2.5 py-2 flex items-center justify-between gap-2 text-left transition ${
                  getFieldError('model') ? 'border-rose-500' : 'border-slate-300 focus:border-[#EA580C]'
                }`}
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <Bike className="w-3.5 h-3.5 text-[#EA580C] shrink-0" />
                  <span className={`truncate ${value.model ? 'font-bold text-slate-900' : 'text-slate-400 font-medium'}`}>
                    {value.model || `Selecionar modelo ${selectedBrandObj.name}...`}
                  </span>
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-150 ${modelOpen ? 'rotate-180' : ''}`} />
              </button>
              {getFieldError('model') && (
                <p className="text-[11px] font-semibold text-rose-600 mt-1">{getFieldError('model')}</p>
              )}

              {modelOpen && (
                <div className="mt-1.5 w-full bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden z-30 pk-dropdown-enter">
                  <div className="p-2 border-b border-slate-100 bg-slate-50 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 px-0.5">
                      <span>Modelos {selectedBrandObj.name} ({brandModels.length})</span>
                      {loadingBrandModelsId === selectedBrandObj.id && (
                        <span className="text-[#EA580C] flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Atualizando FIPE...
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <input
                        ref={modelSearchInputRef}
                        type="text"
                        inputMode="search"
                        autoComplete="off"
                        value={modelSearch}
                        onChange={e => setModelSearch(e.target.value)}
                        placeholder={`Buscar modelo ${selectedBrandObj.name} ou cc...`}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:border-[#EA580C] focus:outline-hidden"
                      />
                    </div>
                  </div>
                  <div className="max-h-56 overflow-y-auto pk-scroll-compact p-1 space-y-0.5">
                    {filteredModels.map(m => {
                      const isSel = normalizeMotoText(m.name) === normalizeMotoText(value.model);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleSelectModel(m.id)}
                          className={`w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between gap-2 transition ${
                            isSel
                              ? 'bg-[#FFEDD5] text-[#9A3412] font-bold'
                              : 'hover:bg-slate-100 text-slate-800'
                          }`}
                        >
                          <div className="min-w-0">
                            <span className="font-semibold block truncate">{m.name}</span>
                            <span className="text-[10px] text-slate-400 block truncate">
                              {m.category} · {m.cc} cc
                            </span>
                          </div>
                          {isSel && <Check className="w-3.5 h-3.5 text-[#EA580C] shrink-0" />}
                        </button>
                      );
                    })}

                    {filteredModels.length === 0 && !modelSearch.trim() && (
                      <p className="text-[11px] text-slate-400 p-3 text-center">
                        Nenhum modelo listado para {selectedBrandObj.name}. Digite abaixo para cadastrar manualmente.
                      </p>
                    )}

                    {modelSearch.trim() &&
                      !filteredModels.some(
                        m => normalizeMotoText(m.name) === normalizeMotoText(modelSearch)
                      ) && (
                        <button
                          type="button"
                          onClick={() => handleRegisterCustomModel(modelSearch)}
                          className="w-full text-left px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-[#9A3412] text-white font-bold flex items-center gap-2 transition mt-1"
                        >
                          <Plus className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">
                            Cadastrar modelo "{modelSearch.trim()}" em {selectedBrandObj.name}
                          </span>
                        </button>
                      )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. ANO FABRICAÇÃO / ANO MODELO / VERSÃO */}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-4 gap-2.5 min-w-0">
        {variant === 'full' ? (
          <>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Ano Fabricação</label>
              <select
                value={value.manufactureYear || value.year}
                onChange={e => handleYearChange('manufacture', Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold text-slate-900"
              >
                {availableYearsForModel.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Ano / Modelo</label>
              <select
                value={value.modelYear || value.year}
                onChange={e => handleYearChange('model', Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold text-slate-900"
              >
                {availableYearsForModel.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </>
        ) : (
          <div className="sm:col-span-2">
            <label className="block font-bold text-slate-700 mb-1">Ano / Modelo</label>
            <select
              value={value.modelYear || value.year}
              onChange={e => {
                const yr = Number(e.target.value);
                onChange({ ...value, year: yr, manufactureYear: yr, modelYear: yr });
              }}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold text-slate-900"
            >
              {availableYearsForModel.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        )}

        <div className="min-[420px]:col-span-2">
          <label className="font-bold text-slate-700 mb-1 flex items-center justify-between gap-1">
            <span>Versão</span>
            {loadingModelYearsId === selectedModelObj?.id && (
              <span className="text-[10px] text-[#EA580C] font-semibold flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                FIPE
              </span>
            )}
          </label>
          {filteredVersions.length > 0 ? (
            <div className="flex flex-col sm:flex-row gap-1.5">
              <select
                value={
                  filteredVersions.some(v => v.name === value.version) ? value.version : '__custom__'
                }
                onChange={e => {
                  if (e.target.value === '__custom__') {
                    onChange({ ...value, version: '' });
                  } else {
                    handleSelectVersion(e.target.value);
                  }
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold text-slate-900"
              >
                {filteredVersions.map(v => (
                  <option key={v.id} value={v.name}>
                    {v.name}
                  </option>
                ))}
                <option value="__custom__">Outra versão (digitar)</option>
              </select>
              {!filteredVersions.some(v => v.name === value.version) && (
                <input
                  type="text"
                  value={value.version}
                  onChange={e => onChange({ ...value, version: e.target.value })}
                  placeholder="Informe a versão"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-medium"
                />
              )}
            </div>
          ) : (
            <input
              type="text"
              value={value.version}
              onChange={e => onChange({ ...value, version: e.target.value })}
              placeholder="Ex: ABS, CBS, Rally, Standard"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-medium"
            />
          )}
        </div>
      </div>

      {/* 4. CILINDRADA & TIPO / CATEGORIA */}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2.5 min-w-0">
        <div>
          <label className="block font-bold text-slate-700 mb-1">Cilindrada (cc)</label>
          <input
            type="number"
            inputMode="numeric"
            min={49}
            max={3000}
            value={value.cc || ''}
            onKeyDown={e => preventInvalidNumericKeys(e, false)}
            onBlur={() => markTouched('cc')}
            onChange={e => {
              const raw = e.target.value;
              onChange({
                ...value,
                cc: raw === '' ? 0 : parseSafeNumber(raw, { min: 0, max: 3000, integer: true }),
              });
            }}
            placeholder="Ex: 160, 650, 1250"
            className={`w-full bg-slate-50 border rounded-xl p-2.5 font-mono font-bold text-slate-900 focus:bg-white focus:outline-hidden ${
              getFieldError('cc') ? 'border-rose-500' : 'border-slate-300 focus:border-[#EA580C]'
            }`}
          />
          {getFieldError('cc') && (
            <p className="text-[11px] font-semibold text-rose-600 mt-1">{getFieldError('cc')}</p>
          )}
        </div>
        <div>
          <label className="block font-bold text-slate-700 mb-1">Tipo / Categoria</label>
          <select
            value={value.category || 'Street'}
            onChange={e => onChange({ ...value, category: e.target.value as MotoCategory })}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold text-slate-900 focus:bg-white focus:border-[#EA580C] focus:outline-hidden"
          >
            {MOTO_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 5. PLACA & COR */}
      {showPlateAndColor && (
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2.5 min-w-0">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Placa {plateRequired ? '*' : ''}
            </label>
            <input
              type="text"
              maxLength={8}
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              value={value.plate}
              onBlur={() => markTouched('plate')}
              onChange={e => onChange({ ...value, plate: sanitizePlateInput(e.target.value) })}
              placeholder="BRA-2E19 ou ABC1D23"
              className={`w-full bg-slate-50 border rounded-xl p-2.5 font-mono font-bold text-slate-900 uppercase focus:bg-white focus:outline-hidden ${
                getFieldError('plate') ? 'border-rose-500' : 'border-slate-300 focus:border-[#EA580C]'
              }`}
            />
            {getFieldError('plate') && (
              <p className="text-[11px] font-semibold text-rose-600 mt-1">{getFieldError('plate')}</p>
            )}
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">Cor</label>
            <input
              type="text"
              maxLength={40}
              value={value.color}
              onChange={e => onChange({ ...value, color: e.target.value })}
              placeholder="Ex: Preto Fosco, Vermelho"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-medium text-slate-900 focus:bg-white focus:border-[#EA580C] focus:outline-hidden"
            />
          </div>
        </div>
      )}

      {/* 6. QUILOMETRAGEM & OBSERVAÇÕES */}
      {showMileageAndNotes && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 min-w-0">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Quilometragem (km)</label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={999999}
              value={value.mileage || ''}
              onKeyDown={e => preventInvalidNumericKeys(e, false)}
              onBlur={() => markTouched('mileage')}
              onChange={e => {
                const raw = e.target.value;
                onChange({
                  ...value,
                  mileage: raw === '' ? 0 : parseSafeNumber(raw, { min: 0, max: 999999, integer: true }),
                });
              }}
              placeholder="0"
              className={`w-full bg-slate-50 border rounded-xl p-2.5 font-mono font-semibold text-slate-900 focus:bg-white focus:outline-hidden ${
                getFieldError('mileage') ? 'border-rose-500' : 'border-slate-300 focus:border-[#EA580C]'
              }`}
            />
            {getFieldError('mileage') && (
              <p className="text-[11px] font-semibold text-rose-600 mt-1">{getFieldError('mileage')}</p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="block font-bold text-slate-700 mb-1">Observações da Motocicleta</label>
            <input
              type="text"
              maxLength={240}
              value={value.notes}
              onChange={e => onChange({ ...value, notes: e.target.value })}
              placeholder="Cuidados com pintura fosca, escapamento, adesivos, acessórios..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-medium text-slate-900 focus:bg-white focus:border-[#EA580C] focus:outline-hidden"
            />
          </div>
        </div>
      )}
    </div>
  );
};
