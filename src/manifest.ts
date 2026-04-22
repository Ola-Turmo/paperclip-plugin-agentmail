import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "ola-turmo.paperclip-plugin-agentmail",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "AgentMail",
  description: "Company-scoped email infrastructure for Paperclip agents with pod isolation, visual inboxes, and signup-ready inbox provisioning.",
  author: "Ola Turmo",
  categories: ["connector", "automation", "ui"],
  capabilities: [
    "companies.read",
    "plugin.state.read",
    "plugin.state.write",
    "agent.tools.register",
    "ui.dashboardWidget.register",
    "ui.page.register",
    "secrets.read-ref"
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui"
  },
  ui: {
    slots: [
      {
        type: "dashboardWidget",
        id: "agentmail-overview",
        displayName: "AgentMail",
        exportName: "DashboardWidget"
      },
      {
        type: "page",
        id: "agentmail-company-page",
        displayName: "AgentMail Inboxes",
        exportName: "CompanyAgentMailPage",
        routePath: "agentmail"
      }
    ]
  }
};

export default manifest;
