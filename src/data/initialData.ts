import {
  User,
  Client,
  Motorcycle,
  ServiceItem,
  Product,
  ServiceOrder,
  Appointment,
  Expense,
  CashRegister,
  LoyaltyCoupon,
  CompanySettings,
  AuditLog,
  CommissionRecord,
  WhatsAppAutomationConfig
} from '../types';

/**
 * Dados iniciais de uma instalação limpa.
 *
 * O sistema começa sem clientes, motos, serviços, produtos, ordens, agenda,
 * despesas, comissões, cupons ou logs — prontos para a empresa configurar.
 * Mantém apenas o usuário administrador e as configurações padrão.
 */
export const INITIAL_USERS: User[] = [
  {
    id: 'usr_1',
    name: 'Administrador',
    phone: '',
    email: 'ricardo@pkdetail.com.br',
    role: 'admin',
    active: true,
    hireDate: '',
    specialties: [],
    commissionType: 'none',
    commissionValue: 0
  }
];

export const INITIAL_CLIENTS: Client[] = [];

export const INITIAL_MOTORCYCLES: Motorcycle[] = [];

export const DEFAULT_SERVICE_CATEGORIES: string[] = [
  'Lavagem Simples',
  'Lavagem Detalhada',
  'Polimento',
  'Cerâmica / Vitrificação',
  'Higienização',
  'Acabamento',
  'Outros Serviços'
];

export const INITIAL_SERVICES: ServiceItem[] = [];

export const INITIAL_PRODUCTS: Product[] = [];

export const INITIAL_ORDERS: ServiceOrder[] = [];

export const INITIAL_APPOINTMENTS: Appointment[] = [];

export const INITIAL_EXPENSES: Expense[] = [];

export const INITIAL_CASH_REGISTER: CashRegister = {
  id: '',
  openedAt: '',
  status: 'fechado',
  operatorId: '',
  operatorName: '',
  initialBalance: 0,
  totalIn: 0,
  totalOut: 0,
  expectedBalance: 0,
  movements: [],
  notes: ''
};

export const INITIAL_COMMISSIONS: CommissionRecord[] = [];

export const INITIAL_COUPONS: LoyaltyCoupon[] = [];

export const INITIAL_SETTINGS: CompanySettings = {
  name: 'PK Detail Estética Automotiva Ltda',
  fantasyName: 'PK DETAIL',
  cnpj: '48.912.304/0001-89',
  phone: '(75) 98807-7173',
  whatsapp: '5575988077173',
  email: 'contato@pkdetail.com.br',
  address: 'Rua das Motocicletas, 1420 - Galpão 03',
  city: 'São Paulo - SP',
  postalCode: '01311-000',
  openingTime: '09:00',
  closingTime: '17:00',
  operatingDays: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
  autoStockDeduction: true,
  commissionsEnabled: true,
  loyaltyPointsPerReal: 1,
  theme: 'light'
};

export const INITIAL_AUDIT_LOGS: AuditLog[] = [];

export const INITIAL_WHATSAPP_CONFIG: WhatsAppAutomationConfig = {
  autoSendOnStatusChange: true,
  deliveryMode: 'link_direto',
  webhookUrl: '',
  webhookToken: '',
  enabledStatuses: {
    para_fazer: true,
    em_servico: true,
    concluido: true,
    entregue: true,
    cancelado: false,
  },
  templates: {
    para_fazer:
      'Olá *{cliente}*! Recebemos sua motocicleta *{moto}* (Placa: *{placa}*) na *PK DETAIL*.\\n\\n*OS:* #{os}\\n*Serviços:* {servicos}\\n*Total:* R$ {total}\\n*Status atual:* Aguardando Início no Pátio\\n\\nAssim que iniciarmos o atendimento, avisaremos por aqui!',
    em_servico:
      'Olá *{cliente}*! Boas notícias da *PK DETAIL*!\\n\\nSua motocicleta *{moto}* (Placa: *{placa}*) acabou de entrar na baia técnica para execução dos serviços da OS *#{os}*.\\n\\n*Serviços:* {servicos}\\n*Status atual:* Em Serviço',
    concluido:
      'Olá *{cliente}*! Sua motocicleta *{moto}* (Placa: *{placa}*) está *PRONTA E FINALIZADA* na *PK DETAIL*!\\n\\n*OS:* #{os}\\n*Status:* Concluído e Inspecionado\\n*Total:* R$ {total} | Saldo pendente: R$ {saldo}\\n\\nPode vir retirar quando desejar (atendimento até às {horario_fechamento}). Esperamos você!',
    entregue:
      'Olá *{cliente}*! Confirmamos a entrega da sua motocicleta *{moto}* (Placa: *{placa}*) referente à OS *#{os}*.\\n\\nMuito obrigado pela confiança na *PK DETAIL*! Qualquer dúvida sobre o atendimento, conte conosco. Boas aceleradas!',
    cancelado:
      'Olá *{cliente}*, informamos que a Ordem de Serviço *#{os}* ({moto} · Placa: {placa}) na *PK DETAIL* foi marcada como *Cancelada*.\\n\\nSe precisar reagendar seu atendimento, responda esta mensagem!',
  },
};
