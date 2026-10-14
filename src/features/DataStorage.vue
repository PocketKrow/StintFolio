<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import { Database, Download, Upload, ShieldCheck } from "lucide-vue-next";
import PageHeading from "../components/PageHeading.vue";
import ConfirmDialog from "../components/ConfirmDialog.vue";
import { db } from "../database/db";
import {
  clients,
  projects,
  entries,
  timer,
  drafts,
  metadata,
  act,
  notice,
} from "../composables/workspace";
import {
  storageInfo,
  requestPersistence,
  bytes,
  type StorageInfo,
} from "../services/storage";
import {
  snapshot,
  encodeBackup,
  decodeBackup,
  restoreBackup,
  clearWorkspace,
  markBackupDownloaded,
  MAX_BACKUP_BYTES,
  type Backup,
} from "../services/backup";
import { dateTime } from "../services/format";
const indexedDBAvailable = typeof indexedDB !== "undefined";
const origin = location.origin,
  diagnostics = ref<StorageInfo>({
    usage: null,
    quota: null,
    persistent: null,
    message: "",
  }),
  busy = ref(false),
  encrypted = ref(true),
  passphrase = ref(""),
  repeat = ref(""),
  importPassphrase = ref(""),
  file = ref<File>(),
  preview = ref<Backup>(),
  restoreOpen = ref(false),
  clearOpen = ref(false);
