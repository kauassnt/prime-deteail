import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Plus,
  ShieldCheck,
  UserX,
  UserMinus,
  UserPlus,
  CheckCircle2,
  Layers,
  Users,
  Info,
  Wallet,
  BarChart3,
  X,
  Trash2,
  Pencil,
  Briefcase,
  KeyRound,
  Eye,
  EyeOff
} from 'lucide-react';
import { CommissionRecord, User, UserRole } from '../../types';
import { ResponsiveModal } from '../ui/ResponsivePrimitives';
import { getLocalDateKey } from '../../utils/dateUtils';
import {
  clearEmployeePassword,
  fetchEmployeeCredentials,
  setEmployeePassword,
} from '../../services/userCredentialsService';

type MainTab = 'acessos' | 'comissoes';
type CommissionPeriod = 'hoje' | '7dias' | '30dias' | 'mes' | 'personalizado';

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Administrativo',
  gerente: 'Gerente',
  atendente: 'Atendente',
  operacional: 'Operacional',
};

const STAFF_LIMIT = 3;

const brl = (value: number) =>
  `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const initialsOf = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'F';

const shiftDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

export const EmployeesModule: React.FC = () => {
  const {
    users,
    currentUser,
    orders,
    commissions,
    settings,
    updateSettings,
    createUser,
    updateUser,
    deleteUser,
    setActiveModule,
  } = useApp();

  const [tab, setTab] = useState<MainTab>('acessos');
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [formError, setFormError] = useState('');
  const [password, setPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<Record<string, boolean>>({});
  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('operacional');
  const [active, setActive] = useState(true);
  const [commissionType, setCommissionType] = useState<'percent' | 'fixed' | 'none'>('percent');
  const [commissionValue, setCommissionValue] = useState(15);

  // Fica nas configurações da empresa para valer em todos os dispositivos.
  const commissionEnabled = settings.commissionsEnabled !== false;

  useEffect(() => {
    if (currentUser.role !== 'admin') return;
    let cancelled = false;
    void fetchEmployeeCredentials().then(map => {
      if (cancelled) return;
      setPasswordStatus(
        Object.fromEntries(Object.entries(map).map(([id, status]) => [id, status.passwordSet]))
      );
    });
    return () => {
      cancelled = true;
    };
  }, [currentUser.role]);

  const todayKey = getLocalDateKey(new Date().toISOString());
  const [commissionPeriod, setCommissionPeriod] = useState<CommissionPeriod>('30dias');
  const [customStart, setCustomStart] = useState(todayKey);
  const [customEnd, setCustomEnd] = useState(todayKey);

  const activeUsers = users.filter(u => u.active);
  const inactiveUsers = users.filter(u => !u.active);
  const operationalUsers = users.filter(u => u.role === 'operacional' || u.role === 'atendente');
  const adminUsers = users.filter(u => u.role === 'admin' || u.role === 'gerente');
  const openSlots = Math.max(0, STAFF_LIMIT - users.length);

  const commissionRange = useMemo(() => {
    const base = new Date(`${todayKey}T12:00:00`);
    if (commissionPeriod === 'hoje') return { start: todayKey, end: todayKey };
    if (commissionPeriod === '7dias') {
      return { start: getLocalDateKey(shiftDays(base, -6).toISOString()), end: todayKey };
    }
    if (commissionPeriod === '30dias') {
      return { start: getLocalDateKey(shiftDays(base, -29).toISOString()), end: todayKey };
    }
    if (commissionPeriod === 'personalizado') return { start: customStart, end: customEnd };
    return { start: `${todayKey.slice(0, 7)}-01`, end: todayKey };
  }, [commissionPeriod, todayKey, customStart, customEnd]);

  const periodCommissions = useMemo(() => {
    const savedByOrder = new Map(commissions.map(record => [record.serviceOrderId, record]));

    const generated = orders
      .filter(order => order.status !== 'cancelado' && !!order.assignedEmployeeId)
      .flatMap(order => {
        const saved = savedByOrder.get(order.id);
        if (saved && saved.status === 'cancelada') return [];

        const total = order.total || 0;
        const received = (order.paymentTransactions || [])
          .filter(tx => tx.status === 'confirmado')
          .reduce((sum, tx) => sum + tx.amount, 0) || order.amountPaid || 0;
        const isSettled = total > 0 && (order.paymentStatus === 'pago' || received >= total - 0.005);
        const commissionAmount = saved ? saved.commissionAmount : order.commissionAmount || 0;
        if (!isSettled || commissionAmount <= 0) return [];

        const employee = users.find(user => user.id === order.assignedEmployeeId);
        const rate =
          saved?.commissionRate ||
          (employee?.commissionType === 'percent'
            ? `${employee.commissionValue}%`
            : employee?.commissionType === 'fixed'
              ? brl(employee.commissionValue)
              : '—');

        return [
          {
            id: saved?.id || `auto_${order.id}`,
            employeeId: order.assignedEmployeeId,
            employeeName: saved?.employeeName || order.assignedEmployeeName || employee?.name || 'Funcionário',
            serviceOrderId: order.id,
            orderNumber: saved?.orderNumber || order.id,
            serviceNames: saved?.serviceNames || order.services.map(service => service.serviceName).join(', '),
            orderTotal: total,
            commissionRate: rate,
            commissionAmount,
            date: order.entryDateTime,
            status: saved?.status || 'aprovada',
            paidAt: saved?.paidAt,
          } as CommissionRecord,
        ];
      });

    return generated.filter(record => {
      const key = getLocalDateKey(record.date);
      return key >= commissionRange.start && key <= commissionRange.end;
    });
  }, [orders, users, commissions, commissionRange]);

  const commissionTotal = periodCommissions.reduce((sum, record) => sum + record.commissionAmount, 0);
  const employeesWithCommission = new Set(periodCommissions.map(record => record.employeeId)).size;
  const ordersWithCommission = new Set(periodCommissions.map(record => record.serviceOrderId)).size;

  const formatRangeLabel = () =>
    `${commissionRange.start.split('-').reverse().join('/')} a ${commissionRange.end.split('-').reverse().join('/')}`;

  const openCreate = () => {
    setEditingUser(null);
    setName('');
    setPhone('');
    setEmail('');
    setRole('operacional');
    setActive(true);
    setCommissionType('percent');
    setCommissionValue(15);
    setFormError('');
    setPassword('');
    setFormOpen(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setName(user.name);
    setPhone(user.phone);
    setEmail(user.email);
    setRole(user.role);
    setActive(user.active);
    setCommissionType(user.commissionType);
    setCommissionValue(user.commissionValue);
    setFormError('');
    setPassword('');
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName) {
      setFormError('Informe o nome do funcionário.');
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setFormError('Informe um e-mail válido.');
      return;
    }
    const duplicated = users.some(
      user => user.email.toLowerCase() === trimmedEmail && user.id !== editingUser?.id
    );
    if (duplicated) {
      setFormError('Já existe um funcionário com este e-mail.');
      return;
    }

    const payload = {
      name: trimmedName,
      phone: phone.trim(),
      email: trimmedEmail,
      role,
      active,
      commissionType,
      commissionValue: commissionType === 'none' ? 0 : commissionValue,
    };

    const trimmedPassword = password.trim();
    if (trimmedPassword && trimmedPassword.length < 8) {
      setFormError('A senha de acesso deve ter pelo menos 8 caracteres.');
      return;
    }

    let savedUser: User;
    if (editingUser) {
      updateUser(editingUser.id, payload);
      savedUser = { ...editingUser, ...payload };
    } else {
      savedUser = createUser({
        ...payload,
        hireDate: todayKey,
        specialties: [],
      });
    }

    if (trimmedPassword) {
      setPasswordSaving(true);
      const result = await setEmployeePassword(savedUser.id, trimmedPassword);
      setPasswordSaving(false);
      if (!result.ok) {
        // Mantém o modal aberto em modo edição para o admin tentar novamente.
        setEditingUser(savedUser);
        setPasswordStatus(prev => ({ ...prev, [savedUser.id]: false }));
        setFormError(result.error || 'Não foi possível definir a senha de acesso.');
        return;
      }
      setPasswordStatus(prev => ({ ...prev, [savedUser.id]: true }));
    }

    setPassword('');
    setFormOpen(false);
    setEditingUser(null);
  };

  const openPasswordModal = (user: User) => {
    setPasswordUser(user);
    setNewPassword('');
    setConfirmPassword('');
    setShowNewPassword(false);
    setPasswordError('');
    setPasswordSuccess('');
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordUser) return;
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword.length < 8) {
      setPasswordError('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('A confirmação não confere com a nova senha.');
      return;
    }

    setPasswordSaving(true);
    const result = await setEmployeePassword(passwordUser.id, newPassword);
    setPasswordSaving(false);

    if (!result.ok) {
      setPasswordError(result.error || 'Não foi possível alterar a senha.');
      return;
    }

    setPasswordStatus(prev => ({ ...prev, [passwordUser.id]: true }));
    setPasswordSuccess(`Senha de ${passwordUser.name.split(' ')[0]} atualizada com sucesso.`);
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleRemovePassword = async () => {
    if (!passwordUser) return;
    setPasswordSaving(true);
    const result = await clearEmployeePassword(passwordUser.id);
    setPasswordSaving(false);
    if (!result.ok) {
      setPasswordError(result.error || 'Não foi possível remover a senha.');
      return;
    }
    setPasswordStatus(prev => ({ ...prev, [passwordUser.id]: false }));
    setNewPassword('');
    setConfirmPassword('');
    setPasswordSuccess('Senha individual removida. O login voltou a usar o PIN da empresa.');
  };

  const confirmDelete = () => {
    if (!deletingUser) return;
    deleteUser(deletingUser.id);
    setDeletingUser(null);
  };

  const canDelete = (user: User) => user.id !== currentUser.id && user.role !== 'admin';

  return (
    <div className="flex flex-col gap-4 sm:gap-5 min-w-0">
      {/* Header */}
      <div className="flex items-stretch gap-2.5 min-w-0">
        <span className="w-1.5 rounded-full bg-[#EA580C] shrink-0" />
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Funcionários</h1>
          <p className="text-xs text-slate-500 mt-1.5">Acessos ao sistema e equipe operacional em um só lugar.</p>
        </div>
      </div>

      {/* Main tabs */}
      <div className="flex items-center gap-1 rounded-xl bg-white border border-slate-200 p-1.5">
        <button
          type="button"
          onClick={() => setTab('acessos')}
          className={`flex-1 min-h-[34px] rounded-lg text-xs font-bold transition ${
            tab === 'acessos' ? 'bg-[#EA580C] text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          Controle de Acessos
        </button>
        <button
          type="button"
          onClick={() => setTab('comissoes')}
          className={`flex-1 min-h-[34px] rounded-lg text-xs font-bold transition ${
            tab === 'comissoes' ? 'bg-[#EA580C] text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          Comissões
        </button>
      </div>

      {/* ================= ACESSOS ================= */}
      {tab === 'acessos' && (
        <>
          <div className="flex items-start justify-between gap-3 min-w-0">
            <p className="text-[11px] text-slate-500">Gerencie os funcionários que têm acesso ao sistema PK Detail.</p>
            <button
              type="button"
              onClick={openCreate}
              className="shrink-0 min-h-[36px] px-3.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-extrabold flex items-center gap-1.5 transition whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Adicionar Funcionário</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 min-w-0">
            {[
              {
                label: 'Ativos',
                value: activeUsers.length,
                hint: `de ${users.length} funcionários`,
                icon: CheckCircle2,
                iconClass: 'text-emerald-600',
              },
              {
                label: 'Desativados',
                value: inactiveUsers.length,
                hint: 'sem acesso ao app',
                icon: UserX,
                iconClass: 'text-slate-500',
              },
              {
                label: 'Removidos',
                value: 0,
                hint: 'histórico de exclusões',
                icon: UserMinus,
                iconClass: 'text-rose-500',
              },
              {
                label: 'Vagas disponíveis',
                value: openSlots,
                hint: `limite ${STAFF_LIMIT}`,
                icon: UserPlus,
                iconClass: 'text-amber-600',
              },
            ].map(card => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${card.iconClass}`} />
                    <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 truncate">
                      {card.label}
                    </p>
                  </div>
                  <p className="text-xl font-black text-slate-900 leading-tight mt-1">{card.value}</p>
                  <p className="text-[10px] text-slate-400 truncate">{card.hint}</p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 flex items-center gap-2 min-w-0">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-700">Operacional</p>
                <p className="text-lg font-black text-slate-900 leading-tight">{operationalUsers.length}</p>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 flex items-center gap-2 min-w-0">
              <Layers className="w-4 h-4 text-violet-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-700">Administrativo/Gerente</p>
                <p className="text-lg font-black text-slate-900 leading-tight">{adminUsers.length}</p>
              </div>
            </div>
          </div>

          {/* Table */}
          <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="hidden md:grid grid-cols-[minmax(0,1.6fr)_110px_120px_100px_90px_92px] gap-2 px-3.5 py-2 bg-slate-50 text-[9.5px] font-bold uppercase tracking-wider text-slate-500">
              <span>Funcionário</span>
              <span>Perfil</span>
              <span>Acesso ao app</span>
              <span>Criado em</span>
              <span>Status</span>
              <span className="text-right">Ações</span>
            </div>

            {users.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">Nenhum funcionário encontrado.</p>
            ) : (
              users.map(user => (
                <div
                  key={user.id}
                  className="flex md:grid md:grid-cols-[minmax(0,1.6fr)_110px_120px_100px_90px_92px] items-center gap-2 px-3.5 py-2.5 border-b border-slate-100 last:border-b-0 min-w-0"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black flex items-center justify-center shrink-0">
                      {initialsOf(user.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate flex items-center gap-1.5">
                        {user.name}
                        {user.id === currentUser.id && (
                          <span className="text-[9px] font-bold text-slate-400 border border-slate-200 rounded px-1">
                            você
                          </span>
                        )}
                      </p>
                      <p className="text-[10.5px] text-slate-500 truncate">{user.email}</p>
                      <p className="text-[9.5px] font-semibold truncate flex items-center gap-1">
                        <KeyRound className="w-2.5 h-2.5 shrink-0" />
                        <span className={passwordStatus[user.id] ? 'text-emerald-600' : 'text-amber-600'}>
                          {passwordStatus[user.id] ? 'Senha própria' : 'PIN da empresa'}
                        </span>
                      </p>
                    </div>
                  </div>

                  <span className="hidden md:inline-flex shrink-0 rounded-md border border-[#EA580C] bg-[#FFEDD5] px-2 py-0.5 text-[9.5px] font-bold text-[#9A3412] justify-center">
                    {user.role === 'admin' ? 'Proprietário' : ROLE_LABEL[user.role]}
                  </span>

                  <span
                    className={`hidden md:inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold ${
                      user.active ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  >
                    <ShieldCheck className="w-3 h-3" />
                    {user.active ? 'Com acesso' : 'Sem acesso'}
                  </span>

                  <span className="hidden md:inline text-[10.5px] text-slate-500 shrink-0">
                    {user.hireDate ? user.hireDate.split('-').reverse().join('/') : '—'}
                  </span>

                  <span
                    className={`hidden md:inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[9.5px] font-bold justify-center ${
                      user.active
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-slate-100 text-slate-500'
                    }`}
                  >
                    {user.active ? 'Ativo' : 'Inativo'}
                  </span>

                  <div className="flex items-center gap-1 shrink-0 md:justify-end">
                    <button
                      type="button"
                      onClick={() => openPasswordModal(user)}
                      aria-label={`Alterar senha de ${user.name}`}
                      title="Alterar senha de acesso"
                      className="w-7 h-7 rounded-md border border-slate-200 text-[#EA580C] hover:bg-[#FFEDD5] flex items-center justify-center transition"
                    >
                      <KeyRound className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(user)}
                      aria-label={`Editar ${user.name}`}
                      className="w-7 h-7 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center transition"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingUser(user)}
                      disabled={!canDelete(user)}
                      aria-label={`Remover ${user.name}`}
                      className="w-7 h-7 rounded-md border border-slate-200 text-rose-500 hover:bg-rose-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </section>
        </>
      )}

      {/* ================= COMISSÕES ================= */}
      {tab === 'comissoes' && (
        <>
          <div className="min-w-0">
            <h2 className="text-lg font-black text-slate-900">Comissões de Funcionários</h2>
            <p className="text-[11px] text-slate-500 mt-0.5 max-w-[720px]">
              Cadastre sua equipe operacional, vincule funcionários aos serviços e acompanhe as comissões em Ordens de
              Serviço, Agendamentos e Orçamentos.
            </p>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 flex items-start justify-between gap-3 min-w-0 max-w-[560px]">
            <div className="min-w-0">
              <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">Comissões</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">Ativar comissões</p>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                Quando ativado, você poderá definir os funcionários responsáveis e suas comissões em Ordens de
                Serviço, Agendamentos e Orçamentos.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={commissionEnabled}
              aria-label="Ativar comissões"
              onClick={() =>
                updateSettings({ ...settings, commissionsEnabled: !commissionEnabled })
              }
              className={`shrink-0 mt-1 w-11 h-6 rounded-full transition relative ${commissionEnabled ? 'bg-[#EA580C]' : 'bg-slate-300'}`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${commissionEnabled ? 'left-[22px]' : 'left-0.5'}`}
              />
            </button>
          </section>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 flex items-start gap-2 max-w-[760px]">
            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-500 leading-snug">
              Os funcionários cadastrados aqui são usados para identificar quem realiza cada serviço e calcular
              comissões em Ordens de Serviço, Agendamentos e Orçamentos. Eles não recebem login nem acesso ao sistema.
            </p>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
              <Users className="w-4 h-4 text-[#EA580C]" />
              Equipe operacional
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveModule('permissions')}
                className="min-h-[34px] px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold flex items-center gap-1.5 transition"
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>Gerenciar cargos</span>
              </button>
              <button
                type="button"
                onClick={openCreate}
                className="min-h-[34px] px-3 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-[11px] font-extrabold flex items-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Adicionar funcionário</span>
              </button>
            </div>
          </div>

          {operationalUsers.length === 0 ? (
            <section className="rounded-2xl border border-slate-200 bg-white py-12 px-6 flex flex-col items-center justify-center text-center gap-2 max-w-[520px]">
              <span className="w-10 h-10 rounded-full bg-[#FFEDD5] text-[#A16207] flex items-center justify-center">
                <Users className="w-4 h-4" />
              </span>
              <p className="text-sm font-extrabold text-slate-900">Sua equipe operacional começa aqui</p>
              <p className="text-xs text-slate-500 max-w-[320px]">
                Cadastre quem realiza os serviços para vinculá-los às Ordens de Serviço, Agendamentos e Orçamentos e
                configurar comissões.
              </p>
              <button
                type="button"
                onClick={openCreate}
                className="mt-1 min-h-[34px] px-3.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-[11px] font-extrabold flex items-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Adicionar funcionário</span>
              </button>
            </section>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {operationalUsers.map(user => (
                <div
                  key={user.id}
                  className="relative rounded-xl border border-slate-200 bg-white px-3.5 py-3 pl-4 min-w-0 overflow-hidden"
                >
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#EA580C]" aria-hidden="true" />
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{user.name}</p>
                      <p className="text-[10.5px] text-slate-500 truncate">{ROLE_LABEL[user.role]}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openEdit(user)}
                      aria-label={`Editar ${user.name}`}
                      className="w-7 h-7 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center transition shrink-0"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-[10.5px] text-slate-500 mt-1.5">
                    Comissão:{' '}
                    <span className="font-semibold text-slate-700">
                      {user.commissionType === 'none'
                        ? 'desativada'
                        : user.commissionType === 'percent'
                          ? `${user.commissionValue}%`
                          : brl(user.commissionValue)}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Commission summary */}
          <section className="space-y-2.5 min-w-0">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                <BarChart3 className="w-4 h-4 text-[#EA580C]" />
                Resumo de Comissões
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Acompanhe as comissões geradas por cada funcionário a partir das Ordens de Serviço pagas.
              </p>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {([
                { id: 'hoje' as CommissionPeriod, label: 'Hoje' },
                { id: '7dias' as CommissionPeriod, label: '7 dias' },
                { id: '30dias' as CommissionPeriod, label: '30 dias' },
                { id: 'mes' as CommissionPeriod, label: 'Este mês' },
                { id: 'personalizado' as CommissionPeriod, label: 'Personalizado' },
              ]).map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCommissionPeriod(item.id)}
                  className={`min-h-[30px] px-3 rounded-lg text-[11px] font-bold transition ${
                    commissionPeriod === item.id
                      ? 'bg-[#FFEDD5] border border-[#EA580C] text-[#9A3412]'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {commissionPeriod === 'personalizado' && (
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value || customStart)}
                  aria-label="Início do período de comissões"
                  className="min-h-[30px] rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700"
                />
                <span className="text-[11px] text-slate-400">até</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value || customEnd)}
                  aria-label="Fim do período de comissões"
                  className="min-h-[30px] rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700"
                />
              </div>
            )}

            <p className="text-[10.5px] text-slate-400">Período: {formatRangeLabel()}</p>

            {!commissionEnabled && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                Comissões desativadas: os valores abaixo são apenas histórico e não são descontados no financeiro.
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Wallet className="w-3 h-3" /> Total de comissões
                </p>
                <p className="text-xl font-black text-slate-900 mt-1">{brl(commissionTotal)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
                  Funcionários com comissão
                </p>
                <p className="text-xl font-black text-slate-900 mt-1">{employeesWithCommission}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">Ordens de serviço</p>
                <p className="text-xl font-black text-slate-900 mt-1">{ordersWithCommission}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              {periodCommissions.length === 0 ? (
                <div className="py-8 px-6 text-center">
                  <p className="text-xs font-bold text-slate-900">Nenhuma comissão foi gerada neste período.</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    As comissões aparecem aqui quando a Ordem de Serviço é quitada.
                  </p>
                </div>
              ) : (
                periodCommissions.map(record => (
                  <div
                    key={record.id}
                    className="flex items-center gap-3 px-3.5 py-2.5 border-b border-slate-100 last:border-b-0 min-w-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">{record.employeeName}</p>
                      <p className="text-[10.5px] text-slate-500 truncate">
                        {record.orderNumber} · {getLocalDateKey(record.date).split('-').reverse().join('/')}
                      </p>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-600 shrink-0">
                      {brl(record.commissionAmount)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      )}

      {/* Form modal */}
      <ResponsiveModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingUser ? 'Editar Funcionário' : 'Adicionar Funcionário'}
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
              placeholder="Nome do funcionário"
              className="w-full min-h-[40px] bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  setFormError('');
                }}
                placeholder="email@empresa.com"
                className="w-full min-h-[40px] bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Telefone</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="(00) 00000-0000"
                className="w-full min-h-[40px] bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Perfil</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as UserRole)}
                className="w-full min-h-[40px] bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:border-[#EA580C] focus:outline-hidden"
              >
                <option value="operacional">Operacional</option>
                <option value="atendente">Atendente</option>
                <option value="gerente">Gerente</option>
                <option value="admin">Administrativo</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Comissão</label>
              <div className="flex items-center gap-1.5">
                <select
                  value={commissionType}
                  onChange={e => setCommissionType(e.target.value as 'percent' | 'fixed' | 'none')}
                  className="min-h-[40px] flex-1 min-w-0 bg-white border border-slate-200 rounded-xl px-2 py-2 text-[11px] font-semibold text-slate-800 focus:border-[#EA580C] focus:outline-hidden"
                >
                  <option value="percent">Percentual</option>
                  <option value="fixed">Valor fixo</option>
                  <option value="none">Sem comissão</option>
                </select>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={commissionType === 'none' ? 0 : commissionValue}
                  onChange={e => setCommissionValue(Number(e.target.value) || 0)}
                  disabled={commissionType === 'none'}
                  aria-label="Valor da comissão"
                  className="w-[80px] shrink-0 min-h-[40px] bg-white border border-slate-200 rounded-xl px-2 py-2 text-xs font-semibold text-slate-800 focus:border-[#EA580C] focus:outline-hidden disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          {!editingUser && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[#EA580C]" />
                  Senha inicial de acesso
                </p>
                <span className="text-[9.5px] font-bold rounded-full border border-slate-200 bg-white text-slate-500 px-2 py-0.5">
                  Novo login
                </span>
              </div>
              <input
                type="password"
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  setFormError('');
                }}
                autoComplete="new-password"
                placeholder="Defina a senha do funcionário (mín. 8 caracteres)"
                className="w-full min-h-[40px] bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden"
              />
              <p className="text-[10px] text-slate-500 leading-snug">
                O funcionário entra com o próprio e-mail e esta senha. Sem senha definida, o login usa o PIN da
                empresa. O acesso ao painel segue o Perfil e as Permissões deste funcionário.
              </p>
            </div>
          )}

          {editingUser && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex items-center justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[#EA580C]" />
                  Senha de acesso
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {passwordStatus[editingUser.id] ? 'Senha própria ativa.' : 'Ainda usando o PIN da empresa.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFormOpen(false);
                  openPasswordModal(editingUser);
                }}
                className="shrink-0 min-h-[32px] px-3 rounded-lg border border-[#EA580C] bg-white text-[#9A3412] text-[10.5px] font-bold hover:bg-[#FFEDD5] transition"
              >
                Alterar senha
              </button>
            </div>
          )}

          <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={active}
              onChange={e => setActive(e.target.checked)}
              className="w-4 h-4 accent-[#EA580C]"
            />
            <span>Funcionário ativo (com acesso ao sistema)</span>
          </label>

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
              disabled={passwordSaving}
              className="min-h-[38px] px-5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-extrabold transition disabled:opacity-60"
            >
              {passwordSaving ? 'Salvando senha...' : 'Salvar'}
            </button>
          </div>
        </form>
      </ResponsiveModal>

      {/* Password change modal */}
      <ResponsiveModal
        isOpen={!!passwordUser}
        onClose={() => setPasswordUser(null)}
        title="Alterar senha de acesso"
        headerClassName="border-l-4 border-l-[#EA580C]"
        maxWidth="sm"
      >
        {passwordUser && (
          <form onSubmit={handlePasswordSave} noValidate className="p-4 space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">{passwordUser.name}</p>
              <p className="text-[10.5px] text-slate-500 truncate">{passwordUser.email}</p>
              <span
                className={`mt-1.5 inline-flex rounded-full border px-2 py-0.5 text-[9.5px] font-bold ${
                  passwordStatus[passwordUser.id]
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-amber-200 bg-amber-50 text-amber-700'
                }`}
              >
                {passwordStatus[passwordUser.id] ? 'Senha própria ativa' : 'Usando PIN da empresa'}
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nova senha</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => {
                    setNewPassword(e.target.value);
                    setPasswordError('');
                    setPasswordSuccess('');
                  }}
                  autoComplete="new-password"
                  placeholder="Mínimo de 8 caracteres"
                  className="w-full min-h-[40px] bg-white border border-slate-200 rounded-xl px-3 pr-10 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(prev => !prev)}
                  aria-label={showNewPassword ? 'Ocultar nova senha' : 'Mostrar nova senha'}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md text-slate-400 hover:text-slate-600 flex items-center justify-center"
                >
                  {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Confirmar nova senha</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => {
                  setConfirmPassword(e.target.value);
                  setPasswordError('');
                  setPasswordSuccess('');
                }}
                autoComplete="new-password"
                placeholder="Repita a nova senha"
                className="w-full min-h-[40px] bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#EA580C] focus:outline-hidden"
              />
            </div>

            <p className="text-[10px] text-slate-500 leading-snug">
              O funcionário passa a entrar com o próprio e-mail e esta senha. A sessão atual dele continua válida até
              sair ou expirar.
            </p>

            {passwordError && (
              <p className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                {passwordError}
              </p>
            )}
            {passwordSuccess && (
              <p className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                {passwordSuccess}
              </p>
            )}

            {passwordStatus[passwordUser.id] && (
              <button
                type="button"
                onClick={handleRemovePassword}
                disabled={passwordSaving}
                className="text-[10px] font-bold text-rose-600 hover:underline disabled:opacity-60"
              >
                Remover senha individual (volta a usar o PIN da empresa)
              </button>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPasswordUser(null)}
                className="min-h-[38px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition"
              >
                Fechar
              </button>
              <button
                type="submit"
                disabled={passwordSaving}
                className="min-h-[38px] px-5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-extrabold transition disabled:opacity-60"
              >
                {passwordSaving ? 'Salvando...' : 'Salvar nova senha'}
              </button>
            </div>
          </form>
        )}
      </ResponsiveModal>

      {/* Delete confirmation */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 pk-fade-enter">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Remover funcionário"
            className="w-full max-w-[440px] bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-black text-slate-900">Remover funcionário?</h2>
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                aria-label="Fechar"
                className="w-7 h-7 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              <span className="font-bold text-slate-800">{deletingUser.name}</span> perderá o acesso ao sistema. As
              ordens e comissões já registradas continuam preservadas.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="min-h-[38px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="min-h-[38px] px-4 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-extrabold transition"
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
