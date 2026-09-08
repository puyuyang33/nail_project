import { expect, test } from "@playwright/test";

test("guest checkout reaches Stripe in configured test mode", async ({
  page,
}) => {
  test.skip(
    !process.env.DATABASE_URL || !process.env.STRIPE_SECRET_KEY,
    "Requires migrated PostgreSQL and Stripe test credentials",
  );
  await page.goto("/en/shop");
  const firstProduct = page.locator("article").first();
  await firstProduct.hover();
  await firstProduct.getByRole("button", { name: "Add to bag" }).click();
  await page.goto("/en/checkout");
  await page.getByLabel("Full name").fill("Playwright Guest");
  await page.getByLabel("Email address").fill("guest@example.test");
  await page.getByLabel("Street address").fill("1847 W Armitage Ave");
  await page.getByLabel("City").fill("Chicago");
  await page.getByLabel("State / region").fill("IL");
  await page.getByLabel("Postal code").fill("60622");
  await page.getByRole("button", { name: "Pay securely" }).click();
  await expect(page).toHaveURL(/checkout\.stripe\.com/);
});

test("administrator can sign in when seeded credentials are supplied", async ({
  page,
}) => {
  test.skip(
    !process.env.SEED_ADMIN_EMAIL ||
      !process.env.SEED_ADMIN_PASSWORD ||
      process.env.AUTH_CREDENTIALS_ENABLED !== "true",
    "Requires seeded administrator credentials",
  );
  await page.goto("/en/login");
  await page.getByLabel("Email address").fill(process.env.SEED_ADMIN_EMAIL!);
  await page.getByLabel("Password").fill(process.env.SEED_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto("/en/admin");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});