async function refresh() {
  diagnostics.value = await storageInfo();
}
onMounted(() => void refresh());
const refreshInterval = setInterval(() => void refresh(), 30000);
onBeforeUnmount(() => {
  clearInterval(refreshInterval);
  passphrase.value = "";
  repeat.value = "";
  importPassphrase.value = "";
});
async function persist() {
  busy.value = true;
  let granted = false;
  if (
    await act(async () => {
      granted = await requestPersistence();
      await refresh();
    })
  ) {
    notice.value = granted
      ? "Persistent storage granted by this browser."
      : "Persistent storage was not granted. Keep backups current.";
  }
  busy.value = false;
}
async function exportData() {
  busy.value = true;
  await act(async () => {
    if (encrypted.value && passphrase.value !== repeat.value)
      throw new Error("The passphrases do not match.");
    const content = await encodeBackup(
      await snapshot(),
      encrypted.value ? passphrase.value : undefined,
    );
    const url = URL.createObjectURL(
      new Blob([content], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `stintfolio-${new Date().toISOString().slice(0, 10)}${encrypted.value ? "-encrypted" : ""}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    await markBackupDownloaded();
    passphrase.value = "";
    repeat.value = "";
  }, "Backup download requested. Check your downloads and keep the file somewhere safe.");
  busy.value = false;
}
function selectFile(event: Event) {
  file.value = (event.target as HTMLInputElement).files?.[0];
  preview.value = undefined;
  restoreOpen.value = false;
}
async function inspect() {
  busy.value = true;
  preview.value = undefined;
  await act(async () => {
    if (!file.value) throw new Error("Choose a backup file.");
    if (file.value.size > MAX_BACKUP_BYTES)
      throw new Error("Backup exceeds the supported 10 MiB limit.");
    preview.value = await decodeBackup(
      await file.value.text(),
      importPassphrase.value,
    );
    importPassphrase.value = "";
  }, "Backup validated. Review the records before replacing your workspace.");
  busy.value = false;
}
async function restore() {
  if (!preview.value) return;
  busy.value = true;
  if (await act(() => restoreBackup(preview.value), "Workspace restored."))
    location.reload();
  else busy.value = false;
}
async function clear() {
  busy.value = true;
  if (await act(clearWorkspace)) location.href = "/";
  else busy.value = false;
}
</script>
<template>
  <PageHeading
    title="Your data, explained."
    description="A clear view of what’s saved, where it lives, and how to keep it yours."
    eyebrow="Data & Storage"
    ><button :disabled="busy" @click="refresh">
      Refresh diagnostics
    </button></PageHeading
  >
  <section class="panel storage-location">
    <Database :size="28" aria-hidden="true" />
    <div>
      <h2>This browser. This device.</h2>
      <p>
        Your workspace is saved locally using IndexedDB inside the current
        browser profile. Your projects, time entries, and preferences are not
        uploaded to a StintFolio server.
      </p>
      <dl class="storage-identity">
        <div>
          <dt>Website origin</dt>
          <dd class="mono">{{ origin }}</dd>
        </div>
        <div>
          <dt>Database</dt>
          <dd class="mono">{{ db.name }}</dd>
        </div>
        <div>
          <dt>Schema version</dt>
          <dd class="mono">{{ db.verno }}</dd>
        </div>
      </dl>
      <p class="fine-print">
        Browsers manage their own storage folders. This website cannot reliably
        show an operating-system filesystem path.
      </p>
    </div>
  </section>
  <div class="settings-grid">
    <section class="panel">
      <div class="section-heading">
        <h2>Storage health</h2>
        <ShieldCheck :size="19" aria-hidden="true" />
      </div>
      <dl class="diagnostic-list">
        <div>
          <dt>IndexedDB</dt>
          <dd>{{ indexedDBAvailable ? "Available" : "Unavailable" }}</dd>
        </div>
        <div>
          <dt>Database connection</dt>
          <dd>{{ db.isOpen() ? "Open" : "Closed" }}</dd>
        </div>
        <div>
          <dt>Persistent storage</dt>
          <dd>
            {{
              diagnostics.persistent === null
                ? "Unavailable"
                : diagnostics.persistent
                  ? "Granted"
                  : "Not granted"
            }}
          </dd>
        </div>
        <div>
          <dt>Approximate site usage</dt>
          <dd>{{ bytes(diagnostics.usage) }}</dd>
        </div>
        <div>
          <dt>Approximate site quota</dt>
          <dd>{{ bytes(diagnostics.quota) }}</dd>
        </div>
        <div>
          <dt>Last successful write</dt>
          <dd>{{ dateTime(metadata?.lastWriteAt) }}</dd>
        </div>
        <div>
          <dt>Last backup download requested</dt>
          <dd>{{ dateTime(metadata?.lastBackupAt) }}</dd>
        </div>
      </dl>
      <p class="fine-print">
        Usage and quota are browser estimates for this origin. They may include
        application caches as well as IndexedDB. A requested download does not
        verify the file was retained.
      </p>
      <p v-if="diagnostics.message" class="muted">{{ diagnostics.message }}</p>
      <button
        :disabled="busy || diagnostics.persistent === true"
        @click="persist"
      >
        Request persistent storage
      </button>
      <p class="fine-print">
        This asks the browser to reduce automatic storage eviction. It can
        decline. It does not protect against manual deletion, browser-profile
        removal, or device failure.
      </p>
    </section>
    <section class="panel">
      <h2>Local record inventory</h2>
      <dl class="diagnostic-list">
        <div>
          <dt>Clients</dt>
          <dd>{{ clients.length }}</dd>
        </div>
        <div>
          <dt>Projects</dt>
          <dd>{{ projects.length }}</dd>
        </div>
        <div>
          <dt>Completed time entries</dt>
          <dd>{{ entries.length }}</dd>
        </div>
        <div>
          <dt>Active / paused sessions</dt>
          <dd>{{ timer ? 1 : 0 }}</dd>
        </div>
        <div>
          <dt>Recoverable drafts</dt>
          <dd>{{ drafts.length }}</dd>
        </div>
      </dl>
      <details>
        <summary>Inspect the browser database</summary>
        <p>
          In Firefox: open Developer Tools → Storage → Indexed DB →
          {{ origin }} → StintFolioDB.
        </p>
        <p>
          In Chrome or Edge: open Developer Tools → Application → IndexedDB →
          StintFolioDB. Refresh the database view after changes.
        </p>
        <p class="fine-print">
          Developer tools can edit or delete records. Use a backup before
          changing anything.
        </p>
      </details>
      <details v-if="drafts.length">
        <summary>Saved draft summaries</summary>
        <ul>
          <li v-for="draft in drafts" :key="draft.id">
            {{ draft.kind }} ·
            {{ draft.entityId ? "existing record" : "new record" }} ·
            {{ dateTime(draft.updatedAt) }}
            <p v-if="draft.data.name">{{ draft.data.name }}</p>
            <RouterLink
              :to="
                draft.kind === 'client'
                  ? '/clients'
                  : draft.kind === 'project'
                    ? '/projects'
                    : '/timesheet'
              "
              >Open
              {{ draft.kind === "entry" ? "timesheet" : `${draft.kind}s` }} to
              resume</RouterLink
            >
          </li>
        </ul>
      </details>
    </section>
  </div>
  <div class="settings-grid">
    <section class="panel">
      <div class="section-heading">
        <h2>Export a complete backup</h2>
        <Download :size="19" aria-hidden="true" />
      </div>
      <p>
        Workspace, clients, projects, entries, timer state, preferences, and
        saved drafts in one versioned file.
      </p>
      <form @submit.prevent="exportData">
        <label class="check-label"
          ><input v-model="encrypted" type="checkbox" />Protect with a
          passphrase <span class="badge">Recommended</span></label
        ><template v-if="encrypted"
          ><label
            >Backup passphrase<input
              v-model="passphrase"
              type="password"
              minlength="12"
              maxlength="1024"
              autocomplete="new-password"
              required /></label
          ><label
            >Repeat passphrase<input
              v-model="repeat"
              type="password"
              minlength="12"
              maxlength="1024"
              autocomplete="new-password"
              required
          /></label>
          <p class="fine-print">
            AES-256-GCM with PBKDF2-SHA256, random salt and nonce. Passphrases
            are never saved. A lost passphrase means a lost backup.
          </p></template
        >
        <p v-else class="warning">
          Unencrypted JSON contains readable business information. Store and
          share it carefully.
        </p>
        <button class="primary" :disabled="busy">
          {{ busy ? "Working…" : "Download backup" }}
        </button>
      </form>
    </section>
    <section class="panel">
      <div class="section-heading">
        <h2>Restore a workspace</h2>
        <Upload :size="19" aria-hidden="true" />
      </div>
      <p>
        Restore replaces all current workspace records. Validation happens
        before any records are changed. Export your current work first.
      </p>
      <form @submit.prevent="inspect">
        <label
          >Backup file <span class="muted">(JSON · up to 10 MiB)</span
          ><input
            type="file"
            accept="application/json,.json"
            required
            @change="selectFile" /></label
        ><label
          >Passphrase <span class="muted">(encrypted files only)</span
          ><input
            v-model="importPassphrase"
            type="password"
            maxlength="1024"
            autocomplete="off" /></label
        ><button :disabled="busy || !file">Read & validate backup</button>
      </form>
      <div v-if="preview" class="restore-preview">
        <p class="eyebrow">Validated snapshot</p>
        <h3>{{ preview.workspace.name }}</h3>
        <p>
          {{ preview.clients.length }} clients ·
          {{ preview.projects.length }} projects ·
          {{ preview.timeEntries.length }} time entries ·
          {{ preview.drafts.length }} drafts ·
          {{ preview.activeTimer ? "1 active session" : "no active session" }}
        </p>
        <p class="fine-print">
          Exported {{ dateTime(preview.exportedAt) }}. Running timers continue
          from their recorded timestamps; review long sessions after import.
        </p>
        <button class="danger" :disabled="busy" @click="restoreOpen = true">
          Replace workspace with this backup
        </button>
      </div>
    </section>
  </div>
  <section class="panel privacy-panel">
    <h2>Know what local means.</h2>
    <div class="privacy-grid">
      <div>
        <h3>Separate by design</h3>
        <p>
          Different browsers, profiles, and devices generally have separate
          databases. There is no automatic synchronization and no cloud account.
          Private browsing may keep data only temporarily.
        </p>
      </div>
      <div>
        <h3>You’re responsible for backups</h3>
        <p>
          Clearing website data, removing a browser profile, or losing a device
          can permanently remove your workspace. IndexedDB is not inherently
          encrypted or password-protected; someone using your unlocked browser
          profile can access it.
        </p>
      </div>
      <div>
        <h3>Changing domains?</h3>
        <p>
          Storage belongs to the website origin shown above. A preview address
          and your production domain have separate databases. Export a backup,
          open the new domain, then import it. Changing DNS alone does not move
          your records.
        </p>
      </div>
      <div>
        <h3>Two separate jobs</h3>
        <p>
          The service worker caches the application so it can open offline.
          IndexedDB stores your workspace records. An application update does
          not replace your workspace.
        </p>
      </div>
    </div>
  </section>
  <section class="panel danger-zone">
    <h2>Clear this local workspace</h2>
    <p>
      Deletes all clients, projects, sessions, preferences, and drafts from this
      browser’s StintFolio database. Application cache remains available.
      Without a backup, these records may be unrecoverable.
    </p>
    <button class="danger" :disabled="busy" @click="clearOpen = true">
      Clear local workspace
    </button>
  </section>
  <ConfirmDialog
    :open="restoreOpen"
    title="Replace your entire workspace?"
    message="Every current local record, draft, and timer will be replaced with this validated backup. Export your current workspace first. Other open tabs will see the replacement."
    word="RESTORE"
    :busy="busy"
    @confirm="restore"
    @cancel="restoreOpen = false"
  /><ConfirmDialog
    :open="clearOpen"
    title="Permanently clear local records?"
    message="This removes your workspace in this browser and affects all open tabs. You must have a backup to recover it."
    word="CLEAR"
    :busy="busy"
    @confirm="clear"
    @cancel="clearOpen = false"
  />
</template>
