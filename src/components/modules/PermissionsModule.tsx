import React, { useEffect, useState } from 'react';
import { useApp, AppModule } from '../../context/AppContext';
import {
  ShieldCheck,
  Lock,
  CheckCircle2,
  Unlock,
  Eye,
  Crown,
  LayoutDashboard,
  Layers,
  Calendar,
  FileText,
  ReceiptText,
  Store,
  MessageSquare,
  Target,
  DollarSign,
  BarChart3,
  Users,
  Gift,
  MessageCircle,
  Sparkles,
  UserCheck,
  Zap
} from 'lucide-react';
import { UserRole } from '../../types';

interface ModuleDef {
  id: AppModule;
  label: string;
  category: 'Operacional' | 'Financeiro & Gestão' | 'Relacionamento & CRM' | 'Catálogo & Estoque' | 'Administrativo';
  description: string;
  isFinancialOrAdmin?: boolean;
}

const MODULE_ICONS: Partial<Record<AppModule, React.ComponentType<{ className?: string }>>> = {
  dashboard: LayoutDashboard,
  patio: Layers,
  agenda: Calendar,
  ordens: FileText,
  orcamentos: ReceiptText,
  vitrine: Store,
  posvenda: MessageSquare,
  metas: Target,
  financeiro: DollarSign,
  relatorios: BarChart3,
  clientes: Users,
  whatsapp: MessageCircle,
  servicos: Sparkles,
  funcionarios: UserCheck,
};

const ALL_MODULES_DEF: ModuleDef[] = [
  { id: 'dashboard', label: 'Dashboard & Faturamento', category: 'Operacional', description: 'KPIs, faturamento e gráficos de desempenho', isFinancialOrAdmin: true },
  { id: 'patio', label: 'Pátio Operacional', category: 'Operacional', description: 'Motos na baia e status do atendimento' },
  { id: 'agenda', label: 'Agenda & Horários', category: 'Operacional', description: 'Agendamentos e prevenção de conflitos' },
  { id: 'ordens', label: 'Ordens de Serviço', category: 'Operacional', description: 'Criação, edição e acompanhamento de OS' },
  { id: 'orcamentos', label: 'Orçamentos', category: 'Operacional', description: 'Montagem e envio de orçamentos' },
  { id: 'vitrine', label: 'Vitrine Online', category: 'Operacional', description: 'Página pública e catálogo' },
  { id: 'posvenda', label: 'Pós-Venda', category: 'Relacionamento & CRM', description: 'Reativação de clientes após o atendimento' },
  { id: 'metas', label: 'Metas', category: 'Financeiro & Gestão', description: 'Objetivo mensal de faturamento', isFinancialOrAdmin: true },
  { id: 'financeiro', label: 'Financeiro Completo', category: 'Financeiro & Gestão', description: 'Contas a pagar e fluxo de caixa', isFinancialOrAdmin: true },
  { id: 'relatorios', label: 'Relatórios', category: 'Financeiro & Gestão', description: 'Relatórios de desempenho e vendas', isFinancialOrAdmin: true },
  { id: 'clientes', label: 'Clientes & CRM', category: 'Relacionamento & CRM', description: 'Cadastro de clientes e histórico' },
  { id: 'whatsapp', label: 'Mensagens WhatsApp', category: 'Relacionamento & CRM', description: 'Mensagens automáticas e manuais' },
  { id: 'servicos', label: 'Serviços & Preços', category: 'Catálogo & Estoque', description: 'Catálogo de serviços e valores' },
  { id: 'funcionarios', label: 'Equipe & Permissões', category: 'Administrativo', description: 'Funcionários, cargos e acessos', isFinancialOrAdmin: true },
];

const CATEGORIES = ['Operacional', 'Financeiro & Gestão', 'Relacionamento & CRM', 'Catálogo & Estoque', 'Administrativo'] as const;

