import React, { useMemo, useState } from 'react';
import {
  X,
  Search,
  Plus,
  Check,
  ChevronLeft,
  Camera,
  Image as ImageIcon,
  Percent,
  CalendarDays
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getLocalDateKey } from '../../utils/dateUtils';
import { DEFAULT_WASH_DURATION_MINUTES } from '../../utils/schedulingUtils';

interface NewAppointmentWizardProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string;
}

const STEPS = ['Cliente', 'Serviços', 'Checklist', 'Fotos', 'Data/Hora', 'Resumo'] as const;

const CHECKLIST_GROUPS: { title: string; items: string[] }[] = [
  {
    title: 'EXTERIOR',
    items: ['Amassados', 'Arranhões na lataria', 'Risco no para-choque', 'Mancha na pintura'],
  },
  {
    title: 'INTERIOR',
    items: ['Manchas no estofado', 'Painel riscado', 'Falta de peça/acessório'],
  },
  {
    title: 'RODAS',
    items: ['Pneus desgastados', 'Roda amassada'],
  },
  {
    title: 'VIDROS',
    items: ['Vidros trincados', 'Vidro quebrado'],
  },
];

const brl = (value: number) =>
  `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatLongDate = (dateKey: string) => {
  if (!dateKey) return '';
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

export const NewAppointmentWizard: React.FC<NewAppointmentWizardProps> = ({ isOpen, onClose, initialDate }) => {
  const {
    clients,
    motorcycles,
    services,
    users,
    appointments,
    portalConfig,
    createClient,
    createService,
    createAppointment,
  } = useApp();

  const [step, setStep] = useState(1);
  const [clientQuery, setClientQuery] = useState('');
  const [clientId, setClientId] = useState('');
  const [motoId, setMotoId] = useState('');
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');

  const [serviceQuery, setServiceQuery] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [servicePrices, setServicePrices] = useState<Record<string, number>>({});
  const [serviceDiscounts, setServiceDiscounts] = useState<Record<string, number>>({});
  const [showNewService, setShowNewService] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);

  const [checklist, setChecklist] = useState<string[]>([]);
  const [customDamage, setCustomDamage] = useState('');

  const [photos, setPhotos] = useState<string[]>([]);
  const [includePhotosInPdf, setIncludePhotosInPdf] = useState(true);

  const [date, setDate] = useState(initialDate || getLocalDateKey(new Date().toISOString()));
  const [time, setTime] = useState('09:00');

  const [error, setError] = useState('');

  const selectedClient = clients.find(client => client.id === clientId) || null;
  const clientMotorcycles = motorcycles.filter(moto => moto.clientId === clientId);
  const selectedMoto = clientMotorcycles.find(moto => moto.id === motoId) || clientMotorcycles[0] || null;

  const filteredClients = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    return clients
      .filter(client => {
        if (!q) return true;
        const plates = motorcycles
          .filter(moto => moto.clientId === client.id)
          .map(moto => moto.plate.toLowerCase());
        return (
          client.name.toLowerCase().includes(q) ||
          client.phone.toLowerCase().includes(q) ||
          client.whatsapp.toLowerCase().includes(q) ||
          plates.some(plate => plate.includes(q))
        );
      })
      .slice(0, 8);
  }, [clients, motorcycles, clientQuery]);

  const filteredServices = useMemo(() => {
    const q = serviceQuery.trim().toLowerCase();
    return services
      .filter(service => service.active !== false)
      .filter(service => !q || service.name.toLowerCase().includes(q))
      .slice(0, 12);
  }, [services, serviceQuery]);

  const selectedServices = services.filter(service => selectedServiceIds.includes(service.id));

  const priceOf = (serviceId: string, fallback: number) => servicePrices[serviceId] ?? fallback;

  const subtotal = selectedServices.reduce((sum, service) => {
    const base = priceOf(service.id, service.price);
    const discount = serviceDiscounts[service.id] || 0;
    return sum + base * (1 - discount / 100);
  }, 0);
  const discount = Number(((subtotal * discountPercent) / 100).toFixed(2));
  const total = Math.max(0, subtotal - discount);

  if (!isOpen) return null;

  const resetAndClose = () => {
    setStep(1);
    setClientQuery('');
    setClientId('');
    setMotoId('');
    setShowNewClient(false);
    setNewClientName('');
    setNewClientPhone('');
    setServiceQuery('');
    setSelectedServiceIds([]);
    setServicePrices({});
    setServiceDiscounts({});
    setShowNewService(false);
    setNewServiceName('');
    setNewServicePrice('');
    setDiscountPercent(0);
    setChecklist([]);
    setCustomDamage('');
    setPhotos([]);
    setTime('09:00');
    setError('');
    onClose();
  };

  const canAdvance = () => {
    if (step === 1) return Boolean(clientId);
    if (step === 2) return selectedServiceIds.length > 0;
    if (step === 5) return Boolean(date && time);
    return true;
  };

  const goNext = () => {
    setError('');
    if (!canAdvance()) {
      if (step === 1) setError('Selecione um cliente para continuar.');
      if (step === 2) setError('Selecione pelo menos um serviço.');
      if (step === 5) setError('Informe data e hora do agendamento.');
      return;
    }
    setStep(prev => Math.min(6, prev + 1));
  };

  const goBack = () => {
    setError('');
    setStep(prev => Math.max(1, prev - 1));
  };

  const handleCreateClient = () => {
    const name = newClientName.trim();
    const phone = newClientPhone.trim();
    if (!name || !phone) {
      setError('Informe nome e telefone do cliente.');
      return;
    }
    const created = createClient({
      name,
      phone,
      whatsapp: phone.replace(/\D/g, ''),
      email: '',
    });
    setClientId(created.id);
    setMotoId('');
    setClientQuery(created.name);
    setNewClientName('');
    setNewClientPhone('');
    setShowNewClient(false);
    setError('');
  };

  const handleCreateService = () => {
    const name = newServiceName.trim();
    const price = Number(newServicePrice.replace(',', '.')) || 0;
    if (!name || price <= 0) {
      setError('Informe nome e valor do serviço.');
      return;
    }
    const created = createService({
      name,
      category: 'Outros Serviços',
      description: '',
      price,
      estimatedMinutes: 60,
      active: true,
      productsUsed: [],
      warrantyDays: 0,
    });
    setSelectedServiceIds(prev => [...prev, created.id]);
    setServicePrices(prev => ({ ...prev, [created.id]: price }));
    setNewServiceName('');
    setNewServicePrice('');
    setShowNewService(false);
    setError('');
  };

  const toggleService = (serviceId: string) => {
    setSelectedServiceIds(prev =>
      prev.includes(serviceId) ? prev.filter(id => id !== serviceId) : [...prev, serviceId]
    );
  };

  const handlePhotoFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files)
      .slice(0, 8)
      .forEach(file => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') setPhotos(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
  };

  const addCustomDamage = () => {
    const value = customDamage.trim();
    if (!value) return;
    setChecklist(prev => [...prev, value]);
    setCustomDamage('');
  };

  const toggleChecklist = (item: string) => {
    setChecklist(prev => (prev.includes(item) ? prev.filter(entry => entry !== item) : [...prev, item]));
  };

  const handleSubmit = () => {
    if (!selectedClient) {
      setError('Selecione um cliente.');
      setStep(1);
      return;
    }

    const employee = users[0];
    const durationMinutes = Math.max(
      DEFAULT_WASH_DURATION_MINUTES,
      selectedServices.reduce((sum, service) => sum + (service.estimatedMinutes || 0), 0)
    );

    const created = createAppointment({
      clientId: selectedClient.id,
      clientName: selectedClient.name,
      clientPhone: selectedClient.phone,
      motorcycleId: selectedMoto?.id,
      motorcyclePlate: selectedMoto?.plate || '',
      motorcycleBrand: selectedMoto?.brand,
      motorcycleModel: selectedMoto ? `${selectedMoto.brand} ${selectedMoto.model}`.trim() : 'Modelo não informado',
      motorcycleVersion: selectedMoto?.version,
      motorcycleYear: selectedMoto?.year,
      serviceIds: selectedServiceIds,
      serviceNames: selectedServices.map(service => service.name),
      assignedEmployeeId: employee?.id || '',
      assignedEmployeeName: employee?.name || 'Equipe',
      date,
      startTime: time,
      endTime: time,
      durationMinutes,
      status: 'agendado',
      photos,
      checklistItems: checklist,
      includePhotosInPdf,
    });

    if (!created) {
      setError('Este horário já está ocupado ou fora do funcionamento. Escolha outro horário.');
      setStep(5);
      return;
    }

    resetAndClose();
  };

  const stepper = (
    <div className="flex items-center justify-between gap-0.5 px-1 pt-1 pb-2">
      {STEPS.map((label, index) => {
        const number = index + 1;
        const done = number < step;
        const active = number === step;
        return (
          <div key={label} className="flex flex-col items-center gap-1 flex-1 min-w-0 relative">
            {index > 0 && (
              <span
                className={`absolute h-[2px] rounded-full ${number <= step ? 'bg-[#EA580C]' : 'bg-slate-200'}`}
                style={{ left: 'calc(-50% + 15px)', width: 'calc(100% - 30px)', top: '13px' }}
                aria-hidden="true"
              />
            )}
            <span
              className={`relative z-10 w-[26px] h-[26px] rounded-full flex items-center justify-center text-[11px] font-black transition ${
                active
                  ? 'bg-[#EA580C] text-white'
                  : done
                    ? 'bg-[#FFEDD5] text-[#A16207] border border-[#EA580C]'
                    : 'bg-slate-100 text-slate-400'
              }`}
            >
              {done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : number}
            </span>
            <span
              className={`text-[8.5px] leading-tight text-center truncate w-full ${
                active ? 'font-extrabold text-slate-900' : done ? 'font-semibold text-[#A16207]' : 'text-slate-400'
              }`}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs pk-fade-enter">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Novo Agendamento"
        className="w-full sm:max-w-[540px] h-full sm:h-auto sm:max-h-[92dvh] bg-white sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="relative flex items-center justify-center px-4 pt-3 pb-1 shrink-0">
          <h2 className="text-[15px] font-extrabold text-slate-900">Novo Agendamento</h2>
          <button
            type="button"
            onClick={resetAndClose}
            aria-label="Fechar"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 shrink-0">{stepper}</div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 pb-3.5 min-w-0">
          {/* STEP 1 — CLIENTE */}
          {step === 1 && (
            <div className="space-y-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={clientQuery}
                  onChange={e => setClientQuery(e.target.value)}
                  placeholder="Buscar cliente pelo nome, telefone ou placa"
                  aria-label="Buscar cliente"
                  className="w-full min-h-[38px] rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 text-[11.5px] font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden"
                />
              </div>

              {!selectedClient && filteredClients.length > 0 && (
                <div className="rounded-lg border border-slate-200 overflow-hidden max-h-[210px] overflow-y-auto">
                  {filteredClients.map(client => {
                    const selected = client.id === clientId;
                    return (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => {
                          setClientId(client.id);
                          setMotoId('');
                          setClientQuery(client.name);
                          setError('');
                        }}
                        className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 text-left border-b border-slate-100 last:border-b-0 transition ${
                          selected ? 'bg-[#FFEDD5]/60' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-[11.5px] font-semibold text-slate-800 truncate">{client.name}</p>
                          <p className="text-[10px] text-slate-500 truncate">{client.phone}</p>
                        </div>
                        {selected && <Check className="w-3.5 h-3.5 text-[#A16207] shrink-0" strokeWidth={3} />}
                      </button>
                    );
                  })}
                </div>
              )}

              {clientQuery.trim() !== '' && filteredClients.length === 0 && !selectedClient && (
                <p className="text-[10.5px] text-slate-400 text-center py-1.5">Nenhum cliente encontrado.</p>
              )}

              {selectedClient && (
                <div className="rounded-lg border border-[#EA580C] bg-[#FFEDD5]/40 px-2.5 py-2">
                  <p className="text-[11px] font-bold text-slate-900 truncate">{selectedClient.name}</p>
                  <p className="text-[10px] text-slate-500">{selectedClient.phone}</p>
                  {clientMotorcycles.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                      {clientMotorcycles.map(moto => {
                        const selected = selectedMoto?.id === moto.id;
                        return (
                          <button
                            key={moto.id}
                            type="button"
                            onClick={() => setMotoId(moto.id)}
                            className={`min-h-[26px] px-2 rounded-md border text-[10px] font-bold transition ${
                              selected
                                ? 'border-[#EA580C] bg-white text-[#9A3412]'
                                : 'border-slate-200 bg-white/70 text-slate-600 hover:bg-white'
                            }`}
                          >
                            {moto.plate} · {moto.brand} {moto.model}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowNewClient(prev => !prev)}
                className="w-full min-h-[38px] rounded-lg border-2 border-dashed border-[#EA580C] bg-[#FFEDD5]/40 hover:bg-[#FFEDD5]/70 text-[#9A3412] text-[11.5px] font-extrabold flex items-center justify-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Cadastrar Novo Cliente</span>
              </button>

              {showNewClient && (
                <div className="rounded-lg border border-[#EA580C] bg-white p-2 space-y-1.5">
                  <input
                    type="text"
                    value={newClientName}
                    onChange={e => setNewClientName(e.target.value)}
                    placeholder="Nome do cliente"
                    className="w-full min-h-[34px] rounded-lg border border-slate-200 px-2.5 text-[11px] font-medium text-slate-800 focus:border-[#EA580C] focus:outline-hidden"
                  />
                  <div className="flex items-center gap-1.5">
                    <input
                      type="tel"
                      value={newClientPhone}
                      onChange={e => setNewClientPhone(e.target.value)}
                      placeholder="Telefone"
                      className="flex-1 min-h-[34px] rounded-lg border border-slate-200 px-2.5 text-[11px] font-medium text-slate-800 focus:border-[#EA580C] focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={handleCreateClient}
                      className="min-h-[34px] px-3 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-[11px] font-extrabold transition"
                    >
                      Cadastrar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2 — SERVIÇOS */}
          {step === 2 && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={serviceQuery}
                  onChange={e => setServiceQuery(e.target.value)}
                  placeholder="Buscar serviço..."
                  aria-label="Buscar serviço"
                  className="w-full min-h-[36px] rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 text-[11.5px] font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden"
                />
              </div>

              <div className="space-y-1.5">
                {filteredServices.map(service => {
                  const selected = selectedServiceIds.includes(service.id);
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => toggleService(service.id)}
                      className={`w-full flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition ${
                        selected
                          ? 'border-[#EA580C] bg-[#FFEDD5]/50'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-[11.5px] font-semibold text-slate-800 truncate">{service.name}</span>
                      <span className="text-[11px] font-mono font-semibold text-slate-600 shrink-0">
                        {brl(service.price)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedServices.length > 0 && (
                <div className="rounded-lg border border-[#EA580C] bg-[#FFEDD5]/40 p-2 space-y-1.5">
                  <p className="text-[9.5px] font-bold text-[#A16207]">Serviços selecionados (edite o valor):</p>
                  {selectedServices.map(service => (
                    <div key={service.id} className="flex items-center gap-1.5">
                      <span className="text-[10.5px] font-semibold text-slate-800 truncate flex-1 min-w-0">
                        {service.name}
                      </span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={priceOf(service.id, service.price)}
                        onChange={e =>
                          setServicePrices(prev => ({ ...prev, [service.id]: Number(e.target.value) || 0 }))
                        }
                        aria-label={`Valor de ${service.name}`}
                        className="w-[72px] shrink-0 min-h-[28px] rounded-md border border-[#EA580C] bg-white px-1.5 text-[10.5px] font-mono font-semibold text-slate-800 focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setServiceDiscounts(prev => ({
                            ...prev,
                            [service.id]: (prev[service.id] || 0) > 0 ? 0 : 10,
                          }))
                        }
                        aria-label={`Desconto de ${service.name}`}
                        className={`w-7 h-7 shrink-0 rounded-md border flex items-center justify-center transition ${
                          (serviceDiscounts[service.id] || 0) > 0
                            ? 'border-[#EA580C] bg-[#EA580C] text-white'
                            : 'border-slate-200 bg-white text-slate-500'
                        }`}
                      >
                        <Percent className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleService(service.id)}
                        aria-label={`Remover ${service.name}`}
                        className="w-7 h-7 shrink-0 rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 flex items-center justify-center transition"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#EA580C]/60">
                    <span className="text-[10.5px] font-bold text-slate-800">Total: {brl(subtotal)}</span>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowNewService(prev => !prev)}
                className="w-full min-h-[36px] rounded-lg border-2 border-dashed border-[#EA580C] bg-[#FFEDD5]/40 hover:bg-[#FFEDD5]/70 text-[#9A3412] text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Cadastrar novo serviço</span>
              </button>

              {showNewService && (
                <div className="rounded-lg border border-[#EA580C] bg-white p-2 flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newServiceName}
                    onChange={e => setNewServiceName(e.target.value)}
                    placeholder="Nome do serviço"
                    className="flex-1 min-w-0 min-h-[34px] rounded-lg border border-slate-200 px-2.5 text-[11px] font-medium text-slate-800 focus:border-[#EA580C] focus:outline-hidden"
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={newServicePrice}
                    onChange={e => setNewServicePrice(e.target.value)}
                    placeholder="Valor"
                    aria-label="Valor do novo serviço"
                    className="w-[78px] shrink-0 min-h-[34px] rounded-lg border border-slate-200 px-2 text-[11px] font-semibold text-slate-800 focus:border-[#EA580C] focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={handleCreateService}
                    className="min-h-[34px] px-2.5 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-[11px] font-extrabold transition"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 3 — CHECKLIST */}
          {step === 3 && (
            <div className="space-y-2.5">
              <p className="text-[13px] font-bold text-slate-900">Checklist de Avarias</p>

              {CHECKLIST_GROUPS.map(group => (
                <div key={group.title} className="space-y-1.5">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{group.title}</p>
                  {group.items.map(item => {
                    const checked = checklist.includes(item);
                    return (
                      <label
                        key={item}
                        className="flex items-center gap-2 text-[11.5px] text-slate-700 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleChecklist(item)}
                          className="w-4 h-4 rounded accent-[#EA580C]"
                        />
                        <span className={checked ? 'font-semibold text-slate-900' : ''}>{item}</span>
                      </label>
                    );
                  })}
                </div>
              ))}

              <div className="flex items-center gap-1.5 pt-0.5">
                <input
                  type="text"
                  value={customDamage}
                  onChange={e => setCustomDamage(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomDamage();
                    }
                  }}
                  placeholder="Adicionar avaria personalizada..."
                  className="flex-1 min-h-[34px] rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={addCustomDamage}
                  aria-label="Adicionar avaria"
                  className="w-9 h-9 shrink-0 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white flex items-center justify-center transition"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4 — FOTOS */}
          {step === 4 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-[11.5px] font-semibold text-slate-800">Fotos ({photos.length})</p>
                <div className="flex items-center gap-1.5">
                  <label className="min-h-[30px] px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[10.5px] font-semibold flex items-center gap-1.5 transition cursor-pointer">
                    <Camera className="w-3.5 h-3.5" />
                    <span>Câmera</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={e => handlePhotoFiles(e.target.files)}
                      className="hidden"
                    />
                  </label>
                  <label className="min-h-[30px] px-2.5 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-[10.5px] font-extrabold flex items-center gap-1.5 transition cursor-pointer">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Galeria</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={e => handlePhotoFiles(e.target.files)}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <label className="flex items-center gap-1.5 text-[10.5px] text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includePhotosInPdf}
                  onChange={e => setIncludePhotosInPdf(e.target.checked)}
                  className="w-3.5 h-3.5 accent-[#EA580C]"
                />
                <span>Adicionar fotos no PDF</span>
              </label>

              {photos.length === 0 ? (
                <p className="text-center text-[11px] text-slate-400 py-6">Nenhuma foto adicionada</p>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {photos.map((photo, index) => (
                    <div key={`${photo.slice(-10)}-${index}`} className="relative">
                      <img
                        src={photo}
                        alt={`Foto ${index + 1}`}
                        className="w-full h-20 rounded-lg object-cover border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => setPhotos(prev => prev.filter((_, i) => i !== index))}
                        aria-label={`Remover foto ${index + 1}`}
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white border border-slate-200 text-slate-500 flex items-center justify-center"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 5 — DATA/HORA */}
          {step === 5 && (
            <div className="space-y-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1" htmlFor="apt-date">
                  Data
                </label>
                <div className="relative">
                  <input
                    id="apt-date"
                    type="date"
                    value={date}
                    onChange={e => {
                      setDate(e.target.value || date);
                      setError('');
                    }}
                    className="w-full min-h-[38px] rounded-lg border border-slate-200 bg-white px-2.5 pr-9 text-[11.5px] font-medium text-slate-800 focus:border-[#EA580C] focus:outline-hidden"
                  />
                  <CalendarDays className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1" htmlFor="apt-time">
                  Hora
                </label>
                <input
                  id="apt-time"
                  type="time"
                  value={time}
                  onChange={e => {
                    setTime(e.target.value || time);
                    setError('');
                  }}
                  className="w-full min-h-[38px] rounded-lg border border-slate-200 bg-white px-2.5 text-[11.5px] font-medium text-slate-800 focus:border-[#EA580C] focus:outline-hidden"
                />
              </div>

              <p className="text-[10px] text-slate-400">
                {portalConfig.availableTimeSlots?.length
                  ? `A agenda aceita ${portalConfig.availableTimeSlots.length} horários por dia (${portalConfig.availableTimeSlots[0]} às ${portalConfig.availableTimeSlots[portalConfig.availableTimeSlots.length - 1]}).`
                  : 'Os horários de funcionamento são definidos no portal e checados ao criar o agendamento.'}{' '}
                Conflitos são verificados automaticamente.
              </p>
            </div>
          )}

          {/* STEP 6 — RESUMO */}
          {step === 6 && (
            <div className="space-y-2.5">
              <p className="text-center text-[10px] font-bold tracking-[0.14em] text-[#A16207]">
                RESUMO DO AGENDAMENTO
              </p>

              <div className="rounded-lg border border-slate-200 p-2.5 space-y-2">
                <div>
                  <p className="text-[9.5px] text-slate-400">Cliente</p>
                  <p className="text-[11.5px] font-bold text-slate-900">{selectedClient?.name}</p>
                  <p className="text-[10.5px] text-slate-500">
                    {selectedMoto ? `${selectedMoto.brand} ${selectedMoto.model} · ${selectedMoto.plate}` : 'Sem veículo'}
                  </p>
                </div>

                <div className="border-t border-slate-100 pt-1.5">
                  <p className="text-[9.5px] text-slate-400">Serviços</p>
                  {selectedServices.map(service => (
                    <div key={service.id} className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-700 truncate">
                        • {service.name}
                        {(serviceDiscounts[service.id] || 0) > 0 ? ` (-${serviceDiscounts[service.id]}%)` : ''}
                      </span>
                      <span className="text-[11px] font-mono text-slate-700 shrink-0">
                        {brl(priceOf(service.id, service.price) * (1 - (serviceDiscounts[service.id] || 0) / 100))}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-100 pt-1.5 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-500">Subtotal: {brl(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-500">Desconto geral (%)</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.5"
                        value={discountPercent}
                        onChange={e => setDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                        aria-label="Desconto geral em porcentagem"
                        className="w-[64px] min-h-[28px] rounded-md border border-slate-200 bg-white px-1.5 text-[11px] text-right font-semibold text-slate-800 focus:border-[#EA580C] focus:outline-hidden"
                      />
                      <span className="text-[10.5px] text-slate-500">%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <span className="text-[12px] font-bold text-slate-900">Total: {brl(total)}</span>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-1.5">
                  <p className="text-[9.5px] text-slate-400">Data e Hora</p>
                  <p className="text-[11px] font-semibold text-slate-800">
                    {date.split('-').reverse().join('/')} às {time}
                  </p>
                </div>

                <div className="rounded-md border border-[#EA580C] bg-[#FFEDD5]/60 px-2 py-1.5">
                  <p className="text-[10px] text-[#9A3412] leading-snug">
                    Este agendamento está confirmado para o dia {formatLongDate(date)} às {time}
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <p className="text-[10.5px] font-semibold text-rose-600 mt-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-100 px-4 py-2.5 flex items-center justify-between gap-2 bg-white">
          {step > 1 ? (
            <button
              type="button"
              onClick={goBack}
              className="min-h-[34px] px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold flex items-center gap-1 transition"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Voltar</span>
            </button>
          ) : (
            <span />
          )}

          {step < 6 ? (
            <button
              type="button"
              onClick={goNext}
              className={`min-h-[34px] px-4 rounded-lg text-[11px] font-extrabold transition ${
                canAdvance()
                  ? 'bg-[#EA580C] hover:bg-[#C2410C] text-white'
                  : 'bg-[#FFEDD5] text-[#A16207]'
              }`}
            >
              Próximo
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              className="min-h-[34px] px-4 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-[11px] font-extrabold transition"
            >
              Criar Agendamento
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
