import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  Pencil,
  Trash2,
  X,
  AlertTriangle
} from 'lucide-react';
import { ServiceItem } from '../../types';
import { ResponsiveModal } from '../ui/ResponsivePrimitives';
import { parseSafeNumber, preventInvalidNumericKeys } from '../../utils/inputValidation';

const DESCRIPTION_MAX = 200;

const brl = (value: number) =>
  `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const ServicesCatalogModule: React.FC = () => {
  const { services, serviceCategories, createService, updateService, deleteService } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [formOpen, setFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [formError, setFormError] = useState('');

  const [deletingService, setDeletingService] = useState<ServiceItem | null>(null);

  const filteredServices = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return services;
    return services.filter(
      service =>
        service.name.toLowerCase().includes(q) ||
        service.description.toLowerCase().includes(q) ||
        service.category.toLowerCase().includes(q)
    );
  }, [services, searchTerm]);

  const openCreate = () => {
    setEditingService(null);
    setName('');
    setDescription('');
    setPrice(0);
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (service: ServiceItem) => {
    setEditingService(service);
    setName(service.name);
    setDescription(service.description);
    setPrice(service.price);
    setFormError('');
    setFormOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('Informe o nome do serviço.');
      return;
    }
    if (!(price > 0)) {
      setFormError('Informe um valor maior que zero.');
      return;
    }

    const payload = {
      name: trimmedName,
      description: description.trim().slice(0, DESCRIPTION_MAX),
      price,
    };

    if (editingService) {
      updateService(editingService.id, payload);
    } else {
      createService({
        ...payload,
        category: serviceCategories[0] || 'Outros Serviços',
        estimatedMinutes: 60,
        active: true,
        productsUsed: [],
        warrantyDays: 0,
      });
    }

    setFormOpen(false);
    setEditingService(null);
  };

  const confirmDelete = () => {
    if (!deletingService) return;
    deleteService(deletingService.id);
    setDeletingService(null);
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-5 min-w-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="flex items-stretch gap-2.5 min-w-0">
          <span className="w-1.5 rounded-full bg-[#EA580C] shrink-0" />
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Serviços</h1>
            <p className="text-xs text-slate-500 mt-1.5">Gerencie os serviços oferecidos pela sua estética automotiva</p>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="shrink-0 min-h-[42px] px-4 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-extrabold text-sm flex items-center gap-1.5 shadow-2xs transition whitespace-nowrap"
        >
          <Plus className="w-4 h-4 shrink-0 stroke-[3]" />
          <span>Novo Serviço</span>
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative flex-1 min-w-0 sm:max-w-[320px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar serviço..."
            className="w-full min-h-[40px] bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden"
          />
        </div>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
            {filteredServices.length} {filteredServices.length === 1 ? 'serviço' : 'serviços'}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-label="Visualizar em cartões"
              aria-pressed={viewMode === 'grid'}
              className={`w-9 h-9 rounded-lg border flex items-center justify-center transition ${
                viewMode === 'grid'
                  ? 'border-[#EA580C] bg-[#EA580C] text-white'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-label="Visualizar em lista"
              aria-pressed={viewMode === 'list'}
              className={`w-9 h-9 rounded-lg border flex items-center justify-center transition ${
                viewMode === 'list'
                  ? 'border-[#EA580C] bg-[#EA580C] text-white'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Cards */}
      {filteredServices.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 py-16 px-6 flex flex-col items-center justify-center text-center">
          <p className="text-sm font-extrabold text-slate-900">Nenhum serviço encontrado.</p>
          <p className="text-xs text-slate-500 mt-1">Ajuste a busca ou cadastre um novo serviço.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5 min-w-0 pk-stagger">
          {filteredServices.map(service => (
            <article
              key={service.id}
              className="relative bg-white rounded-xl border border-slate-200/80 shadow-xs pl-3 pr-3.5 py-3 flex flex-col gap-2.5 min-w-0 overflow-hidden"
            >
              <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#EA580C]" aria-hidden="true" />

              <div className="flex items-start justify-between gap-2 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{service.name}</p>
                <span className="shrink-0 rounded-md border border-[#EA580C] bg-[#FFEDD5] px-2 py-1 text-[11px] font-extrabold font-mono text-slate-900">
                  {brl(service.price)}
                </span>
              </div>

              <p className="text-[11px] leading-snug text-slate-500 line-clamp-2 min-h-[30px]">
                {service.description || 'Sem descrição cadastrada.'}
              </p>

              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => openEdit(service)}
                  className="min-h-[34px] rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingService(service)}
                  className="min-h-[34px] rounded-lg border border-slate-200 bg-white hover:bg-rose-50 text-rose-500 text-[11px] font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
          {filteredServices.map(service => (
            <div
              key={service.id}
              className="flex items-center gap-3 px-3.5 py-2.5 border-b border-slate-100 last:border-b-0 min-w-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 truncate">{service.name}</p>
                <p className="text-[11px] text-slate-500 truncate">{service.description || 'Sem descrição'}</p>
              </div>
              <span className="shrink-0 rounded-md border border-[#EA580C] bg-[#FFEDD5] px-2 py-0.5 text-[11px] font-extrabold font-mono text-slate-900">
                {brl(service.price)}
              </span>
              <button
                type="button"
                onClick={() => openEdit(service)}
                aria-label={`Editar ${service.name}`}
                className="shrink-0 w-8 h-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center transition"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setDeletingService(service)}
                aria-label={`Excluir ${service.name}`}
                className="shrink-0 w-8 h-8 rounded-lg border border-slate-200 text-rose-500 hover:bg-rose-50 flex items-center justify-center transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      <ResponsiveModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingService ? 'Editar Serviço' : 'Novo Serviço'}
        headerClassName="border-l-4 border-l-[#EA580C]"
      >
        <form onSubmit={handleSave} noValidate className="p-4 space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nome</label>
            <input
              type="text"
              value={name}
              onChange={e => {
                setName(e.target.value);
                setFormError('');
              }}
              placeholder="Ex.: Lavagem Simples"
              className="w-full min-h-[42px] bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:ring-2 focus:ring-[#EA580C]/30 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Descrição</label>
            <div className="relative">
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value.slice(0, DESCRIPTION_MAX))}
                rows={4}
                maxLength={DESCRIPTION_MAX}
                placeholder="Descreva o que está incluso no serviço..."
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 pb-5 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden resize-y"
              />
              <span className="absolute bottom-1.5 right-2.5 text-[10px] text-slate-400 tabular-nums">
                {description.length}/{DESCRIPTION_MAX}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Valor</label>
            <div className="flex items-center min-h-[42px] bg-slate-50 border border-slate-200 rounded-xl px-3 focus-within:border-[#EA580C]">
              <span className="text-xs font-bold text-slate-500 mr-1.5">R$</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={price || ''}
                onChange={e => {
                  setPrice(parseSafeNumber(e.target.value, { min: 0 }));
                  setFormError('');
                }}
                onKeyDown={e => preventInvalidNumericKeys(e, true)}
                placeholder="0,00"
                className="flex-1 min-w-0 bg-transparent text-xs font-semibold text-slate-800 focus:outline-hidden py-2"
              />
            </div>
          </div>

          {formError && (
            <p className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {formError}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="min-h-[40px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="min-h-[40px] px-5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-extrabold transition"
            >
              Salvar
            </button>
          </div>
        </form>
      </ResponsiveModal>

      {/* Delete confirmation */}
      {deletingService && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 pk-fade-enter">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Excluir serviço"
            className="w-full max-w-[460px] bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-black text-slate-900">Excluir serviço?</h2>
              <button
                type="button"
                onClick={() => setDeletingService(null)}
                aria-label="Fechar"
                className="w-7 h-7 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Ele deixará de aparecer para novos atendimentos, orçamentos, agendamentos e na Vitrine Online. OS,
              orçamentos, agendamentos e valores já registrados serão preservados.{' '}
              <span className="font-bold text-slate-800">Esta ação é irreversível.</span>
            </p>

            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-rose-700 leading-snug">
                Somente o serviço do catálogo será removido. O histórico registrado não muda.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeletingService(null)}
                className="min-h-[38px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="min-h-[38px] px-4 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-extrabold transition"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
