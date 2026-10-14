<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
const props = defineProps<{
  open: boolean;
  title: string;
  message: string;
  busy?: boolean;
  word?: string;
}>();
const emit = defineEmits<{ confirm: []; cancel: [] }>();
const dialog = ref<HTMLDialogElement>(),
  input = ref("");
watch(
  () => props.open,
  async (value) => {
    await nextTick();
    input.value = "";
    if (value && !dialog.value?.open) dialog.value?.showModal();
    if (!value && dialog.value?.open) dialog.value?.close();
  },
);
</script>
<template>
  <dialog
    ref="dialog"
    aria-labelledby="confirm-title"
    @cancel.prevent="!busy && emit('cancel')"
  >
    <form @submit.prevent="emit('confirm')">
      <h2 id="confirm-title">{{ title }}</h2>
      <p>{{ message }}</p>
      <label v-if="word"
        >Type {{ word }} to continue<input v-model="input" autocomplete="off"
      /></label>
      <div class="actions">
        <button type="button" :disabled="busy" @click="emit('cancel')">
          Cancel</button
        ><button class="danger" :disabled="busy || (!!word && input !== word)">
          {{ busy ? "Working…" : "Confirm" }}
        </button>
      </div>
    </form>
  </dialog>
</template>
