import Dexie, { type Table } from "dexie";
import {
  workspaceSchema,
  clientSchema,
  projectSchema,
  entrySchema,
  timerSchema,
  settingsSchema,
  draftSchema,
  metadataSchema,
  type Workspace,
  type Client,
  type Project,
  type TimeEntry,
  type ActiveTimer,
  type Settings,
  type Draft,
  type Metadata,
} from "./schema";
export class StintDatabase extends Dexie {
  workspace!: Table<Workspace, string>;
  clients!: Table<Client, string>;
  projects!: Table<Project, string>;
  timeEntries!: Table<TimeEntry, string>;
  activeTimer!: Table<ActiveTimer, string>;
  settings!: Table<Settings, string>;
  drafts!: Table<Draft, string>;
  metadata!: Table<Metadata, string>;
  constructor(name = "StintFolioDB") {
    super(name);
    this.version(1).stores({
      workspace: "id",
      clients: "id,name",
      projects: "id,clientId,status,name",
      timeEntries: "id,projectId,startedAt,invoiceId",
      activeTimer: "id",
      settings: "id",
      drafts: "id,kind,entityId",
      metadata: "id",
    });
    // Append versions and transactional upgrade callbacks here; never edit an existing schema.
    this.on("blocked", () =>
      window.dispatchEvent(new Event("stintfolio:blocked")),
    );
  }
}
export const db = new StintDatabase();
export async function initialize() {
  await db.open();
  await db.transaction("rw", db.metadata, async () => {
    const m = await db.metadata.get("local");
    await db.metadata.put(
      m ?? { id: "local", lastWriteAt: null, lastBackupAt: null },
    );
  });
  const tables = [
    db.workspace,
    db.clients,
    db.projects,
    db.timeEntries,
    db.activeTimer,
    db.settings,
    db.drafts,
    db.metadata,
  ];
  const schemas = [
    workspaceSchema,
    clientSchema,
    projectSchema,
    entrySchema,
    timerSchema,
    settingsSchema,
    draftSchema,
    metadataSchema,
  ];
  await db.transaction("r", tables, async () => {
    for (let i = 0; i < tables.length; i++)
      for (const record of await tables[i]!.toArray())
        schemas[i]!.parse(record);
    if ((await db.workspace.count()) > 1 || (await db.activeTimer.count()) > 1)
      throw new Error("Invalid workspace singleton records.");
    if (
      !(await db.workspace.count()) &&
      ((await db.clients.count()) ||
        (await db.projects.count()) ||
        (await db.timeEntries.count()) ||
        (await db.activeTimer.count()))
    )
      throw new Error(
        "Workspace identity is missing. Existing business records have been preserved. Restore a valid backup to recover.",
      );
    const projects = await db.projects.toArray(),
      clients = new Set((await db.clients.toArray()).map((c) => c.id));
    const projectIds = new Set(projects.map((p) => p.id));
    if (
      projects.some((p) => p.clientId && !clients.has(p.clientId)) ||
      (await db.timeEntries.toArray()).some(
        (e) => !projectIds.has(e.projectId),
      ) ||
      (await db.activeTimer.toArray()).some((t) => !projectIds.has(t.projectId))
    )
      throw new Error(
        "Workspace contains missing record relationships. Restore a valid backup; existing records have been preserved.",
      );
  });
}
export async function write<T>(
  tables: Table[],
  operation: () => Promise<T>,
  requireWorkspace = true,
): Promise<T> {
  return db.transaction(
    "rw",
    [...tables, db.metadata, db.workspace],
    async () => {
      if (requireWorkspace && !(await db.workspace.get("local")))
        throw new Error(
          "The workspace was cleared in another tab. Reload before saving more work.",
        );
      const result = await operation();
      const previous = await db.metadata.get("local");
      await db.metadata.put({
        id: "local",
        lastWriteAt: Date.now(),
        lastBackupAt: previous?.lastBackupAt ?? null,
      });
      return result;
    },
  );
}
