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

export const INITIAL_USERS: User[] = [
  {
    id: 'usr_1',
    name: 'Ricardo Santos',
    phone: '(11) 98765-4321',
    email: 'ricardo@pkdetail.com.br',
    role: 'admin',
    active: true,
    hireDate: '2023-01-10',
    specialties: ['Gestão', 'Inspeção Final', 'Vitrificação Master'],
    commissionType: 'percent',
    commissionValue: 10,
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr_2',
    name: 'Lucas Almeida (Mestre)',
    phone: '(11) 97654-3210',
    email: 'lucas.detail@pkdetail.com.br',
    role: 'gerente',
    active: true,
    hireDate: '2023-03-15',
    specialties: ['Polimento Técnico', 'Descontaminação', 'Pintura'],
    commissionType: 'percent',
    commissionValue: 20,
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr_3',
    name: 'Gabriel Vieira',
    phone: '(11) 96543-2109',
    email: 'gabriel.wash@pkdetail.com.br',
    role: 'operacional',
    active: true,
    hireDate: '2023-08-01',
    specialties: ['Lavagem Técnica', 'Chassi', 'Secagem com Ar'],
    commissionType: 'percent',
    commissionValue: 15,
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'usr_4',
    name: 'Bianca Costa',
    phone: '(11) 95432-1098',
    email: 'atendimento@pkdetail.com.br',
    role: 'atendente',
    active: true,
    hireDate: '2024-02-10',
    specialties: ['Atendimento', 'Checklist', 'CRM'],
    commissionType: 'fixed',
    commissionValue: 5,
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80'
  }
];

export const INITIAL_CLIENTS: Client[] = [
  {
    id: 'cli_1',
    name: 'Felipe Ramos',
    phone: '(11) 99123-4567',
    whatsapp: '5511991234567',
    email: 'felipe.ramos@gmail.com',
    document: '342.879.118-20',
    address: 'Av. Paulista, 1500 - Cerqueira César, SP',
    notes: 'Exigente com detalhamento do escape e balança.',
    createdAt: '2024-01-15',
    totalSpent: 1850.00,
    visitsCount: 6,
    lastVisitDate: '2026-11-10',
    loyaltyPoints: 185,
    loyaltyTier: 'Ouro',
    tags: ['vip', 'frequente']
  },
  {
    id: 'cli_2',
    name: 'Camila Mendonça',
    phone: '(11) 98234-5678',
    whatsapp: '5511982345678',
    email: 'camila.mendonca@yahoo.com.br',
    document: '412.339.778-55',
    address: 'Rua Augusta, 850 - Consolação, SP',
    notes: 'Prefere receber aviso 30min antes de ficar pronta.',
    createdAt: '2024-04-20',
    totalSpent: 720.00,
    visitsCount: 3,
    lastVisitDate: '2026-11-08',
    loyaltyPoints: 72,
    loyaltyTier: 'Prata',
    tags: ['frequente']
  },
  {
    id: 'cli_3',
    name: 'Eduardo Silveira',
    phone: '(11) 97345-6789',
    whatsapp: '5511973456789',
    email: 'edu.silveira@outlook.com',
    document: '219.044.898-10',
    address: 'Rua Domingos de Morais, 220 - Vila Mariana, SP',
    notes: 'Usa a moto diariamente em entregas premium.',
    createdAt: '2024-09-02',
    totalSpent: 350.00,
    visitsCount: 2,
    lastVisitDate: '2026-11-01',
    loyaltyPoints: 35,
    loyaltyTier: 'Bronze',
    tags: ['frequente']
  },
  {
    id: 'cli_4',
    name: 'Rodrigo Nogueira',
    phone: '(11) 96456-7890',
    whatsapp: '5511964567890',
    email: 'rodrigo.nog@terra.com.br',
    document: '188.542.908-01',
    address: 'Alameda Santos, 980 - Jardins, SP',
    notes: 'Cliente novo indicado pelo Moto Clube SP.',
    createdAt: '2026-11-09',
    totalSpent: 450.00,
    visitsCount: 1,
    lastVisitDate: '2026-11-09',
    loyaltyPoints: 45,
    loyaltyTier: 'Bronze',
    tags: ['novo']
  },
  {
    id: 'cli_5',
    name: 'Marcos Vinicius',
    phone: '(11) 95567-8901',
    whatsapp: '5511955678901',
    email: 'marcos.vini@gmail.com',
    document: '301.218.490-67',
    address: 'Av. Brigadeiro Faria Lima, 3400 - Itaim Bibi, SP',
    notes: 'Não vinha há mais de 60 dias.',
    createdAt: '2023-11-12',
    totalSpent: 1200.00,
    visitsCount: 5,
    lastVisitDate: '2026-08-15',
    loyaltyPoints: 120,
    loyaltyTier: 'Prata',
    tags: ['inativo']
  }
];

