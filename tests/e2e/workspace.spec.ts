import { test, expect, chromium, type Page } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
async function onboard(page: Page) {
  await page.goto("/");
  await page.getByLabel("Workspace or business name").fill("Test studio");
  await page.getByLabel("Hourly rate").fill("50");
  await page.getByRole("button", { name: "Open my workspace" }).click();
  await expect(
    page.getByRole("heading", {
      name: "A little structure. More room to work.",
    }),
  ).toBeVisible();
}
async function navigate(page: Page, name: string) {
  if (await page.getByRole("button", { name: "Open menu" }).isVisible())
    await page.getByRole("button", { name: "Open menu" }).click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name, exact: true })
    .click();
}
async function clientAndProject(page: Page) {
  await navigate(page, "Clients");
  await page.getByRole("button", { name: "New client" }).click();
  await page.getByLabel("Client name").fill("North studio");
  await page.getByRole("button", { name: "Save client", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "North studio", exact: true }),
  ).toBeVisible();
  await navigate(page, "Projects");
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Project name").fill("Website refresh");
  await page
    .getByRole("combobox", { name: "Client", exact: true })
    .selectOption({ label: "North studio" });
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Website refresh", exact: true }),
  ).toBeVisible();
}
test("workspace, draft, timer, backup restore, themes, manual entries, and deep links", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await onboard(page);
  await clientAndProject(page);
  await navigate(page, "Clients");
  await page.getByRole("button", { name: "New client" }).click();
  await page.getByLabel("Client name").fill("Unfinished client");
  await expect(
    page.getByRole("status").filter({ hasText: "Draft saved in this browser" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "New client" }).click();
  await expect(page.getByLabel("Client name")).toHaveValue("Unfinished client");
  await page.getByRole("button", { name: "Discard draft" }).click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await navigate(page, "Timer");
  await page
    .getByRole("combobox", { name: "Project", exact: true })
    .selectOption({ label: "Website refresh" });
  await page.getByLabel("What are you working on?").fill("Build layout");
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(1200);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.getByRole("button", { name: "Stop & save" }).click();
  await navigate(page, "Timesheet");
  await expect(page.getByRole("table")).toContainText("Build layout");
  await page.getByRole("button", { name: "Manual entry" }).click();
  await page
    .getByRole("combobox", { name: "Project", exact: true })
    .selectOption({ label: "Website refresh" });
  await page.getByLabel("Description", { exact: true }).fill("Manual session");
  await page.getByRole("button", { name: "Save time entry" }).click();
  await expect(page.getByRole("table")).toContainText("Manual session");
  await navigate(page, "Preferences");
  await page.getByLabel("Theme").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.getByLabel("Theme")).toHaveValue("dark");
  await page.getByLabel("Theme").selectOption("light");
  await navigate(page, "Data & Storage");
  await expect(page.getByText("StintFolioDB", { exact: true })).toBeVisible();
  await expect(
    page.getByText("http://127.0.0.1:4173", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Backup passphrase", { exact: true })
    .fill("My safe test passphrase");
  await page.getByLabel("Repeat passphrase").fill("My safe test passphrase");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download backup" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  await page.getByLabel("Backup file").setInputFiles(path!);
  await page.getByLabel("Passphrase (encrypted files only)").fill("wrong");
  await page.getByRole("button", { name: "Read & validate backup" }).click();
  await expect(page.getByRole("alert")).toContainText("Unable to decrypt");
  await page
    .getByLabel("Passphrase (encrypted files only)")
    .fill("My safe test passphrase");
  await page.getByRole("button", { name: "Read & validate backup" }).click();
  await expect(page.getByText("Validated snapshot")).toBeVisible();
  await page
    .getByRole("button", { name: "Replace workspace with this backup" })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Confirm", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("textbox").fill("RESTORE");
  await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your data, explained." }),
  ).toBeVisible();
  await navigate(page, "Timesheet");
  await expect(page.getByRole("table")).toContainText("Manual session");
  await page.goto("/settings/data");
  await expect(
    page.getByRole("heading", { name: "Your data, explained." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear local workspace" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your data, explained." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("a persisted browser profile recovers an active session after a full browser restart", async () => {
  const directory = await mkdtemp(join(tmpdir(), "stintfolio-profile-"));
  let context = await chromium.launchPersistentContext(directory, {
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    args: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? ["--no-sandbox"]
      : [],
    baseURL: "http://127.0.0.1:4173",
  });
  try {
    let page = context.pages()[0]!;
    await onboard(page);
    await clientAndProject(page);
    await navigate(page, "Timer");
    await page
      .getByRole("combobox", { name: "Project", exact: true })
      .selectOption({ label: "Website refresh" });
    await page.getByRole("button", { name: "Start session" }).click();
    await expect(
      page.getByRole("button", { name: "Pause", exact: true }),
    ).toBeVisible();
    await context.close();
    context = await chromium.launchPersistentContext(directory, {
      headless: true,
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? ["--no-sandbox"]
        : [],
      baseURL: "http://127.0.0.1:4173",
    });
    page = context.pages()[0]!;
    await page.goto("http://127.0.0.1:4173/");
    await expect(page).toHaveURL(/\/timer$/);
    await expect(
      page.getByRole("button", { name: "Pause", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Website refresh", { exact: true }),
    ).toBeVisible();
  } finally {
    await context.close();
    await rm(directory, { recursive: true, force: true });
  }
});
test("two tabs share one timer and never duplicate a completed session", async ({
  page,
  context,
}) => {
  await onboard(page);
  await clientAndProject(page);
  await navigate(page, "Timer");
  await page
    .getByRole("combobox", { name: "Project", exact: true })
    .selectOption({ label: "Website refresh" });
  const second = await context.newPage();
  await second.goto("/timer");
  await expect(
    second.getByRole("combobox", { name: "Project", exact: true }),
  ).toHaveValue(
    await page
      .getByRole("combobox", { name: "Project", exact: true })
      .inputValue(),
  );
  await Promise.allSettled([
    page.evaluate(() =>
      [...document.querySelectorAll("button")]
        .find((b) => b.textContent?.includes("Start session"))
        ?.click(),
    ),
    second.evaluate(() =>
      [...document.querySelectorAll("button")]
        .find((b) => b.textContent?.includes("Start session"))
        ?.click(),
    ),
  ]);
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await expect(
    second.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Stop & save" })).toBeEnabled();
  await expect(
    second.getByRole("button", { name: "Stop & save" }),
  ).toBeEnabled();
  await Promise.allSettled([
    page.evaluate(() =>
      [...document.querySelectorAll("button")]
        .find((b) => b.textContent?.includes("Stop & save"))
        ?.click(),
    ),
    second.evaluate(() =>
      [...document.querySelectorAll("button")]
        .find((b) => b.textContent?.includes("Stop & save"))
        ?.click(),
    ),
  ]);
  await navigate(page, "Timesheet");
  await expect(page.locator("tbody tr")).toHaveCount(1);
});
test("cached shell boots offline and accepts local writes on uncached routes", async ({
  page,
  context,
}) => {
  await onboard(page);
  await clientAndProject(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.goto("/timesheet");
  await expect(
    page.getByRole("heading", { name: "Timesheet", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Manual entry" }).click();
  await page
    .getByRole("combobox", { name: "Project", exact: true })
    .selectOption({ label: "Website refresh" });
  await page.getByLabel("Description", { exact: true }).fill("Offline session");
  await page.getByRole("button", { name: "Save time entry" }).click();
  await expect(page.getByRole("table")).toContainText("Offline session");
  await page.reload();
  await expect(page.getByRole("table")).toContainText("Offline session");
  await context.setOffline(false);
});
test("mobile workspace has usable navigation, theme, and no page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await onboard(page);
  await clientAndProject(page);
  await navigate(page, "Data & Storage");
  await expect(
    page.getByRole("heading", { name: "Your data, explained." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await navigate(page, "Preferences");
  await page.getByLabel("Theme").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("failed writes remain visible and never report success", async ({
  page,
}) => {
  await onboard(page);
  await navigate(page, "Clients");
  await page.getByRole("button", { name: "New client" }).click();
  await page.getByLabel("Client name").fill("Must not be saved");
  await expect(
    page.getByRole("status").filter({ hasText: "Draft saved in this browser" }),
  ).toBeVisible();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (this.name === "clients")
        throw new DOMException("Disk full", "QuotaExceededError");
      return original.apply(this, args);
    };
  });
  await page.getByRole("button", { name: "Save client", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("storage is full");
  await expect(page.getByLabel("Client name")).toHaveValue("Must not be saved");
  await expect(
    page.getByText("Client saved in this browser.", { exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Must not be saved", exact: true }),
  ).toHaveCount(0);
});
test("unavailable IndexedDB produces an honest recovery screen", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      value: undefined,
      configurable: true,
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your data deserves a clean recovery." }),
  ).toBeVisible();
  await expect(page.getByLabel("Workspace or business name")).toHaveCount(0);
  await expect(
    page.getByText("No temporary workspace has been substituted.", {
      exact: false,
    }),
  ).toBeVisible();
});
test("keyboard focus and destructive confirmation protect a workspace", async ({
  page,
}) => {
  await onboard(page);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to workspace" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
  await navigate(page, "Data & Storage");
  const clear = page.getByRole("button", { name: "Clear local workspace" });
  await clear.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(clear).toBeFocused();
  await clear.click();
  await page.getByRole("dialog").getByRole("textbox").fill("CLEAR");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await expect(page.getByLabel("Workspace or business name")).toBeVisible();
});
