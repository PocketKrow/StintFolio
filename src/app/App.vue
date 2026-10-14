<script setup lang="ts">
import { computed, onBeforeUnmount, watch, ref } from "vue";
import { useRoute } from "vue-router";
import {
  LayoutDashboard,
  Timer,
  List,
  Folder,
  Users,
  Settings,
  Database,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-vue-next";
import { useRegisterSW } from "virtual:pwa-register/vue";
import { brand } from "./branding";
import {
  workspace,
  ready,
  fatalError,
  preferences,
  timer,
  notice,
  operationError,
  drafts,
} from "../composables/workspace";
import Onboarding from "../features/Onboarding.vue";
import { pendingDrafts } from "../composables/draft";
import RecoveryRestore from "../components/RecoveryRestore.vue";
function reload() {
  location.reload();
}
const route = useRoute(),
  menu = ref(false);
const nav = [
  { path: "/", label: "Overview", icon: LayoutDashboard },
  { path: "/timer", label: "Timer", icon: Timer },
  { path: "/timesheet", label: "Timesheet", icon: List },
  { path: "/projects", label: "Projects", icon: Folder },
  { path: "/clients", label: "Clients", icon: Users },
];
const { offlineReady, needRefresh, updateServiceWorker } = useRegisterSW({
  onRegisterError() {
    operationError.value =
      "Offline caching could not be initialized. Saved workspace records remain in IndexedDB.";
  },
});
const system = window.matchMedia("(prefers-color-scheme: dark)"),
  systemDark = ref(system.matches);
const change = (e: MediaQueryListEvent) => {
  systemDark.value = e.matches;
};
system.addEventListener("change", change);
const actualTheme = computed(() =>
  preferences.value.theme === "system"
    ? systemDark.value
      ? "dark"
      : "light"
    : preferences.value.theme,
);
watch(
  actualTheme,
  (value) => {
    document.documentElement.dataset.theme = value;
  },
  { immediate: true },
);
watch(
  () => route.path,
  () => {
    menu.value = false;
    document.title = `${route.meta.title ?? brand.name} · ${brand.name}`;
  },
);
const blocked = () => {
  fatalError.value =
    "Database upgrade is blocked by another tab. Close other StintFolio tabs, then reload. Existing data has been preserved.";
};
const routeFailure = () => {
  operationError.value =
    "Could not save your last page. Other records have not been changed.";
};
window.addEventListener("stintfolio:blocked", blocked);
window.addEventListener("stintfolio:route-save-failed", routeFailure);
onBeforeUnmount(() => {
  system.removeEventListener("change", change);
  window.removeEventListener("stintfolio:blocked", blocked);
  window.removeEventListener("stintfolio:route-save-failed", routeFailure);
});
async function update() {
  if (timer.value || drafts.value.length || pendingDrafts.value.size) {
    operationError.value =
      "Finish the active session and save or discard recovered drafts before updating.";
    return;
  }
  await updateServiceWorker(true);
}
</script>
<template>
  <div v-if="fatalError" class="startup">
    <p class="eyebrow">Local workspace unavailable</p>
    <h1>Your data deserves a clean recovery.</h1>
    <p role="alert">{{ fatalError }}</p>
    <p>
      Check browser storage permissions and available disk space. Close other
      StintFolio tabs if an upgrade is blocked. No temporary workspace has been
      substituted.
    </p>
    <button @click="reload">Try again</button>
    <p class="muted">
      Do not clear site data to troubleshoot unless you have a backup.
    </p>
    <RecoveryRestore />
  </div>
  <div v-else-if="!ready" class="startup" role="status">
    Opening your local workspace…
  </div>
  <Onboarding v-else-if="!workspace" />
  <div v-else class="app-shell">
    <a class="skip-link" href="#main">Skip to workspace</a>
    <aside class="sidebar" :class="{ expanded: menu }">
      <RouterLink to="/" class="brand"
        ><span class="brand-mark" aria-hidden="true">S<span>F</span></span
        ><span
          >{{ brand.name }}<small>{{ brand.endorsement }}</small></span
        ></RouterLink
      >
      <button
        class="mobile-menu"
        :aria-expanded="menu"
        aria-controls="primary-navigation"
        @click="menu = !menu"
      >
        {{ menu ? "Close menu" : "Open menu" }}
      </button>
      <nav id="primary-navigation" aria-label="Main navigation">
        <p class="eyebrow">Workspace</p>
        <RouterLink
          v-for="item in nav"
          :key="item.path"
          :to="item.path"
          :class="{ selected: route.path === item.path }"
          ><component :is="item.icon" :size="18" aria-hidden="true" />{{
            item.label
          }}<span
            v-if="item.path === '/timer' && timer"
            class="dot"
            :class="{ paused: timer.status === 'paused' }"
            aria-label="Session active"
        /></RouterLink>
        <div class="nav-bottom">
          <RouterLink
            to="/settings"
            :class="{ selected: route.path === '/settings' }"
            ><Settings :size="18" aria-hidden="true" />Preferences</RouterLink
          ><RouterLink
            to="/settings/data"
            :class="{ selected: route.path === '/settings/data' }"
            ><Database :size="18" aria-hidden="true" />Data &
            Storage</RouterLink
          >
        </div>
      </nav>
      <div class="local-card">
        <ShieldCheck :size="18" aria-hidden="true" />
        <div>
          <strong>Yours. Locally.</strong
          ><small>This browser · this device</small
          ><RouterLink to="/settings/data"
            >Inspect storage <ArrowUpRight :size="12" aria-hidden="true"
          /></RouterLink>
        </div>
      </div>
    </aside>
    <div class="workspace-area">
      <header class="topbar">
        <span
          >{{ workspace.name }}
          <span class="muted">/ {{ route.meta.title }}</span></span
        ><span class="local-label"><span class="dot" /> Local workspace</span>
      </header>
      <div class="feedback" aria-live="polite">
        <div v-if="operationError" class="error" role="alert">
          {{ operationError
          }}<button aria-label="Dismiss error" @click="operationError = ''">
            ×
          </button>
        </div>
        <div v-if="notice" class="success">
          {{ notice
          }}<button aria-label="Dismiss message" @click="notice = ''">×</button>
        </div>
        <div v-if="needRefresh" class="info">
          A new version is ready.
          <button @click="update">Update when ready</button
          ><button @click="needRefresh = false">Later</button>
        </div>
        <div v-if="offlineReady" class="info">
          Application cached for offline use.<button
            @click="offlineReady = false"
          >
            Dismiss
          </button>
        </div>
      </div>
      <main id="main" tabindex="-1"><RouterView /></main>
      <footer class="app-footer">
        <span>{{ brand.tagline }}</span
        ><RouterLink to="/settings/data">Your data, explained.</RouterLink>
      </footer>
    </div>
  </div>
</template>
