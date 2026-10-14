import { beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { db, initialize } from "../database/db";
import {
  snapshot,
  validateBackup,
  encodeBackup,
  decodeBackup,
  restoreBackup,
  clearWorkspace,
} from "../services/backup";
import { saveClient, saveEntry, saveDraft } from "../services/records";
import { startTimer } from "../services/timer";
import { seed, client, project, entry } from "./fixtures";
beforeEach(async () => {
  await db.delete();
  await initialize();
  await seed();
});
afterAll(async () => {
  await db.delete();
});
describe("data ownership", () => {
  it("round-trips all records and restores a clean database", async () => {
    await saveEntry(entry(), "entry:new");
    await startTimer(project.id, "Running", true);
    await saveDraft({
      id: "client:new",
      version: 1,
      kind: "client",
      entityId: null,
      data: { name: "Draft" },
      updatedAt: 1000,
    });
    const original = await snapshot();
    const encoded = await encodeBackup(original);
    const backup = await decodeBackup(encoded);
    expect(backup).toEqual(original);
    await clearWorkspace();
    await restoreBackup(backup);
    expect(await db.clients.count()).toBe(1);
    expect(await db.timeEntries.count()).toBe(1);
    expect(await db.drafts.count()).toBe(1);
    expect((await db.activeTimer.get("current"))?.revision).not.toBe(
      original.activeTimer?.revision,
    );
  });
  it("encrypts with random salt and nonce and restores with the correct passphrase", async () => {
    const backup = await snapshot();
    const a = await encodeBackup(backup, "my long test passphrase");
    const b = await encodeBackup(backup, "my long test passphrase");
    expect(a).not.toContain("Test studio");
    expect(JSON.parse(a).salt).not.toBe(JSON.parse(b).salt);
    expect(JSON.parse(a).nonce).not.toBe(JSON.parse(b).nonce);
    expect(await decodeBackup(a, "my long test passphrase")).toEqual(backup);
    await expect(decodeBackup(a, "wrong passphrase")).rejects.toThrow(
      "Unable to decrypt",
    );
    const corrupt = JSON.parse(a);
    corrupt.ciphertext = "A" + corrupt.ciphertext.slice(1);
    await expect(
      decodeBackup(JSON.stringify(corrupt), "my long test passphrase"),
    ).rejects.toThrow();
  });
  it("rejects corrupt, unsupported, duplicated, and relationship-invalid files", async () => {
    const backup = await snapshot();
    await expect(decodeBackup("oops")).rejects.toThrow();
    expect(() => validateBackup({ ...backup, formatVersion: 99 })).toThrow();
    expect(() =>
      validateBackup({ ...backup, clients: [client, client] }),
    ).toThrow("duplicate");
    expect(() => validateBackup({ ...backup, clients: [] })).toThrow(
      "relationships",
    );
    await expect(restoreBackup({ ...backup, clients: [] })).rejects.toThrow();
    expect(await db.projects.count()).toBe(1);
  });
  it("rolls back the entire replacement after an interrupted write", async () => {
    const backup = await snapshot();
    await saveClient({ ...client, name: "Current data" }, "client:edit");
    const spy = vi.spyOn(db.projects, "bulkAdd").mockImplementationOnce(() => {
      throw new Error("Interrupted import");
    });
    await expect(restoreBackup(backup)).rejects.toThrow("Interrupted");
    spy.mockRestore();
    expect((await db.clients.get(client.id))?.name).toBe("Current data");
    expect(await db.projects.count()).toBe(1);
    expect(await db.workspace.count()).toBe(1);
  });
  it("rejects short export passphrases and oversized files before mutation", async () => {
    await expect(encodeBackup(await snapshot(), "short")).rejects.toThrow(
      "12 characters",
    );
    await expect(
      decodeBackup(" ".repeat(10 * 1024 * 1024 + 1)),
    ).rejects.toThrow("limit");
    expect(await db.clients.count()).toBe(1);
  });
  it("clears all stores only when called as an explicit destructive operation", async () => {
    await clearWorkspace();
    for (const table of db.tables) expect(await table.count()).toBe(0);
  });
});
