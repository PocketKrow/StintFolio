<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from "vue";
import { Play, Pause, Square } from "lucide-vue-next";
import PageHeading from "../components/PageHeading.vue";
import {
  timer,
  preferences,
  activeProjects,
  projectName,
  act,
} from "../composables/workspace";
import {
  startTimer,
  transitionTimer,
  updateTimerDetails,
  elapsed,
  reviewTimer,
} from "../services/timer";
import { saveSettings } from "../services/records";
import { duration, money } from "../services/format";
const now = ref(Date.now()),
  busy = ref(false),
  description = ref(""),
  billable = ref(true),
  reviewMinutes = ref(""),
  clockDrift = ref(false),
  editDetails = ref(false),
  reviewOpen = ref(false);
let lastWall = Date.now(),
  lastMono = performance.now();
const tick = window.setInterval(() => {
  const wall = Date.now(),
    mono = performance.now();
  if (
    timer.value?.status === "running" &&
    Math.abs(wall - lastWall - (mono - lastMono)) > 120000
  )
    clockDrift.value = true;
  lastWall = wall;
  lastMono = mono;
  now.value = wall;
}, 500);
onBeforeUnmount(() => clearInterval(tick));
watch(
  () => timer.value?.revision,
  () => {
    now.value = Date.now();
    if (!editDetails.value) {
      description.value = timer.value?.description ?? "";
      billable.value = timer.value?.billable ?? true;
    }
  },
  { immediate: true },
);
const project = computed({
  get: () =>
    activeProjects.value.some(
      (p) => p.id === preferences.value.selectedProjectId,
    )
      ? (preferences.value.selectedProjectId ?? "")
      : "",
  set: (value) => {
    void act(() => saveSettings({ selectedProjectId: value || null }));
  },
});
const elapsedResult = computed(() => {
  if (!timer.value) return { ms: 0, error: "" };
  try {
    return {
      ms: elapsed(timer.value, now.value),
      error: clockDrift.value
        ? "A clock discrepancy was detected. Review this session’s elapsed time."
        : "",
    };
  } catch (e) {
    return { ms: timer.value.accumulatedMs, error: (e as Error).message };
  }
});
async function start() {
  busy.value = true;
  await act(
    () => startTimer(project.value, description.value, billable.value),
    "Timer started and saved locally.",
  );
  busy.value = false;
}
async function transition(action: "pause" | "resume" | "stop") {
  if (!timer.value) return;
  busy.value = true;
  const revision = timer.value.revision;
  if (
    await act(
      () => transitionTimer(revision, action),
      action === "stop"
        ? "Session saved to your timesheet."
        : `Timer ${action === "pause" ? "paused" : "resumed"}.`,
    )
  ) {
    if (action === "stop") {
      description.value = "";
      billable.value = true;
      clockDrift.value = false;
    }
  }
  busy.value = false;
}
async function saveDetails() {
  if (!timer.value) return;
  busy.value = true;
  if (
    await act(
      () =>
        updateTimerDetails(
          timer.value!.revision,
          description.value,
          billable.value,
        ),
      "Session details saved.",
    )
  )
    editDetails.value = false;
  busy.value = false;
}
async function review() {
  if (!timer.value) return;
  busy.value = true;
  if (
    await act(
      () =>
        reviewTimer(
          timer.value!.revision,
          Math.round(Number(reviewMinutes.value) * 60000),
        ),
      "Reviewed duration saved. The session is paused.",
    )
  ) {
    clockDrift.value = false;
    reviewOpen.value = false;
  }
  busy.value = false;
}
</script>
<template>
  <PageHeading
    title="One session at a time."
    description="Start, settle in, and let the work add up."
    eyebrow="Timer"
  />
  <section class="panel timer-panel">
    <div class="timer-meta">
      <span class="eyebrow">{{
        timer ? projectName(timer.projectId) : "Ready when you are"
      }}</span
      ><span class="badge">{{ timer?.status ?? "Idle" }}</span>
    </div>
    <div
      class="timer-digits"
      role="timer"
      aria-live="off"
      :aria-label="`${elapsedResult.error ? 'Review required' : 'Elapsed time'} ${duration(elapsedResult.ms)}`"
    >
      {{ duration(elapsedResult.ms) }}
    </div>
    <p v-if="timer" class="muted timer-context">
      {{ timer.description || "Focused work" }} ·
      {{ timer.billable ? "Billable" : "Non-billable"
      }}<span v-if="timer.rateMinor !== null">
        · {{ money(timer.rateMinor, timer.currency) }} / hr</span
      >
    </p>
    <form v-if="!timer" class="timer-form" @submit.prevent="start">
      <label
        >Project<select v-model="project" required>
          <option value="" disabled>Select an active project</option>
          <option v-for="p in activeProjects" :key="p.id" :value="p.id">
            {{ p.name }}
          </option>
        </select></label
      ><label
        >What are you working on?<textarea
          v-model="description"
          maxlength="5000"
          rows="2"
          placeholder="A short description"
        ></textarea></label
      ><label class="check-label"
        ><input v-model="billable" type="checkbox" />Billable session</label
      ><button class="primary" :disabled="busy || !project">
        <Play :size="17" aria-hidden="true" />Start session
      </button>
      <p v-if="!activeProjects.length" class="muted">
        Create or reactivate a project to start tracking.
        <RouterLink to="/projects">Open projects</RouterLink>
      </p>
    </form>
    <template v-else
      ><div
        v-if="elapsedResult.error || reviewOpen"
        class="clock-review"
        role="alert"
      >
        <p>
          {{
            elapsedResult.error ||
            "Confirm the total tracked duration. Saving a review pauses the session."
          }}
        </p>
        <form @submit.prevent="review">
          <label
            >Reviewed total duration (minutes)<input
              v-model="reviewMinutes"
              type="number"
              step="0.01"
              min="0"
              max="525600"
              required /></label
          ><button :disabled="busy">Save reviewed duration and pause</button>
        </form>
      </div>
      <div class="actions timer-actions">
        <button
          v-if="timer.status === 'running'"
          :disabled="busy || !!elapsedResult.error"
          @click="transition('pause')"
        >
          <Pause :size="17" aria-hidden="true" />Pause</button
        ><button
          v-else
          class="primary"
          :disabled="busy || !!elapsedResult.error"
          @click="transition('resume')"
        >
          <Play :size="17" aria-hidden="true" />Resume</button
        ><button
          :disabled="busy || !!elapsedResult.error || elapsedResult.ms < 1000"
          @click="transition('stop')"
        >
          <Square :size="16" aria-hidden="true" />Stop & save</button
        ><button
          class="text-button"
          @click="
            reviewOpen = !reviewOpen;
            reviewMinutes = String(Math.round(elapsedResult.ms / 600) / 100);
          "
        >
          Review duration
        </button>
        <button class="text-button" @click="editDetails = !editDetails">
          Edit session details
        </button>
      </div>
      <form v-if="editDetails" class="timer-form" @submit.prevent="saveDetails">
        <label
          >Session description<textarea
            v-model="description"
            maxlength="5000"
            rows="2"
          ></textarea></label
        ><label class="check-label"
          ><input v-model="billable" type="checkbox" />Billable session</label
        ><button :disabled="busy">Save session details</button>
        <p class="fine-print">
          Changes to these details are committed when you save.
        </p>
      </form></template
    >
  </section>
  <div class="timer-policy">
    <h2>Closing the tab doesn’t close the session.</h2>
    <p>
      Running sessions count wall-clock time, including browser closure,
      suspended tabs, and sleep. Paused time is excluded. Each transition is
      saved immediately. Only one session can be active across your tabs.
    </p>
    <p class="fine-print">
      Negative elapsed time, detected clock changes, or a running segment longer
      than 24 hours require a duration review. Clock changes while the browser
      is closed cannot always be distinguished from time away.
    </p>
  </div>
</template>
