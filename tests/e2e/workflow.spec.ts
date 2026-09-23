import { expect, test, type Page } from "@playwright/test";
 
const SUMMARY_LABELS = [
  "Gross user revenue",
  "University overhead",
  "Net platform recovery",
  "Operating balance",
] as const;
 
type SummaryLabel = (typeof SUMMARY_LABELS)[number];
 
/** Scoped to .financial-summary so warning text can't cause a strict-mode violation. */
function summaryValue(page: Page, label: SummaryLabel) {
  return page
    .locator(".financial-summary > div")
    .filter({ hasText: label })
    .locator("strong");
}
 
async function readSummary(page: Page) {
  const values = {} as Record<SummaryLabel, string>;
  for (const label of SUMMARY_LABELS) {
    values[label] = (await summaryValue(page, label).innerText()).trim();
  }
  return values;
}
 
/** "$1,234.56" -> 1234.56 */
const toNumber = (text: string) => Number(text.replace(/[^0-9.-]/g, ""));
 
async function saveAndContinue(page: Page, nextHeading: RegExp) {
  await page.getByRole("button", { name: /Save & continue/i }).click();

  await expect(
    page.getByRole("heading", { name: nextHeading }),
  ).toBeVisible();

  await expect(page.getByText("All changes saved")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
}

async function costRow(page: Page, label: string) {
  const rows = page.locator(".line-table:not(.income) .line-row");

  for (let i = 0; i < await rows.count(); i++) {
    const row = rows.nth(i);
    const labelInput = row.getByLabel("Cost label");

    if ((await labelInput.inputValue()) === label) {
      return row;
    }
  }

  throw new Error(`Cost row not found: ${label}`);
}
 
test.describe("Issue #6 – core costing workflow", () => {
  let caseId = "";
 
  test.afterEach(async ({ request }) => {
    if (!caseId) return;
    // Keep the local D1 dashboard from filling up with test cases.
    await request.post(`/api/v1/cases/${caseId}/status`, {
      headers: { "x-demo-role": "EDITOR" },
      data: { status: "ARCHIVED", comment: "Archived by automated E2E teardown." },
    });
    caseId = "";
  });
 
  test("editor completes Steps 1–5 and the snapshot survives a reload", async ({ page }) => {
    test.setTimeout(120_000);
    const caseName = `QA Automated Case ${Date.now()}`;
 
    await test.step("create the case", async () => {
      const casesResponsePromise = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/api/v1/cases" &&
          response.request().method() === "GET",
      );

      await page.goto("/");

      const casesResponse = await casesResponsePromise;
      expect(casesResponse.status()).toBe(200);

      await page.getByRole("button", { name: /New costing case/i }).click();

      await expect(
        page.getByRole("heading", { name: /Start with the pricing context/i }),
      ).toBeVisible();
 
      await page.getByLabel("Platform name").fill(caseName);
      await page.getByLabel("Pricing period").fill("2027–2029");
 
      const [created] = await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().includes("/api/v1/cases") &&
            response.request().method() === "POST",
        ),
        page.getByRole("button", { name: /Create case/i }).click(),
      ]);
      expect(created.status()).toBe(201);
 
      await expect(page).toHaveURL(/\/cases\/[^/]+$/);
      caseId = new URL(page.url()).pathname.split("/").pop()!;
 
      // Proves we opened the case we just made, not a leftover one.
      await expect(page.getByRole("heading", { name: caseName, level: 1 })).toBeVisible();
    });
 
    await test.step("Step 1 – platform & capabilities", async () => {
      await expect(
        page.getByRole("heading", {
          name: /Define the platform and its billable capabilities/i,
        }),
      ).toBeVisible();
 
      await page.getByLabel("Capability name").fill("QA Imaging Service");
      await page.getByLabel("Billable unit").selectOption("DAY");
 
      await saveAndContinue(
        page,
        /Capture full operating costs and recurrent support/i,
      );
    });
 
    await test.step("Step 2 – costs & income", async () => {
      await expect(
        page.getByRole("heading", {
          name: /Capture full operating costs and recurrent support/i,
        }),
      ).toBeVisible();
 
      const staffingRow = await costRow(page, "Platform staffing");

      await staffingRow.getByLabel("Annual amount").fill("60000");

      await saveAndContinue(
        page,
        /Set realistic capacity and forecast utilisation/i,
      );

      await expect(
        page.getByRole("heading", {
          name: /Set realistic capacity and forecast utilisation/i,
        }),
      ).toBeVisible();
    });
 
    await test.step("Back navigation retains entered data", async () => {
      await page.getByRole("button", { name: /^Back$/ }).click();

      await expect(
        page.getByRole("heading", {
          name: /Capture full operating costs and recurrent support/i,
        }),
      ).toBeVisible();

      const staffingRow = await costRow(page, "Platform staffing");

      await expect(
        staffingRow.getByLabel("Annual amount"),
      ).toHaveValue("60000");

      await saveAndContinue(
        page,
        /Set realistic capacity and forecast utilisation/i,
      );
    });
 
    await test.step("Step 3 – capacity & utilisation", async () => {
      await expect(
        page.getByRole("heading", {
          name: /Set realistic capacity and forecast utilisation/i,
        }),
      ).toBeVisible();
 
      await page.getByLabel("Maximum realistic capacity").fill("1000");
      await page.getByLabel("Forecast utilisation (%)").fill("50");
 
      // Derived value shown on the capacity card.
      await expect(page.getByText("Forecast units")).toBeVisible();
 
      await saveAndContinue(
        page,
        /Compare sustainable rates with a practical pricing scenario/i,
      );
    });
 
    let step4Summary: Record<SummaryLabel, string>;
 
    await test.step("Step 4 – calculate sustainable rates", async () => {
      await expect(
        page.getByRole("heading", {
          name: /Compare sustainable rates with a practical pricing scenario/i,
        }),
      ).toBeVisible();
 
      const [calculated] = await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().includes(`/cases/${caseId}/calculate`) &&
            response.request().method() === "POST",
        ),
        page
          .getByRole("button", { name: /Calculate sustainable rates/i })
          .click(),
      ]);

      expect(calculated.status()).toBe(201);

      await expect(page.locator(".financial-summary")).toBeVisible();
      await expect(page.getByRole("alert")).toHaveCount(0);

      step4Summary = await readSummary(page);
      for (const label of SUMMARY_LABELS) {
        expect(step4Summary[label], `${label} should render a currency value`).toMatch(/\$/);
      }
    });
 
    await test.step("Step 5 reflects the persisted snapshot after a reload", async () => {
      // The reload is the point: without it, Step 5 renders the same in-memory
      // `result` object as Step 4, so the comparison below cannot fail.
      await page.reload();

      await expect(
        page.getByRole("heading", {
          name: caseName,
          level: 1,
        }),
      ).toBeVisible();

      await expect(
        page.getByRole("heading", {
          name: /Review the evidence package/i,
        }),
      ).toBeVisible();
  
      for (const label of SUMMARY_LABELS) {
        await expect(summaryValue(page, label), `${label} mismatch between Step 4 and Step 5`)
          .toHaveText(step4Summary[label]);
      }
 
      await expect(page.getByRole("link", { name: /Download PDF/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /Export CSV/i })).toBeVisible();

      await test.step("PDF export returns a valid snapshot PDF", async () => {
        const pdfLink = page.getByRole("link", { name: /Download PDF/i });

        const href = await pdfLink.getAttribute("href");

        expect(href).toBeTruthy();

        const response = await page.request.get(href!);

        expect(response.status()).toBe(200);
        expect(response.headers()["content-type"]).toContain("application/pdf");

        const body = await response.body();

        expect(body.subarray(0, 5).toString()).toBe("%PDF-");
        expect(body.length).toBeGreaterThan(1000);
      });
    });
 
    await test.step("CSV export matches the calculated sustainable rate", async () => {
      const response = await page.request.get(`/api/v1/cases/${caseId}/export.csv`);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("text/csv");
 
      const rows = (await response.text()).trim().split("\r\n");
      expect(rows.length, "header row plus one row per capability").toBe(2);
      expect(rows[0]).toContain("Capability");
 
      const cells = rows[1].split(",").map((cell) => cell.replace(/^"|"$/g, ""));
      expect(cells[0]).toBe("QA Imaging Service");
      expect(cells[1]).toBe("DAY");
 
      // Step 4 shows the sustainable UWA rate as "Minimum $X" beside the rate input.
      await page.getByRole("button", { name: /Rates & scenarios/i }).click();
      const minimumUwa = await page.getByText(/^Minimum \$/).first().innerText();
      expect(Number(cells[4]).toFixed(2)).toBe(toNumber(minimumUwa).toFixed(2));
    });

    await test.step("Archive requires confirmation", async () => {
      await page.goto("/");

      const caseCard = page.locator(".case-card").filter({ hasText: caseName });

      await expect(caseCard).toBeVisible();

      // First verify cancelling does not archive the case.
      await caseCard.getByRole("button", { name: /Archive case/i }).click();

      await expect(
        page.getByRole("heading", { name: /Archive costing case/i }),
      ).toBeVisible();

      await page.getByRole("button", { name: /^Cancel$/ }).click();

      await expect(
        page.getByRole("heading", { name: /Archive costing case/i }),
      ).toHaveCount(0);

      await expect(caseCard.getByText("Draft")).toBeVisible();

      // Then confirm the archive action.
      await caseCard.getByRole("button", { name: /Archive case/i }).click();

      const archiveResponse = page.waitForResponse(
        (response) =>
          response.url().includes(`/cases/${caseId}/status`) &&
          response.request().method() === "POST",
      );

      await page
        .getByRole("dialog")
        .getByRole("button", { name: /Archive case/i })
        .click();

      expect((await archiveResponse).status()).toBe(200);

      await expect(caseCard.getByText("Archived")).toBeVisible();
    });
  });
});
