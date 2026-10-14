<script setup lang="ts">
import { ref, computed } from "vue";
import { Plus } from "lucide-vue-next";
import PageHeading from "../components/PageHeading.vue";
import EntryEditor from "../components/EntryEditor.vue";
import ConfirmDialog from "../components/ConfirmDialog.vue";
import {
  entries,
  projects,
  preferences,
  projectName,
  act,
} from "../composables/workspace";
import { saveFilters, deleteEntry } from "../services/records";
import { duration, date, money, entryValue } from "../services/format";
import type { TimeEntry, Settings } from "../database/schema";
const open = ref(false),
  editing = ref<TimeEntry>(),
  deleting = ref<TimeEntry>(),
  busy = ref(false);
const filter = computed({
  get: () =>
    projects.value.some(
      (p) => p.id === preferences.value.filters.timesheetProjectId,
    )
      ? preferences.value.filters.timesheetProjectId
      : "",
  set: (value) => {
    void act(() => saveFilters({ timesheetProjectId: value }));
  },
});
const sort = computed({
  get: () => preferences.value.filters.entrySort,
  set: (value: Settings["filters"]["entrySort"]) => {
    void act(() => saveFilters({ entrySort: value }));
  },
});
const filtered = computed(() =>
  entries.value
    .filter((e) => !filter.value || e.projectId === filter.value)
    .sort((a, b) =>
      sort.value === "newest"
        ? b.startedAt - a.startedAt
        : a.startedAt - b.startedAt,
    ),
);
function edit(entry?: TimeEntry) {
  editing.value = entry;
  open.value = true;
}
async function remove() {
  if (!deleting.value) return;
  busy.value = true;
  const success = await act(
    () => deleteEntry(deleting.value!.id),
    "Time entry removed.",
  );
  busy.value = false;
  if (success) deleting.value = undefined;
}
</script>
<template>
  <PageHeading
    title="Timesheet"
    description="A clear record of where your time went."
    eyebrow="Session ledger"
    ><button class="primary" :disabled="!projects.length" @click="edit()">
      <Plus :size="16" aria-hidden="true" />Manual entry
    </button></PageHeading
  ><EntryEditor
    v-if="open"
    :key="editing?.id ?? 'new'"
    :entry="editing"
    @close="open = false"
  />
  <div class="list-toolbar">
    <label
      >Filter by project<select v-model="filter">
        <option value="">All projects</option>
        <option v-for="p in projects" :key="p.id" :value="p.id">
          {{ p.name }}
        </option>
      </select></label
    ><label
      >Sort<select v-model="sort">
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
      </select></label
    ><span class="mono muted"
      >{{
        duration(filtered.reduce((n, e) => n + e.durationMs, 0))
      }}
      total</span
    >
  </div>
  <div v-if="!filtered.length" class="panel empty-state">
    <h2>No sessions here yet.</h2>
    <p>Start a timer or add the work you already completed.</p>
    <RouterLink class="button" to="/timer">Open timer</RouterLink>
  </div>
  <div v-else class="panel table-wrap">
    <table>
      <caption class="sr-only">
        Recorded work sessions
      </caption>
      <thead>
        <tr>
          <th scope="col">Session</th>
          <th scope="col">Date</th>
          <th scope="col">Duration</th>
          <th scope="col">Billable value</th>
          <th scope="col">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="entry in filtered" :key="entry.id">
          <td>
            <strong>{{ projectName(entry.projectId) }}</strong
            ><small>{{ entry.description || "Work session" }}</small>
          </td>
          <td>
            {{ date(entry.startedAt, preferences.dateFormat === "iso")
            }}<small
              >{{ entry.source
              }}{{ entry.invoiceId ? " · invoiced" : "" }}</small
            >
          </td>
          <td class="mono">{{ duration(entry.durationMs) }}</td>
          <td class="mono">
            {{
              !entry.billable
                ? "Non-billable"
                : entry.rateMinor === null
                  ? "No hourly rate"
                  : money(entryValue(entry), entry.currency)
            }}
          </td>
          <td>
            <div class="actions">
              <button :disabled="!!entry.invoiceId" @click="edit(entry)">
                Edit</button
              ><button
                class="text-button danger-text"
                :disabled="!!entry.invoiceId"
                @click="deleting = entry"
              >
                Delete
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <ConfirmDialog
    :open="!!deleting"
    title="Delete this time entry?"
    message="This removes the completed session and its value from your timesheet. You will need a backup to recover it."
    :busy="busy"
    @confirm="remove"
    @cancel="deleting = undefined"
  />
</template>