export const INITIAL_MOTORCYCLES: Motorcycle[] = [
  {
    id: 'mot_1',
    clientId: 'cli_1',
    clientName: 'Felipe Ramos',
    brand: 'BMW',
    model: 'R 1250 GS Adventure',
    plate: 'BMW-9G82',
    color: 'Triple Black',
    cc: 1254,
    year: 2023,
    mileage: 18450,
    notes: 'Bolsas laterais removidas pelo cliente.'
  },
  {
    id: 'mot_2',
    clientId: 'cli_2',
    clientName: 'Camila Mendonça',
    brand: 'Yamaha',
    model: 'MT-07 ABS',
    plate: 'MTO-7B21',
    color: 'Storm Fluo',
    cc: 689,
    year: 2024,
    mileage: 6200,
    notes: 'Rodas fluorescentes precisam de desengraxante especial.'
  },
  {
    id: 'mot_3',
    clientId: 'cli_3',
    clientName: 'Eduardo Silveira',
    brand: 'Honda',
    model: 'CB 650R Neo Sports',
    plate: 'BRA-2E19',
    color: 'Vermelho Metálico',
    cc: 649,
    year: 2022,
    mileage: 24100,
    notes: 'Cuidado extra com as aletas de radiador.'
  },
  {
    id: 'mot_4',
    clientId: 'cli_4',
    clientName: 'Rodrigo Nogueira',
    brand: 'Triumph',
    model: 'Street Triple 765 RS',
    plate: 'TRF-3X45',
    color: 'Silver Ice',
    cc: 765,
    year: 2024,
    mileage: 4300,
    notes: 'Retrovisores de ponta de guidão originais.'
  },
  {
    id: 'mot_5',
    clientId: 'cli_5',
    clientName: 'Marcos Vinicius',
    brand: 'Kawasaki',
    model: 'Z900 Edition',
    plate: 'KAW-5Z90',
    color: 'Metallic Spark Black',
    cc: 948,
    year: 2021,
    mileage: 31000,
    notes: 'Ponteira esportiva em fibra de carbono.'
  }
];

export const DEFAULT_SERVICE_CATEGORIES: string[] = [
  'Lavagem Simples',
  'Lavagem Detalhada',
  'Polimento',
  'Cerâmica / Vitrificação',
  'Higienização',
  'Acabamento',
  'Outros Serviços'
];

