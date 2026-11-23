import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/** Opens the app and creates an account (the e2e build uses an in-memory backend). */
async function signIn(page: Page, email = 'e2e@example.test') {
  await page.goto('./');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Name').fill('E2E User');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('correct horse battery');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
}

async function createPlan(page: Page, name: string) {
  await signIn(page);
  await page.getByRole('button', { name: 'Create Your First Plan' }).click();
  await page.getByLabel('Plan Title').fill(name);
  await page.getByRole('button', { name: 'Create Plan' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
}

async function addResource(page: Page, title: string, hours: string, url = '') {
  await page
    .getByRole('region', { name: 'Plan overview' })
    .getByRole('button', { name: 'Add Resource' })
    .click();
  const sheet = page.getByRole('dialog', { name: 'Add Resource' });
  if (url) await sheet.getByRole('textbox', { name: /^Resource URL/ }).fill(url);
  await sheet.getByLabel('Title', { exact: true }).fill(title);
  await sheet.getByRole('spinbutton', { name: 'Estimated Time' }).fill(hours);
  await sheet.getByRole('button', { name: 'Add Resource' }).click();
  await expect(sheet).toBeHidden();
}

async function openImport(page: Page) {
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Import plans' }).click();
}

const summary = (page: Page) => page.getByRole('region', { name: 'Plan overview' });
const journey = (page: Page) => page.getByRole('region', { name: 'Your Preparation Journey' });
const resources = (page: Page) => page.getByRole('region', { name: /^Resources/ });
const statusOf = (page: Page, title: string) =>
  resources(page).getByRole('button', { name: new RegExp(`Change status of ${title}`) });
/** Picks a file in the open Import plans modal. */
const chooseFile = (page: Page, contents: string | Buffer, name = 'backup.json') =>
  page.getByLabel('Plan file', { exact: true }).setInputFiles({
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(contents),
  });
const addFromReview = async (page: Page) => {
  await page.getByRole('button', { name: 'Add to My Plans' }).click();
  await expect(page.getByText('Plans added successfully')).toBeVisible();
  await page.getByRole('button', { name: 'Continue to Dashboard' }).click();
};
const titles = (page: Page) => resources(page).locator('.res-title > :first-child').allInnerTexts();

test('asks for sign-in first, then invites the user to create a plan', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with X (Twitter)' })).toBeVisible();
  await signIn(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Start your preparation journey',
  );
  await expect(page.getByText('Saved to your account')).toBeVisible();
});

test('add resources, track weighted progress, and keep it after reload', async ({ page }) => {
  await createPlan(page, 'System design');
  await expect(journey(page).getByText('Your journey starts here')).toBeVisible();

  await addResource(page, 'Caching talk', '1', 'https://www.youtube.com/watch?v=abc');
  await addResource(page, 'Design course', '3');
  await expect(page.getByRole('status')).toHaveText('Resource added');
  await expect(resources(page).getByRole('heading')).toHaveText('Resources (2)');
  await expect(resources(page).getByText('Watch', { exact: true })).toBeVisible();

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
  await expect(page.locator('.res-card.is-selected')).toContainText('Second');
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
  await expect(resources(page).locator('.band-name')).toContainText(['Basics', 'Unassigned']);

  await expect(journey(page).getByRole('button', { name: /^Basics/ })).toContainText(
    '0 / 1 resources',
  );
  await expect(journey(page).getByRole('button', { name: /^Unorganized/ })).toBeVisible();

  // Picking a phase takes you to its band; every phase and resource stays listed.
  await journey(page)
    .getByRole('button', { name: /^Basics/ })
    .click();
  await expect(resources(page).locator('.band-name')).toHaveCount(2);
  await expect(resources(page).locator('.res-card')).toHaveCount(2);
  await expect(resources(page).getByRole('region', { name: 'Basics' })).toBeInViewport();

  await page.reload();
  await expect(resources(page).locator('.band-name').first()).toContainText('Basics');
  await journey(page)
    .getByRole('button', { name: /^Phases/ })
    .click();
  await journey(page)
    .getByRole('button', { name: /^Basics/ })
    .click();
  await resources(page).getByRole('button', { name: 'Edit phase' }).click();
  await page.getByRole('button', { name: 'Delete phase' }).click();
  await page.getByRole('button', { name: 'Delete? Its resources are kept' }).click();
  await expect(resources(page).locator('.band-name')).toHaveText([/^Unassigned/]);
  await expect(resources(page).locator('.res-card')).toHaveCount(2);
});

test('my plans: switch, duplicate, and import a plan file from an older version', async ({
  page,
}) => {
  await createPlan(page, 'First plan');
  await page.getByRole('link', { name: 'My Plans' }).click();
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
  await openImport(page);
  await chooseFile(page, JSON.stringify(backup), 'old-backup.json');
  const contents = page.getByRole('region', { name: 'File contents' });
  await expect(contents).toContainText('old-backup.json');
  await expect(contents.locator('.backup-stats')).toHaveText(
    /Plan\s*1\s*Phases\s*0\s*Resources\s*2/,
  );
  await expect(contents).not.toContainText('Created');
  await expect(contents).toContainText('1 course with sections will be converted');
  await addFromReview(page);

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Imported goal');
  await expect(resources(page).getByText('Old article')).toBeVisible();
  // The old course's sections became 1h of 2h done.
  await expect(resources(page).getByText('In Progress · 50%')).toBeVisible();
  await page.getByRole('link', { name: 'My Plans' }).click();
  await expect(page.locator('.plan-card')).toHaveCount(3);
});

test('definition of done: two resources in progress at once, then delete all data and import a plan', async ({
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
  await expect(resources(page).locator('.res-card')).toHaveCount(1);
  await resources(page).getByLabel('Filter by status').selectOption('all');

  await page.reload();
  await expect(status('Async video')).toHaveText('Completed');

  // Delete everything from Account settings → Privacy, then import a plan.
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Account settings' }).click();
  await page.getByRole('button', { name: 'Delete All Data' }).click();
  await page
    .getByRole('alertdialog', { name: 'Delete all Road to Goals data?' })
    .getByRole('button', { name: 'Delete All Data' })
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Start your preparation journey',
  );
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Start your preparation journey',
  );

  await page.getByRole('button', { name: 'Import a plan' }).click();
  await chooseFile(page, readFileSync('docs/examples/ios-interview-prep.json'), 'plan.json');
  await addFromReview(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'iOS Developer Interview Preparation',
  );
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'iOS Developer Interview Preparation',
  );
});

