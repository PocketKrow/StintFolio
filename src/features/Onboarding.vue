<script setup lang="ts">
import { ref } from "vue";
import { Database, ArrowRight } from "lucide-vue-next";
import { createWorkspace } from "../services/records";
import { currencies, type Currency } from "../database/schema";
import { parseMoney } from "../services/format";
import { act, operationError } from "../composables/workspace";
const name = ref(""),
  currency = ref<Currency>("USD"),
  rate = ref(""),
  busy = ref(false);
async function create(skip = false) {
  busy.value = true;
  await act(
    () =>
      createWorkspace({
        id: "local",
        name: skip ? "My workspace" : name.value,
        currency: currency.value,
        hourlyRateMinor: skip ? null : parseMoney(rate.value, currency.value),
        createdAt: Date.now(),
      }),
    "Your local workspace is ready.",
  );
  busy.value = false;
}
</script>
<template>
  <main class="onboarding">
    <div class="onboarding-brand">
      <span class="brand-mark" aria-hidden="true">S<span>F</span></span
      ><strong>StintFolio</strong
      ><span class="eyebrow">A PocketRelik Tool</span>
    </div>
    <section class="welcome">
      <p class="eyebrow">Every session, accounted for.</p>
      <h1>Your work.<br />Your own workspace.</h1>
      <p>
        Clients, projects, and tracked time — saved in this browser, ready when
        you return. No account needed.
      </p>
      <div class="storage-intro">
        <Database :size="24" aria-hidden="true" />
        <div>
          <strong>Saved on this device</strong>
          <p>
            StintFolio uses IndexedDB in this browser profile. Records stay
            local and do not sync to other devices. Clearing site data can erase
            them. Create backups in Data & Storage.
          </p>
        </div>
      </div>
    </section>
    <form class="panel setup-form" @submit.prevent="create()">
      <p class="eyebrow">01 / Settle in</p>
      <h2>Make it yours</h2>
      <label
        >Workspace or business name<input
          v-model="name"
          required
          maxlength="120"
          autocomplete="organization"
          placeholder="Your name or studio"
      /></label>
      <div class="form-grid">
        <label
          >Default currency<select v-model="currency">
            <option v-for="c in currencies" :key="c">{{ c }}</option>
          </select></label
        ><label
          >Hourly rate <span class="muted">(optional)</span
          ><input v-model="rate" inputmode="decimal" placeholder="0.00"
        /></label>
      </div>
      <p v-if="operationError" class="error" role="alert">
        {{ operationError }}
      </p>
      <button class="primary" :disabled="busy">
        {{ busy ? "Creating workspace…" : "Open my workspace" }}
        <ArrowRight :size="16" aria-hidden="true" /></button
      ><button
        type="button"
        class="text-button"
        :disabled="busy"
        @click="create(true)"
      >
        Use defaults for now</button
      ><small class="muted"
        >Separate browsers, profiles, and website addresses have separate
        workspaces. Local storage is not password-protected.</small
      >
    </form>
  </main>
</template>
