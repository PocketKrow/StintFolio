import { mount } from "@vue/test-utils";
import { defineComponent, ref, nextTick } from "vue";
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { useDraft } from "../composables/draft";
import { db, initialize } from "../database/db";
import { saveDraft } from "../services/records";
import { seed } from "./fixtures";
beforeEach(async () => {
  await db.delete();
  await initialize();
  await seed();
});
afterAll(async () => {
  await db.delete();
});
function harness() {
  return mount(
    defineComponent({
      setup() {
        const form = ref({ name: "" });
        const id = ref<string | null>(null);
        const draft = useDraft("client", form, id);
        return { form, draft };
      },
      template:
        '<input v-model="form.name"><span role="status">{{ draft.status.value }}</span>',
    }),
  );
}
describe("recoverable Vue form drafts", () => {
  it("recovers saved input, flushes route exits, and discards without recreating a blank draft", async () => {
    await saveDraft({
      id: "client:new",
      version: 1,
      kind: "client",
      entityId: null,
      data: { name: "Unfinished" },
      updatedAt: 1000,
    });
    const wrapper = harness();
    await wrapper.vm.draft.load();
    await nextTick();
    expect(wrapper.get("input").element.value).toBe("Unfinished");
    await wrapper.get("input").setValue("Updated draft");
    await wrapper.vm.draft.flush();
    expect((await db.drafts.get("client:new"))?.data.name).toBe(
      "Updated draft",
    );
    await wrapper.vm.draft.discard({ name: "" });
    expect(await db.drafts.count()).toBe(0);
    await wrapper.vm.draft.flush();
    wrapper.unmount();
    expect(await db.drafts.count()).toBe(0);
  });
  it("does not race a pending autosave with a successful record commit", async () => {
    const wrapper = harness();
    await wrapper.vm.draft.load();
    await wrapper.get("input").setValue("Pending");
    await wrapper.vm.draft.beforeSave();
    await db.drafts.delete("client:new");
    wrapper.unmount();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(await db.drafts.count()).toBe(0);
  });
});
