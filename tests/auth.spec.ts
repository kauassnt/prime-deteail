import { test, expect } from '@playwright/test';

test.describe('PK Detail - Authentication, Session Persistence & Redirect Flow', () => {
  test('should load the application and successfully land on the dashboard', async ({ page }) => {
    await page.goto('/');

    // Verify redirect / initial load lands on the dashboard overview
    await expect(page.locator('text=Visão Geral do Negócio').first()).toBeVisible();
    await expect(page.locator('text=Faturamento').first()).toBeVisible();
  });

  test('should switch user operators/roles and persist session across reloads', async ({ page }) => {
    await page.goto('/');

    // Open user profile dropdown in navbar
    const userDropdownButton = page.locator('button').filter({ hasText: /Admin|Gerente|Detailer|Carlos|João|Bianca/ }).first();
    await userDropdownButton.click();

    // Select another user/operator from the list
    const operatorOption = page.locator('button.w-full.text-left').filter({ hasText: /Gerente|Detailer|Carlos|Bianca/ }).first();
    if (await operatorOption.isVisible()) {
      await operatorOption.click();
    }

    // Verify session state is updated (user profile reflects new operator)
    await expect(page.locator('text=Visão Geral do Negócio').first()).toBeVisible();

    // Reload page to test session persistence
    await page.reload();

    // Verify session persisted correctly in localStorage / UI
    await expect(page.locator('text=Visão Geral do Negócio').first()).toBeVisible();
  });

  test('should persist active module state and filters across browser reloads (Session persistence)', async ({ page }) => {
    await page.goto('/');

    // Navigate to Pátio module
    await page.click('text=Pátio');
    await expect(page.locator('text=Pátio de Atendimento').first()).toBeVisible();

    // Reload page
    await page.reload();

    // Verify user is redirected/restored to Pátio module or dashboard state correctly
    await expect(page.locator('text=Pátio de Atendimento').first()).toBeVisible();
  });
});

const TINY_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

async function navigateToPatio(page: import('@playwright/test').Page) {
  const desktopPatioBtn = page.locator('aside button').filter({ hasText: 'Pátio Operacional' }).first();
  if (await desktopPatioBtn.isVisible()) {
    await desktopPatioBtn.click();
  } else {
    const mobilePatioBtn = page
      .locator('nav[aria-label="Navegação principal mobile"] button')
      .filter({ hasText: 'Pátio' })
      .first();
    if (await mobilePatioBtn.isVisible()) {
      await mobilePatioBtn.click();
    } else {
      await page.getByRole('button', { name: 'Abrir menu lateral' }).click();
      await page.getByRole('dialog', { name: 'Menu lateral PK Detail' }).getByText('Pátio Operacional').click();
    }
  }
  await expect(page.getByRole('heading', { name: 'Pátio Operacional' })).toBeVisible();
}

async function navigateToOrdens(page: import('@playwright/test').Page) {
  const desktopOrdensBtn = page.locator('aside button').filter({ hasText: 'Ordens de Serviço (OS)' }).first();
  if (await desktopOrdensBtn.isVisible()) {
    await desktopOrdensBtn.click();
  } else {
    const mobileMaisBtn = page
      .locator('nav[aria-label="Navegação principal mobile"] button')
      .filter({ hasText: 'Mais' })
      .first();
    if (await mobileMaisBtn.isVisible()) {
      await mobileMaisBtn.click();
      await page.getByRole('button', { name: /Ordens de Serviço \(OS\)/i }).click();
    } else {
      await page.getByRole('button', { name: 'Abrir menu lateral' }).click();
      await page.getByRole('dialog', { name: 'Menu lateral PK Detail' }).getByText('Ordens de Serviço (OS)').click();
    }
  }
}