const ROLES: { id: UserRole; label: string; badge: string; description: string }[] = [
  { id: 'gerente', label: 'Gerente', badge: 'Gestão', description: 'Atendimento, caixa, financeiro e equipe.' },
  { id: 'atendente', label: 'Atendente', badge: 'Recepção', description: 'Agendamentos, clientes, OS e WhatsApp.' },
  { id: 'operacional', label: 'Operacional', badge: 'Pátio', description: 'Executa serviços, checklists e OS.' },
];

const PRESETS: { id: 'all' | 'restricted' | 'operational_only'; label: string; description: string }[] = [
  { id: 'all', label: 'Liberar tudo', description: 'Todos os módulos liberados' },
  { id: 'restricted', label: 'Sem financeiro', description: 'Bloqueia dados financeiros e administrativos' },
  { id: 'operational_only', label: 'Apenas Pátio & OS', description: 'Pátio, agenda, ordens e serviços' },
];

export const PermissionsModule: React.FC = () => {
  const { rolePermissions, updateRolePermission, currentUser } = useApp();
  const [selectedRole, setSelectedRole] = useState<UserRole>('gerente');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const currentRolePerms = rolePermissions?.[selectedRole] || {};

  const isAllowed = (moduleId: AppModule) => currentRolePerms[moduleId] !== false;

  const allowedCount = ALL_MODULES_DEF.filter(mod => isAllowed(mod.id)).length;
  const totalModules = ALL_MODULES_DEF.length;
  const allowedPct = Math.round((allowedCount / totalModules) * 100);

  const handleToggleModule = (mod: ModuleDef) => {
    const next = !isAllowed(mod.id);
    updateRolePermission(selectedRole, mod.id, next);
    setNotice(`${mod.label}: ${next ? 'liberado' : 'bloqueado'} para ${selectedRole}.`);
  };

  const applyPreset = (preset: 'all' | 'restricted' | 'operational_only') => {
    for (const mod of ALL_MODULES_DEF) {
      let allow = true;
      if (preset === 'restricted') {
        allow = !mod.isFinancialOrAdmin;
      } else if (preset === 'operational_only') {
        allow = ['patio', 'agenda', 'ordens', 'servicos'].includes(mod.id);
      }
      updateRolePermission(selectedRole, mod.id, allow);
    }
    const presetLabel = PRESETS.find(p => p.id === preset)?.label || 'Preset';
    setNotice(`${presetLabel} aplicado para ${selectedRole}.`);
  };

  const roleLabel = ROLES.find(role => role.id === selectedRole)?.label || selectedRole;

  return (
    <div className="flex flex-col gap-4 min-w-0">
      {/* Header */}
      <div className="flex items-stretch gap-2.5 min-w-0">
        <span className="w-1.5 rounded-full bg-[#EA580C] shrink-0" />
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none flex items-center gap-2">
            Permissões
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9.5px] font-bold text-emerald-700">
              <ShieldCheck className="w-3 h-3" />
              Ativo
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1.5">
            Escolha o perfil e defina quais módulos ele pode acessar no sistema.
          </p>
        </div>
      </div>

      {/* Roles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
        {ROLES.map(role => {
          const perms = rolePermissions?.[role.id] || {};
          const allowed = ALL_MODULES_DEF.filter(mod => perms[mod.id] !== false).length;
          const selected = selectedRole === role.id;
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => setSelectedRole(role.id)}
              aria-pressed={selected}
              className={`relative rounded-xl border bg-white px-3.5 py-3 text-left transition overflow-hidden min-w-0 ${
                selected
                  ? 'border-[#EA580C] ring-1 ring-[#EA580C]/60 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {selected && <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#EA580C]" aria-hidden="true" />}
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wider text-slate-500">
                  {role.badge}
                </span>
                {selected ? (
                  <CheckCircle2 className="w-4 h-4 text-[#A16207] shrink-0" />
                ) : (
                  <span className="w-4 h-4 shrink-0" />
                )}
              </div>
              <p className="text-[13px] font-extrabold text-slate-900 mt-1.5 truncate">{role.label}</p>
              <p className="text-[10.5px] text-slate-500 leading-snug line-clamp-2">{role.description}</p>
              <p className="text-[10px] font-semibold text-slate-400 mt-1.5 tabular-nums">
                {allowed} de {totalModules} módulos
              </p>
            </button>
          );
        })}

        <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 rounded-md border border-[#EA580C] bg-[#FFEDD5] px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wider text-[#9A3412]">
              <Crown className="w-2.5 h-2.5" /> Proprietário
            </span>
            <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </div>
          <p className="text-[13px] font-extrabold text-slate-900 mt-1.5 truncate">
            {currentUser.role === 'admin' ? currentUser.name : 'Conta principal'}
          </p>
          <p className="text-[10.5px] text-slate-500 leading-snug">Acesso total, sem restrições.</p>
          <p className="text-[10px] font-semibold text-slate-400 mt-1.5 tabular-nums">
            {totalModules} de {totalModules} módulos
          </p>
        </div>
      </div>

      {/* Summary + presets */}
      <section className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 space-y-2.5 min-w-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="text-[11.5px] font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#EA580C]" />
              Acessos de {roleLabel}
            </p>
            <p className="text-[10.5px] text-slate-500 mt-0.5">
              {allowedCount} de {totalModules} módulos liberados · {allowedPct}% do sistema
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {PRESETS.map(preset => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.id)}
                title={preset.description}
                className="min-h-[30px] px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-[10.5px] font-bold flex items-center gap-1 transition"
              >
                <Zap className="w-3 h-3 text-[#EA580C]" />
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#EA580C] transition-all duration-300"
            style={{ width: `${allowedPct}%` }}
          />
        </div>

        {notice && (
          <p className="inline-flex items-center gap-1.5 rounded-lg border border-[#EA580C] bg-[#FFEDD5]/60 px-2.5 py-1.5 text-[10.5px] font-semibold text-[#9A3412]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {notice}
          </p>
        )}
      </section>

      {/* Modules by category */}
      <div className="space-y-3">
        {CATEGORIES.map(category => {
          const modules = ALL_MODULES_DEF.filter(mod => mod.category === category);
          if (modules.length === 0) return null;
          const allowedInCategory = modules.filter(mod => isAllowed(mod.id)).length;

          return (
            <section key={category} className="rounded-xl border border-slate-200 bg-white overflow-hidden min-w-0">
              <div className="flex items-center justify-between gap-2 px-3.5 py-2 bg-slate-50 border-b border-slate-200">
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 truncate">{category}</p>
                <span className="shrink-0 text-[9.5px] font-bold text-slate-500 tabular-nums">
                  {allowedInCategory}/{modules.length}
                </span>
              </div>

              {modules.map(mod => {
                const allowed = isAllowed(mod.id);
                const Icon = MODULE_ICONS[mod.id] || Layers;
                return (
                  <div
                    key={mod.id}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-slate-100 last:border-b-0 min-w-0"
                  >
                    <span
                      className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                        allowed
                          ? 'bg-[#FFEDD5]/60 border-[#EA580C] text-[#A16207]'
                          : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p
                          className={`text-[11.5px] font-bold truncate ${
                            allowed ? 'text-slate-900' : 'text-slate-500'
                          }`}
                        >
                          {mod.label}
                        </p>
                        {mod.isFinancialOrAdmin && (
                          <span className="hidden sm:inline-flex shrink-0 items-center gap-1 rounded border border-rose-200 bg-rose-50 px-1 py-0.5 text-[8.5px] font-bold text-rose-700">
                            <Lock className="w-2.5 h-2.5" /> sensível
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 truncate">{mod.description}</p>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={allowed}
                      aria-label={`Acesso a ${mod.label}`}
                      onClick={() => handleToggleModule(mod)}
                      className={`shrink-0 w-10 h-[22px] rounded-full relative transition ${
                        allowed ? 'bg-[#EA580C]' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow transition-all ${
                          allowed ? 'left-[20px]' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5">
        {allowedCount === totalModules ? (
          <Unlock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        ) : (
          <Eye className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        )}
        <p className="text-[10.5px] text-slate-500 leading-snug">
          O perfil Proprietário sempre tem acesso total. As alterações valem no próximo carregamento do menu para quem
          usa este perfil.
        </p>
      </div>
    </div>
  );
};
