<script setup lang="ts">
import { computed } from "vue";
import { ArrowUpRight, Play } from "lucide-vue-next";
import PageHeading from "../components/PageHeading.vue";
import {
  entries,
  workspace,
  activeProjects,
  timer,
  projectName,
  preferences,
} from "../composables/workspace";
import {
  duration,
  money,
  entryValue,
  timeInRange,
  date,
} from "../services/format";
const now = new Date(),
  today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
const week = new Date(today);
week.setDate(week.getDate() - ((week.getDay() + 6) % 7));
const month = new Date(now.getFullYear(), now.getMonth(), 1).getTime(),
  tomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  ).getTime();
const trackedToday = computed(() =>
  entries.value.reduce((n, e) => n + timeInRange(e, today, tomorrow), 0),
);
const trackedWeek = computed(() =>
  entries.value.reduce(
    (n, e) => n + timeInRange(e, week.getTime(), tomorrow),
    0,
  ),
);
const billable = computed(() =>
  entries.value
    .filter((e) => e.billable)
    .reduce((n, e) => n + timeInRange(e, month, tomorrow), 0),
);
const totals = computed(() => {
  const result: Record<string, string> = {};
  for (const currency of [
    ...new Set(
      entries.value
        .filter(
          (e) =>
            e.billable &&
            e.rateMinor !== null &&
            timeInRange(e, month, tomorrow) > 0,
        )
        .map((e) => e.currency),
    ),
  ]) {
    const total = entries.value
      .filter(
        (e) => e.currency === currency && e.billable && e.rateMinor !== null,
      )
      .reduce(
        (n, e) =>
          n +
          Math.round(
            (entryValue(e) * timeInRange(e, month, tomorrow)) / e.durationMs,
          ),
        0,
      );
    result[currency] = money(total, currency);
  }
  return result;
});
</script>
<template>
  <PageHeading
    title="A little structure. More room to work."
    :description="`Welcome back, ${workspace?.name}. Here’s what you’ve accounted for.`"
    eyebrow="Overview"
    ><RouterLink to="/timer" class="button primary"
      ><Play :size="15" aria-hidden="true" />{{
        timer ? "Return to session" : "Start a session"
      }}</RouterLink
    ></PageHeading
  >
  <section class="metrics" aria-label="Workspace totals">
    <article>
      <span>Today</span><strong>{{ duration(trackedToday) }}</strong
      ><small>Tracked time</small>
    </article>
    <article>
      <span>This week</span><strong>{{ duration(trackedWeek) }}</strong
      ><small>Monday onwards</small>
    </article>
    <article>
      <span>This month</span><strong>{{ duration(billable) }}</strong
      ><small>Billable time</small>
    </article>
    <article>
      <span>Estimated hourly value</span
      ><strong v-if="!Object.keys(totals).length">{{
        money(0, workspace?.currency ?? "USD")
      }}</strong
      ><strong
        v-for="(value, currency) in totals"
        :key="currency"
        class="currency-total"
        >{{ value }}</strong
      ><small>Month · separate currencies</small>
    </article>
  </section>
  <div class="overview-grid">
    <section class="panel">
      <div class="section-heading">
        <h2>Recent sessions</h2>
        <RouterLink to="/timesheet"
          >View timesheet <ArrowUpRight :size="14" aria-hidden="true"
        /></RouterLink>
      </div>
      <div v-if="!entries.length" class="empty-state">
        <span class="empty-mark">01</span>
        <h3>Your first session starts here.</h3>
        <p>Create a project, then give your work a place to land.</p>
        <RouterLink to="/projects" class="button">Create a project</RouterLink>
      </div>
      <ul v-else class="record-list">
        <li v-for="entry in entries.slice(0, 5)" :key="entry.id">
          <div>
            <strong>{{ projectName(entry.projectId) }}</strong>
            <p>
              {{ entry.description || "Work session" }}
              <span class="muted"
                >·
                {{
                  date(entry.startedAt, preferences.dateFormat === "iso")
                }}</span
              >
            </p>
          </div>
          <span class="mono">{{ duration(entry.durationMs) }}</span>
        </li>
      </ul>
    </section>
    <section class="panel workspace-note">
      <p class="eyebrow">On your desk</p>
      <h2>
        {{ activeProjects.length }} active
        {{ activeProjects.length === 1 ? "project" : "projects" }}
      </h2>
      <div v-if="timer" class="session-mini">
        <span class="dot" />
        <div>
          <strong>{{ projectName(timer.projectId) }}</strong>
          <p>
            {{
              timer.status === "running" ? "Session running" : "Session paused"
            }}
            · restored locally
          </p>
        </div>
        <RouterLink to="/timer" aria-label="Open current timer"
          ><ArrowUpRight :size="18"
        /></RouterLink>
      </div>
      <p v-else class="muted">No active session. Start when you’re ready.</p>
      <RouterLink to="/projects"
        >Open projects <ArrowUpRight :size="14" aria-hidden="true"
      /></RouterLink>
      <div class="ownership-note">
        <p class="eyebrow">A workspace that belongs to you</p>
        <p>
          Saved in this browser. Back it up before changing devices or website
          addresses.
        </p>
        <RouterLink to="/settings/data"
          >Data & Storage <ArrowUpRight :size="14" aria-hidden="true"
        /></RouterLink>
      </div>
    </section>
  </div>
  <p class="fine-print">
    Totals include completed sessions. Sessions spanning days are allocated
    proportionally over their timestamp range. Fixed-fee projects contribute
    time, with their fees shown on Projects.
  </p>
</template>
