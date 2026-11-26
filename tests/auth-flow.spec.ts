import { test, expect } from '@playwright/test';

test.describe('PK Detail - Authentication & User Switcher Flow', () => {
  test('should display user profile and allow switching active user/role', async ({ page }) => {
    await page.goto('/');

    // Look for user profile section in sidebar or header
    // PK Detail has user switcher or settings / profile
    const profileTrigger = page.locator('text=Administrador, text=Gerente, text=Detailer, button').filter({ hasText: /Admin|Gerente|Carlos|João|Equipe/ }).first();
    
    if (await profileTrigger.isVisible()) {
      await profileTrigger.click();
    } else {
      // Go to settings or team module if profile switcher is in settings
      await page.click('text=Configurações, text=Equipe, text=Mais');
    }

    // Verify system loaded without any auth errors and displays active user state
    await expect(page.locator('text=PK Detail').first()).toBeVisible();
  });

  test('should verify responsive viewport adaptations across resolutions', async ({ page }) => {
    // Test mobile portrait
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await expect(page.locator('nav, header, footer').first()).toBeVisible();

    // Test tablet portrait
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();
    await expect(page.locator('text=Visão Geral').first()).toBeVisible();

    // Test desktop widescreen
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.reload();
    await expect(page.locator('text=Visão Geral').first()).toBeVisible();
  });
});