export const INITIAL_SERVICES: ServiceItem[] = [
  {
    id: 'srv_1',
    name: 'Lavagem Técnica Simples',
    category: 'Lavagem Simples',
    description: 'Pré-lavagem com snow foam pH neutro, lavagem manual dois baldes, limpeza de rodas, secagem com soprador de ar quente e lubrificação de corrente.',
    price: 80.00,
    estimatedMinutes: 60,
    active: true,
    warrantyDays: 0,
    productsUsed: [
      { productId: 'prd_1', productName: 'Shampoo pH Neutro V-Floc', estimatedQty: 50, unit: 'ml' },
      { productId: 'prd_3', productName: 'Desengraxante Delet', estimatedQty: 40, unit: 'ml' },
      { productId: 'prd_6', productName: 'Pano Microfibra 500GSM', estimatedQty: 1, unit: 'un' }
    ]
  },
  {
    id: 'srv_2',
    name: 'Lavagem Detalhada PK Pro',
    category: 'Lavagem Detalhada',
    description: 'Lavagem minuciosa com desmontagem de carenagens leves quando aplicável, pincelamento técnico em todos os parafusos, cabeçote, chassi, descontaminação ferrosa de rodas e proteção com cera de carnaúba.',
    price: 160.00,
    estimatedMinutes: 60,
    active: true,
    warrantyDays: 0,
    productsUsed: [
      { productId: 'prd_1', productName: 'Shampoo pH Neutro V-Floc', estimatedQty: 80, unit: 'ml' },
      { productId: 'prd_2', productName: 'Cera Carnaúba Tok Final', estimatedQty: 30, unit: 'ml' },
      { productId: 'prd_3', productName: 'Desengraxante Delet', estimatedQty: 70, unit: 'ml' },
      { productId: 'prd_4', productName: 'Restaurador de Plásticos Restaurax', estimatedQty: 25, unit: 'ml' }
    ]
  },
  {
    id: 'srv_3',
    name: 'Higienização e Descontaminação de Pintura',
    category: 'Higienização',
    description: 'Descontaminação com clay bar, remoção de piche, pulverizados, seiva de árvore e fuligem ferrosa industrial. Deixa o verniz suave para proteção.',
    price: 130.00,
    estimatedMinutes: 60,
    active: true,
    warrantyDays: 0,
    productsUsed: [
      { productId: 'prd_1', productName: 'Shampoo pH Neutro V-Floc', estimatedQty: 40, unit: 'ml' },
      { productId: 'prd_3', productName: 'Desengraxante Delet', estimatedQty: 50, unit: 'ml' }
    ]
  },
  {
    id: 'srv_4',
    name: 'Polimento Técnico em 3 Etapas',
    category: 'Polimento',
    description: 'Corte, refino e lustro profissional no tanque, carenagens e paralama. Elimina micro-riscos, teias de aranha (swirls) e restaura a profundidade do brilho.',
    price: 290.00,
    estimatedMinutes: 180,
    active: true,
    warrantyDays: 0,
    productsUsed: [
      { productId: 'prd_2', productName: 'Cera Carnaúba Tok Final', estimatedQty: 40, unit: 'ml' },
      { productId: 'prd_6', productName: 'Pano Microfibra 500GSM', estimatedQty: 2, unit: 'un' }
    ]
  },
  {
    id: 'srv_5',
    name: 'Vitrificação Cerâmica 9H (V-Paint Pro)',
    category: 'Cerâmica / Vitrificação',
    description: 'Aplicação de nano-revestimento cerâmico com dureza 9H no tanque e peças pintadas. Proteção contra raios UV, fezes de pássaros e repelência extrema à água e sujeira por até 2 anos.',
    price: 490.00,
    estimatedMinutes: 240,
    active: true,
    warrantyDays: 0,
    productsUsed: [
      { productId: 'prd_5', productName: 'Vitrificador Cerâmico V-Paint Pro', estimatedQty: 20, unit: 'ml' },
      { productId: 'prd_6', productName: 'Pano Microfibra 500GSM', estimatedQty: 3, unit: 'un' }
    ]
  },
  {
    id: 'srv_6',
    name: 'Revitalização de Plásticos & Borrachas',
    category: 'Outros Serviços',
    description: 'Tratamento com polímeros especiais para revigorar plásticos esbranquiçados pelo sol, mangueiras e borrachas.',
    price: 60.00,
    estimatedMinutes: 30,
    active: true,
    warrantyDays: 0,
    productsUsed: [
      { productId: 'prd_4', productName: 'Restaurador de Plásticos Restaurax', estimatedQty: 35, unit: 'ml' }
    ]
  },
  {
    id: 'srv_7',
    name: 'Polimento e Cristalização do Escapamento',
    category: 'Outros Serviços',
    description: 'Remoção de azulamento térmico e manchas em curvas e ponteiras de inox ou cromo, conferindo acabamento espelhado.',
    price: 110.00,
    estimatedMinutes: 50,
    active: true,
    warrantyDays: 0,
    productsUsed: [
      { productId: 'prd_6', productName: 'Pano Microfibra 500GSM', estimatedQty: 1, unit: 'un' }
    ]
  }
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prd_1',
    name: 'Shampoo pH Neutro V-Floc 3L',
    brand: 'Vonixx',
    category: 'Lavagem',
    currentQuantity: 8400,
    minQuantity: 2000,
    unit: 'ml',
    costPrice: 85.00,
    supplier: 'Distribuidora AutoBrilho SP',
    lastRestockedAt: '2026-10-25'
  },
  {
    id: 'prd_2',
    name: 'Cera Líquida Tok Final 500ml',
    brand: 'Vonixx',
    category: 'Proteção',
    currentQuantity: 1800,
    minQuantity: 500,
    unit: 'ml',
    costPrice: 42.00,
    supplier: 'Distribuidora AutoBrilho SP',
    lastRestockedAt: '2026-11-02'
  },
  {
    id: 'prd_3',
    name: 'Desengraxante Delet 5L',
    brand: 'Vonixx',
    category: 'Desengraxante',
    currentQuantity: 3200,
    minQuantity: 2500,
    unit: 'ml',
    costPrice: 110.00,
    supplier: 'Detail Express SP',
    lastRestockedAt: '2026-10-18'
  },
  {
    id: 'prd_4',
    name: 'Restaurador de Plásticos Restaurax 500ml',
    brand: 'Vonixx',
    category: 'Acabamento',
    currentQuantity: 450,
    minQuantity: 500, // Low stock alert!
    unit: 'ml',
    costPrice: 48.00,
    supplier: 'Detail Express SP',
    lastRestockedAt: '2026-10-05'
  },
  {
    id: 'prd_5',
    name: 'Vitrificador V-Paint Pro 50ml',
    brand: 'Vonixx',
    category: 'Cerâmico',
    currentQuantity: 120,
    minQuantity: 50,
    unit: 'ml',
    costPrice: 215.00,
    supplier: 'Vonixx Oficial',
    lastRestockedAt: '2026-10-30'
  },
  {
    id: 'prd_6',
    name: 'Pano Microfibra 40x40 500GSM',
    brand: 'Zacs',
    category: 'Acessórios',
    currentQuantity: 34,
    minQuantity: 15,
    unit: 'un',
    costPrice: 12.50,
    supplier: 'Detail Express SP',
    lastRestockedAt: '2026-11-05'
  },
  {
    id: 'prd_7',
    name: 'Luva de Lavagem Microfibra Macia',
    brand: 'Kers',
    category: 'Acessórios',
    currentQuantity: 8,
    minQuantity: 4,
    unit: 'un',
    costPrice: 28.00,
    supplier: 'Distribuidora AutoBrilho SP',
    lastRestockedAt: '2026-10-12'
  }
];

