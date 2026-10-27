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
  await resources(page).getByRole('checkbox', { name: 'Mark complete: Caching talk' }).check();
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
  await expect(
    resources(page).getByRole('checkbox', { name: 'Reopen: Caching talk' }),
  ).toBeChecked();
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
  await expect(
    resources(page).getByRole('checkbox', { name: 'Mark complete: Second' }),
  ).not.toBeChecked();
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
  await page.getByLabel('Paste backup JSON').fill(JSON.stringify(backup));
  await page.getByRole('button', { name: 'Check backup' }).click();
  const contents = page.getByRole('region', { name: 'Backup contents' });
  await expect(contents).toContainText('1 plan, 2 resources, 0 phases');
  await expect(contents).toContainText('1 course with sections will be converted');
  await contents.getByRole('button', { name: 'Replace all data' }).click();
  await contents.getByRole('button', { name: 'Click again to replace' }).click();

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

  // Export, wipe, and restore.
  await page.getByRole('button', { name: 'My Plans' }).click();
  await page.getByRole('button', { name: 'Backup and restore' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download .json' }).click(),
  ]);
  const backup = await (await download.createReadStream()).toArray();
  const json = Buffer.concat(backup).toString();
  await page.getByRole('button', { name: 'Erase all data' }).click();
  await page.getByRole('button', { name: 'Erase every plan?' }).click();
  await page.getByRole('button', { name: 'Restore from a backup' }).click();
  await page.getByLabel('Paste backup JSON').fill(json);
  await page.getByRole('button', { name: 'Check backup' }).click();
  await page.getByRole('button', { name: 'Replace all data' }).click();
  await page.getByRole('button', { name: 'Click again to replace' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Senior iOS');
  await expect(status('Async video')).toHaveText('Completed');
});

test('rejects a file that is not a Prepline backup', async ({ page }) => {
  await createPlan(page, 'Keep me');
  await page.getByRole('button', { name: 'My Plans' }).click();
  await page.getByRole('button', { name: 'Backup and restore' }).click();
  await page.getByLabel('Paste backup JSON').fill('{"version": 2, "goals": []}');
  await page.getByRole('button', { name: 'Check backup' }).click();
  await expect(page.getByRole('dialog')).toContainText('different version of Prepline');
  await expect(page.getByRole('region', { name: 'Backup contents' })).toHaveCount(0);
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
