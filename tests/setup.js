import {expect, test} from '@playwright/test';

test('redirects unauthenticated visitor to the sign-in screen', async ({page}) => {
    await page.goto('/');
    await expect(page.getByText(/sign in|login with google/i).first()).toBeVisible();
});
