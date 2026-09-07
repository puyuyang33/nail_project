import { expect, test } from "@playwright/test";

test("browses the English storefront and preserves the page when switching language", async ({
  page,
}) => {
  await page.goto("/en");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Small works of art, made to move with you.",
    }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Explore the collection" })
    .first()
    .click();
  await expect(page).toHaveURL(/\/en\/shop/);
  if (
    !(await page.getByRole("button", { name: "切换到简体中文" }).isVisible())
  ) {
    await page.getByRole("button", { name: "Open menu" }).click();
  }
  await page.getByRole("button", { name: "切换到简体中文" }).click();
  await expect(page).toHaveURL(/\/zh\/shop/);
  await expect(
    page.getByRole("heading", { name: "全部美甲物件" }),
  ).toBeVisible();
});

test("searches products and persists a cart line between navigation", async ({
  page,
}) => {
  await page.goto("/en/shop");
  await page.getByLabel("Search products").fill("chrome");
  await page.getByLabel("Search products").press("Enter");
  await expect(page).toHaveURL(/q=chrome/);
  const firstProduct = page.locator("article").first();
  await firstProduct.getByRole("link").first().click();
  await page.getByRole("button", { name: "Add to bag" }).first().click();
  await page.locator('a[href="/en/cart"]').click();
  await expect(
    page.getByRole("heading", { name: "Your objects" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText("1 item")).toBeVisible();
});

test("shows guest booking fields and only selectable availability", async ({
  page,
}) => {
  await page.goto("/en/book");
  await expect(
    page.getByRole("heading", { name: "Reserve your ritual" }),
  ).toBeVisible();
  await expect(page.getByLabel("Service")).toBeVisible();
  await expect(page.getByLabel("Date")).toBeVisible();
  await expect(page.getByRole("radio")).not.toHaveCount(0);
  await expect(page.getByLabel("Your name")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Request appointment" }),
  ).toBeVisible();
});

test("search and product details remain keyboard reachable", async ({
  page,
}) => {
  await page.goto("/en/products/lunar-relic");
  await expect(
    page.getByRole("heading", { name: "Lunar Relic" }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open enlarged image" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add to bag" }).first(),
  ).toBeVisible();
});
