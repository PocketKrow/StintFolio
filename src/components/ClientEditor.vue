<script setup lang="ts">
import { ref, onMounted } from "vue";
import { currencies, type Client, type Currency } from "../database/schema";
import { workspace, act } from "../composables/workspace";
import { useDraft } from "../composables/draft";
import { saveClient } from "../services/records";
import { parseMoney, moneyInput } from "../services/format";
const props = defineProps<{ client?: Client }>(),
  emit = defineEmits<{ close: [] }>();
const id = ref(props.client?.id ?? null),
  busy = ref(false);
type ClientForm = {
  name: string;
  email: string;
  contact: string;
  address: string;
  notes: string;
  currency: string;
  rate: string;
};
function defaults(): ClientForm {
  const c = props.client;
  return {
    name: c?.name ?? "",
    email: c?.email ?? "",
    contact: c?.contact ?? "",
    address: c?.address ?? "",
    notes: c?.notes ?? "",
    currency: c?.currency ?? workspace.value?.currency ?? "USD",
    rate: moneyInput(
      c?.hourlyRateMinor ?? null,
      c?.currency ?? workspace.value?.currency ?? "USD",
    ),
  };
}
const form = ref(defaults()),
  draft = useDraft("client", form, id);
onMounted(() => void act(draft.load));
async function save() {
  busy.value = true;
  await draft.beforeSave();
  const success = await act(async () => {
    const now = Date.now(),
      currency = form.value.currency as Currency;
    await saveClient(
      {
        id: id.value ?? crypto.randomUUID(),
        name: String(form.value.name),
        email: String(form.value.email).trim(),
        contact: String(form.value.contact),
        address: String(form.value.address),
        notes: String(form.value.notes),
        currency,
        hourlyRateMinor: parseMoney(String(form.value.rate), currency),
        createdAt: props.client?.createdAt ?? now,
        updatedAt: now,
      },
      draft.draftId(),
    );
  }, "Client saved in this browser.");
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
</script>
<template>
  <section class="panel editor" aria-labelledby="client-editor-title">
    <div class="section-heading">
      <h2 id="client-editor-title">
        {{ client ? "Edit client" : "New client" }}
      </h2>
      <button type="button" :disabled="busy" @click="close">Close</button>
    </div>
    <form @submit.prevent="save">
      <fieldset :disabled="!draft.loaded.value || busy">
        <div class="form-grid">
          <label
            >Client name<input
              v-model="form.name"
              required
              maxlength="120" /></label
          ><label
            >Email <span class="muted">(optional)</span
            ><input
              v-model="form.email"
              type="email"
              autocomplete="email" /></label
          ><label
            >Contact / phone<input
              v-model="form.contact"
              maxlength="200" /></label
          ><label
            >Currency<select v-model="form.currency">
              <option v-for="c in currencies" :key="c">{{ c }}</option>
            </select></label
          ><label
            >Default hourly rate<input
              v-model="form.rate"
              inputmode="decimal"
              placeholder="Inherit workspace rate" /></label
          ><label
            >Billing address<textarea
              v-model="form.address"
              rows="2"
              maxlength="5000"
            ></textarea>
          </label>
        </div>
        <label
          >Notes<textarea
            v-model="form.notes"
            rows="3"
            maxlength="5000"
          ></textarea>
        </label>
        <div class="actions">
          <button class="primary" :disabled="busy || !draft.loaded.value">
            {{ busy ? "Saving…" : "Save client" }}</button
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
