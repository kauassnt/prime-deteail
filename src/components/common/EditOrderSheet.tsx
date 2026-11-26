import React, { useMemo, useRef, useState } from 'react';
import {
  X,
  Bike,
  Phone,
  Plus,
  Check,
  Search,
  Percent,
  Camera,
  Image as ImageIcon,
  Link2,
  Save,
  Wallet
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Motorcycle, OSStatus, PaymentMethod, ServiceOrder } from '../../types';
import { getLocalDateKey } from '../../utils/dateUtils';

interface EditOrderSheetProps {
  order: ServiceOrder | null;
  onClose: () => void;
}

interface DraftService {
  serviceId: string;
  serviceName: string;
  price: number;
  estimatedMinutes: number;
  discountPct: number;
}

const STATUS_OPTIONS: { id: Exclude<OSStatus, 'cancelado'>; label: string }[] = [
  { id: 'para_fazer', label: 'Para Fazer' },
  { id: 'em_servico', label: 'Em Serviço' },
  { id: 'concluido', label: 'Concluído' },
  { id: 'entregue', label: 'Entregue' },
];

const METHOD_OPTIONS: { id: PaymentMethod; label: string }[] = [
  { id: 'pix', label: 'PIX' },
  { id: 'dinheiro', label: 'Dinheiro' },
  { id: 'debito', label: 'Cartão de Débito' },
  { id: 'credito', label: 'Cartão de Crédito' },
  { id: 'transferencia', label: 'Transferência' },
];

