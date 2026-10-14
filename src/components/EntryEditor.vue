<script setup lang="ts">
import { ref, onMounted } from "vue";
import { type TimeEntry } from "../database/schema";
import { projects, preferences, act } from "../composables/workspace";
import { useDraft } from "../composables/draft";
import { saveEntry } from "../services/records";
import { localInput } from "../services/format";
const props = defineProps<{ entry?: TimeEntry }>(),
  emit = defineEmits<{ close: [] }>();
const id = ref(props.entry?.id ?? null),
  busy = ref(false);
type EntryForm = {
  projectId: string;
  description: string;
  billable: boolean;
  start: string;
  end: string;
  minutes: string;
};
function defaults(): EntryForm {
  const e = props.entry;
  return {
    projectId: e?.projectId ?? preferences.value.selectedProjectId ?? "",
    description: e?.description ?? "",
    billable: e?.billable ?? true,
    start: localInput(e?.startedAt ?? Date.now() - 3600000),
    end: localInput(e?.endedAt ?? Date.now()),
    minutes: e ? String(e.durationMs / 60000) : "60",
  };
}
const form = ref(defaults()),
  draft = useDraft("entry", form, id);
onMounted(() => void act(draft.load));
function recalculate() {
  if (!props.entry)
    form.value.minutes = String(
      (new Date(String(form.value.end)).getTime() -
        new Date(String(form.value.start)).getTime()) /
        60000,
    );
}
async function save() {
  busy.value = true;
  await draft.beforeSave();
  const success = await act(async () => {
    const p = projects.value.find((p) => p.id === form.value.projectId);
    if (!p) throw new Error("Select a project.");
    const now = Date.now();
    await saveEntry(
      {
        id: id.value ?? crypto.randomUUID(),
        projectId: p.id,
        description: String(form.value.description),
        billable: Boolean(form.value.billable),
        startedAt: new Date(String(form.value.start)).getTime(),
        endedAt: new Date(String(form.value.end)).getTime(),
        durationMs: Math.round(Number(form.value.minutes) * 60000),
        rateMinor: props.entry?.rateMinor ?? null,
        currency: props.entry?.currency ?? p.currency,
        source: props.entry?.source ?? "manual",
        invoiceId: props.entry?.invoiceId ?? null,
        createdAt: props.entry?.createdAt ?? now,
        updatedAt: now,
      },
      draft.draftId(),
    );
  }, "Time entry saved.");
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
  <section class="panel editor" aria-labelledby="entry-editor-title">
    <div class="section-heading">
      <h2 id="entry-editor-title">
        {{ entry ? "Edit time entry" : "Manual time entry" }}
      </h2>
      <button type="button" :disabled="busy" @click="close">Close</button>
    </div>
    <form @submit.prevent="save">
      <fieldset :disabled="!draft.loaded.value || busy">
        <div class="form-grid">
          <label
            >Project<select
              v-model="form.projectId"
              required
              :disabled="!!entry"
            >
              <option value="" disabled>Select a project</option>
              <option v-for="p in projects" :key="p.id" :value="p.id">
                {{ p.name }}{{ p.status === "archived" ? " (archived)" : "" }}
              </option>
            </select></label
          ><label
            >Tracked minutes<input
              v-model="form.minutes"
              type="number"
              min="0.0167"
              step="any"
              max="525600"
              required /></label
          ><label
            >Start (local time)<input
              v-model="form.start"
              type="datetime-local"
              step="0.001"
              required
              @change="recalculate" /></label
          ><label
            >End (local time)<input
              v-model="form.end"
              type="datetime-local"
              step="0.001"
              required
              @change="recalculate"
          /></label>
        </div>
        <label
          >Description<textarea
            v-model="form.description"
            maxlength="5000"
            rows="2"
          ></textarea></label
        ><label class="check-label"
          ><input v-model="form.billable" type="checkbox" />Billable time</label
        >
        <p class="fine-print">
          Tracked minutes may be less than the timestamp span to account for
          pauses. Existing entries keep their captured currency and hourly rate.
        </p>
        <div class="actions">
          <button class="primary" :disabled="busy || !draft.loaded.value">
            {{ busy ? "Saving…" : "Save time entry" }}</button
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