export const INITIAL_ORDERS: ServiceOrder[] = [
  {
    id: 'OS-2026-001',
    clientId: 'cli_1',
    clientName: 'Felipe Ramos',
    clientPhone: '(11) 99123-4567',
    clientWhatsapp: '5511991234567',
    motorcycleId: 'mot_1',
    motorcycleBrand: 'BMW',
    motorcycleModel: 'R 1250 GS Adventure',
    motorcyclePlate: 'BMW-9G82',
    status: 'em_servico',
    paymentStatus: 'parcial',
    assignedEmployeeId: 'usr_2',
    assignedEmployeeName: 'Lucas Almeida (Mestre)',
    entryDateTime: '2026-11-12T08:30:00',
    promisedDateTime: '2026-11-12T13:00:00',
    services: [
      { serviceId: 'srv_2', serviceName: 'Lavagem Detalhada PK Pro', price: 160.00, estimatedMinutes: 90 },
      { serviceId: 'srv_7', serviceName: 'Polimento e Cristalização do Escapamento', price: 110.00, estimatedMinutes: 50 }
    ],
    productsConsumed: [
      { productId: 'prd_1', productName: 'Shampoo pH Neutro V-Floc', quantity: 80, unit: 'ml', cost: 2.26 },
      { productId: 'prd_2', productName: 'Cera Carnaúba Tok Final', quantity: 30, unit: 'ml', cost: 2.52 },
      { productId: 'prd_3', productName: 'Desengraxante Delet', quantity: 70, unit: 'ml', cost: 1.54 },
      { productId: 'prd_4', productName: 'Restaurador de Plásticos Restaurax', quantity: 25, unit: 'ml', cost: 2.40 }
    ],
    subtotal: 270.00,
    discount: 20.00,
    addition: 0,
    total: 250.00,
    amountPaid: 100.00,
    pendingBalance: 150.00,
    paymentTransactions: [
      {
        id: 'tx_1',
        serviceOrderId: 'OS-2026-001',
        amount: 100.00,
        method: 'pix',
        date: '2026-11-12T08:45:00',
        operatorName: 'Bianca Costa',
        status: 'confirmado',
        notes: 'Sinal de entrada via Pix chave CNPJ'
      }
    ],
    checklist: {
      entryDate: '2026-11-12T08:30:00',
      fuelLevel: '3/4',
      odometer: 18450,
      inspectorName: 'Bianca Costa',
      accessoriesLeft: ['Chaveiro original BMW', 'Suporte celular RAM'],
      items: [
        { item: 'Tanque de combustível', entryStatus: 'ok', notes: 'Sem riscos profundos' },
        { item: 'Carenagens laterais', entryStatus: 'ok' },
        { item: 'Balança e Chassi', entryStatus: 'sujo', notes: 'Gordura de asfalto acumulada' },
        { item: 'Rodas e Raios', entryStatus: 'sujo', notes: 'Pó de pastilha' },
        { item: 'Escapamento', entryStatus: 'avaria', notes: 'Leve mancha amarelada de caloria' },
        { item: 'Banco e Costuras', entryStatus: 'ok' },
        { item: 'Painel TFT', entryStatus: 'ok' },
        { item: 'Espelhos', entryStatus: 'ok' }
      ],
      entryNotes: 'Cliente autorizou polimento químico para clarear o escape.'
    },
    photosBefore: [
      'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=500&auto=format&fit=crop&q=80'
    ],
    photosAfter: [],
    notes: 'Prioridade para entrega até 13h00 antes do almoço do cliente.',
    commissionCalculated: true,
    commissionAmount: 50.00,
    commissionPaid: false
  },
  {
    id: 'OS-2026-002',
    clientId: 'cli_2',
    clientName: 'Camila Mendonça',
    clientPhone: '(11) 98234-5678',
    clientWhatsapp: '5511982345678',
    motorcycleId: 'mot_2',
    motorcycleBrand: 'Yamaha',
    motorcycleModel: 'MT-07 ABS',
    motorcyclePlate: 'MTO-7B21',
    status: 'para_fazer',
    paymentStatus: 'pendente',
    assignedEmployeeId: 'usr_3',
    assignedEmployeeName: 'Gabriel Vieira',
    entryDateTime: '2026-11-12T09:15:00',
    promisedDateTime: '2026-11-12T11:45:00',
    services: [
      { serviceId: 'srv_1', serviceName: 'Lavagem Técnica Simples', price: 80.00, estimatedMinutes: 45 },
      { serviceId: 'srv_6', serviceName: 'Revitalização de Plásticos & Borrachas', price: 60.00, estimatedMinutes: 30 }
    ],
    productsConsumed: [],
    subtotal: 140.00,
    discount: 0,
    addition: 0,
    total: 140.00,
    amountPaid: 0,
    pendingBalance: 140.00,
    paymentTransactions: [],
    checklist: {
      entryDate: '2026-11-12T09:15:00',
      fuelLevel: '1/2',
      odometer: 6200,
      inspectorName: 'Bianca Costa',
      accessoriesLeft: ['Chave reserva'],
      items: [
        { item: 'Tanque de combustível', entryStatus: 'ok' },
        { item: 'Rodas fluorescentes', entryStatus: 'sujo', notes: 'Graxa de corrente espalhada' },
        { item: 'Painel digital', entryStatus: 'ok' },
        { item: 'Plásticos do paralama', entryStatus: 'sujo', notes: 'Esbranquiçados' }
      ]
    },
    photosBefore: [
      'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=500&auto=format&fit=crop&q=80'
    ],
    photosAfter: [],
    notes: 'Avisar 30min antes da conclusão.',
    commissionCalculated: true,
    commissionAmount: 21.00,
    commissionPaid: false
  },
  {
    id: 'OS-2026-003',
    clientId: 'cli_3',
    clientName: 'Eduardo Silveira',
    clientPhone: '(11) 97345-6789',
    clientWhatsapp: '5511973456789',
    motorcycleId: 'mot_3',
    motorcycleBrand: 'Honda',
    motorcycleModel: 'CB 650R Neo Sports',
    motorcyclePlate: 'BRA-2E19',
    status: 'concluido',
    paymentStatus: 'pago',
    assignedEmployeeId: 'usr_2',
    assignedEmployeeName: 'Lucas Almeida (Mestre)',
    entryDateTime: '2026-11-11T14:00:00',
    promisedDateTime: '2026-11-11T17:30:00',
    completedDateTime: '2026-11-11T17:10:00',
    services: [
      { serviceId: 'srv_4', serviceName: 'Polimento Técnico em 3 Etapas', price: 290.00, estimatedMinutes: 180 }
    ],
    productsConsumed: [
      { productId: 'prd_2', productName: 'Cera Carnaúba Tok Final', quantity: 40, unit: 'ml', cost: 3.36 },
      { productId: 'prd_6', productName: 'Pano Microfibra 500GSM', quantity: 2, unit: 'un', cost: 25.00 }
    ],
    subtotal: 290.00,
    discount: 10.00,
    addition: 0,
    total: 280.00,
    amountPaid: 280.00,
    pendingBalance: 0,
    paymentTransactions: [
      {
        id: 'tx_2',
        serviceOrderId: 'OS-2026-003',
        amount: 280.00,
        method: 'credito',
        installments: 2,
        date: '2026-11-11T17:15:00',
        operatorName: 'Bianca Costa',
        status: 'confirmado',
        notes: 'Cartão de crédito Master 2x'
      }
    ],
    checklist: {
      entryDate: '2026-11-11T14:00:00',
      exitDate: '2026-11-11T17:10:00',
      fuelLevel: '1/4',
      odometer: 24100,
      inspectorName: 'Lucas Almeida',
      accessoriesLeft: [],
      items: [
        { item: 'Tanque de combustível', entryStatus: 'sujo', exitStatus: 'limpo', notes: 'Brilho espelhado alcançado' },
        { item: 'Carenagens', entryStatus: 'sujo', exitStatus: 'limpo' },
        { item: 'Pintura geral', entryStatus: 'avaria', exitStatus: 'ok', notes: 'Micro-riscos 95% corrigidos' }
      ],
      customerSignatureConfirmed: true
    },
    photosBefore: [
      'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=500&auto=format&fit=crop&q=80'
    ],
    photosAfter: [
      'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=500&auto=format&fit=crop&q=80'
    ],
    notes: 'Cliente elogiou o resultado do polimento.',
    commissionCalculated: true,
    commissionAmount: 56.00,
    commissionPaid: true
  },
  {
    id: 'OS-2026-004',
    clientId: 'cli_4',
    clientName: 'Rodrigo Nogueira',
    clientPhone: '(11) 96456-7890',
    clientWhatsapp: '5511964567890',
    motorcycleId: 'mot_4',
    motorcycleBrand: 'Triumph',
    motorcycleModel: 'Street Triple 765 RS',
    motorcyclePlate: 'TRF-3X45',
    status: 'entregue',
    paymentStatus: 'pago',
    assignedEmployeeId: 'usr_2',
    assignedEmployeeName: 'Lucas Almeida (Mestre)',
    entryDateTime: '2026-11-10T10:00:00',
    promisedDateTime: '2026-11-10T16:00:00',
    completedDateTime: '2026-11-10T15:30:00',
    deliveredDateTime: '2026-11-10T16:20:00',
    services: [
      { serviceId: 'srv_5', serviceName: 'Vitrificação Cerâmica 9H (V-Paint Pro)', price: 490.00, estimatedMinutes: 240 }
    ],
    productsConsumed: [
      { productId: 'prd_5', productName: 'Vitrificador Cerâmico V-Paint Pro', quantity: 20, unit: 'ml', cost: 86.00 },
      { productId: 'prd_6', productName: 'Pano Microfibra 500GSM', quantity: 3, unit: 'un', cost: 37.50 }
    ],
    subtotal: 490.00,
    discount: 40.00,
    addition: 0,
    total: 450.00,
    amountPaid: 450.00,
    pendingBalance: 0,
    paymentTransactions: [
      {
        id: 'tx_3',
        serviceOrderId: 'OS-2026-004',
        amount: 450.00,
        method: 'pix',
        date: '2026-11-10T16:15:00',
        operatorName: 'Bianca Costa',
        status: 'confirmado'
      }
    ],
    checklist: {
      entryDate: '2026-11-10T10:00:00',
      exitDate: '2026-11-10T15:30:00',
      fuelLevel: 'cheio',
      odometer: 4300,
      inspectorName: 'Ricardo Santos',
      accessoriesLeft: ['Chave codificada'],
      items: [
        { item: 'Pintura e Carenagens', entryStatus: 'ok', exitStatus: 'ok', notes: 'Vitrificada com cura UV acelerada' }
      ],
      customerSignatureConfirmed: true
    },
    photosBefore: [],
    photosAfter: [],
    notes: 'Atendimento técnico concluído com sucesso.',
    commissionCalculated: true,
    commissionAmount: 90.00,
    commissionPaid: true
  }
];

