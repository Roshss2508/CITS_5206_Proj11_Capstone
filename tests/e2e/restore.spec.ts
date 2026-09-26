import { expect, test, type APIRequestContext } from "@playwright/test";

const EDITOR = { "x-demo-role": "EDITOR" };
const REVIEWER = { "x-demo-role": "REVIEWER" };

async function createCalculatedCase(request: APIRequestContext, platformName: string) {
  const created = await request.post("/api/v1/cases", {
    headers: EDITOR,
    data: { platformName, pricingPeriod: "2027-2029" },
  });
  expect(created.status()).toBe(201);

  const createdBody = await created.json();
  const caseId = createdBody.case.costingCase.id as string;
  const capabilityId = createdBody.case.capabilities[0].id as string;

  const requests = [
    request.put(`/api/v1/cases/${caseId}/costs`, {
      headers: EDITOR,
      data: { costs: [{ capabilityId, category: "STAFFING", scope: "CAPABILITY", label: "Staffing", amount: "10000", justification: "Restore workflow test." }] },
    }),
    request.put(`/api/v1/cases/${caseId}/income`, {
      headers: EDITOR,
      data: { income: [] },
    }),
    request.put(`/api/v1/cases/${caseId}/capacity`, {
      headers: EDITOR,
      data: { capacity: [{ capabilityId, maximumCapacity: "1000", forecastUtilisationPct: "50", historicYear1: null, historicYear2: null, historicYear3: null, justification: "Restore workflow test." }] },
    }),
    request.put(`/api/v1/cases/${caseId}/proposed-rates`, {
      headers: EDITOR,
      data: { proposedRates: [{ capabilityId, uwaRate: null, apfrRate: null, commercialRate: null, uwaSharePct: "60", apfrSharePct: "25", commercialSharePct: "15", justification: "Restore workflow test." }] },
    }),
  ];

  for (const response of await Promise.all(requests)) expect(response.status()).toBe(200);

  const calculated = await request.post(`/api/v1/cases/${caseId}/calculate`, { headers: EDITOR });
  expect(calculated.status()).toBe(201);
  const calculatedBody = await calculated.json();

  return { caseId, snapshotId: calculatedBody.snapshot.id as string };
}

test("an editor can restore an archived case without losing its snapshot", async ({ page, request }) => {
  const caseName = `QA Restore Case ${Date.now()}`;
  const { caseId, snapshotId } = await createCalculatedCase(request, caseName);

  const archived = await request.post(`/api/v1/cases/${caseId}/status`, {
    headers: EDITOR,
    data: { status: "ARCHIVED", comment: "Archived for restore testing." },
  });
  expect(archived.status()).toBe(200);

  const reviewerAttempt = await request.post(`/api/v1/cases/${caseId}/status`, {
    headers: REVIEWER,
    data: { status: "DRAFT", comment: "Reviewer restore attempt." },
  });
  expect(reviewerAttempt.status()).toBe(403);

  await page.goto("/");
  const caseCard = page.locator(".case-card").filter({ hasText: caseName });
  await expect(caseCard).toContainText("Archived");

  const restoredResponse = page.waitForResponse((response) =>
    response.url().includes(`/api/v1/cases/${caseId}/status`) && response.request().method() === "POST",
  );
  await caseCard.getByRole("button", { name: "Restore case" }).click();
  expect((await restoredResponse).status()).toBe(200);
  await expect(caseCard).toContainText("Draft");

  const restored = await request.get(`/api/v1/cases/${caseId}`);
  expect(restored.status()).toBe(200);
  const restoredBody = await restored.json();
  expect(restoredBody.case.costingCase.status).toBe("DRAFT");
  expect(restoredBody.case.snapshots.map((snapshot: { id: string }) => snapshot.id)).toContain(snapshotId);
  expect(restoredBody.case.auditEvents[0]).toMatchObject({
    action: "STATUS_CHANGED",
    fromStatus: "ARCHIVED",
    toStatus: "DRAFT",
    details: "Restored from the case dashboard.",
  });

  await request.post(`/api/v1/cases/${caseId}/status`, {
    headers: EDITOR,
    data: { status: "ARCHIVED", comment: "Archived by automated E2E teardown." },
  });
});

test("the restore button prevents duplicate requests while restoration is in progress", async ({ page, request }) => {
  const caseName = `QA Restore Guard ${Date.now()}`;
  const { caseId } = await createCalculatedCase(request, caseName);

  const archived = await request.post(`/api/v1/cases/${caseId}/status`, {
    headers: EDITOR,
    data: { status: "ARCHIVED", comment: "Archived for duplicate restore testing." },
  });
  expect(archived.status()).toBe(200);

  let restoreRequests = 0;
  await page.route(`**/api/v1/cases/${caseId}/status`, async (route) => {
    const payload = route.request().postDataJSON() as { status?: string };
    if (route.request().method() === "POST" && payload.status === "DRAFT") {
      restoreRequests += 1;
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    await route.continue();
  });

  await page.goto("/");
  const caseCard = page.locator(".case-card").filter({ hasText: caseName });
  const restoreButton = caseCard.getByRole("button", { name: "Restore case" });
  await expect(restoreButton).toBeVisible();

  const restoredResponse = page.waitForResponse((response) =>
    response.url().includes(`/api/v1/cases/${caseId}/status`) && response.request().method() === "POST",
  );

  await restoreButton.evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });

  const restoringButton = caseCard.getByRole("button", { name: "Restoring case" });
  await expect(restoringButton).toBeDisabled();
  await expect(restoringButton.locator(".spin")).toBeVisible();

  expect((await restoredResponse).status()).toBe(200);
  await expect(caseCard).toContainText("Draft");
  expect(restoreRequests).toBe(1);

  await request.post(`/api/v1/cases/${caseId}/status`, {
    headers: EDITOR,
    data: { status: "ARCHIVED", comment: "Archived by automated E2E teardown." },
  });
});
