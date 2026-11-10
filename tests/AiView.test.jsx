import {expect, test} from '../e2e/network.mock';

test('AI screen opens with chat input and clear-history control', async ({page}) => {
    await page.goto('/');
    await page.getByText('AI', {exact: true}).click();
    await expect(page.getByPlaceholder('Message Nexus AI...')).toBeVisible();
    await expect(page.getByText('Clear History')).toBeVisible();
});
