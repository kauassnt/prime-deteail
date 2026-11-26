import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, ChevronDown, RotateCcw, Save, Check } from 'lucide-react';

type TemplateId =
  | 'resumo_os'
  | 'servico_concluido'
  | 'agendamento_criado'
  | 'confirmacao_agendamento'
  | 'solicitacao_recebida'
  | 'agendamento_confirmado'
  | 'tirar_duvida'
  | 'sugerir_horario'
  | 'envio_orcamento'
  | 'recibo_pagamento'
  | 'recibo_sinal'
  | 'solicitar_feedback';

interface TemplateDef {
  id: TemplateId;
  label: string;
  description: string;
  template: string;
}

interface TemplateGroup {
  title: string;
  items: TemplateDef[];
}

const STORAGE_KEY = 'pk_detail_message_templates_v1';

const GROUPS: TemplateGroup[] = [
  {
    title: 'ORDEM DE SERVIÇO',
    items: [
      {
        id: 'resumo_os',
        label: 'Resumo da Ordem de Serviço',
        description: 'Enviada pelo botão do WhatsApp em uma OS em andamento e ao finalizar a criação da OS.',
        template:
          'Olá, {cliente}!\nSeguir e o resumo da sua Ordem de Serviço:\n\nVeículo: {veiculo} - {placa}\n\nServiços:\n{servicos}\n\nTotal: {total}\n\nO PDF com os detalhes completos será enviado em seguida.\n\nQualquer dúvida, estamos à disposição!',
      },
      {
        id: 'servico_concluido',
        label: 'Serviço concluído / veículo pronto',
        description: 'Enviada quando a moto está pronta para retirada.',
        template:
          'Olá, {cliente}! Tudo bem?\n\nSua moto {veiculo} ({placa}) já está pronta para retirada na {empresa}.\n\nTotal do serviço: {total}\n\nNosso horário de atendimento está no site. Esperamos você!',
      },
    ],
  },
  {
    title: 'AGENDA',
    items: [
      {
        id: 'agendamento_criado',
        label: 'Agendamento criado',
        description: 'Enviada assim que um agendamento é registrado no sistema.',
        template:
          'Olá, {cliente}!\n\nSeu agendamento na {empresa} foi registrado com sucesso.\n\nEm breve confirmamos o horário. Qualquer dúvida, é só responder por aqui.',
      },
      {
        id: 'confirmacao_agendamento',
        label: 'Confirmação de agendamento',
        description: 'Enviada para confirmar data e horário do agendamento.',
        template:
          'Olá, {cliente}!\n\nSeu agendamento está confirmado:\n\nVeículo: {veiculo} - {placa}\n\nQualquer imprevisto, avise com antecedência para liberarmos o horário.\n\nAté breve!',
      },
    ],
  },
  {
    title: 'AGENDAMENTO ONLINE',
    items: [
      {
        id: 'solicitacao_recebida',
        label: 'Solicitação recebida',
        description: 'Resposta automática quando o cliente solicita um horário pela vitrine.',
        template:
          'Olá, {cliente}! Recebemos sua solicitação de agendamento.\n\nNossa equipe vai confirmar o horário disponível e responder por aqui em breve.',
      },
      {
        id: 'agendamento_confirmado',
        label: 'Agendamento confirmado',
        description: 'Enviada quando a solicitação online é confirmada.',
        template:
          'Olá, {cliente}! Seu horário na {empresa} está confirmado.\n\nVeículo: {veiculo} - {placa}\n\nEstamos te esperando!',
      },
      {
        id: 'tirar_duvida',
        label: 'Tirar uma dúvida',
        description: 'Enviada quando o cliente envia uma dúvida pelo agendamento online.',
        template:
          'Olá, {cliente}!\n\nRecebemos sua dúvida e já estamos verificando. Respondemos por aqui o quanto antes.\n\nObrigado pelo contato!',
      },
      {
        id: 'sugerir_horario',
        label: 'Sugerir outro horário',
        description: 'Enviada quando o horário solicitado não está disponível.',
        template:
          'Olá, {cliente}!\n\nO horário solicitado não está disponível. Podemos sugerir outra data para o seu {veiculo}?\n\nResponda por aqui que ajustamos juntos.',
      },
    ],
  },
  {
    title: 'ORÇAMENTOS',
    items: [
      {
        id: 'envio_orcamento',
        label: 'Envio de orçamento',
        description: 'Enviada junto com o orçamento para aprovação do cliente.',
        template:
          'Olá, {cliente}!\n\nSegue o orçamento para o seu {veiculo} ({placa}):\n\n{servicos}\n\nSubtotal: {subtotal}\nDesconto: {desconto}\nTotal: {total}\n\nPodemos seguir com o serviço?',
      },
    ],
  },
  {
    title: 'PAGAMENTOS',
    items: [
      {
        id: 'recibo_pagamento',
        label: 'Recibo de pagamento',
        description: 'Enviada após a quitação de uma ordem de serviço.',
        template:
          'Olá, {cliente}!\n\nRecebemos seu pagamento de {total} referente à {veiculo} ({placa}).\n\nObrigado pela confiança na {empresa}!',
      },
      {
        id: 'recibo_sinal',
        label: 'Recibo de sinal / recebimento',
        description: 'Enviada ao registrar um sinal ou pagamento parcial.',
        template:
          'Olá, {cliente}!\n\nRegistramos seu pagamento parcial de {total} para o serviço da {veiculo} ({placa}).\n\nQualquer dúvida, estamos à disposição!',
      },
    ],
  },
  {
    title: 'PÓS-VENDA',
    items: [
      {
        id: 'solicitar_feedback',
        label: 'Solicitação de feedback',
        description: 'Enviada depois da entrega para avaliar o atendimento.',
        template:
          'Olá, {cliente}! Esperamos que tenha gostado do resultado na {empresa}.\n\nSua opinião é muito importante para nós:\n{link_avaliacao}\n\nObrigado!',
      },
    ],
  },
];

