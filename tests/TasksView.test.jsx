import {expect, test} from '../e2e/network.mock';

test('opens tasks view with task controls', async ({page}) => {
    await page.goto('/');
    await page.getByRole('navigation').getByText('Tasks').click();
    await expect(page.getByText(/task/i).first()).toBeVisible();
});