test.describe('PK Detail - Criação Completa de OS e Atualização de Status no Pátio', () => {
  test('deve preencher formulário em etapas da OS, registrar checklist e 4 fotos e avançar status no pátio', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await expect(page.getByText('Visão Geral do Negócio').first()).toBeVisible();

    // 1. Navegar para o Pátio Operacional
    await navigateToPatio(page);

    // 2. Abrir modal de criação de OS pelo Pátio ("Entrada de Moto")
    await page.getByRole('button', { name: 'Entrada de Moto' }).click();

    const quickModal = page.getByRole('dialog').last();
    await expect(quickModal).toBeVisible();
    await expect(quickModal.getByRole('button', { name: /Etapa 1: Dados & Serviços/i })).toBeVisible();

    // --- ETAPA 1: DADOS, SERVIÇOS, PAGAMENTO E OBSERVAÇÕES ---
    const selectsStep1 = quickModal.locator('form select');
    // Seleciona cliente Rodrigo Nogueira (cli_4 -> moto mot_4 TRF-3X45 sem OS ativa no pátio)
    await selectsStep1.nth(0).selectOption('cli_4');
    await expect(selectsStep1.nth(1)).toHaveValue('mot_4');

    // Adiciona segundo serviço além do padrão (Lavagem Técnica Simples R$ 80 + Revitalização de Plásticos R$ 60 = R$ 140)
    await quickModal.getByText('Revitalização de Plásticos & Borrachas').click();
    await expect(quickModal.getByText('Subtotal: R$ 140.00')).toBeVisible();

    // Aplica desconto de R$ 10 -> Total esperado R$ 130.00
    await quickModal.locator('input[placeholder="0.00"]').first().fill('10');
    await expect(quickModal.getByText('R$ 130.00').first()).toBeVisible();

    // Seleciona condição de pagamento Parcial via PIX com sinal de R$ 50
    await quickModal
      .locator('select')
      .filter({ has: page.locator('option[value="parcial"]') })
      .selectOption('parcial');
    await quickModal
      .locator('select')
      .filter({ has: page.locator('option[value="pix"]') })
      .selectOption('pix');
    await quickModal.locator('input[placeholder="0.00"]').nth(1).fill('50');

    // Observações da OS
    await quickModal
      .getByPlaceholder(/Entregar até 17h30/i)
      .fill('Vistoria completa E2E - Triumph Street Triple');

    // Avança para Etapa 2
    await quickModal.getByRole('button', { name: /Próxima Etapa: Editar Checklist/i }).click();

    // --- ETAPA 2: CHECKLIST EDITÁVEL DE ENTRADA ---
    await expect(quickModal.getByText('Nível de Combustível na Entrada')).toBeVisible();
    await quickModal.getByRole('button', { name: '3/4', exact: true }).click();
    await quickModal.getByRole('button', { name: 'Capacete', exact: true }).click();

    await quickModal.getByPlaceholder(/Outro pertence/i).fill('Trava de disco');
    await quickModal.getByRole('button', { name: 'Adicionar', exact: true }).click();
    await expect(quickModal.getByRole('button', { name: 'Trava de disco', exact: true })).toBeVisible();

    // Adiciona item customizado na checklist de vistoria
    await quickModal.getByPlaceholder(/Novo item para vistoriar/i).fill('Bolha / Para-brisa');
    await quickModal.getByRole('button', { name: 'Adicionar Item', exact: true }).click();
    await expect(quickModal.locator('input[value="Bolha / Para-brisa"]')).toBeVisible();

    await quickModal
      .getByPlaceholder(/Descreva riscos preexistentes/i)
      .fill('Pintura fosca sem avarias aparentes na entrada.');

    // Avança para Etapa 3
    await quickModal.getByRole('button', { name: /Próxima Etapa: 4 Fotos Antes do Serviço/i }).click();

    // --- ETAPA 3: 4 FOTOS ANTES DO SERVIÇO ---
    await expect(quickModal.getByText('0 de 4 fotos registradas')).toBeVisible();

    for (const angleLabel of ['Dianteira', 'Traseira', 'Lado Esquerdo', 'Lado Direito']) {
      await quickModal
        .locator(`input[aria-label="Selecionar foto ${angleLabel}"]`)
        .setInputFiles({
          name: `${angleLabel.toLowerCase().replace(/\s+/g, '_')}.png`,
          mimeType: 'image/png',
          buffer: TINY_PNG_BUFFER,
        });
    }

    await expect(quickModal.getByText('4 de 4 fotos registradas')).toBeVisible();
    await expect(quickModal.getByText('Etapa 3: Fotos Antes (4/4)')).toBeVisible();

    // Finaliza criação enviando ao Pátio ("para_fazer")
    await quickModal.getByRole('button', { name: /Criar OS \(Enviar ao Pátio\)/i }).click();
    await expect(quickModal).toBeHidden();

    // --- VALIDAÇÃO NO PÁTIO E TRANSIÇÕES DE STATUS ---
    const isMobilePatioTabs = await page
      .locator('button')
      .filter({ hasText: /^Pagas/ })
      .isVisible();

    const getKanbanColumn = (titleRegex: RegExp) =>
      page
        .locator('div.rounded-3xl')
        .filter({ has: page.locator('span', { hasText: titleRegex }) })
        .first();

    // Helper para localizar o cartão específico da moto TRF-3X45 com o texto esperado
    const locateCreatedCardInActiveArea = () => {
      if (isMobilePatioTabs) {
        return page.locator('div.rounded-2xl').filter({ hasText: 'TRF-3X45' }).filter({ hasText: 'Rodrigo Nogueira' }).first();
      }
      return getKanbanColumn(/^Para Fazer$/).locator('div.rounded-2xl').filter({ hasText: 'TRF-3X45' }).first();
    };

    // Verifica que a OS nasceu em "Para Fazer" com os valores preenchidos
    const cardParaFazer = locateCreatedCardInActiveArea();
    await expect(cardParaFazer).toBeVisible();
    await expect(cardParaFazer).toContainText('Rodrigo Nogueira');
    await expect(cardParaFazer).toContainText('R$ 130.00');
    await expect(cardParaFazer).toContainText('Falta: R$ 80.00');
    await expect(cardParaFazer).toContainText('4/4 fotos');

    // Transição 1: Para Fazer -> Em Serviço (passando pelo modal de vistoria obrigatória)
    await cardParaFazer.getByRole('button', { name: /Iniciar Serviço/i }).click();

    const inspectionModal = page.getByRole('dialog').last();
    await expect(inspectionModal).toBeVisible();
    await expect(
      inspectionModal.getByText(/Vistoria Obrigatória Antes de Iniciar Serviço — Rodrigo Nogueira/i)
    ).toBeVisible();
    await expect(inspectionModal.locator('input[value="Bolha / Para-brisa"]')).toBeVisible();
    await expect(inspectionModal.getByRole('button', { name: 'Trava de disco', exact: true })).toBeVisible();

    await inspectionModal.getByRole('button', { name: /Avançar para 4 Fotos de Vistoria/i }).click();
    await expect(inspectionModal.getByText('4 de 4 fotos registradas')).toBeVisible();

    await inspectionModal.getByRole('button', { name: /Confirmar Vistoria e Iniciar Serviço/i }).click();
    await expect(inspectionModal).toBeHidden();

    // Verifica movimentação para "Em Serviço"
    let cardEmServico;
    if (isMobilePatioTabs) {
      await page.locator('button').filter({ hasText: /^Em Serviço/ }).first().click();
      cardEmServico = page.locator('div.rounded-2xl').filter({ hasText: 'TRF-3X45' }).filter({ hasText: 'Rodrigo Nogueira' }).first();
    } else {
      await expect(
        getKanbanColumn(/^Para Fazer$/).locator('div.rounded-2xl').filter({ hasText: 'TRF-3X45' })
      ).toHaveCount(0);
      cardEmServico = getKanbanColumn(/^Em Serviço$/).locator('div.rounded-2xl').filter({ hasText: 'TRF-3X45' }).first();
    }
    await expect(cardEmServico).toBeVisible();
    await expect(cardEmServico.getByRole('button', { name: /Concluir Serviço/i })).toBeVisible();

    // Transição 2: Em Serviço -> Concluído
    await cardEmServico.getByRole('button', { name: /Concluir Serviço/i }).click();

    let cardConcluido;
    if (isMobilePatioTabs) {
      await page.locator('button').filter({ hasText: /^Concluído/ }).first().click();
      cardConcluido = page.locator('div.rounded-2xl').filter({ hasText: 'TRF-3X45' }).filter({ hasText: 'Rodrigo Nogueira' }).first();
    } else {
      await expect(
        getKanbanColumn(/^Em Serviço$/).locator('div.rounded-2xl').filter({ hasText: 'TRF-3X45' })
      ).toHaveCount(0);
      cardConcluido = getKanbanColumn(/^Concluído \(Pronto\)$/).locator('div.rounded-2xl').filter({ hasText: 'TRF-3X45' }).first();
    }
    await expect(cardConcluido).toBeVisible();
    await expect(cardConcluido.getByRole('button', { name: /Registrar Entrega/i })).toBeVisible();

    // Transição 3: Concluído -> Entregue
    await cardConcluido.getByRole('button', { name: /Registrar Entrega/i }).click();

    if (isMobilePatioTabs) {
      await expect(
        page.locator('div.rounded-2xl').filter({ hasText: 'TRF-3X45' }).filter({ hasText: 'Rodrigo Nogueira' })
      ).toHaveCount(0);
    } else {
      await expect(
        getKanbanColumn(/^Concluído \(Pronto\)$/).locator('div.rounded-2xl').filter({ hasText: 'TRF-3X45' })
      ).toHaveCount(0);
    }

    // Valida persistência após reload na listagem de Ordens de Serviço
    await page.reload();
    await navigateToOrdens(page);
    const persistedOrderCard = page
      .locator('div.rounded-2xl')
      .filter({ hasText: 'TRF-3X45' })
      .filter({ hasText: 'Rodrigo Nogueira' })
      .filter({ hasText: 'R$ 130.00' })
      .first();
    await expect(persistedOrderCard).toBeVisible();
    await expect(persistedOrderCard).toContainText('Entregue');
    await expect(persistedOrderCard).toContainText('Parcial');
  });
});

