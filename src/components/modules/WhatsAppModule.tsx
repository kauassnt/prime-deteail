import React, { useState, useEffect } from 'react';
import { companyDisplayName } from '../../utils/company';

import { useApp } from '../../context/AppContext';
import {
  MessageCircle,
  Send,
  Calendar,
  CheckCircle2,
  DollarSign,
  Heart,
  Repeat,
  FileText,
  ExternalLink,
  Settings2,
  History,
  Copy,
  Check,
  Zap,
  Webhook,
  Clock,
  AlertTriangle,
  RotateCcw,
  Trash2,
  Wrench,
  PackageCheck,
  XCircle,
  Edit3,
  CheckCheck
} from 'lucide-react';
import { OSStatus, WhatsAppAutomationConfig, WhatsAppDeliveryMode } from '../../types';
import { PageHeader, ResponsiveModal } from '../ui/ResponsivePrimitives';
import { buildWhatsappLink, formatWhatsappDisplay, normalizeBrazilWhatsappDigits } from '../../utils/whatsappUtils';

type TemplateKey =
  | 'status_para_fazer'
  | 'status_em_servico'
  | 'status_concluido'
  | 'status_entregue'
  | 'agendamento'
  | 'lembrete'
  | 'orcamento'
  | 'pagamento'
  | 'agradecimento'
  | 'retorno';

const OS_STATUS_META: { status: OSStatus; label: string; desc: string }[] = [
  { status: 'para_fazer', label: 'Aguardando Início', desc: 'Quando uma nova moto entra no pátio / OS criada' },
  { status: 'em_servico', label: 'Em Serviço', desc: 'Quando o profissional inicia a lavagem/detalhamento' },
  { status: 'concluido', label: 'Concluído (Pronto p/ Retirada)', desc: 'Quando o serviço termina e a moto está pronta' },
  { status: 'entregue', label: 'Entregue ao Cliente', desc: 'Confirmação de entrega e agradecimento final' },
  { status: 'cancelado', label: 'Cancelado', desc: 'Aviso de cancelamento da Ordem de Serviço' },
];

const VARIABLES_HELP = ['{cliente}', '{os}', '{moto}', '{placa}', '{servicos}', '{total}', '{saldo}', '{horario_fechamento}'];

