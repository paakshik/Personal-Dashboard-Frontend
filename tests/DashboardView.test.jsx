import {expect, test} from '../e2e/network.mock';

test('renders dashboard shell and real sidebar navigation', async ({page}) => {
    await page.goto('/');
    await expect(page.getByRole('navigation').locator('span').filter({hasText: /^Dashboard$/})).toBeVisible();
    await expect(page.getByRole('navigation').locator('span').filter({hasText: /^Calendar$/})).toBeVisible();
});