export const INITIAL_APPOINTMENTS: Appointment[] = [
  {
    id: 'apt_1',
    clientId: 'cli_1',
    clientName: 'Felipe Ramos',
    clientPhone: '(11) 99123-4567',
    motorcyclePlate: 'BMW-9G82',
    motorcycleModel: 'BMW R 1250 GS',
    serviceIds: ['srv_2', 'srv_7'],
    serviceNames: ['Lavagem Detalhada PK Pro', 'Polimento Escapamento'],
    assignedEmployeeId: 'usr_2',
    assignedEmployeeName: 'Lucas Almeida (Mestre)',
    date: '2026-11-12',
    startTime: '09:00',
    endTime: '10:00',
    durationMinutes: 60,
    status: 'em_atendimento',
    notes: 'Já iniciado na baia 01. Transformado na OS-2026-001',
    serviceOrderId: 'OS-2026-001'
  },
  {
    id: 'apt_2',
    clientId: 'cli_2',
    clientName: 'Camila Mendonça',
    clientPhone: '(11) 98234-5678',
    motorcyclePlate: 'MTO-7B21',
    motorcycleModel: 'Yamaha MT-07',
    serviceIds: ['srv_1', 'srv_6'],
    serviceNames: ['Lavagem Técnica Simples', 'Revitalização de Plásticos'],
    assignedEmployeeId: 'usr_3',
    assignedEmployeeName: 'Gabriel Vieira',
    date: '2026-11-12',
    startTime: '11:00',
    endTime: '12:00',
    durationMinutes: 60,
    status: 'agendado',
    notes: 'Cliente confirmou presença via WhatsApp',
    serviceOrderId: 'OS-2026-002'
  },
  {
    id: 'apt_3',
    clientId: 'cli_3',
    clientName: 'Eduardo Silveira',
    clientPhone: '(11) 97345-6789',
    motorcyclePlate: 'BRA-2E19',
    motorcycleModel: 'Honda CB 650R',
    serviceIds: ['srv_1'],
    serviceNames: ['Lavagem Técnica Simples'],
    assignedEmployeeId: 'usr_3',
    assignedEmployeeName: 'Gabriel Vieira',
    date: '2026-11-12',
    startTime: '13:00',
    endTime: '14:00',
    durationMinutes: 60,
    status: 'confirmado',
    notes: 'Chegada rápida para limpeza de pós-chuva.'
  },
  {
    id: 'apt_4',
    clientId: 'cli_5',
    clientName: 'Marcos Vinicius',
    clientPhone: '(11) 95567-8901',
    motorcyclePlate: 'KAW-5Z90',
    motorcycleModel: 'Kawasaki Z900',
    serviceIds: ['srv_2', 'srv_4'],
    serviceNames: ['Lavagem Detalhada PK Pro', 'Polimento Técnico em 3 Etapas'],
    assignedEmployeeId: 'usr_2',
    assignedEmployeeName: 'Lucas Almeida (Mestre)',
    date: '2026-11-13',
    startTime: '09:00',
    endTime: '10:00',
    durationMinutes: 60,
    status: 'agendado',
    notes: 'Agendamento feito pelo Portal do Cliente online.',
    isOnlineBooking: true
  }
];

