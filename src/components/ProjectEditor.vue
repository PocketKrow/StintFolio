<script setup lang="ts">
import { onMounted, ref } from "vue";
import { currencies, type Project, type Currency } from "../database/schema";
import { workspace, clients, act } from "../composables/workspace";
import { useDraft } from "../composables/draft";
import { saveProject } from "../services/records";
import { parseMoney, moneyInput } from "../services/format";
const props = defineProps<{ project?: Project; clientId?: string }>(),
  emit = defineEmits<{ close: [] }>();
const id = ref(props.project?.id ?? null),
  busy = ref(false);
type ProjectForm = {
  name: string;
  clientId: string;
  description: string;
  billing: string;
  currency: string;
  rate: string;
  fee: string;
  budget: string;
  hours: string;
  status: string;
};
function defaults(): ProjectForm {
  const p = props.project,
    currency = p?.currency ?? workspace.value?.currency ?? "USD";
  return {
    name: p?.name ?? "",
    clientId: p?.clientId ?? props.clientId ?? "",
    description: p?.description ?? "",
    billing: p?.billing ?? "hourly",
    currency,
    rate: moneyInput(p?.hourlyRateMinor ?? null, currency),
    fee: moneyInput(p?.fixedFeeMinor ?? null, currency),
    budget: moneyInput(p?.budgetMinor ?? null, currency),
    hours:
      p?.estimatedHours === null || p?.estimatedHours === undefined
        ? ""
        : String(p.estimatedHours),
    status: p?.status ?? "active",
  };
}
const form = ref(defaults()),
  draft = useDraft("project", form, id);
onMounted(() => void act(draft.load));
async function save() {
  busy.value = true;
  await draft.beforeSave();
  const success = await act(async () => {
    const now = Date.now(),
      currency = form.value.currency as Currency;
    await saveProject(
      {
        id: id.value ?? crypto.randomUUID(),
        name: String(form.value.name),
        clientId: form.value.clientId ? String(form.value.clientId) : null,
        description: String(form.value.description),
        billing: form.value.billing as Project["billing"],
        currency,
        hourlyRateMinor:
          form.value.billing === "hourly"
            ? parseMoney(String(form.value.rate), currency)
            : null,
        fixedFeeMinor:
          form.value.billing === "fixed"
            ? parseMoney(String(form.value.fee), currency)
            : null,
        estimatedHours:
          form.value.hours === "" ? null : Number(form.value.hours),
        budgetMinor: parseMoney(String(form.value.budget), currency),
        status: form.value.status as Project["status"],
        createdAt: props.project?.createdAt ?? now,
        updatedAt: now,
      },
      draft.draftId(),
    );
  }, "Project saved in this browser.");
  busy.value = false;
  if (success) emit("close");
  else draft.saveFailed();
}
async function discard() {
  if (await act(() => draft.discard(defaults()), "Draft discarded.")) {
    draft.resume();
  }
}
async function close() {
  await draft.flush();
  emit("close");
}
function selectClient() {
  const c = clients.value.find((c) => c.id === form.value.clientId);
  if (c && !props.project) form.value.currency = c.currency;
}
</script>
<template>
  <section class="panel editor" aria-labelledby="project-editor-title">
    <div class="section-heading">
      <h2 id="project-editor-title">
        {{ project ? "Edit project" : "New project" }}
      </h2>
      <button type="button" :disabled="busy" @click="close">Close</button>
    </div>
    <form @submit.prevent="save">
      <fieldset :disabled="!draft.loaded.value || busy">
        <div class="form-grid">
          <label
            >Project name<input
              v-model="form.name"
              required
              maxlength="120" /></label
          ><label
            >Client<select v-model="form.clientId" @change="selectClient">
              <option value="">Independent project</option>
              <option v-for="c in clients" :key="c.id" :value="c.id">
                {{ c.name }}
              </option>
            </select></label
          ><label
            >Billing arrangement<select v-model="form.billing">
              <option value="hourly">Hourly</option>
              <option value="fixed">Fixed fee</option>
            </select></label
          ><label
            >Currency<select v-model="form.currency">
              <option v-for="c in currencies" :key="c">{{ c }}</option>
            </select></label
          ><label v-if="form.billing === 'hourly'"
            >Hourly rate<input
              v-model="form.rate"
              inputmode="decimal"
              placeholder="Inherit client / workspace rate" /></label
          ><label v-else
            >Fixed fee<input
              v-model="form.fee"
              inputmode="decimal"
              placeholder="Optional fee" /></label
          ><label
            >Estimated hours<input
              v-model="form.hours"
              type="number"
              min="0"
              max="1000000"
              step="0.25" /></label
          ><label
            >Budget <span class="muted">(optional)</span
            ><input v-model="form.budget" inputmode="decimal" /></label
          ><label
            >Status<select v-model="form.status">
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select></label
          >
        </div>
        <label
          >Project description<textarea
            v-model="form.description"
            rows="3"
            maxlength="5000"
          ></textarea>
        </label>
        <p class="fine-print">
          Blank hourly rates inherit defaults in the same currency. Fixed fees
          are project totals; time entries do not turn them into hourly
          earnings. Rate changes affect future sessions only.
        </p>
        <div class="actions">
          <button class="primary" :disabled="busy || !draft.loaded.value">
            {{ busy ? "Saving…" : "Save project" }}</button
          ><button type="button" :disabled="busy" @click="discard">
            Discard draft</button
          ><span class="muted save-state" role="status">{{
            draft.status.value
          }}</span>
        </div>
      </fieldset>
    </form>
  </section>
</template>
