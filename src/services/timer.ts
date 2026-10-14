import { db, write } from "../database/db";
import { timerSchema, entrySchema, type ActiveTimer } from "../database/schema";
import { resolveRate } from "./records";
export class ClockReviewError extends Error {
  constructor() {
    super(
      "The clock moved backwards or this running segment exceeds 24 hours. Review the elapsed time before continuing.",
    );
    this.name = "ClockReviewError";
  }
}
export function elapsed(timer: ActiveTimer, now = Date.now()) {
  const delta = timer.runningSince === null ? 0 : now - timer.runningSince;
  if (now < timer.startedAt || delta < 0 || delta > 24 * 3600000)
    throw new ClockReviewError();
  return timer.accumulatedMs + delta;
}
export async function startTimer(
  projectId: string,
  description: string,
  billable: boolean,
  now = Date.now(),
) {
  return write(
    [db.activeTimer, db.projects, db.clients, db.workspace],
    async () => {
      if (await db.activeTimer.get("current"))
        throw new Error(
          "A session is already active. Finish it before starting another.",
        );
      const project = await db.projects.get(projectId);
      if (!project || project.status !== "active")
        throw new Error("Choose an active project.");
      const record = timerSchema.parse({
        id: "current",
        revision: crypto.randomUUID(),
        projectId,
        description,
        billable,
        startedAt: now,
        runningSince: now,
        accumulatedMs: 0,
        status: "running",
        rateMinor: await resolveRate(project),
        currency: project.currency,
      });
      await db.activeTimer.add(record);
    },
  );
}
export async function transitionTimer(
  revision: string,
  action: "pause" | "resume" | "stop",
  now = Date.now(),
) {
  return write([db.activeTimer, db.timeEntries], async () => {
    const t = await db.activeTimer.get("current");
    if (!t || t.revision !== revision)
      throw new Error(
        "This timer changed in another tab. Review its current state and try again.",
      );
    if (action === "resume") {
      if (t.status !== "paused")
        throw new Error("The timer is already running.");
      if (now < t.startedAt) throw new ClockReviewError();
      await db.activeTimer.put(
        timerSchema.parse({
          ...t,
          status: "running",
          runningSince: now,
          revision: crypto.randomUUID(),
        }),
      );
      return;
    }
    if (action === "pause" && t.status !== "running")
      throw new Error("The timer is already paused.");
    const durationMs = elapsed(t, now);
    if (action === "pause") {
      await db.activeTimer.put(
        timerSchema.parse({
          ...t,
          status: "paused",
          runningSince: null,
          accumulatedMs: durationMs,
          revision: crypto.randomUUID(),
        }),
      );
      return;
    }
    if (durationMs < 1000)
      throw new Error("Track at least one second before saving the session.");
    const entry = entrySchema.parse({
      id: crypto.randomUUID(),
      projectId: t.projectId,
      description: t.description,
      billable: t.billable,
      startedAt: t.startedAt,
      endedAt: now,
      durationMs,
      rateMinor: t.rateMinor,
      currency: t.currency,
      source: "timer",
      invoiceId: null,
      createdAt: now,
      updatedAt: now,
    });
    await db.timeEntries.add(entry);
    await db.activeTimer.delete("current");
  });
}
export async function updateTimerDetails(
  revision: string,
  description: string,
  billable: boolean,
) {
  return write([db.activeTimer], async () => {
    const t = await db.activeTimer.get("current");
    if (!t || t.revision !== revision)
      throw new Error("The timer changed in another tab.");
    await db.activeTimer.put(
      timerSchema.parse({
        ...t,
        description,
        billable,
        revision: crypto.randomUUID(),
      }),
    );
  });
}
export async function reviewTimer(
  revision: string,
  durationMs: number,
  now = Date.now(),
) {
  return write([db.activeTimer], async () => {
    const t = await db.activeTimer.get("current");
    if (!t || t.revision !== revision)
      throw new Error("The timer changed in another tab.");
    if (
      !Number.isSafeInteger(durationMs) ||
      durationMs < 0 ||
      durationMs > 365 * 86400000
    )
      throw new Error("Enter a valid elapsed duration.");
    await db.activeTimer.put(
      timerSchema.parse({
        ...t,
        accumulatedMs: durationMs,
        startedAt: Math.min(t.startedAt, now - durationMs),
        runningSince: null,
        status: "paused",
        revision: crypto.randomUUID(),
      }),
    );
  });
}
