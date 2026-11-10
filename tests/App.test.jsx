import {expect, test} from '../e2e/network.mock';

test('authenticated visitor sees the dashboard and can open navigation views', async ({page}) => {
    await page.goto('/');
    await expect(page.getByText('Dashboard', {exact: true}).first()).toBeVisible();
    await page.getByText('Commands', {exact: true}).click();
    await expect(page.getByText('Flush DNS')).toBeVisible();
});
