import { beforeEach, afterAll, describe, expect, it } from "vitest";
import { db, initialize, StintDatabase } from "../database/db";
import {
  startTimer,
  transitionTimer,
  elapsed,
  reviewTimer,
  updateTimerDetails,
} from "../services/timer";
import { saveProject, saveClient } from "../services/records";
import { seed, client, project } from "./fixtures";
beforeEach(async () => {
  await db.delete();
  await initialize();
  await seed();
});
afterAll(async () => {
  await db.delete();
});
const current = async () => (await db.activeTimer.get("current"))!;
describe("transactional timer", () => {
  it("starts, pauses, resumes, and saves exact accumulated time", async () => {
    await startTimer(project.id, "Build", true, 1000);
    await transitionTimer((await current()).revision, "pause", 11000);
    expect((await current()).accumulatedMs).toBe(10000);
    expect(elapsed(await current(), 31000)).toBe(10000);
    await transitionTimer((await current()).revision, "resume", 31000);
    await transitionTimer((await current()).revision, "stop", 41000);
    expect(await db.activeTimer.count()).toBe(0);
    expect((await db.timeEntries.toArray())[0]).toMatchObject({
      durationMs: 20000,
      rateMinor: 6000,
      startedAt: 1000,
      endedAt: 41000,
    });
  });
  it("recovers running and paused timers after database close and long suspension", async () => {
    await startTimer(project.id, "Recover", false, 1000);
    db.close();
    await initialize();
    expect(elapsed(await current(), 8 * 3600000 + 1000)).toBe(8 * 3600000);
    await transitionTimer((await current()).revision, "pause", 11000);
    db.close();
    await initialize();
    expect(elapsed(await current(), 90000000)).toBe(10000);
  });
  it("allows only one start under contention", async () => {
    const results = await Promise.allSettled([
      startTimer(project.id, "A", true, 1000),
      startTimer(project.id, "B", true, 1000),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.activeTimer.count()).toBe(1);
  });
  it("uses a singleton key across independent database connections", async () => {
    const second = new StintDatabase();
    await second.open();
    try {
      await startTimer(project.id, "", true, 1000);
      await expect(second.activeTimer.add(await current())).rejects.toThrow();
      expect(await second.activeTimer.count()).toBe(1);
    } finally {
      second.close();
    }
  });
  it("prevents duplicate stop and stale-tab transitions", async () => {
    await startTimer(project.id, "", true, 1000);
    const revision = (await current()).revision;
    const results = await Promise.allSettled([
      transitionTimer(revision, "stop", 11000),
      transitionTimer(revision, "stop", 11000),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.timeEntries.count()).toBe(1);
    await startTimer(project.id, "", true, 12000);
    await expect(transitionTimer(revision, "pause", 22000)).rejects.toThrow(
      "another tab",
    );
  });
  it("keeps historical session rates when project or client rates change", async () => {
    await startTimer(project.id, "", true, 1000);
    await saveProject({ ...project, hourlyRateMinor: 10000 }, "project:edit");
    await saveClient({ ...client, hourlyRateMinor: 12000 }, "client:edit");
    await transitionTimer((await current()).revision, "stop", 3601000);
    expect((await db.timeEntries.toArray())[0]?.rateMinor).toBe(6000);
  });
  it("does not inherit rates from a different currency or from fixed fees", async () => {
    await saveProject({ ...project, currency: "EUR" }, "project:edit");
    await startTimer(project.id, "", true, 1000);
    expect((await current()).rateMinor).toBeNull();
    await transitionTimer((await current()).revision, "stop", 11000);
    await saveProject(
      { ...project, billing: "fixed", fixedFeeMinor: 20000 },
      "project:edit",
    );
    await startTimer(project.id, "", true, 12000);
    expect((await current()).rateMinor).toBeNull();
  });
  it("requires explicit review for clock reversal and unusually long sessions", async () => {
    await startTimer(project.id, "", true, 1000);
    expect(() =>
      elapsed({ ...awaitableTimer(), runningSince: 2000 }, 1000),
    ).toThrow();
    await expect(
      transitionTimer((await current()).revision, "stop", 0),
    ).rejects.toThrow("clock");
    await expect(
      transitionTimer((await current()).revision, "pause", 90000000),
    ).rejects.toThrow("24 hours");
    await reviewTimer((await current()).revision, 60000, 90000000);
    expect(await current()).toMatchObject({
      status: "paused",
      accumulatedMs: 60000,
    });
    await transitionTimer((await current()).revision, "stop", 90000000);
    expect((await db.timeEntries.toArray())[0]?.durationMs).toBe(60000);
  });
  it("updates timer details transactionally and rejects empty or archived projects", async () => {
    await expect(
      startTimer(crypto.randomUUID(), "", true, 1000),
    ).rejects.toThrow("active");
    await saveProject({ ...project, status: "archived" }, "project:edit");
    await expect(startTimer(project.id, "", true, 1000)).rejects.toThrow(
      "active",
    );
    await saveProject(project, "project:edit");
    await startTimer(project.id, "", true, 1000);
    await updateTimerDetails((await current()).revision, "Changed", false);
    expect(await current()).toMatchObject({
      description: "Changed",
      billable: false,
    });
    await expect(
      saveProject({ ...project, status: "archived" }, "project:edit"),
    ).rejects.toThrow("Stop");
  });
});
function awaitableTimer() {
  return {
    id: "current" as const,
    revision: crypto.randomUUID(),
    projectId: project.id,
    description: "",
    billable: true,
    startedAt: 1000,
    runningSince: 1000,
    accumulatedMs: 0,
    rateMinor: 6000,
    currency: "USD" as const,
    status: "running" as const,
  };
}
