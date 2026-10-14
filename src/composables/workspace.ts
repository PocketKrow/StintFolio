import { ref, computed } from "vue";
import { storeToRefs } from "pinia";
import { pinia } from "../app/pinia";
import { useFeedbackStore } from "../stores/feedback";
import { liveQuery } from "dexie";
import { db, initialize } from "../database/db";
import {
  defaultSettings,
  type Workspace,
  type Client,
  type Project,
  type TimeEntry,
  type ActiveTimer,
  type Settings,
  type Draft,
  type Metadata,
} from "../database/schema";
export const ready = ref(false),
  fatalError = ref("");
export const workspace = ref<Workspace>(),
  clients = ref<Client[]>([]),
  projects = ref<Project[]>([]),
  entries = ref<TimeEntry[]>([]),
  timer = ref<ActiveTimer>(),
  preferences = ref<Settings>(defaultSettings()),
  drafts = ref<Draft[]>([]),
  metadata = ref<Metadata>();
export const { notice, operationError } = storeToRefs(useFeedbackStore(pinia));
export const activeProjects = computed(() =>
  projects.value.filter((p) => p.status === "active"),
);
let subscription: { unsubscribe(): void } | undefined;
export async function boot() {
  ready.value = false;
  fatalError.value = "";
  try {
    await initialize();
    subscription?.unsubscribe();
    await new Promise<void>((resolve, reject) => {
      subscription = liveQuery(async () =>
        db.transaction("r", db.tables, async () => ({
          workspace: await db.workspace.get("local"),
          clients: await db.clients.toArray(),
          projects: await db.projects.toArray(),
          entries: await db.timeEntries
            .orderBy("startedAt")
            .reverse()
            .toArray(),
          timer: await db.activeTimer.get("current"),
          preferences:
            (await db.settings.get("preferences")) ?? defaultSettings(),
          drafts: await db.drafts.toArray(),
          metadata: await db.metadata.get("local"),
        })),
      ).subscribe({
        next(data) {
          workspace.value = data.workspace;
          clients.value = data.clients;
          projects.value = data.projects;
          entries.value = data.entries;
          timer.value = data.timer;
          preferences.value = data.preferences;
          drafts.value = data.drafts;
          metadata.value = data.metadata;
          ready.value = true;
          resolve();
        },
        error(error) {
          fatalError.value =
            error instanceof Error
              ? error.message
              : "Cannot read the local database.";
          reject(error);
        },
      });
    });
  } catch (error) {
    fatalError.value =
      error instanceof Error ? error.message : "IndexedDB is unavailable.";
  }
}
export function friendlyError(error: unknown) {
  if (error instanceof Error && /quota/i.test(error.name + error.message))
    return "Browser storage is full. The action was not saved. Export a backup and free space before trying again.";
  return error instanceof Error
    ? error.message
    : "The action could not be saved.";
}
export async function act(operation: () => Promise<unknown>, success = "") {
  operationError.value = "";
  notice.value = "";
  try {
    await operation();
    notice.value = success;
    return true;
  } catch (error) {
    operationError.value = friendlyError(error);
    return false;
  }
}
export function projectName(id: string) {
  return projects.value.find((p) => p.id === id)?.name ?? "Unavailable project";
}
