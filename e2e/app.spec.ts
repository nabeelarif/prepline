import { expect, test } from '@playwright/test';

test('first run shows the sample goal', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Senior iOS interview prep');
  await expect(page.getByText('Saved in this browser')).toBeVisible();
});

test('create a goal, add a resource from a link, finish and rate it, and keep it after reload', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByRole('button', { name: '+ New goal' }).click();
  await page.getByLabel('What are you preparing for?').fill('System design');
  await page.getByRole('button', { name: 'Create goal' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('System design');

  await page.getByRole('button', { name: '+ Add' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('textbox', { name: /^Link/ }).fill('https://www.youtube.com/watch?v=abc');
  await expect(sheet.getByRole('combobox')).toHaveValue('video');
  await sheet.getByRole('textbox', { name: 'Title', exact: true }).fill('Caching talk');
  await page.getByRole('button', { name: 'Add to plan' }).click();

  const resources = page.getByRole('region', { name: 'Resources' });
  await expect(resources.getByText('Caching talk')).toBeVisible();

  await resources.getByRole('button', { name: 'Mark done: Caching talk' }).click();
  await expect(page.getByText('How well do you understand it?')).toBeVisible();
  await page.getByRole('button', { name: /^4\s*Solid$/ }).click();
  await expect(page.getByText('How well do you understand it?')).toBeHidden();
  await expect(page.locator('.pill')).toHaveText('Complete');

  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('System design');
  await expect(resources.getByText('Solid')).toBeVisible();
});

test('import replaces data from a backup', async ({ page }) => {
  const backup = {
    version: 1,
    activeGoalId: 'g1',
    goals: [
      {
        id: 'g1',
        name: 'Imported goal',
        targetDate: '2099-01-01',
        hoursPerDay: 2,
        resources: [{ id: 'r1', title: 'Old article', type: 'article', minutes: 20 }],
      },
    ],
  };
  await page.goto('./');
  await page.getByRole('button', { name: 'Backup and restore' }).click();
  await page.getByLabel('Paste backup JSON').fill(JSON.stringify(backup));
  const importBtn = page.getByRole('button', { name: 'Import' });
  await importBtn.click();
  await page.getByRole('button', { name: 'Replace all data?' }).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Imported goal');
  await expect(page.getByText('Old article').first()).toBeVisible();
  await expect(page.locator('.goal-btn')).toHaveCount(1);
});
