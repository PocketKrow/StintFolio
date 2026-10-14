import { z } from "zod";
import { db, write } from "../database/db";
import {
  workspaceSchema,
  clientSchema,
  projectSchema,
  entrySchema,
  timerSchema,
  settingsSchema,
  draftSchema,
  metadataSchema,
  defaultSettings,
} from "../database/schema";
export const backupSchema = z
  .object({
    format: z.literal("StintFolio"),
    formatVersion: z.literal(1),
    schemaVersion: z.literal(1),
    exportedAt: z.number().int().nonnegative(),
    workspace: workspaceSchema,
    clients: z.array(clientSchema).max(20000),
    projects: z.array(projectSchema).max(20000),
    timeEntries: z.array(entrySchema).max(50000),
    activeTimer: timerSchema.nullable(),
    settings: settingsSchema,
    drafts: z.array(draftSchema).max(1000),
    metadata: metadataSchema,
  })
  .strict();
export type Backup = z.infer<typeof backupSchema>;
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
export function validateBackup(value: unknown): Backup {
  const backup = backupSchema.parse(value);
  for (const collection of [
    backup.clients,
    backup.projects,
    backup.timeEntries,
    backup.drafts,
  ])
    if (new Set(collection.map((r) => r.id)).size !== collection.length)
      throw new Error("Backup has duplicate record IDs.");
  const clients = new Set(backup.clients.map((c) => c.id)),
    projects = new Set(backup.projects.map((p) => p.id));
  if (
    backup.projects.some((p) => p.clientId && !clients.has(p.clientId)) ||
    backup.timeEntries.some((e) => !projects.has(e.projectId)) ||
    (backup.activeTimer && !projects.has(backup.activeTimer.projectId))
  )
    throw new Error("Backup has missing client or project relationships.");
  for (const draft of backup.drafts) {
    const collection =
      draft.kind === "client"
        ? backup.clients
        : draft.kind === "project"
          ? backup.projects
          : backup.timeEntries;
    if (draft.entityId && !collection.some((r) => r.id === draft.entityId))
      throw new Error("Backup contains a draft for a missing record.");
  }
  return backup;
}
export async function snapshot(): Promise<Backup> {
  return db.transaction("r", db.tables, async () => {
    const workspace = await db.workspace.get("local");
    if (!workspace) throw new Error("Create a workspace before exporting.");
    return validateBackup({
      format: "StintFolio",
      formatVersion: 1,
      schemaVersion: db.verno,
      exportedAt: Date.now(),
      workspace,
      clients: await db.clients.toArray(),
      projects: await db.projects.toArray(),
      timeEntries: await db.timeEntries.toArray(),
      activeTimer: (await db.activeTimer.get("current")) ?? null,
      settings: (await db.settings.get("preferences")) ?? defaultSettings(),
      drafts: await db.drafts.toArray(),
      metadata: (await db.metadata.get("local")) ?? {
        id: "local",
        lastWriteAt: null,
        lastBackupAt: null,
      },
    });
  });
}
export async function restoreBackup(input: unknown) {
  const backup = validateBackup(input);
  await write(
    db.tables,
    async () => {
      for (const table of db.tables) await table.clear();
      await db.workspace.put(backup.workspace);
      await db.clients.bulkAdd(backup.clients);
      await db.projects.bulkAdd(backup.projects);
      await db.timeEntries.bulkAdd(backup.timeEntries);
      if (backup.activeTimer)
        await db.activeTimer.add({
          ...backup.activeTimer,
          revision: crypto.randomUUID(),
        });
      await db.settings.put(backup.settings);
      await db.drafts.bulkAdd(backup.drafts);
      await db.metadata.put(backup.metadata);
    },
    false,
  );
}
export async function clearWorkspace() {
  await db.transaction("rw", db.tables, async () => {
    for (const table of db.tables) await table.clear();
  });
}
const envelopeSchema = z
  .object({
    format: z.literal("StintFolioEncrypted"),
    formatVersion: z.literal(1),
    cipher: z.literal("AES-GCM"),
    kdf: z.literal("PBKDF2-SHA256"),
    iterations: z.literal(600000),
    salt: z.string().max(64),
    nonce: z.string().max(64),
    ciphertext: z.string().max(14 * 1024 * 1024),
  })
  .strict();
function base64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192)
    s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s);
}
function unbase64(s: string): Uint8Array<ArrayBuffer> {
  const binary = atob(s);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
const aad = new TextEncoder().encode(
  "StintFolioEncrypted:1:AES-GCM:PBKDF2-SHA256:600000",
);
async function key(passphrase: string, salt: Uint8Array<ArrayBuffer>) {
  if (!crypto.subtle)
    throw new Error(
      "Encrypted backups require HTTPS or localhost and browser Web Crypto support.",
    );
  if (passphrase.length > 1024) throw new Error("Passphrase is too long.");
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 600000 },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function encodeBackup(backup: Backup, passphrase?: string) {
  const plain = JSON.stringify(validateBackup(backup), null, 2);
  if (new TextEncoder().encode(plain).byteLength > MAX_BACKUP_BYTES)
    throw new Error("Backup exceeds the supported 10 MiB limit.");
  if (passphrase === undefined) return plain;
  if (passphrase.length < 12)
    throw new Error("Use a passphrase with at least 12 characters.");
  const salt = crypto.getRandomValues(new Uint8Array(16)),
    nonce = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, additionalData: aad },
    await key(passphrase, salt),
    new TextEncoder().encode(plain),
  );
  const envelope = JSON.stringify({
    format: "StintFolioEncrypted",
    formatVersion: 1,
    cipher: "AES-GCM",
    kdf: "PBKDF2-SHA256",
    iterations: 600000,
    salt: base64(salt),
    nonce: base64(nonce),
    ciphertext: base64(new Uint8Array(encrypted)),
  });
  if (new TextEncoder().encode(envelope).byteLength > MAX_BACKUP_BYTES)
    throw new Error(
      "Encrypted backup exceeds the supported 10 MiB file limit.",
    );
  return envelope;
}
export async function decodeBackup(text: string, passphrase = "") {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES)
    throw new Error("Backup exceeds the supported 10 MiB file limit.");
  let value: unknown = JSON.parse(text);
  if (
    value &&
    typeof value === "object" &&
    "format" in value &&
    value.format === "StintFolioEncrypted"
  ) {
    const e = envelopeSchema.parse(value);
    const salt = unbase64(e.salt),
      nonce = unbase64(e.nonce),
      ciphertext = unbase64(e.ciphertext);
    if (salt.length !== 16 || nonce.length !== 12 || ciphertext.length < 16)
      throw new Error("Invalid encrypted backup.");
    try {
      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: nonce, additionalData: aad },
        await key(passphrase, salt),
        ciphertext,
      );
      value = JSON.parse(new TextDecoder().decode(decrypted));
    } catch {
      throw new Error(
        "Unable to decrypt. Check the passphrase and whether the file is intact.",
      );
    }
  }
  return validateBackup(value);
}
export async function markBackupDownloaded() {
  await write([db.metadata], async () => {
    const m = await db.metadata.get("local");
    await db.metadata.put({
      id: "local",
      lastWriteAt: m?.lastWriteAt ?? null,
      lastBackupAt: Date.now(),
    });
  });
}
