<script setup lang="ts">
import { computed, ref } from "vue";
import { Plus } from "lucide-vue-next";
import PageHeading from "../components/PageHeading.vue";
import ClientEditor from "../components/ClientEditor.vue";
import ConfirmDialog from "../components/ConfirmDialog.vue";
import {
  clients,
  projects,
  preferences,
  drafts,
  act,
} from "../composables/workspace";
import { deleteClient, saveFilters } from "../services/records";
import { money } from "../services/format";
import type { Client } from "../database/schema";
const editing = ref<Client>(),
  open = ref(false),
  deleting = ref<Client>(),
  busy = ref(false);
const search = computed({
  get: () => preferences.value.filters.clients,
  set: (value) => {
    void act(() => saveFilters({ clients: value }));
  },
});
const filtered = computed(() =>
  clients.value
    .filter((c) => c.name.toLowerCase().includes(search.value.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name)),
);
function edit(client?: Client) {
  editing.value = client;
  open.value = true;
}
async function remove() {
  if (!deleting.value) return;
  busy.value = true;
  const success = await act(
    () => deleteClient(deleting.value!.id),
    "Client removed.",
  );
  busy.value = false;
  if (success) deleting.value = undefined;
}
</script>
<template>
  <PageHeading
    title="Clients"
    description="The people behind the projects."
    eyebrow="Your network"
    ><button class="primary" @click="edit()">
      <Plus :size="16" aria-hidden="true" />New client
    </button></PageHeading
  ><ClientEditor
    v-if="open"
    :key="editing?.id ?? 'new'"
    :client="editing"
    @close="open = false"
  />
  <div class="list-toolbar">
    <label class="search-field"
      >Find a client<input
        v-model="search"
        type="search"
        placeholder="Search names"
        maxlength="120" /></label
    ><span class="muted">{{ clients.length }} clients · saved locally</span>
  </div>
  <div v-if="!clients.length" class="panel empty-state">
    <h2>Good work starts with a person.</h2>
    <p>Add your first client, or keep projects independent.</p>
    <button @click="edit()">
      {{
        drafts.some((d) => d.id === "client:new")
          ? "Resume client draft"
          : "Add a client"
      }}
    </button>
  </div>
  <div v-else-if="!filtered.length" class="panel empty-state">
    No clients match your search.
  </div>
  <section v-else class="card-grid">
    <article
      v-for="client in filtered"
      :key="client.id"
      class="panel entity-card"
    >
      <div class="entity-title">
        <span class="initial-mark">{{
          client.name.slice(0, 2).toUpperCase()
        }}</span>
        <div>
          <h2>{{ client.name }}</h2>
          <p>{{ client.email || client.contact || "No contact details" }}</p>
        </div>
      </div>
      <dl class="inline-details">
        <div>
          <dt>Projects</dt>
          <dd>{{ projects.filter((p) => p.clientId === client.id).length }}</dd>
        </div>
        <div>
          <dt>Hourly rate</dt>
          <dd>
            {{
              client.hourlyRateMinor === null
                ? "Inherit default"
                : money(client.hourlyRateMinor, client.currency)
            }}
          </dd>
        </div>
      </dl>
      <p v-if="client.address" class="preserve-lines muted">
        {{ client.address }}
      </p>
      <p v-if="client.notes" class="muted">{{ client.notes }}</p>
      <div class="actions">
        <button @click="edit(client)">
          {{
            drafts.some((d) => d.id === `client:${client.id}`)
              ? "Resume editing"
              : "Edit client"
          }}</button
        ><button class="text-button danger-text" @click="deleting = client">
          Delete</button
        ><RouterLink :to="{ path: '/projects', query: { client: client.id } }"
          >View projects</RouterLink
        >
      </div>
    </article>
  </section>
  <ConfirmDialog
    :open="!!deleting"
    title="Delete this client?"
    message="Clients with associated projects cannot be deleted. Reassign their projects first. This cannot be undone without a backup."
    :busy="busy"
    @confirm="remove"
    @cancel="deleting = undefined"
  />
</template>
