import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { alertDialog } from '../../services/dialogService';
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  User,
  Eye,
  Pencil,
  Trash2,
  Bike,
  X,
  AlertTriangle,
  FileDown
} from 'lucide-react';
import { Client, Motorcycle, OSStatus } from '../../types';
import { ResponsiveModal } from '../ui/ResponsivePrimitives';
import { formatDateBR } from '../../utils/dateUtils';
import { formatPhoneBR } from '../../utils/inputValidation';

type SortMode = 'az' | 'za' | 'recentes';

interface VehicleDraft {
  id?: string;
  model: string;
  plate: string;
}

const STATUS_LABEL: Record<OSStatus, string> = {
  para_fazer: 'Para Fazer',
  em_servico: 'Em Serviço',
  concluido: 'Concluído',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

const STATUS_PILL: Record<OSStatus, string> = {
  para_fazer: 'bg-blue-50 text-blue-700 border-blue-200',
  em_servico: 'bg-amber-50 text-amber-700 border-amber-200',
  concluido: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  entregue: 'bg-slate-100 text-slate-700 border-slate-200',
  cancelado: 'bg-rose-50 text-rose-700 border-rose-200',
};

const brl = (value: number) =>
  `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const initialsOf = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'C';

export const ClientsModule: React.FC = () => {
  const {
    clients,
    motorcycles,
    orders,
    createClient,
    updateClient,
    deleteClient,
    createMotorcycle,
    updateMotorcycle,
    deleteMotorcycle,
    setSelectedOrderId,
  } = useApp();

  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('az');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [detailsClient, setDetailsClient] = useState<Client | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicles, setVehicles] = useState<VehicleDraft[]>([]);
  const [formError, setFormError] = useState('');

  const motosOf = (clientId: string) => motorcycles.filter(m => m.clientId === clientId);
  const ordersOf = (clientId: string) => orders.filter(o => o.clientId === clientId);

  const filteredClients = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = clients.filter(client => {
      if (!q) return true;
      const motos = motorcycles.filter(m => m.clientId === client.id);
      return (
        client.name.toLowerCase().includes(q) ||
        client.phone.toLowerCase().includes(q) ||
        motos.some(m => m.plate.toLowerCase().includes(q) || m.model.toLowerCase().includes(q))
      );
    });

    return [...list].sort((a, b) => {
      if (sortMode === 'az') return a.name.localeCompare(b.name, 'pt-BR');
      if (sortMode === 'za') return b.name.localeCompare(a.name, 'pt-BR');
      const aDate = new Date(a.lastVisitDate || a.createdAt).getTime();
      const bDate = new Date(b.lastVisitDate || b.createdAt).getTime();
      return bDate - aDate;
    });
  }, [clients, motorcycles, search, sortMode]);

  const openCreate = () => {
    setEditingClient(null);
    setName('');
    setPhone('');
    setVehicles([{ model: '', plate: '' }]);
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (client: Client) => {
    setEditingClient(client);
    setName(client.name);
    setPhone(client.phone);
    setVehicles(
      motorcycles
        .filter(m => m.clientId === client.id)
        .map(m => ({ id: m.id, model: m.model, plate: m.plate }))
    );
    setFormError('');
    setFormOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('Informe o nome do cliente.');
      return;
    }
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      setFormError('Informe o telefone do cliente.');
      return;
    }

    const validVehicles = vehicles
      .map(v => ({ id: v.id, model: v.model.trim(), plate: v.plate.trim().toUpperCase() }))
      .filter(v => v.model || v.plate);

    if (validVehicles.some(v => !v.model || !v.plate)) {
      setFormError('Preencha nome e placa de cada veículo.');
      return;
    }

    const phoneDigits = trimmedPhone.replace(/\D/g, '');

    if (editingClient) {
      updateClient(editingClient.id, {
        name: trimmedName,
        phone: trimmedPhone,
        whatsapp: phoneDigits || editingClient.whatsapp,
      });

      // Veículos removidos do formulário precisam sair do cadastro de verdade.
      const keptVehicleIds = new Set(validVehicles.map(v => v.id).filter(Boolean));
      motorcycles
        .filter(m => m.clientId === editingClient.id && !keptVehicleIds.has(m.id))
        .forEach(m => deleteMotorcycle(m.id));

      validVehicles.forEach(vehicle => {
        if (vehicle.id) {
          updateMotorcycle(vehicle.id, { model: vehicle.model, plate: vehicle.plate });
        } else {
          createMotorcycle({
            clientId: editingClient.id,
            clientName: trimmedName,
            brand: 'Outro',
            model: vehicle.model,
            plate: vehicle.plate,
            color: 'Não informado',
            cc: 0,
            year: new Date().getFullYear(),
            category: 'Outro',
            isManualEntry: true,
          });
        }
      });
    } else {
      const created = createClient({
        name: trimmedName,
        phone: trimmedPhone,
        whatsapp: phoneDigits,
        email: `${trimmedName.toLowerCase().replace(/\s+/g, '.')}@email.com`,
        document: '',
        address: '',
        notes: '',
      });

      validVehicles.forEach(vehicle => {
        createMotorcycle({
          clientId: created.id,
          clientName: created.name,
          brand: 'Outro',
          model: vehicle.model,
          plate: vehicle.plate,
          color: 'Não informado',
          cc: 0,
          year: new Date().getFullYear(),
          category: 'Outro',
          isManualEntry: true,
        });
      });
    }

    setFormOpen(false);
    setEditingClient(null);
  };

  const confirmDelete = () => {
    if (!deletingClient) return;
    deleteClient(deletingClient.id);
    setDeletingClient(null);
    setDetailsClient(null);
  };

  const exportHistory = (client: Client) => {
    const clientOrders = ordersOf(client.id);
    const rows = clientOrders
      .map(order => {
        const services = order.services.map(s => s.serviceName).join(', ') || '-';
        return `<tr>
          <td>${formatDateBR(order.entryDateTime)}</td>
          <td>${order.id}</td>
          <td>${STATUS_LABEL[order.status]}</td>
          <td>${services}</td>
          <td style="text-align:right">${brl(order.total)}</td>
        </tr>`;
      })
      .join('');

    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
      <title>Histórico - ${client.name}</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;padding:28px;}
        h1{font-size:18px;margin:0 0 4px;}
        p.meta{font-size:11px;color:#475569;margin:0 0 18px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th{background:#0f172a;color:#fff;text-align:left;padding:6px 8px;}
        td{border-bottom:1px solid #e2e8f0;padding:6px 8px;}
      </style></head><body>
      <h1>Histórico de Ordens de Serviço</h1>
      <p class="meta">${client.name} · ${client.phone} · ${clientOrders.length} ordem(ns)</p>
      <table><thead><tr><th>Data</th><th>OS</th><th>Status</th><th>Serviços</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5">Nenhuma ordem registrada.</td></tr>'}</tbody></table>
      </body></html>`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      void alertDialog('Permita pop-ups para exportar o histórico em PDF.', {
        title: 'Pop-ups bloqueados'
      });
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-5 min-w-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="flex items-stretch gap-2.5 min-w-0">
          <span className="w-1.5 rounded-full bg-[#EA580C] shrink-0" />
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Clientes</h1>
            <p className="text-xs text-slate-500 mt-1.5">
              Gerencie os relacionamentos e cadastros dos clientes da sua estética automotiva
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="shrink-0 min-h-[42px] px-4 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-extrabold text-sm flex items-center gap-1.5 shadow-2xs transition whitespace-nowrap"
        >
          <Plus className="w-4 h-4 shrink-0 stroke-[3]" />
          <span>Novo Cliente</span>
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <div className="relative flex-1 min-w-[200px] sm:max-w-[300px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Digite nome, telefone ou placa..."
            className="w-full min-h-[40px] bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden"
          />
        </div>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1">
            {([
              { id: 'az' as SortMode, label: 'A-Z' },
              { id: 'za' as SortMode, label: 'Z-A' },
              { id: 'recentes' as SortMode, label: 'Mais Recentes' },
            ]).map(option => (
              <button
                key={option.id}
                type="button"
                onClick={() => setSortMode(option.id)}
                className={`min-h-[34px] px-3 rounded-lg text-[11px] font-bold whitespace-nowrap transition ${
                  sortMode === option.id
                    ? 'bg-[#FFEDD5] text-[#9A3412] border border-[#EA580C]'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

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

      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {filteredClients.length} {filteredClients.length === 1 ? 'cliente' : 'clientes'}
      </p>

      {/* Cards */}
      {filteredClients.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 py-16 px-6 flex flex-col items-center justify-center text-center">
          <p className="text-sm font-extrabold text-slate-900">Nenhum cliente encontrado.</p>
          <p className="text-xs text-slate-500 mt-1">Ajuste a busca ou cadastre um novo cliente.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5 min-w-0 pk-stagger">
          {filteredClients.map(client => {
            const motos = motosOf(client.id);
            const clientOrders = ordersOf(client.id);

            return (
              <article
                key={client.id}
                className="relative bg-white rounded-xl border border-slate-200/80 shadow-xs pl-3 pr-3.5 py-3 flex flex-col gap-2.5 min-w-0 overflow-hidden"
              >
                <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#EA580C]" aria-hidden="true" />

                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{client.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{client.phone}</p>
                  </div>
                </div>

                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Veículos</p>
                  <div className="mt-1 space-y-1">
                    {motos.length === 0 ? (
                      <p className="text-[11px] text-slate-400">Nenhum veículo</p>
                    ) : (
                      motos.map(moto => (
                        <div key={moto.id} className="flex items-center justify-between gap-2 min-w-0">
                          <span className="flex items-center gap-1.5 text-[11px] text-slate-700 min-w-0">
                            <Bike className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{moto.model}</span>
                          </span>
                          <span className="shrink-0 rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[9.5px] font-bold text-slate-700 tracking-wide">
                            {moto.plate}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Serviços</p>
                    <p className="text-sm font-bold text-slate-900 leading-tight">{clientOrders.length}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Total gasto</p>
                    <p className="text-sm font-black text-emerald-600 leading-tight">{brl(client.totalSpent)}</p>
                  </div>
                </div>

                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Última visita</p>
                  <p className="text-[11px] font-semibold text-slate-700">
                    {client.lastVisitDate ? formatDateBR(client.lastVisitDate) : 'Sem visita'}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setDetailsClient(client)}
                    className="flex-1 min-h-[34px] rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold flex items-center justify-center gap-1.5 transition"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Ver</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(client)}
                    className="flex-1 min-h-[34px] rounded-lg border border-[#EA580C] bg-[#FFEDD5] hover:bg-[#FFEDD5] text-[#9A3412] text-[11px] font-bold flex items-center justify-center gap-1.5 transition"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingClient(client)}
                    aria-label={`Excluir ${client.name}`}
                    className="shrink-0 w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 text-rose-500 flex items-center justify-center transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
          {filteredClients.map(client => (
            <div
              key={client.id}
              className="flex items-center gap-3 px-3.5 py-2.5 border-b border-slate-100 last:border-b-0 min-w-0"
            >
              <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                <User className="w-3.5 h-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 truncate">{client.name}</p>
                <p className="text-[11px] text-slate-500 truncate">
                  {client.phone} · {motosOf(client.id).map(m => m.plate).join(', ') || 'Sem veículo'}
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-600 shrink-0">{brl(client.totalSpent)}</span>
              <button
                type="button"
                onClick={() => setDetailsClient(client)}
                aria-label={`Ver ${client.name}`}
                className="shrink-0 w-8 h-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center transition"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => openEdit(client)}
                aria-label={`Editar ${client.name}`}
                className="shrink-0 w-8 h-8 rounded-lg border border-slate-200 text-[#A16207] hover:bg-[#FFEDD5] flex items-center justify-center transition"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setDeletingClient(client)}
                aria-label={`Excluir ${client.name}`}
                className="shrink-0 w-8 h-8 rounded-lg border border-slate-200 text-rose-500 hover:bg-rose-50 flex items-center justify-center transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Details modal */}
      {detailsClient && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 pk-fade-enter">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Detalhes do cliente"
            className="w-full max-w-[640px] max-h-[90dvh] overflow-y-auto pk-scroll-compact bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 space-y-3"
          >
            <div className="flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-[#EA580C]" aria-hidden="true" />
              <h2 className="text-base font-black text-slate-900 mr-auto">Detalhes do Cliente</h2>
              <button
                type="button"
                onClick={() => setDetailsClient(null)}
                aria-label="Fechar"
                className="w-7 h-7 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
              <span className="w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-500 flex items-center justify-center shrink-0">
                <User className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{detailsClient.name}</p>
                <p className="text-[11px] text-slate-500 truncate">{detailsClient.phone}</p>
              </div>
            </div>

            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                Veículos ({motosOf(detailsClient.id).length})
              </p>
              <div className="mt-1 space-y-1">
                {motosOf(detailsClient.id).map(moto => (
                  <div
                    key={moto.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5"
                  >
                    <span className="flex items-center gap-1.5 text-[11.5px] text-slate-700 min-w-0">
                      <Bike className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{moto.model}</span>
                    </span>
                    <span className="shrink-0 rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[9.5px] font-bold text-slate-700">
                      {moto.plate}
                    </span>
                  </div>
                ))}
                {motosOf(detailsClient.id).length === 0 && (
                  <p className="text-[11px] text-slate-400">Nenhum veículo cadastrado.</p>
                )}
              </div>
            </div>

            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Resumo</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-slate-200 px-2.5 py-2">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Total gasto</p>
                  <p className="text-xs font-black text-emerald-600">{brl(detailsClient.totalSpent)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 px-2.5 py-2">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Serviços</p>
                  <p className="text-xs font-bold text-slate-900">{ordersOf(detailsClient.id).length}</p>
                </div>
                <div className="rounded-lg border border-slate-200 px-2.5 py-2">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Última visita</p>
                  <p className="text-xs font-bold text-slate-900">
                    {detailsClient.lastVisitDate ? formatDateBR(detailsClient.lastVisitDate) : '-'}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  Histórico de Ordens de Serviço
                </p>
                <button
                  type="button"
                  onClick={() => exportHistory(detailsClient)}
                  className="min-h-[30px] px-2.5 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-[10.5px] font-extrabold flex items-center gap-1 transition"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Exportar histórico (PDF)</span>
                </button>
              </div>

              <div className="space-y-1.5">
                {ordersOf(detailsClient.id).length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 py-4 text-center">
                    <p className="text-[11px] text-slate-400">Nenhuma ordem registrada.</p>
                  </div>
                ) : (
                  ordersOf(detailsClient.id).map(order => (
                    <div key={order.id} className="rounded-lg border border-slate-200 px-2.5 py-2 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] font-semibold text-slate-700">
                          {formatDateBR(order.entryDateTime)}
                        </p>
                        <button
                          type="button"
                          onClick={() => setSelectedOrderId(order.id)}
                          aria-label={`Abrir OS ${order.id}`}
                          className="ml-auto w-6 h-6 rounded-md text-slate-500 hover:bg-slate-100 flex items-center justify-center"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-[9.5px] font-bold ${STATUS_PILL[order.status]}`}
                        >
                          {STATUS_LABEL[order.status]}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 flex-wrap">
                        {order.services.slice(0, 3).map(service => (
                          <span
                            key={`${order.id}_${service.serviceId}`}
                            className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9.5px] text-slate-600"
                          >
                            {service.serviceName}
                          </span>
                        ))}
                        {order.services.length > 3 && (
                          <span className="text-[9.5px] text-slate-400">
                            + outros {order.services.length - 3}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] font-black text-slate-900 font-mono">{brl(order.total)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setDetailsClient(null)}
              className="w-full min-h-[38px] rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      <ResponsiveModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingClient ? 'Editar Cliente' : 'Novo Cliente'}
        headerClassName="border-l-4 border-l-[#EA580C]"
        maxWidth="md"
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
              placeholder="Nome do cliente"
              className="w-full min-h-[40px] bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Telefone</label>
            <input
              type="tel"
              value={phone}
              onChange={e => {
                setPhone(formatPhoneBR(e.target.value));
                setFormError('');
              }}
              placeholder="(00) 00000-0000"
              className="w-full min-h-[40px] bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] font-semibold text-slate-600">Veículos</label>
              <button
                type="button"
                onClick={() => setVehicles(prev => [...prev, { model: '', plate: '' }])}
                className="min-h-[30px] px-2.5 rounded-lg border border-[#EA580C] bg-[#FFEDD5] hover:bg-[#FFEDD5] text-[#9A3412] text-[10.5px] font-bold flex items-center gap-1 transition"
              >
                <Plus className="w-3 h-3 stroke-[3]" />
                <span>Adicionar</span>
              </button>
            </div>

            <div className="space-y-3">
              {vehicles.map((vehicle, index) => (
                <div key={vehicle.id || `new_vehicle_${index}`} className="rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Veículo {index + 1}
                    </p>
                    <button
                      type="button"
                      onClick={() => setVehicles(prev => prev.filter((_, i) => i !== index))}
                      aria-label={`Remover veículo ${index + 1}`}
                      className="w-6 h-6 rounded-md text-rose-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={vehicle.model}
                      onChange={e => {
                        const value = e.target.value;
                        setVehicles(prev => prev.map((v, i) => (i === index ? { ...v, model: value } : v)));
                        setFormError('');
                      }}
                      placeholder="Modelo"
                      className="flex-1 min-w-0 min-h-[36px] bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden"
                    />
                    <input
                      type="text"
                      value={vehicle.plate}
                      onChange={e => {
                        const value = e.target.value.toUpperCase().slice(0, 8);
                        setVehicles(prev => prev.map((v, i) => (i === index ? { ...v, plate: value } : v)));
                        setFormError('');
                      }}
                      placeholder="Placa"
                      className="w-[90px] shrink-0 min-h-[36px] bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold tracking-wide text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden"
                    />
                  </div>
                </div>
              ))}
              {vehicles.length === 0 && (
                <p className="text-[11px] text-slate-400">Nenhum veículo adicionado.</p>
              )}
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
              className="min-h-[38px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="min-h-[38px] px-5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-extrabold transition"
            >
              Salvar
            </button>
          </div>
        </form>
      </ResponsiveModal>

      {/* Delete confirmation */}
      {deletingClient && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 pk-fade-enter">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Excluir cliente"
            className="w-full max-w-[460px] bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-black text-slate-900">Excluir Cliente</h2>
              <button
                type="button"
                onClick={() => setDeletingClient(null)}
                aria-label="Fechar"
                className="w-7 h-7 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Você tem certeza que deseja excluir este Cliente? Esta ação é irreversível e pode impactar
              diretamente outras áreas do sistema, como: Ordens de Serviço, Orçamentos, Agendamentos, Finanças e
              Relatórios. A exclusão só deve ser feita em casos de erro no cadastro.{' '}
              <span className="font-bold text-rose-600">Esta ação é irreversível.</span>
            </p>

            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-rose-700 leading-snug">
                Se você não tiver certeza do que está fazendo, é altamente recomendado cancelar essa ação.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeletingClient(null)}
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
