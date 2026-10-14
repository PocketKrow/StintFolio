export type StorageInfo = {
  usage: number | null;
  quota: number | null;
  persistent: boolean | null;
  message: string;
};
export async function storageInfo(): Promise<StorageInfo> {
  const info: StorageInfo = {
    usage: null,
    quota: null,
    persistent: null,
    message: "",
  };
  if (!navigator.storage) {
    info.message = "Storage diagnostics are unavailable in this browser.";
    return info;
  }
  const results = await Promise.allSettled([
    navigator.storage.estimate?.(),
    navigator.storage.persisted?.(),
  ]);
  const estimate = results[0],
    persistent = results[1];
  if (estimate.status === "fulfilled" && estimate.value) {
    info.usage = estimate.value.usage ?? null;
    info.quota = estimate.value.quota ?? null;
  }
  if (persistent.status === "fulfilled")
    info.persistent = persistent.value ?? null;
  if (results.some((r) => r.status === "rejected"))
    info.message =
      "Some storage diagnostics could not be read. Your records have not been changed.";
  return info;
}
export async function requestPersistence() {
  if (!navigator.storage?.persist)
    throw new Error(
      "Persistent storage requests are unsupported in this browser.",
    );
  return navigator.storage.persist();
}
export function bytes(value: number | null) {
  return value === null ? "Unavailable" : `${(value / 1048576).toFixed(2)} MiB`;
}