const brl = (value: number) =>
  `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const initialsOf = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'OS';

const dateInputValue = (iso: string) => {
  const key = getLocalDateKey(iso);
  return key || new Date().toISOString().slice(0, 10);
};

export const EditOrderSheet: React.FC<EditOrderSheetProps> = ({ order, onClose }) => {
  const { services, motorcycles, clients, updateOrder, addPaymentToOrder } = useApp();

  const [vehicleId, setVehicleId] = useState(order?.motorcycleId || '');
  const [vehicleLabel, setVehicleLabel] = useState(
    order ? `${order.motorcycleBrand} ${order.motorcycleModel}`.trim() : ''
  );
  const [vehiclePlate, setVehiclePlate] = useState(order?.motorcyclePlate || '');
  const [status, setStatus] = useState<Exclude<OSStatus, 'cancelado'>>(
    order && order.status !== 'cancelado' ? order.status : 'para_fazer'
  );
  const [entryDate, setEntryDate] = useState(order ? dateInputValue(order.entryDateTime) : getLocalDateKey(new Date().toISOString()));
  const [draftServices, setDraftServices] = useState<DraftService[]>(
    order
      ? order.services.map(service => ({
          serviceId: service.serviceId,
          serviceName: service.serviceName,
          price: service.price,
          estimatedMinutes: service.estimatedMinutes,
          discountPct: 0,
        }))
      : []
  );
  const [serviceQuery, setServiceQuery] = useState('');
  const [generalDiscountPct, setGeneralDiscountPct] = useState(
    order && order.subtotal > 0 ? Number(((order.discount / order.subtotal) * 100).toFixed(2)) : 0
  );
  const [photos, setPhotos] = useState<string[]>(order?.photosBefore || []);
  const [includePhotosInPdf, setIncludePhotosInPdf] = useState(order?.includePhotosInPdf ?? true);
  const [checklistItems, setChecklistItems] = useState<string[]>(order?.checklist?.accessoriesLeft || []);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [notes, setNotes] = useState(order?.notes || '');
  const [showNewVehicle, setShowNewVehicle] = useState(false);
  const [newVehicleModel, setNewVehicleModel] = useState('');
  const [newVehiclePlate, setNewVehiclePlate] = useState('');
  const [newVehicles, setNewVehicles] = useState<{ id: string; label: string; plate: string }[]>([]);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [paymentDate, setPaymentDate] = useState(getLocalDateKey(new Date().toISOString()));
  const [paymentError, setPaymentError] = useState('');

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const clientMotorcycles = useMemo<Motorcycle[]>(() => {
    if (!order) return [];
    const list = motorcycles.filter(moto => moto.clientId === order.clientId);
    if (order.motorcyclePlate && !list.some(moto => moto.plate === order.motorcyclePlate)) {
      list.unshift({
        id: order.motorcycleId,
        clientId: order.clientId,
        brand: order.motorcycleBrand,
        model: order.motorcycleModel,
        plate: order.motorcyclePlate,
        color: '',
        cc: 0,
        year: order.motorcycleYear || 0,
      });
    }
    return list;
  }, [motorcycles, order]);

  const subtotal = draftServices.reduce((sum, service) => sum + service.price, 0);
  const discount = Number(((subtotal * generalDiscountPct) / 100).toFixed(2));
  const total = Math.max(0, subtotal - discount);

  const alreadyPaid = order?.amountPaid || 0;
  const savedPending = order?.pendingBalance ?? Math.max(0, (order?.total || 0) - alreadyPaid);

  const filteredServices = useMemo(() => {
    const q = serviceQuery.trim().toLowerCase();
    if (!q) return [];
    return services
      .filter(service => service.active !== false && service.name.toLowerCase().includes(q))
      .filter(service => !draftServices.some(item => item.serviceId === service.id))
      .slice(0, 6);
  }, [serviceQuery, services, draftServices]);

  if (!order) return null;

  const client = clients.find(c => c.id === order.clientId);
  const clientPhone = client?.phone || order.clientPhone;

  const selectVehicle = (moto: Motorcycle) => {
    setVehicleId(moto.id);
    setVehicleLabel(`${moto.brand} ${moto.model}`.trim());
    setVehiclePlate(moto.plate);
  };

  const selectNewVehicle = (id: string, label: string, plate: string) => {
    setVehicleId(id);
    setVehicleLabel(label);
    setVehiclePlate(plate);
  };

  const handleAddNewVehicle = () => {
    const model = newVehicleModel.trim();
    const plate = newVehiclePlate.trim().toUpperCase();
    if (!model || !plate) return;
    const id = `local_${Date.now()}`;
    setNewVehicles(prev => [...prev, { id, label: model, plate }]);
    selectNewVehicle(id, model, plate);
    setNewVehicleModel('');
    setNewVehiclePlate('');
    setShowNewVehicle(false);
  };

  const addService = (serviceId: string) => {
    const service = services.find(item => item.id === serviceId);
    if (!service) return;
    setDraftServices(prev => [
      ...prev,
      {
        serviceId: service.id,
        serviceName: service.name,
        price: service.price,
        estimatedMinutes: service.estimatedMinutes,
        discountPct: 0,
      },
    ]);
    setServiceQuery('');
  };

  const updateService = (index: number, patch: Partial<DraftService>) => {
    setDraftServices(prev => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const removeService = (index: number) => {
    setDraftServices(prev => prev.filter((_, i) => i !== index));
  };

  const handlePhotoFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).slice(0, 6).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        if (result) setPhotos(prev => [...prev, result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const addChecklistItem = () => {
    const value = newChecklistItem.trim();
    if (!value) return;
    setChecklistItems(prev => [...prev, value]);
    setNewChecklistItem('');
  };

  const handleSave = () => {
    updateOrder(order.id, {
      motorcycleId: vehicleId,
      motorcycleBrand: vehicleLabel.split(' ')[0] || order.motorcycleBrand,
      motorcycleModel: vehicleLabel.split(' ').slice(1).join(' ') || vehicleLabel || order.motorcycleModel,
      motorcyclePlate: vehiclePlate,
      status,
      entryDateTime: `${entryDate}T${(order.entryDateTime.split('T')[1] || '09:00:00').slice(0, 8)}`,
      services: draftServices.map(service => ({
        serviceId: service.serviceId,
        serviceName: service.serviceName,
        price: Number(((service.price * (100 - service.discountPct)) / 100).toFixed(2)),
        estimatedMinutes: service.estimatedMinutes,
      })),
      subtotal,
      discount,
      total,
      pendingBalance: Math.max(0, total - alreadyPaid),
      paymentStatus: alreadyPaid >= total && total > 0 ? 'pago' : alreadyPaid > 0 ? 'parcial' : 'pendente',
      photosBefore: photos,
      includePhotosInPdf,
      checklist: {
        ...order.checklist,
        accessoriesLeft: checklistItems,
      },
      notes,
    });
    onClose();
  };

  const openPayment = () => {
    setPaymentAmount(savedPending);
    setPaymentError('');
    setPaymentMethod('');
    setPaymentDate(getLocalDateKey(new Date().toISOString()));
    setPaymentOpen(true);
  };

  const confirmPayment = () => {
    if (!paymentMethod) {
      setPaymentError('Selecione a forma de pagamento.');
      return;
    }
    if (!paymentAmount || paymentAmount <= 0) {
      setPaymentError('Informe um valor recebido maior que zero.');
      return;
    }
    const todayKey = getLocalDateKey(new Date().toISOString());
    const noteParts = [`Recebido em ${paymentDate.split('-').reverse().join('/')}`];
    if (paymentDate !== todayKey) noteParts.push('data informada manualmente');
    addPaymentToOrder(
      order.id,
      paymentAmount,
      paymentMethod,
      noteParts.join(' · '),
      new Date(`${paymentDate}T12:00:00`).toISOString()
    );
    setPaymentOpen(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs pk-fade-enter">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Editar Ordem de Serviço"
        className="w-full sm:max-w-[520px] h-full sm:h-auto sm:max-h-[92dvh] bg-white sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="relative flex items-center justify-center px-4 py-3 border-b border-slate-100 shrink-0">
          <h2 className="text-[15px] font-extrabold text-slate-900">Editar Ordem de Serviço</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-3.5">
          {/* Client */}
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 text-[11px] font-black flex items-center justify-center shrink-0">
              {initialsOf(order.clientName)}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{order.clientName}</p>
              <p className="text-[11px] text-slate-500 flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {clientPhone}
              </p>
            </div>
          </div>

          {/* Vehicle */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">Selecione o veículo</p>
              <button
                type="button"
                onClick={() => setShowNewVehicle(prev => !prev)}
                className="min-h-[30px] px-2.5 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-[10.5px] font-extrabold flex items-center gap-1 transition"
              >
                <Plus className="w-3 h-3 stroke-[3]" />
                <span>Novo Veículo</span>
              </button>
            </div>

            {showNewVehicle && (
              <div className="rounded-xl border border-[#EA580C] bg-[#FFEDD5]/40 p-2 space-y-1.5">
                <input
                  type="text"
                  value={newVehicleModel}
                  onChange={e => setNewVehicleModel(e.target.value)}
                  placeholder="Modelo (ex.: Honda CG 160)"
                  className="w-full min-h-[34px] rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-800 focus:border-[#EA580C] focus:outline-hidden"
                />
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newVehiclePlate}
                    onChange={e => setNewVehiclePlate(e.target.value)}
                    placeholder="Placa"
                    className="w-[120px] min-h-[34px] rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold uppercase text-slate-800 focus:border-[#EA580C] focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={handleAddNewVehicle}
                    className="min-h-[34px] px-3 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-[11px] font-extrabold transition"
                  >
                    Adicionar
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              {[...clientMotorcycles.map(moto => ({
                id: moto.id,
                label: `${moto.brand} ${moto.model}`.trim(),
                plate: moto.plate,
              })), ...newVehicles].map(vehicle => {
                const selected = vehicle.id === vehicleId;
                return (
                  <button
                    key={vehicle.id}
                    type="button"
                    onClick={() => selectNewVehicle(vehicle.id, vehicle.label, vehicle.plate)}
                    className={`w-full flex items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition ${
                      selected
                        ? 'border-[#EA580C] bg-[#FFEDD5]/60'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <Bike className="w-4 h-4 text-slate-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">{vehicle.label}</p>
                      <p className="text-[10px] font-semibold text-slate-500 tracking-wide uppercase">
                        {vehicle.plate}
                      </p>
                    </div>
                    {selected && <Check className="w-4 h-4 text-[#A16207] shrink-0" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status + Date */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1" htmlFor="os-status">
                Status
              </label>
              <select
                id="os-status"
                value={status}
                onChange={e => setStatus(e.target.value as Exclude<OSStatus, 'cancelado'>)}
                className="w-full min-h-[38px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 focus:border-[#EA580C] focus:outline-hidden"
              >
                {STATUS_OPTIONS.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1" htmlFor="os-date">
                Data
              </label>
              <input
                id="os-date"
                type="date"
                value={entryDate}
                onChange={e => setEntryDate(e.target.value || entryDate)}
                className="w-full min-h-[38px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 focus:border-[#EA580C] focus:outline-hidden"
              />
            </div>
          </div>

          {/* Services */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-slate-700">Serviços</p>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={serviceQuery}
                onChange={e => setServiceQuery(e.target.value)}
                placeholder="Buscar serviço..."
                aria-label="Buscar serviço"
                className="w-full min-h-[36px] rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 text-[11px] font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden"
              />
              {filteredServices.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-10 rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden">
                  {filteredServices.map(service => (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => addService(service.id)}
                      className="w-full flex items-center justify-between gap-2 px-2.5 py-2 text-left hover:bg-[#FFEDD5]/50 transition border-b border-slate-100 last:border-b-0"
                    >
                      <span className="text-[11px] font-semibold text-slate-800 truncate">{service.name}</span>
                      <span className="text-[11px] font-mono font-bold text-slate-600 shrink-0">{brl(service.price)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {draftServices.length === 0 && (
              <p className="text-[10.5px] text-slate-400 text-center py-3">Nenhum serviço adicionado.</p>
            )}

            <div className="space-y-1.5">
              {draftServices.map((service, index) => (
                <div
                  key={`${service.serviceId}-${index}`}
                  className="rounded-lg border border-[#EA580C] bg-[#FFEDD5]/35 px-2 py-1.5"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[11px] font-semibold text-slate-800 truncate flex-1 min-w-0">
                      {service.serviceName}
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={service.price}
                      onChange={e => updateService(index, { price: Number(e.target.value) || 0 })}
                      aria-label={`Valor de ${service.serviceName}`}
                      className="w-[74px] shrink-0 min-h-[30px] rounded-md border border-[#EA580C] bg-white px-1.5 text-[11px] font-mono font-semibold text-slate-800 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        updateService(index, {
                          discountPct: service.discountPct > 0 ? 0 : 10,
                        })
                      }
                      aria-label={`Desconto de ${service.serviceName}`}
                      title="Desconto (%)"
                      className={`w-7 h-7 shrink-0 rounded-md border flex items-center justify-center transition ${
                        service.discountPct > 0
                          ? 'border-[#EA580C] bg-[#EA580C] text-white'
                          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <Percent className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeService(index)}
                      aria-label={`Remover ${service.serviceName}`}
                      className="w-7 h-7 shrink-0 rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 flex items-center justify-center transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  {service.discountPct > 0 && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[9.5px] font-semibold text-slate-500">Desconto deste serviço</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="1"
                        value={service.discountPct}
                        onChange={e =>
                          updateService(index, { discountPct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })
                        }
                        aria-label={`Percentual de desconto de ${service.serviceName}`}
                        className="w-[52px] min-h-[26px] rounded-md border border-slate-200 bg-white px-1 text-[10.5px] font-semibold text-slate-800 focus:border-[#EA580C] focus:outline-hidden"
                      />
                      <span className="text-[9.5px] text-slate-500">%</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="pt-1.5 border-t border-slate-200 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">Subtotal</span>
                <span className="text-[11px] font-semibold text-slate-700 font-mono">{brl(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">Desconto geral (%)</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.5"
                    value={generalDiscountPct}
                    onChange={e =>
                      setGeneralDiscountPct(Math.min(100, Math.max(0, Number(e.target.value) || 0)))
                    }
                    aria-label="Desconto geral em porcentagem"
                    className="w-[64px] min-h-[28px] rounded-md border border-slate-200 bg-white px-1.5 text-[11px] text-right font-semibold text-slate-800 focus:border-[#EA580C] focus:outline-hidden"
                  />
                  <span className="text-[10.5px] text-slate-500">%</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className="text-[11.5px] font-bold text-slate-800">Total</span>
                <span className="text-sm font-black text-slate-900 font-mono">{brl(total)}</span>
              </div>
            </div>
          </div>

          {/* Photos */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                Fotos ({photos.length})
              </p>
              <div className="flex items-center gap-1.5">
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={e => handlePhotoFiles(e.target.files)}
                  className="hidden"
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={e => handlePhotoFiles(e.target.files)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="min-h-[28px] px-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-[10px] font-semibold flex items-center gap-1 transition"
                >
                  <Camera className="w-3 h-3" /> Câmera
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="min-h-[28px] px-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-[10px] font-semibold flex items-center gap-1 transition"
                >
                  <ImageIcon className="w-3 h-3" /> Galeria
                </button>
              </div>
            </div>

            {photos.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {photos.map((photo, index) => (
                  <div key={`${photo.slice(-12)}-${index}`} className="relative">
                    <img
                      src={photo}
                      alt={`Foto ${index + 1}`}
                      loading="lazy"
                      decoding="async"
                      className="w-12 h-12 rounded-lg object-cover border border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => setPhotos(prev => prev.filter((_, i) => i !== index))}
                      aria-label={`Remover foto ${index + 1}`}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white border border-slate-200 text-slate-500 flex items-center justify-center"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <label className="flex items-center gap-1.5 text-[10.5px] text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={includePhotosInPdf}
                onChange={e => setIncludePhotosInPdf(e.target.checked)}
                className="w-3.5 h-3.5 accent-[#EA580C]"
              />
              <span>Adicionar fotos no PDF</span>
            </label>
          </div>

          {/* Checklist */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-slate-400" />
              Checklist de Avarias ({checklistItems.length})
            </p>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={newChecklistItem}
                onChange={e => setNewChecklistItem(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addChecklistItem();
                  }
                }}
                placeholder="Novo item..."
                className="flex-1 min-h-[34px] rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden"
              />
              <button
                type="button"
                onClick={addChecklistItem}
                aria-label="Adicionar item ao checklist"
                className="w-9 h-9 shrink-0 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white flex items-center justify-center transition"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
              </button>
            </div>
            {checklistItems.length > 0 && (
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                {checklistItems.map((item, index) => (
                  <div
                    key={`${item}-${index}`}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-slate-100 last:border-b-0"
                  >
                    <span className="text-[10.5px] text-slate-700 truncate">{item}</span>
                    <button
                      type="button"
                      onClick={() => setChecklistItems(prev => prev.filter((_, i) => i !== index))}
                      aria-label={`Remover ${item}`}
                      className="text-slate-400 hover:text-slate-700 shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1" htmlFor="os-notes">
              Observações
            </label>
            <textarea
              id="os-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Observações..."
              rows={3}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden resize-y"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-100 px-4 py-2.5 bg-white flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            onClick={openPayment}
            className="min-h-[32px] px-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 text-[10.5px] font-semibold flex items-center gap-1.5 transition"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Registrar recebimento</span>
          </button>
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[32px] px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-[10.5px] font-semibold transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="min-h-[32px] px-3.5 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-[10.5px] font-extrabold flex items-center gap-1.5 transition"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Salvar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Payment modal */}
      {paymentOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 pk-fade-enter">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Registrar recebimento"
            className="w-full max-w-[400px] bg-white rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="relative flex items-center justify-center px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-extrabold text-slate-900">Registrar recebimento</h3>
              <button
                type="button"
                onClick={() => setPaymentOpen(false)}
                aria-label="Fechar"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 space-y-1">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-500">Total da OS</span>
                  <span className="font-semibold text-slate-800 font-mono">{brl(order.total)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-500">Já recebido</span>
                  <span className="font-semibold text-slate-800 font-mono">{brl(alreadyPaid)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-[11px] pt-1 border-t border-slate-200">
                  <span className="font-bold text-slate-700">A receber</span>
                  <span className="font-black text-slate-900 font-mono">{brl(savedPending)}</span>
                </div>
              </div>

              <div>
                <label className="block text-[9.5px] font-bold uppercase tracking-wider text-slate-400 mb-1" htmlFor="pay-amount">
                  Valor recebido
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-500">R$</span>
                  <input
                    id="pay-amount"
                    type="number"
                    min={0}
                    step="0.01"
                    value={paymentAmount}
                    onChange={e => {
                      setPaymentAmount(Number(e.target.value) || 0);
                      setPaymentError('');
                    }}
                    className="w-full min-h-[38px] rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 text-xs font-semibold text-slate-800 focus:border-[#EA580C] focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9.5px] font-bold uppercase tracking-wider text-slate-400 mb-1" htmlFor="pay-method">
                  Forma de pagamento
                </label>
                <select
                  id="pay-method"
                  value={paymentMethod}
                  onChange={e => {
                    setPaymentMethod(e.target.value as PaymentMethod);
                    setPaymentError('');
                  }}
                  className="w-full min-h-[38px] rounded-lg border border-[#EA580C] bg-white px-2.5 text-xs font-medium text-slate-800 focus:outline-hidden"
                >
                  <option value="">Selecione</option>
                  {METHOD_OPTIONS.map(option => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[9.5px] font-bold uppercase tracking-wider text-slate-400 mb-1" htmlFor="pay-date">
                  Data do recebimento
                </label>
                <input
                  id="pay-date"
                  type="date"
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value || paymentDate)}
                  className="w-full min-h-[38px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 focus:border-[#EA580C] focus:outline-hidden"
                />
              </div>

              {paymentError && (
                <p className="text-[10.5px] font-semibold text-rose-600">{paymentError}</p>
              )}

              <div className="flex items-center justify-end gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setPaymentOpen(false)}
                  className="min-h-[34px] px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-[11px] font-semibold transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmPayment}
                  className="min-h-[34px] px-3 rounded-lg bg-[#C2410C] hover:bg-[#EA580C] text-white text-[11px] font-extrabold transition"
                >
                  Confirmar recebimento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
