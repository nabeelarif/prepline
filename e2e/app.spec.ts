import { expect, test, type Page } from '@playwright/test';

async function createPlan(page: Page, name: string) {
  await page.goto('./');
  await page.getByRole('button', { name: 'Create Your First Plan' }).click();
  await page.getByLabel('Plan Title').fill(name);
  await page.getByRole('button', { name: 'Create Plan' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
}

async function addResource(page: Page, title: string, hours: string, url = '') {
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('menuitem', { name: /Add Resource/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Add Resource' });
  if (url) await sheet.getByRole('textbox', { name: /^Resource URL/ }).fill(url);
  await sheet.getByLabel('Title', { exact: true }).fill(title);
  await sheet.getByRole('spinbutton', { name: 'Estimated Time' }).fill(hours);
  await sheet.getByRole('button', { name: 'Add Resource' }).click();
  await expect(sheet).toBeHidden();
}

const summary = (page: Page) => page.getByRole('region', { name: 'Progress summary' });
const journey = (page: Page) => page.getByRole('region', { name: 'Your Preparation Journey' });
const resources = (page: Page) => page.getByRole('region', { name: /^Resources/ });
const statusOf = (page: Page, title: string) =>
  resources(page).getByRole('button', { name: new RegExp(`Change status of ${title}`) });
/** Picks a backup file in the open Backup and Restore modal. */
const chooseBackup = (page: Page, contents: string | Buffer, name = 'backup.json') =>
  page.getByLabel('Backup file').setInputFiles({
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(contents),
  });
const restoreFromReview = async (page: Page) => {
  await page.getByRole('button', { name: 'Restore Backup' }).click();
  await page.getByRole('button', { name: 'Replace and Restore' }).click();
  await expect(page.getByText('Backup restored successfully')).toBeVisible();
  await page.getByRole('button', { name: 'Continue to Dashboard' }).click();
};
const titles = (page: Page) => resources(page).locator('.res-name > :first-child').allInnerTexts();

test('first run invites the user to create a plan', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Start your preparation journey',
  );
  await expect(page.getByText('Saved in this browser')).toBeVisible();
});

test('add resources, track weighted progress, and keep it after reload', async ({ page }) => {
  await createPlan(page, 'System design');
  await expect(journey(page).getByText('Your journey starts here')).toBeVisible();

  await addResource(page, 'Caching talk', '1', 'https://www.youtube.com/watch?v=abc');
  await addResource(page, 'Design course', '3');
  await expect(page.getByRole('status')).toHaveText('Resource added');
  await expect(resources(page).getByRole('heading')).toHaveText('Resources (2)');
  await expect(resources(page).getByText('Video', { exact: true })).toBeVisible();

  // Finishing the 1h video is 25% of 4h, though it is half of the resources.
  await statusOf(page, 'Caching talk').click();
  await page.getByRole('menuitemradio', { name: 'Completed' }).click();
  await expect(summary(page).getByText('25%', { exact: true })).toBeVisible();
  await expect(summary(page).getByText('1 / 2')).toBeVisible();

  // Partial progress through the details panel.
  await resources(page).getByRole('button', { name: 'Actions for Design course' }).click();
  await page.getByRole('menuitem', { name: 'Update progress' }).click();
  await page.getByLabel('Hours completed').fill('1.5');
  await page.getByRole('dialog').getByRole('button', { name: 'Update progress' }).click();
  await page.getByRole('button', { name: 'Close', exact: true }).first().click();
  await expect(resources(page).getByText('In Progress · 50%')).toBeVisible();
  await expect(summary(page).getByText('63%', { exact: true })).toBeVisible();

  await page.reload();
  await expect(summary(page).getByText('63%', { exact: true })).toBeVisible();
  await expect(statusOf(page, 'Caching talk')).toHaveText('Completed');
});

test('selecting a journey step highlights its resource', async ({ page }) => {
  await createPlan(page, 'Prep');
  await addResource(page, 'First', '1');
  await addResource(page, 'Second', '1');
  await journey(page)
    .getByRole('button', { name: /^Second/ })
    .click();
  await expect(page.locator('.res-row.is-selected')).toContainText('Second');
  // Picking a step never completes it.
  await expect(statusOf(page, 'Second')).toHaveText('Not Started');
});

test('phases are optional, group resources, and deleting one keeps its resources', async ({
  page,
}) => {
  await createPlan(page, 'Interviews');
  await addResource(page, 'Arrays', '1');
  await addResource(page, 'Graphs', '2');

  await journey(page).getByRole('button', { name: 'Phases' }).click();
  await expect(journey(page).getByText('Organize your journey into milestones')).toBeVisible();
  await journey(page).getByRole('button', { name: 'Add Phase' }).click();
  await page.getByLabel('Phase Title').fill('Basics');
  await page.getByRole('radio', { name: 'green' }).check();
  await page.getByRole('dialog').getByRole('button', { name: 'Add Phase' }).click();

  await resources(page).getByRole('button', { name: 'Actions for Arrays' }).click();
  await page.getByRole('menuitemradio', { name: 'Basics' }).click();
  await expect(resources(page).locator('.ph-tag')).toHaveText('Basics');

  await expect(journey(page).getByRole('button', { name: /^Basics/ })).toContainText(
    '0 / 1 resources',
  );
  await expect(journey(page).getByRole('button', { name: /^Unorganized/ })).toBeVisible();

  // Selecting a phase filters the list to it.
  await journey(page)
    .getByRole('button', { name: /^Basics/ })
    .click();
  await expect(resources(page).locator('.res-row')).toHaveCount(1);

  await page.reload();
  await expect(resources(page).locator('.ph-tag')).toHaveText('Basics');
  await journey(page)
    .getByRole('button', { name: /^Phases/ })
    .click();
  await journey(page)
    .getByRole('button', { name: /^Basics/ })
    .click();
  await resources(page).getByRole('button', { name: 'Edit phase' }).click();
  await page.getByRole('button', { name: 'Delete phase' }).click();
  await page.getByRole('button', { name: 'Delete? Its resources are kept' }).click();
  await expect(resources(page).locator('.ph-tag')).toHaveCount(0);
  await expect(resources(page).locator('.res-row')).toHaveCount(2);
});

test('my plans: switch, duplicate, and import a backup from an older version', async ({ page }) => {
  await createPlan(page, 'First plan');
  await page.getByRole('button', { name: 'My Plans' }).click();
  await page.getByRole('button', { name: 'Actions for First plan' }).click();
  await page.getByRole('menuitem', { name: 'Duplicate plan' }).click();
  await expect(page.getByRole('heading', { name: 'First plan (copy)' })).toBeVisible();

  const backup = {
    version: 1,
    activeGoalId: 'g1',
    goals: [
      {
        id: 'g1',
        name: 'Imported goal',
        targetDate: '2099-01-01',
        hoursPerDay: 2,
        resources: [
          { id: 'r1', title: 'Old article', type: 'article', minutes: 30, rating: 4 },
          {
            id: 'r2',
            title: 'Old course',
            type: 'course',
            sections: [
              { title: 'A', minutes: 60, done: true },
              { title: 'B', minutes: 60, done: false },
            ],
          },
        ],
      },
    ],
  };
  await page.getByRole('button', { name: 'Backup and restore' }).click();
  await chooseBackup(page, JSON.stringify(backup), 'old-backup.json');
  const contents = page.getByRole('region', { name: 'Backup contents' });
  await expect(contents).toContainText('old-backup.json');
  await expect(contents.locator('.backup-stats')).toHaveText(
    /Plan\s*1\s*Phases\s*0\s*Resources\s*2/,
  );
  await expect(contents).not.toContainText('Created');
  await expect(contents).toContainText('1 course with sections will be converted');
  await restoreFromReview(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Imported goal');
  await expect(resources(page).getByText('Old article')).toBeVisible();
  // The old course's sections became 1h of 2h done.
  await expect(resources(page).getByText('In Progress · 50%')).toBeVisible();
  await page.getByRole('button', { name: 'My Plans' }).click();
  await expect(page.locator('.plan-card')).toHaveCount(1);
});

test('definition of done: two resources in progress at once, then export and restore', async ({
  page,
}) => {
  await createPlan(page, 'Senior iOS');
  await addResource(page, 'SwiftUI course', '20');
  await addResource(page, 'Async video', '2');
  await addResource(page, 'System design article', '8');

  const status = (title: string) =>
    resources(page).getByRole('button', { name: new RegExp(`Change status of ${title}`) });
  const setStatus = async (title: string, to: string) => {
    await status(title).click();
    await page.getByRole('menuitemradio', { name: to }).click();
  };
  const record = async (title: string, hours: string) => {
    await resources(page)
      .getByRole('button', { name: `Actions for ${title}` })
      .click();
    await page.getByRole('menuitem', { name: 'Update progress' }).click();
    await page.getByLabel('Hours completed').fill(hours);
    await page.getByRole('dialog').getByRole('button', { name: 'Update progress' }).click();
    await page.getByRole('button', { name: 'Close', exact: true }).first().click();
  };

  // Starting credits no time.
  await setStatus('SwiftUI course', 'In Progress');
  await setStatus('Async video', 'In Progress');
  await expect(status('SwiftUI course')).toHaveText('In Progress');
  await expect(status('Async video')).toHaveText('In Progress');
  await expect(summary(page).getByText('0%', { exact: true })).toBeVisible();

  await record('SwiftUI course', '5');
  await record('Async video', '1');
  await expect(status('SwiftUI course')).toHaveText('In Progress · 25%');
  await expect(status('Async video')).toHaveText('In Progress · 50%');

  await setStatus('Async video', 'Completed');
  await expect(status('SwiftUI course')).toHaveText('In Progress · 25%');
  // (5h + 2h) of 30h.
  await expect(summary(page).getByText('23%', { exact: true })).toBeVisible();
  await expect(summary(page).getByText('1 / 3')).toBeVisible();

  // The journey shows the active one and recommends the first unfinished step.
  await expect(journey(page).locator('.step-btn.is-active')).toHaveCount(1);
  await expect(journey(page).locator('.step-btn.is-next')).toContainText('SwiftUI course');
  await expect(page.getByRole('region', { name: 'Continue Learning' })).toContainText(
    'SwiftUI course',
  );

  // Resetting progress needs a second click.
  await status('SwiftUI course').click();
  await page.getByRole('menuitemradio', { name: 'Not Started' }).click();
  await expect(status('SwiftUI course')).toHaveText('In Progress · 25%');
  await page.getByRole('menuitemradio', { name: 'Clear progress? Click again' }).click();
  await expect(status('SwiftUI course')).toHaveText('Not Started');

  // Filter by status.
  await resources(page).getByLabel('Filter by status').selectOption('completed');
  await expect(resources(page).locator('.res-row')).toHaveCount(1);
  await resources(page).getByLabel('Filter by status').selectOption('all');

  await page.reload();
  await expect(status('Async video')).toHaveText('Completed');

  // Download, delete everything, and restore.
  await page.getByRole('button', { name: 'My Plans' }).click();
  await page.getByRole('button', { name: 'Backup and restore' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download Backup' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^prepline-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const backup = Buffer.concat(await (await download.createReadStream()).toArray());
  await page.getByRole('button', { name: /Advanced Options/ }).click();
  await page.getByRole('button', { name: 'Delete All Data' }).click();
  await page
    .getByRole('alertdialog', { name: 'Delete all Prepline data?' })
    .getByRole('button', { name: 'Delete All Data' })
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Start your preparation journey',
  );
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Start your preparation journey',
  );

  await page.getByRole('button', { name: 'Restore from a backup' }).click();
  await chooseBackup(page, backup);
  await expect(page.getByRole('region', { name: 'Backup contents' })).toContainText('Created');
  await restoreFromReview(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Senior iOS');
  await expect(status('Async video')).toHaveText('Completed');
  await page.reload();
  await expect(status('Async video')).toHaveText('Completed');
});

test('rejects a file that is not a Prepline backup', async ({ page }) => {
  await createPlan(page, 'Keep me');
  await page.getByRole('button', { name: 'My Plans' }).click();
  await page.getByRole('button', { name: 'Backup and restore' }).click();
  await chooseBackup(page, '{"version": 2, "goals": []}');
  const alert = page.getByRole('dialog').getByRole('alert');
  await expect(alert).toContainText("This backup couldn't be opened.");
  await expect(alert).toContainText('Unsupported backup version');
  await expect(page.getByRole('region', { name: 'Backup contents' })).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'My Plans' }).click();
  await expect(page.locator('.plan-card')).toHaveCount(1);
});

test('on a phone the backup cards stack without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await page.getByRole('button', { name: 'Restore from a backup' }).click();
  const [dl, restore] = await page.locator('.backup-card').all();
  const a = (await dl!.boundingBox())!;
  const b = (await restore!.boundingBox())!;
  expect(b.y).toBeGreaterThanOrEqual(a.y + a.height);
  const overflow = await page.getByRole('dialog').evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('on a phone the journey is a vertical stepper and the list is stacked cards', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await createPlan(page, 'Mobile');
  await addResource(page, 'One', '1');
  await addResource(page, 'Two', '1');
  await expect(journey(page).locator('.snake')).toHaveClass(/vertical/);
  const [a, b] = await journey(page).locator('.step').all();
  const ba = (await a!.boundingBox())!;
  const bb = (await b!.boundingBox())!;
  expect(bb.y).toBeGreaterThan(ba.y);
  expect(Math.abs(bb.x - ba.x)).toBeLessThan(2);
  await expect(resources(page).locator('thead')).toBeHidden();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(390);
});

test('the theme switch overrides the system setting and is remembered', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('./');
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const darkBg = await bg();

  await page.getByRole('radio', { name: 'Light' }).click();
  await expect(page.getByRole('radio', { name: 'Light' })).toHaveAttribute('aria-checked', 'true');
  await expect.poll(bg).not.toBe(darkBg);
  const lightBg = await bg();

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.getByRole('radio', { name: 'Auto' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
  await expect.poll(bg).toBe(darkBg);

  // Auto follows OS changes live, without a reload.
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(bg).toBe(lightBg);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(bg).toBe(darkBg);
});

test('drag a resource to reorder the list, or move it with the arrow keys', async ({ page }) => {
  await createPlan(page, 'Prep');
  for (const t of ['One', 'Two', 'Three']) await addResource(page, t, '1');
  await expect(resources(page).getByRole('checkbox')).toHaveCount(0);

  // Drag "Three" above "One".
  const handle = resources(page).getByRole('button', { name: 'Reorder Three' });
  // Centre the table so the drag stays clear of the auto-scroll edges.
  await resources(page)
    .getByRole('table')
    .evaluate((t) => t.scrollIntoView({ block: 'center' }));
  const first = await resources(page).getByRole('row').nth(1).boundingBox();
  const from = await handle.boundingBox();
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  await page.mouse.move(from!.x + from!.width / 2, first!.y + 4, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => titles(page)).toEqual(['Three', 'One', 'Two']);
  // The journey follows the new priority order.
  await expect(
    journey(page)
      .getByRole('button', { name: /^(One|Two|Three)/ })
      .first(),
  ).toContainText('Three');

  // Keyboard: focus the handle and press ArrowDown twice.
  await handle.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => titles(page)).toEqual(['One', 'Two', 'Three']);
  await expect(handle).toBeFocused();

  await page.reload();
  await expect.poll(() => titles(page)).toEqual(['One', 'Two', 'Three']);
});
