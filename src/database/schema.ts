import { z } from "zod";
export const currencies = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "JPY",
  "CHF",
  "SEK",
] as const;
export const currencySchema = z.enum(currencies);
const id = z.uuid();
const stamp = z.number().int().nonnegative().max(8640000000000000);
const money = z.number().int().nonnegative().max(100_000_000_000);
const text = z.string().max(5000);
const name = z.string().trim().min(1).max(120);
export const workspaceSchema = z
  .object({
    id: z.literal("local"),
    name,
    currency: currencySchema,
    hourlyRateMinor: money.nullable(),
    createdAt: stamp,
  })
  .strict();
export const clientSchema = z
  .object({
    id,
    name,
    email: z.union([z.literal(""), z.email()]),
    contact: z.string().max(200),
    address: text,
    notes: text,
    currency: currencySchema,
    hourlyRateMinor: money.nullable(),
    createdAt: stamp,
    updatedAt: stamp,
  })
  .strict();
export const projectSchema = z
  .object({
    id,
    name,
    clientId: id.nullable(),
    description: text,
    billing: z.enum(["hourly", "fixed"]),
    currency: currencySchema,
    hourlyRateMinor: money.nullable(),
    fixedFeeMinor: money.nullable(),
    estimatedHours: z.number().nonnegative().max(1_000_000).nullable(),
    budgetMinor: money.nullable(),
    status: z.enum(["active", "archived"]),
    createdAt: stamp,
    updatedAt: stamp,
  })
  .strict();
export const entrySchema = z
  .object({
    id,
    projectId: id,
    description: text,
    billable: z.boolean(),
    startedAt: stamp,
    endedAt: stamp,
    durationMs: z
      .number()
      .int()
      .positive()
      .max(365 * 86400000),
    rateMinor: money.nullable(),
    currency: currencySchema,
    source: z.enum(["timer", "manual"]),
    invoiceId: id.nullable(),
    createdAt: stamp,
    updatedAt: stamp,
  })
  .strict()
  .refine(
    (e) => e.endedAt >= e.startedAt && e.durationMs <= e.endedAt - e.startedAt,
    "Duration must fit within the session timestamps.",
  );
export const timerSchema = z
  .object({
    id: z.literal("current"),
    revision: id,
    projectId: id,
    description: text,
    billable: z.boolean(),
    startedAt: stamp,
    runningSince: stamp.nullable(),
    accumulatedMs: z
      .number()
      .int()
      .nonnegative()
      .max(365 * 86400000),
    rateMinor: money.nullable(),
    currency: currencySchema,
    status: z.enum(["running", "paused"]),
  })
  .strict()
  .refine(
    (t) => (t.status === "running") === (t.runningSince !== null),
    "Invalid timer state",
  )
  .refine(
    (t) => t.runningSince === null || t.runningSince >= t.startedAt,
    "Invalid timer timestamps",
  );
export const settingsSchema = z
  .object({
    id: z.literal("preferences"),
    theme: z.enum(["light", "dark", "system"]),
    dateFormat: z.enum(["locale", "iso"]),
    lastRoute: z.string().max(200),
    selectedProjectId: id.nullable(),
    filters: z
      .object({
        clients: z.string().max(120),
        projects: z.string().max(120),
        timesheetProjectId: z.string().max(40),
        projectStatus: z.enum(["active", "archived", "all"]),
        entrySort: z.enum(["newest", "oldest"]),
      })
      .strict(),
  })
  .strict();
export const draftSchema = z
  .object({
    id: z.string().max(100),
    version: z.literal(1),
    kind: z.enum(["client", "project", "entry"]),
    entityId: id.nullable(),
    data: z.record(z.string(), z.union([z.string().max(5000), z.boolean()])),
    updatedAt: stamp,
  })
  .strict();
export const metadataSchema = z
  .object({
    id: z.literal("local"),
    lastWriteAt: stamp.nullable(),
    lastBackupAt: stamp.nullable(),
  })
  .strict();
export type Workspace = z.infer<typeof workspaceSchema>;
export type Client = z.infer<typeof clientSchema>;
export type Project = z.infer<typeof projectSchema>;
export type TimeEntry = z.infer<typeof entrySchema>;
export type ActiveTimer = z.infer<typeof timerSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type Draft = z.infer<typeof draftSchema>;
export type Metadata = z.infer<typeof metadataSchema>;
export type Currency = z.infer<typeof currencySchema>;
export const defaultSettings = (): Settings => ({
  id: "preferences",
  theme: "system",
  dateFormat: "locale",
  lastRoute: "/",
  selectedProjectId: null,
  filters: {
    clients: "",
    projects: "",
    timesheetProjectId: "",
    projectStatus: "active",
    entrySort: "newest",
  },
});