test('adds the documented agent plan next to an existing plan', async ({ page }) => {
  await createPlan(page, 'Keep me');
  await page.getByRole('link', { name: 'My Plans' }).click();
  await openImport(page);
  await chooseFile(page, readFileSync('docs/examples/ios-interview-prep.json'), 'plan.json');
  await expect(page.getByRole('region', { name: 'File contents' })).toBeVisible();
  // The example asks to be shared by link, so the review says so before anything happens.
  await expect(page.getByText('Made by')).toBeVisible();
  await expect(page.getByText('Will be shared')).toBeVisible();
  await expect(page.getByText(/anyone with the link · tags: interview, ios, swift/)).toBeVisible();
  await page.getByRole('button', { name: 'Add to My Plans' }).click();
  await expect(page.getByText('Plans added successfully')).toBeVisible();
  await page.getByRole('button', { name: 'Continue to Dashboard' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'iOS Developer Interview Preparation',
  );
  expect(await titles(page)).toHaveLength(8);
  await page.reload();
  await page.getByRole('link', { name: 'My Plans' }).click();
  await expect(page.locator('.plan-card')).toHaveCount(2);
});

test('rejects a file that is not a Road to Goals plan, and non-JSON files', async ({ page }) => {
  await createPlan(page, 'Keep me');
  await page.getByRole('link', { name: 'My Plans' }).click();
  await page.getByRole('button', { name: 'Import plan' }).click();
  await page.getByLabel('Plan file', { exact: true }).setInputFiles({
    name: 'photo.png',
    mimeType: 'image/png',
    buffer: Buffer.from('not an image'),
  });
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Not a .json file');
});

test('rejects an unsupported plan file version', async ({ page }) => {
  await createPlan(page, 'Keep me');
  await page.getByRole('link', { name: 'My Plans' }).click();
  await openImport(page);
  await chooseFile(page, '{"version": 2, "goals": []}');
  const alert = page.getByRole('dialog').getByRole('alert');
  await expect(alert).toContainText("This file couldn't be opened.");
  await expect(alert).toContainText('Unsupported file version');
  await expect(page.getByRole('region', { name: 'File contents' })).toHaveCount(0);
  await page.reload();
  await page.getByRole('link', { name: 'My Plans' }).click();
  await expect(page.locator('.plan-card')).toHaveCount(1);
});

test('on a phone the import dialog has no sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.getByRole('button', { name: 'Import a plan' }).click();
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
  await expect(resources(page).locator('.res-card').first()).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(390);
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeHidden();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'My Plans' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
  await page.getByRole('link', { name: 'My Plans' }).click();
  await expect(page.getByRole('link', { name: 'My Plans' })).toBeHidden();
});

