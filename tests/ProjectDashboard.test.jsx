import {expect, test} from '../e2e/network.mock';

test('opens the projects view with its empty state', async ({page}) => {
    await page.goto('/');
    await page.getByRole('navigation').getByText('Projects').click();
    await expect(page.getByText(/no projects|project/i).first()).toBeVisible();
});
