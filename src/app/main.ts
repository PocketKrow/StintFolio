import { createApp } from "vue";
import { pinia } from "./pinia";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "../styles/global.scss";
import App from "./App.vue";
import { router, allowedRoutes } from "./router";
import {
  boot,
  preferences,
  fatalError,
  workspace,
} from "../composables/workspace";
import { saveSettings } from "../services/records";
async function start() {
  createApp(App).use(pinia).use(router).mount("#app");
  await router.isReady();
  await boot();
  // Explicit deep links win; a normal root launch recovers the last meaningful section.
  if (
    !fatalError.value &&
    location.pathname === "/" &&
    allowedRoutes.includes(preferences.value.lastRoute)
  )
    await router.replace(preferences.value.lastRoute);
  if (
    !fatalError.value &&
    allowedRoutes.includes(router.currentRoute.value.path)
  ) {
    await saveSettings({ lastRoute: router.currentRoute.value.path }).catch(
      () => window.dispatchEvent(new Event("stintfolio:route-save-failed")),
    );
  }
  router.afterEach((to) => {
    if (!fatalError.value && workspace.value && allowedRoutes.includes(to.path))
      void saveSettings({ lastRoute: to.path }).catch(() => {
        /* Navigation stays available; App surfaces write failures via the event. */ window.dispatchEvent(
          new Event("stintfolio:route-save-failed"),
        );
      });
  });
}
void start();
