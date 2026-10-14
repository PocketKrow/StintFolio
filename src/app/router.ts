import { createRouter, createWebHistory } from "vue-router";
import Overview from "../features/Overview.vue";
const routes = [
  { path: "/", component: Overview, meta: { title: "Overview" } },
  {
    path: "/timer",
    component: () => import("../features/Timer.vue"),
    meta: { title: "Timer" },
  },
  {
    path: "/timesheet",
    component: () => import("../features/Timesheet.vue"),
    meta: { title: "Timesheet" },
  },
  {
    path: "/projects",
    component: () => import("../features/Projects.vue"),
    meta: { title: "Projects" },
  },
  {
    path: "/clients",
    component: () => import("../features/Clients.vue"),
    meta: { title: "Clients" },
  },
  {
    path: "/settings",
    component: () => import("../features/Settings.vue"),
    meta: { title: "Preferences" },
  },
  {
    path: "/settings/data",
    component: () => import("../features/DataStorage.vue"),
    meta: { title: "Data & Storage" },
  },
  { path: "/:pathMatch(.*)*", redirect: "/" },
];
export const allowedRoutes = routes
  .filter((r) => !r.path.includes(":"))
  .map((r) => r.path);
export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});