export const INITIAL_EXPENSES: Expense[] = [
  {
    id: 'exp_1',
    description: 'Aluguel do Galpão & Boxes de Lavagem',
    category: 'Aluguel',
    amount: 3200.00,
    dueDate: '2026-11-10',
    paymentDate: '2026-11-09',
    status: 'pago',
    paymentMethod: 'transferencia',
    notes: 'Comprovante Banco Itaú enviado à imobiliária'
  },
  {
    id: 'exp_2',
    description: 'Conta de Água Sabesp (Uso Industrial)',
    category: 'Água',
    amount: 680.40,
    dueDate: '2026-11-15',
    status: 'pendente',
    notes: 'Vence em 3 dias'
  },
  {
    id: 'exp_3',
    description: 'Enel Energia Elétrica Trifásica',
    category: 'Energia',
    amount: 890.15,
    dueDate: '2026-11-18',
    status: 'pendente',
    notes: 'Consumo compressores e iluminação led high-bay'
  },
  {
    id: 'exp_4',
    description: 'Reposicao Insumos Vonixx e Panos',
    category: 'Produtos',
    amount: 620.00,
    dueDate: '2026-11-05',
    paymentDate: '2026-11-05',
    status: 'pago',
    paymentMethod: 'pix',
    receiptName: 'NF-e 004812 AutoBrilho'
  },
  {
    id: 'exp_5',
    description: 'Internet Fibra 600MB + IP Fixo',
    category: 'Internet',
    amount: 149.90,
    dueDate: '2026-11-20',
    status: 'pendente'
  }
];

