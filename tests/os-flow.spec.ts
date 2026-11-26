import { test, expect } from '@playwright/test';

test.describe('PK Detail - Service Order & Responsive Navigation Flow', () => {
  test('should load dashboard and navigate across modules', async ({ page }) => {
    await page.goto('/');

    // Check main title / header
    await expect(page.locator('text=Visão Geral do Negócio').first()).toBeVisible();

    // Navigate to Pátio module
    await page.click('text=Pátio');
    await expect(page.locator('text=Pátio de Atendimento').first()).toBeVisible();

    // Navigate to Agenda
    await page.click('text=Agenda');
    await expect(page.locator('h1:has-text("Agenda")').first()).toBeVisible();
  });

  test('should open Quick Action modal and create a Service Order', async ({ page }) => {
    await page.goto('/');

    // Click the floating or header '+' button to open QuickActionModal
    // Usually (+) button is in navbar or header
    const quickActionBtn = page.locator('button').filter({ hasText: /Nova O\.S\.|Novo/ }).first();
    if (await quickActionBtn.isVisible()) {
      await quickActionBtn.click();
    } else {
      // Click bottom nav (+) button on mobile or desktop add button
      await page.locator('button:has-text("+"), button[title*="Nova"]').first().click();
    }

    // Check if modal opened
    await expect(page.locator('text=Nova Ordem de Serviço').first()).toBeVisible();

    // Fill client & motorcycle details
    await page.fill('input[placeholder*="Nome do Cliente"]', 'Cliente Teste Playwright');
    await page.fill('input[placeholder*="Telefone"]', '11999999999');
    await page.fill('input[placeholder*="Placa"]', 'XYZ1234');
    await page.fill('input[placeholder*="Modelo"]', 'Honda CB 500');

    // Select payment method and status if present
    const paymentSelect = page.locator('select').filter({ hasText: /PIX|Dinheiro/ }).first();
    if (await paymentSelect.isVisible()) {
      await paymentSelect.selectOption({ index: 0 });
    }

    // Submit order
    const submitBtn = page.locator('button:has-text("Criar Ordem de Serviço")').first();
    await submitBtn.click();

    // Verify success / appearance in Pátio or Orders
    await expect(page.locator('text=Cliente Teste Playwright').first()).toBeVisible();
  });
});
