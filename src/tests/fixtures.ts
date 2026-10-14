import { createWorkspace, saveClient, saveProject } from "../services/records";
import type { Client, Project, TimeEntry } from "../database/schema";
export const client: Client = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Test client",
  email: "client@example.test",
  contact: "",
  address: "",
  notes: "",
  currency: "USD",
  hourlyRateMinor: 6000,
  createdAt: 1000,
  updatedAt: 1000,
};
export const project: Project = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Test project",
  clientId: client.id,
  description: "",
  billing: "hourly",
  currency: "USD",
  hourlyRateMinor: null,
  fixedFeeMinor: null,
  estimatedHours: null,
  budgetMinor: null,
  status: "active",
  createdAt: 1000,
  updatedAt: 1000,
};
export function entry(): TimeEntry {
  return {
    id: crypto.randomUUID(),
    projectId: project.id,
    description: "Work",
    billable: true,
    startedAt: 1000,
    endedAt: 3601000,
    durationMs: 3600000,
    rateMinor: 6000,
    currency: "USD",
    source: "manual",
    invoiceId: null,
    createdAt: 1000,
    updatedAt: 1000,
  };
}
export async function seed() {
  await createWorkspace({
    id: "local",
    name: "Test studio",
    currency: "USD",
    hourlyRateMinor: 5000,
    createdAt: 1000,
  });
  await saveClient(client, "client:new");
  await saveProject(project, "project:new");
}
