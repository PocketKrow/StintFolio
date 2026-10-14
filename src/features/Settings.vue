<script setup lang="ts">
import { ref } from "vue";
import PageHeading from "../components/PageHeading.vue";
import { workspace, preferences, act } from "../composables/workspace";
import { currencies, type Currency, type Settings } from "../database/schema";
import { saveSettings, saveWorkspace } from "../services/records";
import { moneyInput, parseMoney } from "../services/format";
const name = ref(workspace.value?.name ?? ""),
  currency = ref<Currency>(workspace.value?.currency ?? "USD"),
  rate = ref(
    moneyInput(
      workspace.value?.hourlyRateMinor ?? null,
      workspace.value?.currency ?? "USD",
    ),
  ),
  busy = ref(false);
async function save() {
  if (!workspace.value) return;
  busy.value = true;
  await act(
    () =>
      saveWorkspace({
        ...workspace.value!,
        name: name.value,
        currency: currency.value,
        hourlyRateMinor: parseMoney(rate.value, currency.value),
      }),
    "Workspace preferences saved.",
  );
  busy.value = false;
}
async function changeTheme(event: Event) {
  await act(
    () =>
      saveSettings({
        theme: (event.target as HTMLSelectElement).value as Settings["theme"],
      }),
    "Appearance saved.",
  );
}
async function changeDate(event: Event) {
  await act(
    () =>
      saveSettings({
        dateFormat: (event.target as HTMLSelectElement)
          .value as Settings["dateFormat"],
      }),
    "Date preference saved.",
  );
}
</script>
<template>
  <PageHeading
    title="Preferences"
    description="A workspace that fits the way you work."
    eyebrow="Make it yours"
    ><RouterLink to="/settings/data" class="button"
      >Data & Storage</RouterLink
    ></PageHeading
  >
  <div class="settings-grid">
    <section class="panel">
      <h2>Workspace defaults</h2>
      <form @submit.prevent="save">
        <label
          >Workspace name<input v-model="name" required maxlength="120"
        /></label>
        <div class="form-grid">
          <label
            >Default currency<select v-model="currency">
              <option v-for="c in currencies" :key="c">{{ c }}</option>
            </select></label
          ><label
            >Default hourly rate<input
              v-model="rate"
              inputmode="decimal"
              placeholder="Optional"
          /></label>
        </div>
        <p class="fine-print">
          Defaults apply to future sessions that inherit a matching currency.
          Existing records keep their captured rates.
        </p>
        <button class="primary" :disabled="busy">
          Save workspace defaults
        </button>
      </form>
    </section>
    <section class="panel">
      <h2>Appearance & dates</h2>
      <label
        >Theme<select :value="preferences.theme" @change="changeTheme">
          <option value="system">Follow system</option>
          <option value="light">Winter light</option>
          <option value="dark">Charcoal dark</option>
        </select></label
      ><label
        >Date display<select
          :value="preferences.dateFormat"
          @change="changeDate"
        >
          <option value="locale">Browser locale</option>
          <option value="iso">YYYY-MM-DD</option>
        </select></label
      >
      <p class="muted">
        Preferences are saved in IndexedDB with the rest of your workspace.
      </p>
    </section>
  </div>
</template>