test('the theme switch overrides the system setting and is remembered', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await signIn(page);
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const darkBg = await bg();

  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitemradio', { name: 'Light' }).click();
  await page.getByRole('button', { name: 'Account menu' }).click();
  await expect(page.getByRole('menuitemradio', { name: 'Light' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.keyboard.press('Escape');
  await expect.poll(bg).not.toBe(darkBg);
  const lightBg = await bg();

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitemradio', { name: 'Auto' }).click();
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
    .locator('.res-list')
    .evaluate((t) => t.scrollIntoView({ block: 'center' }));
  const first = await resources(page).locator('.res-card').first().boundingBox();
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

test('keeps plans after reload and hides them after sign-out', async ({ page }) => {
  await createPlan(page, 'Private plan');
  await expect(page.getByText('All changes saved')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Private plan');

  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await page.getByRole('menuitem', { name: 'Click again to sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByText('Private plan')).toBeHidden();

  // Signing back in finds the same account and data.
  await page.getByLabel('Email').fill('e2e@example.test');
  await page.getByLabel('Password').fill('correct horse battery');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Private plan');
});

test('linking Google keeps the same account, so a Google sign-in opens the same plans', async ({
  page,
}) => {
  await createPlan(page, 'Shared plan');
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Account settings' }).click();
  const account = page.getByRole('dialog', { name: 'Account' });
  await account.getByRole('listitem').filter({ hasText: 'Google' }).getByRole('button').click();
  await expect(account.getByText('linked')).toHaveCount(2);
});

test('the address bar follows the screen: dashboard, My Plans, a plan, Back, Forward, refresh, new tab', async ({
  page,
  context,
}) => {
  await createPlan(page, 'Routing plan');
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await page.getByRole('link', { name: 'My Plans' }).click();
  await expect(page).toHaveURL(/\/plans$/);
  await page.getByRole('link', { name: 'Open plan' }).click();
  await expect(page).toHaveURL(/\/plans\/[^/]+$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Routing plan');
  await expect(page.getByRole('link', { name: 'My Plans' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  const planUrl = page.url();
  await page.getByRole('link', { name: 'Road to Goals home' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goBack();
  await expect(page).toHaveURL(planUrl);

  await page.goBack();
  await expect(page).toHaveURL(/\/plans$/);
  await expect(page.getByRole('heading', { level: 1, name: 'My Plans' })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goForward();
  await page.goForward();
  await expect(page).toHaveURL(planUrl);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Routing plan');

  // Refresh: the same plan, still signed in.
  await page.reload();
  await expect(page).toHaveURL(planUrl);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Routing plan');

  // A new tab with the same session (the e2e backend keeps it in sessionStorage).
  const stored = await page.evaluate(() => JSON.stringify({ ...sessionStorage }));
  const tab = await context.newPage();
  await tab.addInitScript((s) => {
    for (const [k, v] of Object.entries(JSON.parse(s) as Record<string, string>)) {
      sessionStorage.setItem(k, v);
    }
  }, stored);
  await tab.goto(planUrl);
  await expect(tab.getByRole('heading', { level: 1 })).toHaveText('Routing plan');

  // A plan that is not in the account.
  await tab.goto(planUrl.replace(/\/plans\/.*/, '/plans/someone-elses'));
  await expect(tab.getByRole('heading', { level: 1, name: 'Plan not found' })).toBeVisible();
  await tab.goto(planUrl.replace(/\/plans\/.*/, '/'));
  await expect(tab).toHaveURL(/\/dashboard$/);
});

test('signed out, a plan address shows sign-in and returns to the plan after signing in', async ({
  page,
}) => {
  await page.goto('./plans/wanted-plan');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page).toHaveURL(/\/plans\/wanted-plan$/);
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Name').fill('E2E User');
  await page.getByLabel('Email').fill('route@example.test');
  await page.getByLabel('Password').fill('correct horse battery');
  await page.getByRole('button', { name: 'Create account' }).click();
  // Signed in, still at the requested address (no such plan in a fresh account).
  await expect(page).toHaveURL(/\/plans\/wanted-plan$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Plan not found' })).toBeVisible();
});

test('a plan can be started later, with a deadline or none, and shows no red before then', async ({
  page,
}) => {
  await createPlan(page, 'Later plan');
  await addResource(page, 'Read a book', '10');
  const overview = summary(page);
  await expect(overview).toContainText('Not started yet');
  await expect(page.locator('.velocity')).toHaveCount(0);

  await overview.getByRole('button', { name: 'Start plan' }).click();
  await page.getByRole('radio', { name: 'No deadline' }).check();
  await page.getByRole('dialog').getByRole('button', { name: 'Start plan' }).click();
  await expect(overview).not.toContainText('Not started yet');
  await expect(overview).toContainText('No deadline');
  await expect(page.locator('.velocity')).toHaveCount(0);
  await expect(page.locator('.pace-open, .pace-not_started, .pace-idle')).not.toHaveCount(0);
  await expect(page.locator('.pace-behind, .pace-past')).toHaveCount(0);
});

test('a shared plan shows content only, signed out, and can be copied into another account', async ({
  page,
}) => {
  await createPlan(page, 'Shared plan');
  await addResource(page, 'Swift basics', '2', 'https://example.com/swift');
  await summary(page).getByRole('button', { name: 'Start plan' }).click();
  await page.getByRole('radio', { name: '30 days from today' }).check();
  await page.getByRole('dialog').getByRole('button', { name: 'Start plan' }).click();

  await summary(page).getByRole('button', { name: 'Share plan' }).click();
  const dialog = page.getByRole('dialog', { name: /Share/ });
  await dialog.getByRole('radio', { name: /Anyone with the link/ }).check();
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog.getByText('Sharing settings saved.')).toBeVisible();
  const link = await dialog.getByLabel('Link to this plan').inputValue();
  await dialog.getByRole('button', { name: 'Done' }).click();

  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await page.getByRole('menuitem', { name: 'Click again to sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

  // Signed out, the link opens the plan: its content, and nothing of its owner's schedule.
  await page.goto(link);
  await expect(page.getByRole('heading', { level: 1, name: 'Shared plan' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Swift basics/ })).toBeVisible();
  // Nothing about the owner's schedule or progress: no deadline, days left or percentage.
  await expect(page.getByText(/days left|deadline|% complete/i)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Swift basics' })).toHaveAttribute('rel', /nofollow/);

  // Adding it asks for an account, then returns to the plan and adds a fresh copy.
  await page.getByRole('button', { name: 'Add to My Plans' }).click();
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Name').fill('E2E User');
  await page.getByLabel('Email').fill('viewer@example.test');
  await page.getByLabel('Password').fill('correct horse battery');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Shared plan' })).toBeVisible();
  await page.getByRole('button', { name: 'Add to My Plans' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Shared plan' })).toBeVisible();
  await expect(summary(page)).toContainText('Not started yet');
  await expect(summary(page)).toContainText('0%');
});

test('a signed-out visitor stars a shared plan and finds it under Favorites later', async ({
  page,
}) => {
  await createPlan(page, 'Starred plan');
  await addResource(page, 'Swift basics', '2', 'https://example.com/swift');
  await summary(page).getByRole('button', { name: 'Share plan' }).click();
  const dialog = page.getByRole('dialog', { name: /Share/ });
  await dialog.getByRole('radio', { name: /Anyone with the link/ }).check();
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog.getByText('Sharing settings saved.')).toBeVisible();
  const link = await dialog.getByLabel('Link to this plan').inputValue();
  await dialog.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await page.getByRole('menuitem', { name: 'Click again to sign out' }).click();

  // Both counts show, even at zero. Starring signed out asks for an account first.
  await page.goto(link);
  await expect(page.getByText(/0 forks · 0 favorites/)).toBeVisible();
  await page.getByRole('button', { name: 'Favorite', exact: true }).click();
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Name').fill('Star Fan');
  await page.getByLabel('Email').fill('fan@example.test');
  await page.getByLabel('Password').fill('correct horse battery');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Starred plan' })).toBeVisible();

  await page.getByRole('button', { name: 'Favorite', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Favorited' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByText(/0 forks · 1 favorite$/)).toBeVisible();

  // Later, without copying it, the plan is still in Favorites.
  await page.getByRole('link', { name: 'Favorites' }).click();
  await expect(page.getByRole('heading', { name: 'Starred plan' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Starred plan' })).toBeVisible();
  await page.getByRole('button', { name: 'Favorited' }).click();
  await page.reload();
  await expect(page.getByText('No favorites yet')).toBeVisible();
});

test('exports a plan as JSON and imports that file back', async ({ page }) => {
  await createPlan(page, 'Take me along');
  await addResource(page, 'Intro video', '1.5', 'https://example.com/v');
  await page.getByRole('button', { name: 'Export plan' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: /^JSON/ }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('take-me-along.json');
  const text = readFileSync((await file.path())!, 'utf8');
  expect(JSON.parse(text).goals[0].resources[0].title).toBe('Intro video');

  await page.getByRole('link', { name: 'My Plans' }).click();
  await openImport(page);
  await chooseFile(page, text, 'take-me-along.json');
  await expect(page.getByRole('region', { name: 'File contents' })).toBeVisible();
  await page.getByRole('button', { name: 'Add to My Plans' }).click();
  await expect(page.getByText('Plans added successfully')).toBeVisible();
  await page.getByRole('button', { name: 'Continue to Dashboard' }).click();
  await page.getByRole('link', { name: 'My Plans' }).click();
  await expect(page.locator('.plan-card')).toHaveCount(2);
});
