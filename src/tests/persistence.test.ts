import { beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { db, initialize } from "../database/db";
import {
  createWorkspace,
  saveClient,
  saveProject,
  saveEntry,
  deleteClient,
  deleteProject,
  deleteEntry,
  saveSettings,
  saveFilters,
  saveDraft,
} from "../services/records";
import { seed, client, project, entry } from "./fixtures";
import { defaultSettings } from "../database/schema";
import { storageInfo } from "../services/storage";
beforeEach(async () => {
  await db.delete();
  await initialize();
});
afterAll(async () => {
  await db.delete();
});
describe("local workspace persistence", () => {
  it("starts empty and recovers saved entities and settings after closing the database", async () => {
    expect(await db.workspace.count()).toBe(0);
    await seed();
    await saveSettings({ theme: "dark", lastRoute: "/projects" });
    await saveFilters({ projects: "Test", projectStatus: "all" });
    db.close();
    await initialize();
    expect((await db.workspace.get("local"))?.name).toBe("Test studio");
    expect(await db.clients.count()).toBe(1);
    expect(await db.projects.count()).toBe(1);
    expect(await db.settings.get("preferences")).toMatchObject({
      theme: "dark",
      lastRoute: "/projects",
      filters: { projects: "Test", projectStatus: "all" },
    });
  });
  it("prevents concurrent onboarding from overwriting a workspace", async () => {
    await seed();
    await expect(
      createWorkspace({
        id: "local",
        name: "Other",
        currency: "EUR",
        hourlyRateMinor: null,
        createdAt: 1000,
      }),
    ).rejects.toThrow("already");
    expect((await db.workspace.get("local"))?.name).toBe("Test studio");
  });
  it("validates all records and preserves corrupted records for recovery", async () => {
    await seed();
    await db.clients.put({ ...client, email: "bad" });
    db.close();
    await expect(initialize()).rejects.toThrow();
    expect((await db.clients.get(client.id))?.email).toBe("bad");
  });
  it("rejects missing workspace metadata rather than onboarding over existing business records", async () => {
    await seed();
    await db.workspace.clear();
    await expect(initialize()).rejects.toThrow("identity is missing");
    expect(await db.clients.count()).toBe(1);
  });
  it("saves drafts, removes them after successful save, and prevents stale drafts", async () => {
    await seed();
    const draft = {
      id: `client:${client.id}`,
      version: 1 as const,
      kind: "client" as const,
      entityId: client.id,
      data: { name: "Unfinished" },
      updatedAt: 1000,
    };
    await saveDraft(draft);
    db.close();
    await initialize();
    expect((await db.drafts.get(draft.id))?.data.name).toBe("Unfinished");
    await saveClient({ ...client, name: "Updated" }, draft.id);
    expect(await db.drafts.count()).toBe(0);
    await expect(
      saveDraft({ ...draft, entityId: crypto.randomUUID() }),
    ).rejects.toThrow("no longer exists");
  });
  it("does not cascade-delete historical work", async () => {
    await seed();
    await saveEntry(entry(), "entry:new");
    await expect(deleteClient(client.id)).rejects.toThrow("Reassign");
    await expect(deleteProject(project.id)).rejects.toThrow("Archive");
    await saveProject({ ...project, status: "archived" }, "project:edit");
    expect(await db.timeEntries.count()).toBe(1);
  });
  it("supports editing and deleting unused records, with their drafts", async () => {
    await seed();
    await saveDraft({
      id: "project:edit",
      kind: "project",
      version: 1,
      entityId: project.id,
      data: {},
      updatedAt: 1000,
    });
    await deleteProject(project.id);
    expect(await db.drafts.count()).toBe(0);
    await deleteClient(client.id);
    expect(await db.clients.count()).toBe(0);
  });
  it("captures manual-entry rates and protects invoiced entries", async () => {
    await seed();
    const e = entry();
    await saveEntry(e, "entry:new");
    await saveProject({ ...project, hourlyRateMinor: 9999 }, "project:edit");
    await saveEntry({ ...e, description: "Edit", rateMinor: 1 }, "entry:edit");
    expect((await db.timeEntries.get(e.id))?.rateMinor).toBe(6000);
    await db.timeEntries.update(e.id, { invoiceId: crypto.randomUUID() });
    await expect(deleteEntry(e.id)).rejects.toThrow("Invoiced");
    await expect(saveEntry(e, "entry:edit")).rejects.toThrow("Invoiced");
  });
  it("rejects missing client references and rolls back quota-failed saves", async () => {
    await seed();
    await expect(
      saveProject({ ...project, clientId: crypto.randomUUID() }, "project:new"),
    ).rejects.toThrow("no longer");
    const spy = vi
      .spyOn(db.clients, "put")
      .mockRejectedValueOnce(new DOMException("Full", "QuotaExceededError"));
    await expect(
      saveClient({ ...client, name: "Unsaved" }, "client:new"),
    ).rejects.toThrow("Full");
    spy.mockRestore();
    expect((await db.clients.get(client.id))?.name).toBe("Test client");
  });
  it("reports unavailable storage estimates without inventing numbers", async () => {
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: {
        estimate: () => Promise.reject(new Error("Unavailable")),
        persisted: () => Promise.resolve(false),
      },
    });
    expect(await storageInfo()).toMatchObject({
      usage: null,
      quota: null,
      persistent: false,
    });
    expect((await storageInfo()).message).toContain("could not");
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: undefined,
    });
    expect((await storageInfo()).message).toContain("unavailable");
  });
  it("persists the initial settings schema without mock production records", () => {
    expect(defaultSettings().selectedProjectId).toBeNull();
  });
});