export const INITIAL_CASH_REGISTER: CashRegister = {
  id: 'csh_20261112',
  openedAt: '2026-11-12T07:45:00',
  status: 'aberto',
  operatorId: 'usr_4',
  operatorName: 'Bianca Costa',
  initialBalance: 200.00, // Fundo de troco
  totalIn: 380.00,
  totalOut: 30.00,
  expectedBalance: 550.00,
  movements: [
    {
      id: 'csh_mov_1',
      timestamp: '2026-11-12T07:45:00',
      type: 'abertura',
      amount: 200.00,
      paymentMethod: 'saldo_inicial',
      description: 'Abertura de Caixa - Fundo de Troco',
      operatorName: 'Bianca Costa'
    },
    {
      id: 'csh_mov_2',
      timestamp: '2026-11-12T08:45:00',
      type: 'entrada_os',
      amount: 100.00,
      paymentMethod: 'pix',
      description: 'Recebimento Sinal OS-2026-001 (Felipe Ramos)',
      relatedOrderId: 'OS-2026-001',
      operatorName: 'Bianca Costa'
    },
    {
      id: 'csh_mov_3',
      timestamp: '2026-11-12T09:20:00',
      type: 'sangria',
      amount: 30.00,
      paymentMethod: 'dinheiro',
      description: 'Compra de água mineral e café para recepção de clientes',
      operatorName: 'Bianca Costa'
    },
    {
      id: 'csh_mov_4',
      timestamp: '2026-11-12T10:00:00',
      type: 'entrada_os',
      amount: 280.00,
      paymentMethod: 'credito',
      description: 'Recebimento OS-2026-003 (Eduardo Silveira)',
      relatedOrderId: 'OS-2026-003',
      operatorName: 'Bianca Costa'
    }
  ],
  notes: 'Caixa do turno matutino operando com normalidade.'
};

