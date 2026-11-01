import { test, expect } from '@playwright/test';

test.describe('Historical Fantasy Football Stats', () => {
  test('rank column displays row positions correctly', async ({ page }) => {
    await page.goto('/');

    // Wait for data to load
    await expect(page.getByText('Loading data...')).toBeHidden({ timeout: 10000 });

    // Verify rank column header exists
    await expect(page.getByRole('columnheader', { name: '#' })).toBeVisible();

    // Get the first few rows and verify they have correct rank numbers
    const rows = page.locator('tbody tr');

    // First row should show rank 1
    const firstRowRank = rows.first().locator('td').first();
    await expect(firstRowRank).toHaveText('1');

    // Second row should show rank 2
    const secondRowRank = rows.nth(1).locator('td').first();
    await expect(secondRowRank).toHaveText('2');

    // Third row should show rank 3
    const thirdRowRank = rows.nth(2).locator('td').first();
    await expect(thirdRowRank).toHaveText('3');
  });

  test('serves crawlable content before JavaScript runs', async ({ request }) => {
    const html = await (await request.get('/')).text();
    expect(html).toContain('<h1');
    expect(html).toContain('Best Fantasy Seasons of All Time');
    expect(html).toContain('href="/mcp"');
  });

  test('rank column is sortable', async ({ page }) => {
    await page.goto('/');

    // Wait for data to load
    await expect(page.getByText('Loading data...')).toBeHidden({ timeout: 10000 });

    const rows = page.locator('tbody tr');
    const rankHeader = page.getByRole('columnheader', { name: '#' });

    // Initially sorted by fantasy points, so rank 1 is first
    await expect(rows.first().locator('td').first()).toHaveText('1');

    // Click rank header - first click sorts descending (numeric columns default to desc)
    await rankHeader.click();
    await expect(rankHeader).toContainText('↓');
    // First row should now show the highest rank number (last place)
    const firstRowRankDesc = await rows.first().locator('td').first().textContent();
    expect(Number(firstRowRankDesc)).toBeGreaterThan(1);

    // Click again to sort ascending (1, 2, 3...)
    await rankHeader.click();
    await expect(rankHeader).toContainText('↑');
    await expect(rows.first().locator('td').first()).toHaveText('1');
  });

  test('scoring modal saves and persists changes', async ({ page }) => {
    await page.goto('/');

    // Wait for data to load
    await expect(page.getByText('Loading data...')).toBeHidden({ timeout: 10000 });

    // Open scoring settings
    await page.getByRole('button', { name: 'Scoring Settings' }).click();
    await expect(page.getByRole('heading', { name: 'Scoring Settings' })).toBeVisible();

    // Get the PPR input by finding the label and its adjacent input
    const pprInput = page.getByLabel('Points per Reception');

    // Verify initial value is 1 (full PPR - the default)
    await expect(pprInput).toHaveValue('1');

    // Change PPR to 0.5 (half PPR)
    await pprInput.fill('0.5');
    await expect(pprInput).toHaveValue('0.5');

    // Save changes
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // Modal should close
    await expect(page.getByRole('heading', { name: 'Scoring Settings' })).toBeHidden();

    // Reopen modal and verify the value persisted
    await page.getByRole('button', { name: 'Scoring Settings' }).click();
    await expect(page.getByRole('heading', { name: 'Scoring Settings' })).toBeVisible();

    // Verify PPR is still 0.5
    await expect(page.getByLabel('Points per Reception')).toHaveValue('0.5');

    // Close modal
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('loads and displays player data', async ({ page }) => {
    await page.goto('/');

    // Check header is present
    await expect(page.locator('h1')).toContainText('Historical Fantasy Football Stats');

    // Wait for data to load (loading indicator should disappear)
    await expect(page.getByText('Loading data...')).toBeHidden({ timeout: 10000 });

    // Check that the table is present with data
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // Check that we have rows in the table
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible();

    // Check that fantasy points column exists
    await expect(page.getByRole('columnheader', { name: 'Fantasy Pts' })).toBeVisible();

    // Check that position dropdown is present
    await expect(page.getByLabel('Position')).toBeVisible();

    // Check that scoring settings button is present
    await expect(page.getByRole('button', { name: 'Scoring Settings' })).toBeVisible();

    // Click on scoring settings and verify modal opens
    await page.getByRole('button', { name: 'Scoring Settings' }).click();
    await expect(page.getByRole('heading', { name: 'Scoring Settings' })).toBeVisible();

    // Close modal
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: 'Scoring Settings' })).toBeHidden();

    // Filter by position (QB)
    await page.getByLabel('Position').selectOption('QB');

    // Verify table still has data and shows QB-specific columns
    await expect(page.getByRole('columnheader', { name: 'Pass Yds' })).toBeVisible();
  });

  test('shows a single week of the live season', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Loading data...')).toBeHidden({ timeout: 10000 });

    // Weekly data exists only for live seasons, so the filter starts hidden
    await expect(page.getByLabel('Week')).toHaveCount(0);

    const yearSelect = page.getByLabel('Year');
    const season = await yearSelect.locator('option').filter({ hasText: /^\d{4}$/ }).first().getAttribute('value');
    await yearSelect.selectOption(season!);

    const weekSelect = page.getByLabel('Week');
    await weekSelect.selectOption('1');

    await expect(page.getByRole('columnheader', { name: 'Opp' })).toBeVisible();
    await expect(page.locator('tbody tr').first().locator('td').nth(1)).toHaveText('1');
    await expect(page.locator('tbody tr').first().locator('td').first()).toHaveText('1');

    // Changing the year goes back to full seasons
    await yearSelect.selectOption(String(Number(season) - 1));
    await expect(page.getByRole('columnheader', { name: 'Opp' })).toHaveCount(0);
    await expect(page.getByLabel('Week')).toHaveCount(0);
  });

  test('moves saved settings off retired year filters', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'fantasy-mvp-storage',
        JSON.stringify({
          state: { yearFilter: 'Last56', positionFilter: 'All', scoringConfig: { reception: 0.5 } },
          version: 0,
        })
      );
    });
    await page.goto('/');
    await expect(page.getByText('Loading data...')).toBeHidden({ timeout: 10000 });

    await expect(page.getByLabel('Year')).toHaveValue('AllYears');
    await expect(page.locator('tbody tr').first().locator('td').nth(4)).not.toContainText('NaN');
  });

  test('scoring accepts typed negatives and survives a reload', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Loading data...')).toBeHidden({ timeout: 10000 });

    const points = page.locator('tbody tr').first().locator('td').nth(4);
    const before = await points.textContent();

    await page.getByRole('button', { name: 'Scoring Settings' }).click();
    const interception = page.getByLabel('Interception Points');
    await interception.click();
    await interception.press('ControlOrMeta+a');
    await interception.pressSequentially('-1');
    await expect(interception).toHaveValue('-1');

    await page.getByLabel('Points per Reception').fill('0');
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(points).not.toHaveText(before!);
    const changed = await points.textContent();

    await page.reload();
    await expect(page.getByText('Loading data...')).toBeHidden({ timeout: 10000 });
    await expect(points).toHaveText(changed!);
  });

  test('lists year ranges, then the two newest seasons', async ({ page }) => {
    await page.goto('/');
    const options = await page.getByLabel('Year').locator('option').allTextContents();
    const newest = Number(options[2]);

    expect(options[0]).toMatch(/^Last \d+ Years$/);
    expect(options[1]).toMatch(/^All \d+ Years$/);
    expect(options[3]).toBe(String(newest - 1));
    expect(new Set(options).size).toBe(options.length);
  });

  test('format buttons set reception scoring', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Scoring Settings' }).click();
    await page.getByRole('button', { name: 'Half-PPR' }).click();
    await expect(page.getByLabel('Points per Reception')).toHaveValue('0.5');
  });

  test('links to the explore page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /Explore all pages/ })).toHaveAttribute('href', '/explore');
  });

  test('first paint matches the page React renders', async ({ browser, page }) => {
    const before = await browser.newContext({ javaScriptEnabled: false });
    const staticPage = await before.newPage();
    await staticPage.goto('/');
    const staticHeaders = await staticPage.locator('table').first().locator('thead th').allTextContents();
    const staticRow = await staticPage.locator('table').first().locator('tbody tr').first().locator('td').allTextContents();
    await expect(staticPage.getByRole('button', { name: 'Scoring Settings' })).toBeVisible();
    await before.close();

    await page.goto('/');
    await expect(page.locator('tbody tr')).toHaveCount(500);
    expect(await page.locator('thead th').allTextContents()).toEqual(staticHeaders);
    expect(await page.locator('tbody tr').first().locator('td').allTextContents()).toEqual(staticRow);
  });

  test('shows the default table without the full data file', async ({ page }) => {
    await page.route('**/data/fantasy_data.json', (route) => route.abort());
    await page.goto('/');

    await expect(page.locator('tbody tr')).toHaveCount(500);
    await expect(page.getByText('Error loading data')).toHaveCount(0);
  });

  test('waits for the full data when a filter changes', async ({ page }) => {
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/data/fantasy_data.json', async (route) => {
      await held;
      await route.continue();
    });

    await page.goto('/');
    await expect(page.locator('tbody tr')).toHaveCount(500);

    await page.getByLabel('Year').selectOption('1985');
    await expect(page.getByText('Loading data...')).toBeVisible();

    release();
    await expect(page.getByText('Loading data...')).toBeHidden({ timeout: 10000 });
    await expect(page.locator('tbody tr').first()).toContainText('1985');
  });

  test('saved scoring never shows the default ranking', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'fantasy-mvp-storage',
        JSON.stringify({ state: { yearFilter: 'Last36', positionFilter: 'All', scoringConfig: { reception: 0 } }, version: 1 })
      );
    });
    await page.route('**/data/fantasy_data.json', (route) => route.abort());
    await page.goto('/');

    await expect(page.getByText('Error loading data')).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(0);
  });

  test('columns can be sorted from the keyboard', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Loading data...')).toBeHidden({ timeout: 10000 });

    const header = page.getByRole('columnheader', { name: 'Player' });
    await header.getByRole('button').focus();
    await page.keyboard.press('Enter');
    await expect(header).toHaveAttribute('aria-sort', /ascending|descending/);
  });
});
