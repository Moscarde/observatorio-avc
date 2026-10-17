import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

let output: string;
test.beforeAll(() => {
  const root = resolve(process.cwd(), "..");
  output = mkdtempSync(join(tmpdir(), "avc-report-browser-"));
  const local = join(root, ".venv/bin/python");
  const python = process.env.PYTHON ?? (existsSync(local) ? local : "python3");
  execFileSync(python, ["-m", "etl.analytics", "--output", output], {
    cwd: root,
    timeout: 60000,
  });
});
test.afterAll(() => rmSync(output, { recursive: true, force: true }));

test("Relatório funciona sem rede e sem transbordamento", async ({ page }) => {
  const errors: string[] = [];
  const remote: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/^https?:/, (route) => {
    remote.push(route.request().url());
    return route.abort();
  });
  await page.goto(pathToFileURL(join(output, "index.html")).href);
  await expect(
    page.getByRole("heading", {
      name: "Internações por AVC no Rio de Janeiro",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".metric").first()).toContainText("112.150");
  await expect(
    page.getByRole("img", { name: "Internações por ano" }),
  ).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(4);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  expect(remote).toEqual([]);
});
