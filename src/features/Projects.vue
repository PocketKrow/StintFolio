<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Plus } from "lucide-vue-next";
import PageHeading from "../components/PageHeading.vue";
import ProjectEditor from "../components/ProjectEditor.vue";
import ConfirmDialog from "../components/ConfirmDialog.vue";
import {
  projects,
  clients,
  entries,
  timer,
  preferences,
  drafts,
  act,
} from "../composables/workspace";
import { deleteProject, saveProject, saveFilters } from "../services/records";
import { money, duration } from "../services/format";
import type { Project, Settings } from "../database/schema";
const route = useRoute(),
  router = useRouter(),
  editing = ref<Project>(),
  open = ref(false),
  deleting = ref<Project>(),
  busy = ref(false);
const search = computed({
  get: () => preferences.value.filters.projects,
  set: (value) => {
    void act(() => saveFilters({ projects: value }));
  },
});
const status = computed({
  get: () => preferences.value.filters.projectStatus,
  set: (value: Settings["filters"]["projectStatus"]) => {
    void act(() => saveFilters({ projectStatus: value }));
  },
});
const clientId = computed(() =>
  typeof route.query.client === "string" &&
  clients.value.some((c) => c.id === route.query.client)
    ? route.query.client
    : undefined,
);
const filtered = computed(() =>
  projects.value
    .filter(
      (p) =>
        (status.value === "all" || p.status === status.value) &&
        (!clientId.value || p.clientId === clientId.value) &&
        p.name.toLowerCase().includes(search.value.toLowerCase()),
    )
    .sort((a, b) => a.name.localeCompare(b.name)),
);
function edit(project?: Project) {
  editing.value = project;
  open.value = true;
}
async function archive(project: Project) {
  await act(
    () =>
      saveProject(
        {
          ...project,
          status: project.status === "active" ? "archived" : "active",
          updatedAt: Date.now(),
        },
        `unused:${project.id}`,
      ),
    "Project status updated.",
  );
}
async function remove() {
  if (!deleting.value) return;
  busy.value = true;
  const success = await act(
    () => deleteProject(deleting.value!.id),
    "Unused project removed.",
  );
  busy.value = false;
  if (success) deleting.value = undefined;
}
async function viewEntries(id: string) {
  if (await act(() => saveFilters({ timesheetProjectId: id })))
    await router.push("/timesheet");
}
</script>
<template>
  <PageHeading
    title="Projects"
    description="Give every session a place to belong."
    eyebrow="Work in progress"
    ><button class="primary" @click="edit()">
      <Plus :size="16" aria-hidden="true" />New project
    </button></PageHeading
  ><ProjectEditor
    v-if="open"
    :key="editing?.id ?? 'new'"
    :project="editing"
    :client-id="clientId"
    @close="open = false"
  />
  <div class="list-toolbar">
    <label class="search-field"
      >Find a project<input
        v-model="search"
        type="search"
        maxlength="120"
        placeholder="Search names" /></label
    ><label
      >Status<select v-model="status">
        <option value="active">Active</option>
        <option value="archived">Archived</option>
        <option value="all">All projects</option>
      </select></label
    ><button v-if="clientId" @click="router.replace('/projects')">
      Clear client filter
    </button>
  </div>
  <div v-if="!projects.length" class="panel empty-state">
    <h2>A clean slate for your next project.</h2>
    <p>Add a project to begin tracking. Clients are optional.</p>
    <button @click="edit()">
      {{
        drafts.some((d) => d.id === "project:new")
          ? "Resume project draft"
          : "Add a project"
      }}
    </button>
  </div>
  <div v-else-if="!filtered.length" class="panel empty-state">
    No projects match these filters.
  </div>
  <section v-else class="card-grid">
    <article
      v-for="project in filtered"
      :key="project.id"
      class="panel entity-card"
    >
      <div class="section-heading">
        <span class="eyebrow">{{
          clients.find((c) => c.id === project.clientId)?.name ?? "Independent"
        }}</span
        ><span class="badge">{{ project.status }}</span>
      </div>
      <h2>{{ project.name }}</h2>
      <p v-if="project.description" class="muted">{{ project.description }}</p>
      <dl class="inline-details">
        <div>
          <dt>
            {{ project.billing === "fixed" ? "Fixed fee" : "Hourly rate" }}
          </dt>
          <dd>
            {{
              project.billing === "fixed"
                ? project.fixedFeeMinor === null
                  ? "Not set"
                  : money(project.fixedFeeMinor, project.currency)
                : project.hourlyRateMinor === null
                  ? "Inherited default"
                  : money(project.hourlyRateMinor, project.currency)
            }}
          </dd>
        </div>
        <div>
          <dt>Tracked</dt>
          <dd class="mono">
            {{
              duration(
                entries
                  .filter((e) => e.projectId === project.id)
                  .reduce((n, e) => n + e.durationMs, 0),
              )
            }}
          </dd>
        </div>
      </dl>
      <p
        v-if="project.estimatedHours !== null || project.budgetMinor !== null"
        class="fine-print"
      >
        {{
          project.estimatedHours === null
            ? ""
            : `${project.estimatedHours} estimated hours`
        }}
        {{
          project.budgetMinor === null
            ? ""
            : `· ${money(project.budgetMinor, project.currency)} budget`
        }}
      </p>
      <div class="actions">
        <button @click="edit(project)">
          {{
            drafts.some((d) => d.id === `project:${project.id}`)
              ? "Resume editing"
              : "Edit"
          }}</button
        ><button
          :disabled="timer?.projectId === project.id"
          @click="archive(project)"
        >
          {{ project.status === "active" ? "Archive" : "Reactivate" }}</button
        ><button class="text-button" @click="viewEntries(project.id)">
          Sessions</button
        ><button class="text-button danger-text" @click="deleting = project">
          Delete
        </button>
      </div>
    </article>
  </section>
  <ConfirmDialog
    :open="!!deleting"
    title="Delete this project?"
    message="Only projects without tracked work can be deleted. Archive projects to preserve their history."
    :busy="busy"
    @confirm="remove"
    @cancel="deleting = undefined"
  />
</template>
