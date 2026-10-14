import { onBeforeUnmount, ref, watch, type Ref } from "vue";
import { db } from "../database/db";
import { saveDraft, discardDraft } from "../services/records";
import { friendlyError, operationError } from "./workspace";
import type { Draft } from "../database/schema";
export const pendingDrafts = ref(new Set<string>());
type Form = Record<string, string | boolean>;
export function useDraft<T extends Form>(
  kind: Draft["kind"],
  form: Ref<T>,
  id: Ref<string | null>,
) {
  const status = ref(""),
    recovered = ref(false),
    loaded = ref(false);
  let pending: ReturnType<typeof setTimeout> | undefined,
    saving = Promise.resolve(),
    paused = false,
    dirty = false,
    changeSequence = 0;
  const draftId = () => `${kind}:${id.value ?? "new"}`;
  async function load() {
    loaded.value = false;
    status.value = "Checking for a saved draft…";
    clearTimeout(pending);
    await saving;
    const d = await db.drafts.get(draftId());
    recovered.value = Boolean(d);
    if (d?.version === 1) {
      for (const key of Object.keys(form.value))
        if (key in d.data && typeof d.data[key] === typeof form.value[key])
          form.value[key as keyof T] = d.data[key] as T[keyof T];
      status.value = "Recovered draft";
    } else status.value = "";
    loaded.value = true;
  }
  function flush() {
    clearTimeout(pending);
    if (!loaded.value || paused || !dirty) return saving;
    const sequence = changeSequence;
    dirty = false;
    const record: Draft = {
      id: draftId(),
      version: 1,
      kind,
      entityId: id.value,
      data: { ...form.value },
      updatedAt: Date.now(),
    };
    status.value = "Saving draft…";
    saving = saving.then(async () => {
      try {
        await saveDraft(record);
        if (sequence === changeSequence) pendingDrafts.value.delete(record.id);
        status.value =
          sequence === changeSequence
            ? "Draft saved in this browser"
            : "Unsaved changes";
      } catch (error) {
        dirty = true;
        operationError.value = `Your latest draft could not be saved. ${friendlyError(error)}`;
        status.value = `Draft not saved: ${friendlyError(error)}`;
      }
    });
    return saving;
  }
  watch(
    form,
    () => {
      if (!loaded.value || paused) return;
      dirty = true;
      changeSequence++;
      pendingDrafts.value.add(draftId());
      status.value = "Unsaved changes";
      clearTimeout(pending);
      pending = setTimeout(() => void flush(), 250);
    },
    { deep: true, flush: "sync" },
  );
  async function beforeSave() {
    paused = true;
    clearTimeout(pending);
    await saving;
  }
  function saveFailed() {
    paused = false;
  }
  async function discard(defaults: T) {
    paused = true;
    clearTimeout(pending);
    await saving;
    await discardDraft(draftId());
    form.value = defaults;
    paused = false;
    recovered.value = false;
    dirty = false;
    pendingDrafts.value.delete(draftId());
    status.value = "";
  }
  function resume() {
    paused = false;
  }
  // Start a best-effort write on pagehide, while ordinary route changes flush reliably.
  const pagehide = () => {
    void flush();
  };
  window.addEventListener("pagehide", pagehide);
  onBeforeUnmount(() => {
    if (paused) pendingDrafts.value.delete(draftId());
    else void flush();
    window.removeEventListener("pagehide", pagehide);
  });
  return {
    status,
    recovered,
    loaded,
    load,
    flush,
    beforeSave,
    saveFailed,
    discard,
    resume,
    draftId,
  };
}
