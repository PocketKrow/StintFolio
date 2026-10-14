<script setup lang="ts">
import { ref } from "vue";
import {
  decodeBackup,
  restoreBackup,
  MAX_BACKUP_BYTES,
  type Backup,
} from "../services/backup";
import { friendlyError } from "../composables/workspace";
import ConfirmDialog from "./ConfirmDialog.vue";
const file = ref<File>(),
  passphrase = ref(""),
  preview = ref<Backup>(),
  error = ref(""),
  busy = ref(false),
  confirm = ref(false);
function select(event: Event) {
  file.value = (event.target as HTMLInputElement).files?.[0];
  preview.value = undefined;
}
async function read() {
  busy.value = true;
  error.value = "";
  try {
    if (!file.value || file.value.size > MAX_BACKUP_BYTES)
      throw new Error("Select a backup no larger than 10 MiB.");
    preview.value = await decodeBackup(
      await file.value.text(),
      passphrase.value,
    );
    passphrase.value = "";
  } catch (e) {
    error.value = friendlyError(e);
  } finally {
    busy.value = false;
  }
}
async function restore() {
  if (!preview.value) return;
  busy.value = true;
  error.value = "";
  try {
    await restoreBackup(preview.value);
    location.reload();
  } catch (e) {
    error.value = friendlyError(e);
    busy.value = false;
    confirm.value = false;
  }
}
</script>
<template>
  <details>
    <summary>Recover using a backup</summary>
    <p>
      A validated backup can replace damaged records when browser storage is
      still writable. Original records are preserved if validation or
      restoration fails.
    </p>
    <form @submit.prevent="read">
      <label
        >Recovery backup<input
          type="file"
          accept=".json,application/json"
          required
          @change="select" /></label
      ><label
        >Passphrase (encrypted backups only)<input
          v-model="passphrase"
          type="password"
          autocomplete="off"
          maxlength="1024" /></label
      ><button :disabled="busy">Read recovery backup</button>
    </form>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <div v-if="preview">
      <p>
        {{ preview.workspace.name }} · {{ preview.clients.length }} clients ·
        {{ preview.projects.length }} projects ·
        {{ preview.timeEntries.length }} entries
      </p>
      <button :disabled="busy" @click="confirm = true">
        Restore validated backup
      </button>
    </div>
  </details>
  <ConfirmDialog
    :open="confirm"
    title="Replace damaged workspace?"
    message="This replaces every current local record with the validated backup. It cannot be undone without another backup."
    word="RESTORE"
    :busy="busy"
    @confirm="restore"
    @cancel="confirm = false"
  />
</template>