const ALL_ITEMS = GROUPS.flatMap(group => group.items);
const DEFAULT_TEMPLATES = Object.fromEntries(ALL_ITEMS.map(item => [item.id, item.template])) as Record<TemplateId, string>;

const VARIABLES = ['cliente', 'veiculo', 'placa', 'servicos', 'subtotal', 'desconto', 'total', 'empresa', 'link_avaliacao'];

const SAMPLE: Record<string, string> = {
  cliente: 'João',
  veiculo: 'Honda Civic',
  placa: 'ABC1D23',
  servicos: '• Lavagem Completa — R$ 150,00\n• Higienização interna — R$ 100,00',
  subtotal: 'R$ 250,00',
  desconto: 'R$ 0,00',
  total: 'R$ 250,00',
  empresa: 'PK Detail',
  link_avaliacao: 'https://pkdetail.com.br/avaliar',
};

const loadTemplates = (): Record<TemplateId, string> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return { ...DEFAULT_TEMPLATES, ...(parsed as Partial<Record<TemplateId, string>>) };
  } catch {
    return { ...DEFAULT_TEMPLATES };
  }
};

const renderPreview = (template: string) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => SAMPLE[key] ?? match);

export const MessageTemplatesModule: React.FC = () => {
  const [templates, setTemplates] = useState<Record<TemplateId, string>>(() => loadTemplates());
  const [activeId, setActiveId] = useState<TemplateId>('resumo_os');
  const [openGroups, setOpenGroups] = useState<string[]>(['ORDEM DE SERVIÇO']);
  const [saved, setSaved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const active = ALL_ITEMS.find(item => item.id === activeId) ?? ALL_ITEMS[0];
  const value = templates[activeId];
  const isDefault = value === DEFAULT_TEMPLATES[activeId];

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 2200);
    return () => window.clearTimeout(timer);
  }, [saved]);

  const toggleGroup = (title: string) => {
    setOpenGroups(prev => (prev.includes(title) ? prev.filter(item => item !== title) : [...prev, title]));
  };

  const insertVariable = (variable: string) => {
    const token = `{${variable}}`;
    const textarea = textareaRef.current;
    const current = templates[activeId];
    if (!textarea) {
      setTemplates(prev => ({ ...prev, [activeId]: `${current}${token}` }));
      return;
    }
    const start = textarea.selectionStart ?? current.length;
    const end = textarea.selectionEnd ?? current.length;
    const next = `${current.slice(0, start)}${token}${current.slice(end)}`;
    setTemplates(prev => ({ ...prev, [activeId]: next }));
    requestAnimationFrame(() => {
      textarea.focus();
      const caret = start + token.length;
      textarea.setSelectionRange(caret, caret);
    });
  };

  const handleSave = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    } catch {
      // segue em memória
    }
    setSaved(true);
  };

  const restoreDefault = () => {
    setTemplates(prev => ({ ...prev, [activeId]: DEFAULT_TEMPLATES[activeId] }));
  };

  return (
    <div className="flex flex-col gap-4 min-w-0">
      {/* Header */}
      <div className="flex items-stretch gap-2.5 min-w-0">
        <span className="w-1.5 rounded-full bg-[#EA580C] shrink-0" />
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-slate-900" />
            Personalizar Mensagens
          </h1>
          <p className="text-xs text-slate-500 mt-1.5">
            Personalize as mensagens de WhatsApp enviadas aos seus clientes.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[236px_minmax(0,1fr)_286px] gap-3 items-start min-w-0">
        {/* Step 1: message picker */}
        <section className="rounded-2xl border border-slate-200 bg-white p-3 min-w-0">
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-[#EA580C] text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
              1
            </span>
            <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">Passo 1</p>
          </div>
          <p className="text-[13px] font-extrabold text-slate-900 leading-snug mt-1">
            Escolha a mensagem que você quer alterar
          </p>

          <div className="mt-2.5 space-y-2">
            {GROUPS.map(group => {
              const open = openGroups.includes(group.title);
              const hasActive = group.items.some(item => item.id === activeId);
              return (
                <div key={group.title} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.title)}
                    aria-expanded={open}
                    className={`w-full flex items-center justify-between gap-1 rounded-lg px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider transition border ${
                      hasActive
                        ? 'bg-[#FFEDD5] border-[#EA580C] text-[#9A3412]'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <span className="truncate">{group.title}</span>
                    <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>

                  {open && (
                    <div className="mt-1 space-y-0.5">
                      {group.items.map(item => {
                        const selected = item.id === activeId;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setActiveId(item.id);
                              setSaved(false);
                            }}
                            className={`w-full text-left px-2 py-1.5 rounded-md text-[10.5px] leading-snug transition ${
                              selected
                                ? 'bg-[#FFEDD5]/70 text-[#9A3412] font-bold'
                                : 'text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Step 2: editor */}
        <section className="rounded-2xl border border-slate-200 bg-white p-3.5 min-w-0">
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-[#EA580C] text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
              2
            </span>
            <div className="min-w-0">
              <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">Passo 2</p>
              <p className="text-[13px] font-extrabold text-slate-900 leading-snug">Personalize sua mensagem aqui</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
            <p className="text-[12.5px] font-bold text-slate-900">{active.label}</p>
            <span className="inline-flex rounded-md border border-[#EA580C] bg-[#FFEDD5] px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-wider text-[#9A3412]">
              {isDefault ? 'Padrão PK Detail' : 'Personalizada'}
            </span>
          </div>
          <p className="text-[10.5px] text-slate-500 mt-1">{active.description}</p>

          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-3 mb-1">Mensagem</p>

          <div className="rounded-xl border border-[#EA580C] bg-white overflow-hidden">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={e => {
                const nextValue = e.target.value;
                setTemplates(prev => ({ ...prev, [activeId]: nextValue }));
                setSaved(false);
              }}
              spellCheck={false}
              aria-label="Conteúdo da mensagem"
              className="block w-full min-h-[250px] resize-y bg-white px-3 py-2.5 text-xs leading-relaxed text-slate-800 placeholder:text-slate-400 caret-slate-900 focus:outline-hidden font-sans"
            />
          </div>

          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-3 mb-1.5">
            Variáveis disponíveis
          </p>
          <div className="flex flex-wrap gap-1.5">
            {VARIABLES.map(variable => (
              <button
                key={variable}
                type="button"
                onClick={() => insertVariable(variable)}
                className="min-h-[26px] px-2 rounded-md border border-[#EA580C] bg-[#FFEDD5]/60 hover:bg-[#FFEDD5] text-[10px] font-bold text-[#9A3412] transition"
              >
                {`{${variable}}`}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">Toque em uma variável para inseri-la onde o cursor estiver.</p>

          <div className="flex items-center justify-between gap-2 flex-wrap mt-3 pt-2.5 border-t border-slate-100">
            <span className="text-[10px] text-slate-400 tabular-nums">{value.length} caracteres</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={restoreDefault}
                disabled={isDefault}
                className="min-h-[32px] px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-600 text-[10.5px] font-bold flex items-center gap-1.5 transition"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restaurar padrão</span>
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="min-h-[32px] px-3.5 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] text-white text-[10.5px] font-extrabold flex items-center gap-1.5 transition"
              >
                {saved ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" />}
                <span>{saved ? 'Salvo' : 'Salvar'}</span>
              </button>
            </div>
          </div>
        </section>

        {/* WhatsApp preview */}
        <aside className="rounded-2xl border border-slate-200 bg-white p-3 min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Preview no WhatsApp</p>
          <div className="mt-2 rounded-xl bg-[#E5DDD5] p-2.5 min-w-0">
            <div className="ml-auto max-w-full rounded-lg rounded-tr-none bg-[#DCF8C6] px-2.5 py-2 shadow-xs">
              <p className="text-[10.5px] text-slate-800 whitespace-pre-wrap break-words leading-relaxed">
                {renderPreview(value)}
              </p>
              <p className="text-[8.5px] text-slate-500 text-right mt-1">09:41</p>
            </div>
          </div>
          <p className="text-[9.5px] text-slate-400 mt-2 leading-snug">
            Os dados acima são fictícios, apenas para exemplo.
          </p>
        </aside>
      </div>
    </div>
  );
};