export const WhatsAppModule: React.FC = () => {
  const {
    clients,
    orders,
    appointments,
    settings,
    whatsappConfig,
    whatsappLogs,
    updateWhatsappConfig,
    resetWhatsappConfig,
    sendWhatsappForOrderStatus,
    logManualWhatsappMessage,
    markWhatsappLogSent,
    retryWhatsappWebhook,
    clearWhatsappLogs,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'disparo' | 'automacao' | 'historico'>('disparo');

  // Tab 1: Disparo states
  const [selectedClientId, setSelectedClientId] = useState<string>(clients[0]?.id || '');
  const [selectedOrderId, setSelectedOrderId] = useState<string>(orders[0]?.id || '');
  const [templateType, setTemplateType] = useState<TemplateKey>('status_concluido');
  const [customMessage, setCustomMessage] = useState<string>('');
  const [isEditingMessage, setIsEditingMessage] = useState<boolean>(false);
  const [copiedMsg, setCopiedMsg] = useState<boolean>(false);
  const [dispatchNotice, setDispatchNotice] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  // Tab 2: Automation config draft states
  const [draftConfig, setDraftConfig] = useState<WhatsAppAutomationConfig>(whatsappConfig);
  const [testingWebhook, setTestingWebhook] = useState<boolean>(false);

  // Tab 3: History filters & modal
  const [historyFilter, setHistoryFilter] = useState<'all' | 'pronta_para_envio' | 'enviada' | 'erro'>('all');
  const [confirmClearOpen, setConfirmClearOpen] = useState<boolean>(false);
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);

  useEffect(() => {
    setDraftConfig(whatsappConfig);
  }, [whatsappConfig]);

  const showNotice = (type: 'success' | 'info' | 'error', text: string) => {
    setDispatchNotice({ type, text });
    setTimeout(() => setDispatchNotice(null), 4000);
  };

  const client = clients.find(c => c.id === selectedClientId) || clients[0];
  const clientOrders = orders.filter(o => o.clientId === client?.id);
  const activeOrder =
    clientOrders.find(o => o.id === selectedOrderId) ||
    clientOrders[0] ||
    undefined;
  const clientApt = appointments.find(a => a.clientId === client?.id);

  // Auto-sync order when client changes
  const handleClientChange = (newClientId: string) => {
    setSelectedClientId(newClientId);
    const firstOrderForClient = orders.find(o => o.clientId === newClientId);
    setSelectedOrderId(firstOrderForClient ? firstOrderForClient.id : '');
    setIsEditingMessage(false);
  };

  const formatTemplateVars = (rawTemplate: string): string => {
    const motoDesc = activeOrder
      ? `${activeOrder.motorcycleBrand} ${activeOrder.motorcycleModel}`.trim()
      : 'Sua Motocicleta';
    const servicosDesc = activeOrder?.services.map(s => s.serviceName).join(', ') || 'Serviço PK Detail';

    return rawTemplate
      .replace(/\{cliente\}/g, client?.name || 'Cliente')
      .replace(/\{os\}/g, activeOrder?.id || 'OS')
      .replace(/\{moto\}/g, motoDesc)
      .replace(/\{placa\}/g, activeOrder?.motorcyclePlate || '---')
      .replace(/\{servicos\}/g, servicosDesc)
      .replace(/\{total\}/g, (activeOrder?.total ?? 0).toFixed(2))
      .replace(/\{saldo\}/g, (activeOrder?.pendingBalance ?? 0).toFixed(2))
      .replace(/\{empresa\}/g, companyDisplayName(settings))
      .replace(/\{horario_fechamento\}/g, settings.closingTime || '17:00');
  };

  const generateMessage = (): string => {
    if (!client) return '';
    const motoName = activeOrder
      ? `${activeOrder.motorcycleBrand} ${activeOrder.motorcycleModel}`.trim()
      : 'sua motocicleta';
    const plateText = activeOrder?.motorcyclePlate || 'em cadastro';
    const money = (value: number) =>
      value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const orderTotal = money(activeOrder?.total ?? 0);
    const servicesList =
      activeOrder?.services && activeOrder.services.length > 0
        ? activeOrder.services.map(s => `• ${s.serviceName}: R$ ${money(s.price)}`).join('\n')
        : '• Serviços conforme avaliação técnica';

    switch (templateType) {
      case 'status_para_fazer':
        return formatTemplateVars(whatsappConfig.templates.para_fazer);
      case 'status_em_servico':
        return formatTemplateVars(whatsappConfig.templates.em_servico);
      case 'status_concluido':
        return formatTemplateVars(whatsappConfig.templates.concluido);
      case 'status_entregue':
        return formatTemplateVars(whatsappConfig.templates.entregue);
      case 'agendamento':
        return `Olá *${client.name}*! Tudo bem?\n\nConfirmamos o agendamento da sua motocicleta *${motoName}* (Placa: ${plateText}) na *PK DETAIL*!\n\n*Data:* ${clientApt?.date || 'Hoje'}\n*Horário:* ${clientApt?.startTime || '09:00'}\n*Serviços:* ${clientApt?.serviceNames.join(', ') || 'Lavagem Técnica'}\n\n*Local:* ${settings.address} - ${settings.city}\n\nQualquer imprevisto, favor nos avisar. Te aguardamos!`;
      case 'lembrete':
        return `Olá *${client.name}*! Lembrete da *PK DETAIL*:\n\nSeu atendimento está agendado para *${clientApt?.date || 'amanhã'}* às *${clientApt?.startTime || '09:00'}*.\n\nSua moto merece o melhor tratamento estético! Nos vemos em breve.`;
      case 'orcamento':
        return `Olá *${client.name}*! Segue a proposta da *PK DETAIL* para sua moto (${plateText}):\n\n${servicesList}\n\n*Total:* R$ ${orderTotal}\n\nPodemos dar início ao serviço? Aguardo seu OK!`;
      case 'pagamento':
        return `Olá *${client.name}*! Confirmamos o recebimento do pagamento no valor de *R$ ${orderTotal}* referente à OS *#${activeOrder?.id || '---'}*.\n\nMuito obrigado pela confiança na *PK DETAIL*! Seu comprovante digital está arquivado com segurança.`;
      case 'agradecimento':
        return `Olá *${client.name}*! Passando para agradecer pela preferência na *PK DETAIL*!\n\nEsperamos que tenha gostado do resultado na sua moto. Caso precise de qualquer ajuste ou queira nos avaliar, estamos à total disposição!\n\nUm forte abraço e boas aceleradas!`;
      case 'retorno':
        return `Olá *${client.name}*! Já faz algum tempo desde a última lavagem da sua *${activeOrder?.motorcycleModel || 'motocicleta'}* na *PK DETAIL*.\n\nPara manter a pintura protegida e evitar acúmulo de sujeira prejudicial ao verniz e metais, que tal agendarmos uma nova sessão técnica esta semana?\n\nResponda esta mensagem para garantir seu horário preferido!`;
    }
  };

  const generatedText = generateMessage();
  const messageText = isEditingMessage ? customMessage : generatedText;

  const studioWhatsappRaw = settings.whatsapp || settings.phone || '';
  const studioWhatsappDigits = normalizeBrazilWhatsappDigits(studioWhatsappRaw);
  const studioWhatsappDisplay = formatWhatsappDisplay(studioWhatsappRaw);
  const studioSelfTestUrl = buildWhatsappLink(
    studioWhatsappRaw,
    messageText || `Teste de automação WhatsApp — ${companyDisplayName(settings)}`
  );

  const buildWhatsAppUrl = (textToSend: string) => {
    if (!client) return '#';
    return buildWhatsappLink(client.whatsapp || client.phone, textToSend);
  };

  const whatsappDirectUrl = buildWhatsAppUrl(messageText);

  const handleTemplateSelect = (key: TemplateKey) => {
    setTemplateType(key);
    setIsEditingMessage(false);
  };

  const handleToggleEditMessage = () => {
    if (!isEditingMessage) {
      setCustomMessage(generatedText);
      setIsEditingMessage(true);
    } else {
      setIsEditingMessage(false);
    }
  };

  const handleCopyPreview = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopiedMsg(true);
      setTimeout(() => setCopiedMsg(false), 1800);
    } catch {}
  };

  const handleTriggerStatusDispatch = () => {
    if (!activeOrder) return;
    const statusMap: Partial<Record<TemplateKey, OSStatus>> = {
      status_para_fazer: 'para_fazer',
      status_em_servico: 'em_servico',
      status_concluido: 'concluido',
      status_entregue: 'entregue',
    };
    const chosenStatus = statusMap[templateType] || activeOrder.status;
    const log = sendWhatsappForOrderStatus(activeOrder.id, chosenStatus, messageText);
    if (log) {
      if (log.deliveryStatus === 'erro') {
        showNotice('error', log.errorMessage || 'Falha ao preparar disparo da OS.');
      } else if (log.deliveryStatus === 'enviando') {
        showNotice('info', `Enviando notificação via Webhook para ${activeOrder.clientName} (${activeOrder.id})...`);
      } else {
        showNotice('success', `Mensagem pronta na fila automática para ${activeOrder.clientName} (${activeOrder.id}).`);
      }
    }
  };

  const handleSaveAutomation = (e: React.FormEvent) => {
    e.preventDefault();
    updateWhatsappConfig(draftConfig);
    showNotice('success', 'Configurações de envio automático via WhatsApp salvas com sucesso.');
  };

  const handleTestWebhook = async () => {
    const url = draftConfig.webhookUrl.trim();
    if (!url) {
      showNotice('error', 'Informe a URL do seu Webhook / API WhatsApp antes de testar.');
      return;
    }
    setTestingWebhook(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (draftConfig.webhookToken.trim()) {
        headers['Authorization'] = `Bearer ${draftConfig.webhookToken.trim()}`;
      }
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          event: 'test_connection',
          source: companyDisplayName(settings),
          phone: studioWhatsappDigits,
          studioWhatsapp: studioWhatsappDigits,
          message: 'Teste de conexão automática de status da OS - PK DETAIL',
          timestamp: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showNotice('success', `Webhook respondeu com sucesso (HTTP ${res.status})!`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro de rede ou CORS';
      showNotice('error', `Não foi possível conectar ao webhook: ${msg}`);
    } finally {
      setTestingWebhook(false);
    }
  };

  const handleQuickToggleAutomation = () => {
    const next = { ...whatsappConfig, autoSendOnStatusChange: !whatsappConfig.autoSendOnStatusChange };
    updateWhatsappConfig(next);
    showNotice(
      'info',
      next.autoSendOnStatusChange
        ? 'Envio automático de status da OS ATIVADO.'
        : 'Envio automático de status da OS PAUSADO.'
    );
  };

  const pendingLogsCount = whatsappLogs.filter(l => l.deliveryStatus === 'pronta_para_envio').length;
  const sentLogsCount = whatsappLogs.filter(l => l.deliveryStatus === 'enviada').length;

  const filteredLogs = whatsappLogs.filter(l => historyFilter === 'all' || l.deliveryStatus === historyFilter);

  const templateButtons: { id: TemplateKey; label: string; group: 'status' | 'jornada'; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
    { id: 'status_para_fazer', label: 'OS: Aguardando no Pátio', group: 'status', icon: Clock, color: 'text-amber-700' },
    { id: 'status_em_servico', label: 'OS: Em Serviço na Baia', group: 'status', icon: Wrench, color: 'text-blue-700' },
    { id: 'status_concluido', label: 'OS: Concluída / Pronta', group: 'status', icon: CheckCircle2, color: 'text-orange-700' },
    { id: 'status_entregue', label: 'OS: Entregue ao Cliente', group: 'status', icon: PackageCheck, color: 'text-slate-700' },
    { id: 'agendamento', label: 'Confirmação de Agendamento', group: 'jornada', icon: Calendar, color: 'text-blue-700' },
    { id: 'lembrete', label: 'Lembrete do Dia Anterior', group: 'jornada', icon: MessageCircle, color: 'text-amber-700' },
    { id: 'orcamento', label: 'Orçamento de Detalhamento', group: 'jornada', icon: FileText, color: 'text-purple-700' },
    { id: 'pagamento', label: 'Confirmação de Pagamento', group: 'jornada', icon: DollarSign, color: 'text-orange-700' },
    { id: 'agradecimento', label: 'Pós-Venda / Agradecimento', group: 'jornada', icon: Heart, color: 'text-rose-700' },
    { id: 'retorno', label: 'Chamada de Retorno (30 dias)', group: 'jornada', icon: Repeat, color: 'text-indigo-700' },
  ];

  return (
    <div className="pk-section-stack text-left min-w-0">
      <PageHeader
        title="WhatsApp & Envio Automático de OS"
        badge={
          <span
            className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
              whatsappConfig.autoSendOnStatusChange
                ? 'bg-[#FFEDD5] text-[#9A3412]'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {whatsappConfig.autoSendOnStatusChange ? 'Automação OS Ativa' : 'Automação OS Pausada'}
          </span>
        }
        subtitle={`WhatsApp Oficial da Loja: ${studioWhatsappDisplay} · Disparo por status da OS, modelos e histórico`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {studioSelfTestUrl !== '#' && (
              <a
                href={studioSelfTestUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[40px] py-2 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition shrink-0"
              >
                <MessageCircle className="w-3.5 h-3.5 text-[#EA580C] shrink-0" />
                <span>Testar no Meu WhatsApp</span>
                <ExternalLink className="w-3 h-3 opacity-60 shrink-0" />
              </a>
            )}
            <button
              type="button"
              onClick={handleQuickToggleAutomation}
              className={`min-h-[40px] py-2 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition shrink-0 ${
                whatsappConfig.autoSendOnStatusChange
                  ? 'bg-[#9A3412] hover:bg-[#EA580C] text-white'
                  : 'bg-[#EA580C] hover:bg-[#9A3412] text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5 shrink-0" />
              <span>{whatsappConfig.autoSendOnStatusChange ? 'Pausar Automação' : 'Ativar Automação'}</span>
            </button>
          </div>
        }
      />

      {dispatchNotice && (
        <div
          className={`px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-between gap-2 border ${
            dispatchNotice.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : dispatchNotice.type === 'info'
              ? 'bg-slate-100 border-slate-200 text-slate-800'
              : 'bg-[#FFEDD5] border-[#F97316]/40 text-[#9A3412]'
          }`}
        >
          <span className="wrap-anywhere">{dispatchNotice.text}</span>
          <button
            type="button"
            onClick={() => setDispatchNotice(null)}
            className="text-[11px] font-extrabold underline shrink-0"
          >
            Fechar
          </button>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 pk-grid-gap items-stretch">
        <div className="bg-white pk-card-pad rounded-2xl border border-slate-200/80 shadow-xs h-full flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Automação por Status</span>
          <div className="mt-1 flex items-center gap-1.5">
            <span className={`text-base sm:text-lg font-black ${whatsappConfig.autoSendOnStatusChange ? 'text-[#EA580C]' : 'text-slate-500'}`}>
              {whatsappConfig.autoSendOnStatusChange ? 'Ativada' : 'Pausada'}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Modo: {whatsappConfig.deliveryMode === 'webhook_api' ? 'Webhook / API' : 'Link Direto (1 Clique)'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            setActiveTab('historico');
            setHistoryFilter('pronta_para_envio');
          }}
          className="bg-white pk-card-pad rounded-2xl border border-slate-200/80 shadow-xs h-full flex flex-col justify-between text-left hover:border-[#EA580C] transition"
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Aguardando Envio</span>
          <span className="fluid-kpi font-black font-mono text-amber-600 block mt-1 tabular-nums">{pendingLogsCount}</span>
          <span className="text-[11px] text-slate-500 mt-1 block">Mensagens automáticas na fila</span>
        </button>

        <div className="bg-white pk-card-pad rounded-2xl border border-slate-200/80 shadow-xs h-full flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Enviadas / Confirmadas</span>
          <span className="fluid-kpi font-black font-mono text-[#EA580C] block mt-1 tabular-nums">{sentLogsCount}</span>
          <span className="text-[11px] text-slate-500 mt-1 block">Disparos concluídos</span>
        </div>

        <div className="bg-white pk-card-pad rounded-2xl border border-slate-200/80 shadow-xs h-full flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Histórico Total</span>
          <span className="fluid-kpi font-black font-mono text-slate-900 block mt-1 tabular-nums">{whatsappLogs.length}</span>
          <span className="text-[11px] text-slate-500 mt-1 block">Registros automáticos e manuais</span>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex overflow-x-auto no-scrollbar sm:flex-wrap gap-1.5 bg-white p-1.5 sm:p-2 rounded-2xl border border-slate-200/80 min-w-0">
        <button
          type="button"
          onClick={() => setActiveTab('disparo')}
          className={`min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shrink-0 whitespace-nowrap ${
            activeTab === 'disparo' ? 'bg-[#9A3412] text-white shadow-xs' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Send className="w-3.5 h-3.5 shrink-0" />
          <span>Envio & Simulador</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('automacao')}
          className={`min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shrink-0 whitespace-nowrap ${
            activeTab === 'automacao' ? 'bg-[#9A3412] text-white shadow-xs' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Settings2 className="w-3.5 h-3.5 shrink-0" />
          <span>Automação por Status da OS</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('historico')}
          className={`min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shrink-0 whitespace-nowrap ${
            activeTab === 'historico' ? 'bg-[#9A3412] text-white shadow-xs' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <History className="w-3.5 h-3.5 shrink-0" />
          <span>Fila & Histórico</span>
          {pendingLogsCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-[#EA580C] text-white text-[10px] font-black tabular-nums">
              {pendingLogsCount}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: DISPARO & SIMULADOR */}
      {activeTab === 'disparo' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 pk-grid-gap items-stretch min-w-0">
          {/* Left: Selector & Templates (5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-2xl pk-card-pad border border-slate-200/80 shadow-xs space-y-3 h-full min-w-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Selecionar Cliente Destinatário</label>
                <select
                  value={selectedClientId}
                  onChange={e => handleClientChange(e.target.value)}
                  className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:border-[#EA580C] focus:outline-hidden"
                >
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ordem de Serviço Vinculada</label>
                <select
                  value={activeOrder?.id || ''}
                  onChange={e => {
                    setSelectedOrderId(e.target.value);
                    setIsEditingMessage(false);
                  }}
                  disabled={clientOrders.length === 0}
                  className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:border-[#EA580C] focus:outline-hidden disabled:opacity-60"
                >
                  {clientOrders.length === 0 ? (
                    <option value="">Nenhuma OS cadastrada para este cliente</option>
                  ) : (
                    clientOrders.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.id} — {o.motorcyclePlate} ({o.motorcycleModel}) · [{o.status}]
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Mensagens de Status da OS
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5">
                {templateButtons.filter(t => t.group === 'status').map(tpl => {
                  const Icon = tpl.icon;
                  const isSelected = templateType === tpl.id;
                  return (
                    <button
                      type="button"
                      key={tpl.id}
                      onClick={() => handleTemplateSelect(tpl.id)}
                      className={`w-full flex items-center gap-2.5 p-2.5 rounded-2xl text-xs font-bold text-left transition ${
                        isSelected
                          ? 'bg-[#9A3412] text-white shadow-xs'
                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-[#F97316]' : tpl.color}`} />
                      <span className="wrap-anywhere">{tpl.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Jornada & Relacionamento
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5">
                {templateButtons.filter(t => t.group === 'jornada').map(tpl => {
                  const Icon = tpl.icon;
                  const isSelected = templateType === tpl.id;
                  return (
                    <button
                      type="button"
                      key={tpl.id}
                      onClick={() => handleTemplateSelect(tpl.id)}
                      className={`w-full flex items-center gap-2.5 p-2.5 rounded-2xl text-xs font-bold text-left transition ${
                        isSelected
                          ? 'bg-[#9A3412] text-white shadow-xs'
                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-[#F97316]' : tpl.color}`} />
                      <span className="wrap-anywhere">{tpl.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Preview & Send Actions (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-2xl pk-card-pad border border-slate-200/80 shadow-xs space-y-3 flex flex-col justify-between h-full min-w-0">
            <div className="space-y-3 flex-1 flex flex-col min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 shrink-0">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 block">
                    Pré-visualização da Mensagem (WhatsApp)
                  </span>
                  <span className="text-xs font-bold text-orange-700 wrap-anywhere">
                    Para: {client?.name} ({client?.whatsapp || client?.phone})
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleToggleEditMessage}
                  className={`min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition ${
                    isEditingMessage
                      ? 'bg-[#9A3412] text-white border-[#9A3412]'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{isEditingMessage ? 'Usar Modelo Automático' : 'Editar Texto'}</span>
                </button>
              </div>

              {isEditingMessage ? (
                <div className="flex-1 flex flex-col space-y-2">
                  <textarea
                    rows={10}
                    value={customMessage}
                    onChange={e => setCustomMessage(e.target.value)}
                    className="w-full flex-1 bg-slate-50 border border-slate-300 rounded-2xl p-3.5 text-xs text-slate-800 leading-relaxed focus:border-[#EA580C] focus:outline-hidden"
                  />
                  <span className="text-[11px] text-slate-400">Edição manual ativa para este envio.</span>
                </div>
              ) : (
                <div className="bg-[#EFEAE2] p-3 sm:p-4 rounded-2xl border border-slate-200 flex-1 min-h-[170px] sm:min-h-[210px] flex items-end min-w-0">
                  <div className="bg-white rounded-2xl rounded-bl-none p-3.5 sm:p-4 shadow-xs w-full sm:max-w-xl space-y-1 text-xs text-slate-800 leading-relaxed font-sans whitespace-pre-wrap wrap-anywhere">
                    {messageText}
                    <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 font-mono mt-1">
                      <span>{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      <CheckCheck className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-2">
              {whatsappDirectUrl !== '#' ? (
                <a
                  href={whatsappDirectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    if (!client) return;
                    logManualWhatsappMessage({
                      clientId: client.id,
                      clientName: client.name,
                      clientPhone: client.whatsapp || client.phone,
                      orderId: activeOrder?.id,
                      templateLabel: templateButtons.find(t => t.id === templateType)?.label || 'Mensagem WhatsApp',
                      message: messageText,
                      whatsappUrl: whatsappDirectUrl,
                    });
                    showNotice('success', `Envio registrado no histórico para ${client.name}.`);
                  }}
                  className="sm:col-span-6 min-h-[46px] py-3 px-4 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-orange-600/30 transition flex items-center justify-center gap-2 active:scale-98"
                >
                  <Send className="w-4 h-4 shrink-0" />
                  <span>Enviar no WhatsApp</span>
                  <ExternalLink className="w-4 h-4 shrink-0 opacity-70" />
                </a>
              ) : (
                <span className="sm:col-span-6 min-h-[46px] py-3 px-4 rounded-2xl bg-slate-200 text-slate-500 font-bold text-xs flex items-center justify-center">
                  Cliente sem WhatsApp válido
                </span>
              )}

              <button
                type="button"
                onClick={handleTriggerStatusDispatch}
                disabled={!activeOrder}
                className="sm:col-span-4 min-h-[46px] py-3 px-3.5 rounded-2xl bg-slate-900 hover:bg-[#9A3412] disabled:opacity-50 text-white font-bold text-xs transition flex items-center justify-center gap-1.5"
              >
                <Zap className="w-4 h-4 text-[#F97316] shrink-0" />
                <span>Registrar / Disparar OS</span>
              </button>

              <button
                type="button"
                onClick={handleCopyPreview}
                className="sm:col-span-2 min-h-[46px] py-3 px-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition flex items-center justify-center gap-1.5"
              >
                {copiedMsg ? <Check className="w-4 h-4 text-[#EA580C]" /> : <Copy className="w-4 h-4" />}
                <span>{copiedMsg ? 'Copiada' : 'Copiar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AUTOMAÇÃO POR STATUS DA OS */}
      {activeTab === 'automacao' && (
        <form onSubmit={handleSaveAutomation} className="pk-section-stack">
          <div className="grid grid-cols-1 lg:grid-cols-12 pk-grid-gap items-stretch">
            {/* Left config: Master Switch & Delivery Channel */}
            <div className="lg:col-span-5 bg-white rounded-2xl pk-card-pad border border-slate-200/80 shadow-xs space-y-3 h-full">
              <div className="flex items-start justify-between gap-3 p-3.5 rounded-2xl bg-[#FFEDD5]/60 border border-[#F97316]/30">
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900">
                    Disparo Automático na Atualização da OS
                  </h3>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                    Sempre que uma OS mudar de status no Pátio, Lista de OS ou Comprovante, o sistema prepara ou envia automaticamente a mensagem para o WhatsApp do cliente.
                  </p>
                </div>
                <input
                  type="checkbox"
                  aria-label="Ativar disparo automático ao atualizar status da OS"
                  checked={draftConfig.autoSendOnStatusChange}
                  onChange={e =>
                    setDraftConfig(prev => ({ ...prev, autoSendOnStatusChange: e.target.checked }))
                  }
                  className="w-5 h-5 accent-[#EA580C] shrink-0 mt-0.5 cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 block">
                  Modo de Entrega Automática
                </span>

                <label
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition ${
                    draftConfig.deliveryMode === 'link_direto'
                      ? 'bg-[#FFEDD5]/50 border-[#EA580C]'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <input
                    type="radio"
                    name="deliveryMode"
                    value="link_direto"
                    checked={draftConfig.deliveryMode === 'link_direto'}
                    onChange={() =>
                      setDraftConfig(prev => ({ ...prev, deliveryMode: 'link_direto' as WhatsAppDeliveryMode }))
                    }
                    className="mt-1 accent-[#EA580C]"
                  />
                  <div>
                    <span className="text-xs font-black text-slate-900 block">
                      Link Direto WhatsApp (Sem API Paga)
                    </span>
                    <span className="text-[11px] text-slate-600 block mt-0.5 leading-relaxed">
                      Gera a mensagem personalizada instantaneamente ao mudar o status, adiciona na fila e abre o aviso flutuante de 1 clique.
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition ${
                    draftConfig.deliveryMode === 'webhook_api'
                      ? 'bg-[#FFEDD5]/50 border-[#EA580C]'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <input
                    type="radio"
                    name="deliveryMode"
                    value="webhook_api"
                    checked={draftConfig.deliveryMode === 'webhook_api'}
                    onChange={() =>
                      setDraftConfig(prev => ({ ...prev, deliveryMode: 'webhook_api' as WhatsAppDeliveryMode }))
                    }
                    className="mt-1 accent-[#EA580C]"
                  />
                  <div>
                    <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <Webhook className="w-3.5 h-3.5 text-[#EA580C]" />
                      <span>Webhook / API WhatsApp (Envio em 2º Plano)</span>
                    </span>
                    <span className="text-[11px] text-slate-600 block mt-0.5 leading-relaxed">
                      Envia requisição POST JSON automática para sua Evolution API, Z-API, N8N ou Make sempre que a OS mudar de status.
                    </span>
                  </div>
                </label>
              </div>

              {draftConfig.deliveryMode === 'webhook_api' && (
                <div className="space-y-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">URL do Webhook / Endpoint *</label>
                    <input
                      type="url"
                      placeholder="https://seu-n8n-ou-api.com/webhook/whatsapp-os"
                      value={draftConfig.webhookUrl}
                      onChange={e => setDraftConfig(prev => ({ ...prev, webhookUrl: e.target.value }))}
                      className="w-full text-xs bg-white border border-slate-300 rounded-xl p-2.5 focus:border-[#EA580C] focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Bearer Token / Chave (Opcional)</label>
                    <input
                      type="password"
                      placeholder="Token de autenticação"
                      value={draftConfig.webhookToken}
                      onChange={e => setDraftConfig(prev => ({ ...prev, webhookToken: e.target.value }))}
                      className="w-full text-xs bg-white border border-slate-300 rounded-xl p-2.5 focus:border-[#EA580C] focus:outline-hidden"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={testingWebhook}
                    onClick={handleTestWebhook}
                    className="w-full min-h-[38px] py-2 px-3 rounded-xl bg-slate-900 hover:bg-[#9A3412] text-white text-xs font-bold transition"
                  >
                    {testingWebhook ? 'Testando conexão...' : 'Testar Envio para Webhook'}
                  </button>
                </div>
              )}

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                <span className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block">
                  Variáveis Disponíveis nos Modelos
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {VARIABLES_HELP.map(v => (
                    <code key={v} className="text-[11px] font-mono bg-white border border-slate-200 text-[#9A3412] px-2 py-0.5 rounded-md font-bold">
                      {v}
                    </code>
                  ))}
                </div>
              </div>
            </div>

            {/* Right config: Per-status rules & editable templates */}
            <div className="lg:col-span-7 bg-white rounded-2xl pk-card-pad border border-slate-200/80 shadow-xs space-y-3 h-full">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Status Monitorados e Textos Automáticos</h3>
                  <p className="text-xs text-slate-500">Ative os gatilhos desejados e personalize cada mensagem</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    resetWhatsappConfig();
                    showNotice('info', 'Modelos restaurados para o padrão PK Detail.');
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restaurar Padrão</span>
                </button>
              </div>

              <div className="space-y-3">
                {OS_STATUS_META.map(item => {
                  const enabled = draftConfig.enabledStatuses[item.status];
                  return (
                    <div
                      key={item.status}
                      className={`p-3.5 rounded-2xl border transition space-y-2 ${
                        enabled ? 'bg-slate-50 border-slate-200' : 'bg-slate-50/50 border-slate-100 opacity-75'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-xs font-black text-slate-900 block">{item.label}</span>
                          <span className="text-[11px] text-slate-500 block">{item.desc}</span>
                        </div>
                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={e =>
                              setDraftConfig(prev => ({
                                ...prev,
                                enabledStatuses: { ...prev.enabledStatuses, [item.status]: e.target.checked },
                              }))
                            }
                            className="w-4 h-4 accent-[#EA580C]"
                          />
                          <span>Ativo</span>
                        </label>
                      </div>

                      <textarea
                        rows={3}
                        value={draftConfig.templates[item.status]}
                        onChange={e =>
                          setDraftConfig(prev => ({
                            ...prev,
                            templates: { ...prev.templates, [item.status]: e.target.value },
                          }))
                        }
                        className="w-full text-xs bg-white border border-slate-300 rounded-xl p-2.5 leading-relaxed focus:border-[#EA580C] focus:outline-hidden"
                      />
                    </div>
                  );
                })}
              </div>

              <button
                type="submit"
                className="w-full min-h-[44px] py-3 rounded-xl bg-[#EA580C] hover:bg-[#9A3412] text-white font-bold text-xs sm:text-sm shadow-md transition"
              >
                Salvar Configurações de Automação
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 3: FILA & HISTÓRICO DE ENVIOS */}
      {activeTab === 'historico' && (
        <div className="bg-white rounded-2xl pk-card-pad border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
            <div className="flex overflow-x-auto no-scrollbar sm:flex-wrap gap-1.5 min-w-0">
              {([
                { id: 'all', label: `Todos (${whatsappLogs.length})` },
                { id: 'pronta_para_envio', label: `Prontas p/ Envio (${pendingLogsCount})` },
                { id: 'enviada', label: `Enviadas (${sentLogsCount})` },
                { id: 'erro', label: `Erros (${whatsappLogs.filter(l => l.deliveryStatus === 'erro').length})` },
              ] as const).map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setHistoryFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 whitespace-nowrap ${
                    historyFilter === f.id ? 'bg-[#9A3412] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {whatsappLogs.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirmClearOpen(true)}
                className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpar Histórico</span>
              </button>
            )}
          </div>

          {filteredLogs.length === 0 ? (
            <div className="py-7 sm:py-8 text-center text-slate-400 space-y-2">
              <MessageCircle className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-600">Nenhuma mensagem registrada nesta visão</p>
              <p className="text-xs">
                Atualize o status de uma Ordem de Serviço no Pátio ou envie manualmente na aba Envio & Simulador.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map(log => (
                <div
                  key={log.id}
                  className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      {log.orderId && (
                        <span className="font-mono font-black bg-slate-900 text-white px-2 py-0.5 rounded-md text-[11px]">
                          {log.orderId}
                        </span>
                      )}
                      <span className="font-bold text-slate-900">{log.clientName}</span>
                      <span className="text-slate-500 font-mono text-[11px]">{log.clientPhone}</span>
                      <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-semibold text-[11px]">
                        {log.templateLabel}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          log.deliveryStatus === 'enviada'
                            ? 'bg-[#FFEDD5] text-[#9A3412]'
                            : log.deliveryStatus === 'enviando'
                            ? 'bg-sky-100 text-sky-700'
                            : log.deliveryStatus === 'erro'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {log.deliveryStatus === 'enviada'
                          ? 'Enviada'
                          : log.deliveryStatus === 'enviando'
                          ? 'Enviando...'
                          : log.deliveryStatus === 'erro'
                          ? 'Erro Webhook'
                          : 'Pronta p/ Envio'}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                        {new Date(log.timestamp).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 text-slate-700 whitespace-pre-wrap wrap-anywhere leading-relaxed">
                    {log.message}
                  </div>

                  {log.errorMessage && (
                    <div className="text-rose-600 font-semibold text-[11px] flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{log.errorMessage}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    {log.whatsappUrl && log.whatsappUrl !== '#' ? (
                      <a
                        href={log.whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => markWhatsappLogSent(log.id)}
                        className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#EA580C] hover:bg-[#9A3412] text-white font-bold text-xs flex items-center gap-1.5 transition"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{log.deliveryStatus === 'enviada' ? 'Reabrir WhatsApp' : 'Enviar Agora no WhatsApp'}</span>
                        <ExternalLink className="w-3 h-3 opacity-80" />
                      </a>
                    ) : (
                      <span className="min-h-[36px] px-3 py-1.5 rounded-xl bg-slate-200 text-slate-500 font-bold text-xs flex items-center">
                        Número sem WhatsApp válido
                      </span>
                    )}

                    {whatsappConfig.webhookUrl.trim() && (
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await retryWhatsappWebhook(log.id);
                          showNotice(
                            ok ? 'success' : 'error',
                            ok ? 'Webhook reenviado com sucesso!' : 'Falha ao reenviar via Webhook.'
                          );
                        }}
                        className="min-h-[36px] px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-[#9A3412] text-white font-bold text-xs flex items-center gap-1.5 transition"
                      >
                        <Webhook className="w-3.5 h-3.5" />
                        <span>Disparar Webhook</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(log.message);
                          setCopiedLogId(log.id);
                          setTimeout(() => setCopiedLogId(null), 1800);
                        } catch {}
                      }}
                      className="min-h-[36px] px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition"
                    >
                      {copiedLogId === log.id ? <Check className="w-3.5 h-3.5 text-[#EA580C]" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLogId === log.id ? 'Copiada' : 'Copiar'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Clear History Modal */}
      <ResponsiveModal
        isOpen={confirmClearOpen}
        onClose={() => setConfirmClearOpen(false)}
        title="Limpar Histórico WhatsApp"
        maxWidth="sm"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-900">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Deseja limpar todos os registros da fila e histórico de mensagens WhatsApp? Suas configurações e modelos salvos serão mantidos.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setConfirmClearOpen(false)}
              className="min-h-[42px] py-2 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                clearWhatsappLogs();
                setConfirmClearOpen(false);
                showNotice('info', 'Histórico de envios WhatsApp limpo.');
              }}
              className="min-h-[42px] py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs"
            >
              Limpar Agora
            </button>
          </div>
        </div>
      </ResponsiveModal>
    </div>
  );
};