export const INITIAL_COMMISSIONS: CommissionRecord[] = [
  {
    id: 'com_1',
    employeeId: 'usr_2',
    employeeName: 'Lucas Almeida (Mestre)',
    serviceOrderId: 'OS-2026-003',
    orderNumber: 'OS-2026-003',
    serviceNames: 'Polimento Técnico em 3 Etapas',
    orderTotal: 280.00,
    commissionRate: '20%',
    commissionAmount: 56.00,
    date: '2026-11-11',
    status: 'paga',
    paidAt: '2026-11-11T18:00:00'
  },
  {
    id: 'com_2',
    employeeId: 'usr_2',
    employeeName: 'Lucas Almeida (Mestre)',
    serviceOrderId: 'OS-2026-004',
    orderNumber: 'OS-2026-004',
    serviceNames: 'Vitrificação Cerâmica 9H (V-Paint Pro)',
    orderTotal: 450.00,
    commissionRate: '20%',
    commissionAmount: 90.00,
    date: '2026-11-10',
    status: 'paga',
    paidAt: '2026-11-10T18:00:00'
  },
  {
    id: 'com_3',
    employeeId: 'usr_2',
    employeeName: 'Lucas Almeida (Mestre)',
    serviceOrderId: 'OS-2026-001',
    orderNumber: 'OS-2026-001',
    serviceNames: 'Lavagem Detalhada + Escapamento',
    orderTotal: 250.00,
    commissionRate: '20%',
    commissionAmount: 50.00,
    date: '2026-11-12',
    status: 'aprovada'
  },
  {
    id: 'com_4',
    employeeId: 'usr_3',
    employeeName: 'Gabriel Vieira',
    serviceOrderId: 'OS-2026-002',
    orderNumber: 'OS-2026-002',
    serviceNames: 'Lavagem Técnica + Plásticos',
    orderTotal: 140.00,
    commissionRate: '15%',
    commissionAmount: 21.00,
    date: '2026-11-12',
    status: 'aprovada'
  }
];

export const INITIAL_COUPONS: LoyaltyCoupon[] = [
  {
    id: 'cpn_1',
    code: 'PK10',
    discountType: 'percent',
    discountValue: 10,
    minOrderValue: 100,
    expiryDate: '2026-12-31',
    timesUsed: 14,
    maxUses: 100,
    active: true
  },
  {
    id: 'cpn_2',
    code: 'BEMVINDO20',
    discountType: 'fixed',
    discountValue: 20.00,
    minOrderValue: 80,
    expiryDate: '2026-12-31',
    timesUsed: 8,
    maxUses: 50,
    active: true
  },
  {
    id: 'cpn_3',
    code: 'VIPGOLD',
    discountType: 'percent',
    discountValue: 15,
    minOrderValue: 200,
    expiryDate: '2027-06-30',
    timesUsed: 21,
    active: true
  }
];

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
  loyaltyPointsPerReal: 1, // R$ 10 = 10 pts
  theme: 'light'
};

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'aud_1',
    timestamp: '2026-11-12T07:45:00',
    userName: 'Bianca Costa',
    userRole: 'atendente',
    action: 'ABERTURA_CAIXA',
    module: 'Caixa',
    details: 'Abertura do caixa csh_20261112 com fundo de troco R$ 200,00'
  },
  {
    id: 'aud_2',
    timestamp: '2026-11-12T08:30:00',
    userName: 'Bianca Costa',
    userRole: 'atendente',
    action: 'CRIAR_ORDEM_SERVICO',
    module: 'Ordens de Serviço',
    details: 'Criada ordem OS-2026-001 para Felipe Ramos (BMW R 1250 GS)'
  },
  {
    id: 'aud_3',
    timestamp: '2026-11-12T08:45:00',
    userName: 'Bianca Costa',
    userRole: 'atendente',
    action: 'REGISTRAR_PAGAMENTO',
    module: 'Financeiro',
    details: 'Recebido R$ 100,00 via Pix na OS-2026-001'
  }
];

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
      'Olá *{cliente}*! Recebemos sua motocicleta *{moto}* (Placa: *{placa}*) na *PK DETAIL*.\n\n*OS:* #{os}\n*Serviços:* {servicos}\n*Total:* R$ {total}\n*Status atual:* Aguardando Início no Pátio\n\nAssim que iniciarmos o atendimento, avisaremos por aqui!',
    em_servico:
      'Olá *{cliente}*! Boas notícias da *PK DETAIL*!\n\nSua motocicleta *{moto}* (Placa: *{placa}*) acabou de entrar na baia técnica para execução dos serviços da OS *#{os}*.\n\n*Serviços:* {servicos}\n*Status atual:* Em Serviço',
    concluido:
      'Olá *{cliente}*! Sua motocicleta *{moto}* (Placa: *{placa}*) está *PRONTA E FINALIZADA* na *PK DETAIL*!\n\n*OS:* #{os}\n*Status:* Concluído e Inspecionado\n*Total:* R$ {total} | Saldo pendente: R$ {saldo}\n\nPode vir retirar quando desejar (atendimento até às {horario_fechamento}). Esperamos você!',
    entregue:
      'Olá *{cliente}*! Confirmamos a entrega da sua motocicleta *{moto}* (Placa: *{placa}*) referente à OS *#{os}*.\n\nMuito obrigado pela confiança na *PK DETAIL*! Qualquer dúvida sobre o atendimento, conte conosco. Boas aceleradas!',
    cancelado:
      'Olá *{cliente}*, informamos que a Ordem de Serviço *#{os}* ({moto} · Placa: {placa}) na *PK DETAIL* foi marcada como *Cancelada*.\n\nSe precisar reagendar seu atendimento, responda esta mensagem!',
  },
};

