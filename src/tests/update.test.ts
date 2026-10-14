import { mount } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import { beforeEach, afterAll, describe, it, expect, vi } from "vitest";
import { nextTick } from "vue";
import { db, initialize } from "../database/db";
import {
  workspace,
  ready,
  fatalError,
  timer,
  drafts,
  operationError,
  preferences,
} from "../composables/workspace";
import { pendingDrafts } from "../composables/draft";
import { seed } from "./fixtures";
const update = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("virtual:pwa-register/vue", async () => {
  const { ref } = await import("vue");
  return {
    useRegisterSW: () => ({
      offlineReady: ref(false),
      needRefresh: ref(true),
      updateServiceWorker: update,
    }),
  };
});
import App from "../app/App.vue";
beforeEach(async () => {
  await db.delete();
  await initialize();
  await seed();
  workspace.value = await db.workspace.get("local");
  preferences.value = (await db.settings.get("preferences"))!;
  ready.value = true;
  fatalError.value = "";
  timer.value = undefined;
  drafts.value = [];
  pendingDrafts.value.clear();
  operationError.value = "";
  update.mockClear();
});
afterAll(async () => {
  await db.delete();
});
describe("controlled service-worker updates", () => {
  it("keeps a waiting update from interrupting an uncommitted draft, then allows it after saving", async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/", component: { template: "<div>Workspace</div>" } }],
    });
    await router.push("/");
    await router.isReady();
    const wrapper = mount(App, { global: { plugins: [router] } });
    pendingDrafts.value.add("project:new");
    await nextTick();
    const button = wrapper
      .findAll("button")
      .find((b) => b.text() === "Update when ready")!;
    await button.trigger("click");
    expect(update).not.toHaveBeenCalled();
    expect(operationError.value).toContain("before updating");
    pendingDrafts.value.clear();
    await button.trigger("click");
    expect(update).toHaveBeenCalledWith(true);
    wrapper.unmount();
  });
});
