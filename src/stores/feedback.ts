import { defineStore } from "pinia";
// Pinia owns transient feedback only. Workspace records remain sourced from Dexie live queries.
export const useFeedbackStore = defineStore("feedback", {
  state: () => ({ notice: "", operationError: "" }),
});
