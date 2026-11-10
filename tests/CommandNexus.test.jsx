import {expect, test} from '../e2e/network.mock';

test('commands view displays saved entries and search filters them', async ({page}) => {
    await page.goto('/');
    await page.getByText('Commands', {exact: true}).click();
    await expect(page.getByText('Flush DNS')).toBeVisible();
    await page.getByPlaceholder(/search commands/i).fill('not found');
    await expect(page.getByText('No matching commands found')).toBeVisible();
});
