import { test, expect } from "@playwright/test";
const columns = [
  "period",
  "residence",
  "hospital_city",
  "hospital",
  "sex",
  "age",
  "cid",
  "n",
  "deaths",
  "death_n",
  "days",
  "days_n",
  "cents",
  "value_n",
  "age_sum",
  "age_n",
];
// Fixtures apenas na interceptação do teste, jamais em public/data.
const rows = [
  [
    "2025-01",
    "330455",
    "330330",
    "0012345",
    "Feminino",
    "60–69",
    "I639",
    10,
    2,
    10,
    80,
    10,
    120015,
    10,
    650,
    10,
  ],
  [
    "2025-02",
    "330170",
    "330330",
    "0098765",
    "Masculino",
    "70–79",
    "I629",
    4,
    2,
    4,
    40,
    4,
    80000,
    4,
    300,
    4,
  ],
];
test("Shared filters update indicators, charts and hospitals without overflow", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/data/manifest.json", async (route) => {
    const response = await route.fetch();
    const manifest = await response.json();
    await route.fulfill({
      json: {
        ...manifest,
        status: "partial",
        coverage: ["2025-01", "2025-02"],
        failures: [],
        files: [{ year: 2025, file: "test-cube.json" }],
      },
    });
  });
  await page.route("**/data/test-cube.json", (route) =>
    route.fulfill({ json: { columns, rows } }),
  );
  await page.goto("/");
  await expect(page.locator(".kpi").first()).toContainText("14");
  await expect(page.locator(".map-chart svg")).toBeVisible();
  await page
    .getByRole("combobox", { name: "Sexo", exact: true })
    .selectOption("Feminino");
  await expect(page.locator(".kpi").first()).toContainText("10");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page
    .getByRole("combobox", { name: "Município", exact: true })
    .selectOption("330170");
  await expect(page.locator(".kpi").first()).toContainText("0");
  await expect(
    page.getByText("Nenhuma internação disponível para este recorte.").first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Remover filtro Município: Duque de Caxias" })
    .click();
  await expect(page.locator(".kpi").first()).toContainText("10");
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(page.locator(".kpi").first()).toContainText("14");
  await page.getByRole("button", { name: "Anual", exact: true }).click();
  await page.getByRole("button", { name: "Mortalidade", exact: true }).click();
  await expect(page.locator(".timeline svg")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("Methodology page reports audited coverage and links back", async ({
  page,
}) => {
  await page.goto("/#/metodologia");
  await expect(
    page.getByRole("heading", { name: "Seleção do recorte" }),
  ).toBeVisible();
  await expect(page.locator(".method-table tbody tr").first()).toBeVisible();
  await page.getByRole("link", { name: "Painel", exact: true }).click();
  await expect(page.locator(".kpi").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("Empty data is explicit and failed requests can be retried", async ({
  page,
}) => {
  await page.route("**/data/manifest.json", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível carregar os dados",
  );
  await page.unroute("**/data/manifest.json");
  await page.route("**/data/manifest.json", async (route) => {
    const response = await route.fetch();
    const manifest = await response.json();
    await route.fulfill({
      json: {
        ...manifest,
        status: "unavailable",
        coverage: [],
        files: [],
        failures: [],
      },
    });
  });
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(
    page.getByText("Dados de internação ainda não disponíveis", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".kpi").first()).toContainText("—");
});
