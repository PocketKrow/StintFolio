import { db, write } from "../database/db";
import {
  workspaceSchema,
  clientSchema,
  projectSchema,
  entrySchema,
  defaultSettings,
  settingsSchema,
  draftSchema,
  type Workspace,
  type Client,
  type Project,
  type TimeEntry,
  type Settings,
  type Draft,
} from "../database/schema";
export async function createWorkspace(input: Workspace) {
  const workspace = workspaceSchema.parse(input);
  return write(
    [db.workspace, db.settings],
    async () => {
      if (await db.workspace.count())
        throw new Error(
          "This workspace was already created in another tab. Reload to recover it.",
        );
      await db.workspace.add(workspace);
      await db.settings.put(defaultSettings());
    },
    false,
  );
}
export async function saveWorkspace(input: Workspace) {
  const record = workspaceSchema.parse(input);
  return write([db.workspace], async () => {
    await db.workspace.put(record);
  });
}
export async function saveSettings(patch: Partial<Omit<Settings, "id">>) {
  return write([db.settings], async () => {
    const current = (await db.settings.get("preferences")) ?? defaultSettings();
    await db.settings.put(settingsSchema.parse({ ...current, ...patch }));
  });
}
export async function saveFilters(patch: Partial<Settings["filters"]>) {
  return write([db.settings], async () => {
    const current = (await db.settings.get("preferences")) ?? defaultSettings();
    await db.settings.put(
      settingsSchema.parse({
        ...current,
        filters: { ...current.filters, ...patch },
      }),
    );
  });
}
export async function saveClient(input: Client, draftId: string) {
  const record = clientSchema.parse(input);
  return write([db.clients, db.drafts], async () => {
    await db.clients.put(record);
    await db.drafts.delete(draftId);
  });
}
export async function deleteClient(id: string) {
  return write([db.clients, db.projects, db.drafts], async () => {
    if (await db.projects.where("clientId").equals(id).count())
      throw new Error(
        "Reassign this client’s projects before deleting the client.",
      );
    await db.clients.delete(id);
    await db.drafts.where("entityId").equals(id).delete();
  });
}
export async function saveProject(input: Project, draftId: string) {
  const record = projectSchema.parse(input);
  return write(
    [db.projects, db.clients, db.drafts, db.activeTimer],
    async () => {
      if (record.clientId && !(await db.clients.get(record.clientId)))
        throw new Error("That client no longer exists.");
      const timer = await db.activeTimer.get("current");
      if (record.status === "archived" && timer?.projectId === record.id)
        throw new Error(
          "Stop the active session before archiving its project.",
        );
      await db.projects.put(record);
      await db.drafts.delete(draftId);
    },
  );
}
export async function deleteProject(id: string) {
  return write(
    [db.projects, db.timeEntries, db.activeTimer, db.drafts],
    async () => {
      if (
        (await db.timeEntries.where("projectId").equals(id).count()) ||
        (await db.activeTimer.get("current"))?.projectId === id
      )
        throw new Error(
          "This project has tracked work. Archive it to preserve history.",
        );
      await db.projects.delete(id);
      await db.drafts.where("entityId").equals(id).delete();
    },
  );
}
export async function resolveRate(project: Project) {
  const client = project.clientId
    ? await db.clients.get(project.clientId)
    : undefined;
  const workspace = await db.workspace.get("local");
  if (project.billing === "fixed") return null;
  return (
    project.hourlyRateMinor ??
    (client?.currency === project.currency ? client.hourlyRateMinor : null) ??
    (workspace?.currency === project.currency
      ? workspace.hourlyRateMinor
      : null)
  );
}
export async function saveEntry(input: TimeEntry, draftId: string) {
  const record = entrySchema.parse(input);
  return write(
    [db.timeEntries, db.projects, db.clients, db.workspace, db.drafts],
    async () => {
      const project = await db.projects.get(record.projectId);
      if (!project) throw new Error("That project no longer exists.");
      const existing = await db.timeEntries.get(record.id);
      if (existing?.invoiceId)
        throw new Error("Invoiced entries cannot be edited.");
      const final = existing
        ? {
            ...record,
            rateMinor: existing.rateMinor,
            currency: existing.currency,
            invoiceId: existing.invoiceId,
          }
        : {
            ...record,
            currency: project.currency,
            rateMinor: await resolveRate(project),
          };
      await db.timeEntries.put(entrySchema.parse(final));
      await db.drafts.delete(draftId);
    },
  );
}
export async function deleteEntry(id: string) {
  return write([db.timeEntries, db.drafts], async () => {
    if ((await db.timeEntries.get(id))?.invoiceId)
      throw new Error("Invoiced entries cannot be deleted.");
    await db.timeEntries.delete(id);
    await db.drafts.where("entityId").equals(id).delete();
  });
}
export async function saveDraft(input: Draft) {
  const record = draftSchema.parse(input);
  return write(
    [db.drafts, db.clients, db.projects, db.timeEntries],
    async () => {
      const table =
        record.kind === "client"
          ? db.clients
          : record.kind === "project"
            ? db.projects
            : db.timeEntries;
      if (record.entityId && !(await table.get(record.entityId)))
        throw new Error("The edited record no longer exists.");
      await db.drafts.put(record);
    },
  );
}
export async function discardDraft(id: string) {
  return write([db.drafts], async () => {
    await db.drafts.delete(id);
  });
}
