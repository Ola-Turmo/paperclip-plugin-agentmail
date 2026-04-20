import { definePlugin, runWorker, type PluginContext, type ToolResult } from "@paperclipai/plugin-sdk";
import { createInboxForCompany, ensureCompanyPod, findVerificationCode, getMessageDetail, listCompanyInboxes, listMessagesForInbox, replyToMessage, reserveSignupInbox, sendMessageFromInbox } from "./agentmail-client.js";
import { loadCompanyConfig, saveCompanyConfig } from "./state.js";
import type { CompanyAgentMailConfig } from "./types.js";

function requireCompanyId(input: Record<string, unknown>) {
  const companyId = typeof input.companyId === "string" ? input.companyId.trim() : "";
  if (!companyId) throw new Error("companyId is required");
  return companyId;
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function formatAddressField(value: string | string[] | undefined) {
  return Array.isArray(value) ? value.join(", ") : (value ?? "");
}

async function registerData(ctx: PluginContext) {
  ctx.data.register("companyMailOverview", async (params) => {
    const companyId = requireCompanyId(params as Record<string, unknown>);
    return await listCompanyInboxes(ctx, companyId);
  });

  ctx.data.register("companyInboxMessages", async (params) => {
    const payload = params as Record<string, unknown>;
    const companyId = requireCompanyId(payload);
    const inboxId = normalizeString(payload.inboxId);
    if (!inboxId) throw new Error("inboxId is required");
    const limit = typeof payload.limit === "number" ? payload.limit : 25;
    return await listMessagesForInbox(ctx, companyId, inboxId, limit);
  });

  ctx.data.register("companyMessageDetail", async (params) => {
    const payload = params as Record<string, unknown>;
    const companyId = requireCompanyId(payload);
    const inboxId = normalizeString(payload.inboxId);
    const messageId = normalizeString(payload.messageId);
    if (!inboxId || !messageId) throw new Error("inboxId and messageId are required");
    return await getMessageDetail(ctx, companyId, inboxId, messageId);
  });
}

async function registerActions(ctx: PluginContext) {
  ctx.actions.register("saveCompanyConfig", async (params) => {
    const payload = params as Record<string, unknown>;
    const companyId = requireCompanyId(payload);
    const current = await loadCompanyConfig(ctx, companyId);
    const next: CompanyAgentMailConfig = {
      apiKeySecretRef: normalizeString(payload.apiKeySecretRef) ?? current?.apiKeySecretRef,
      podId: normalizeString(payload.podId) ?? current?.podId,
      podClientId: normalizeString(payload.podClientId) ?? current?.podClientId,
      podName: normalizeString(payload.podName) ?? current?.podName,
      defaultDomain: normalizeString(payload.defaultDomain) ?? current?.defaultDomain,
      defaultDisplayName: normalizeString(payload.defaultDisplayName) ?? current?.defaultDisplayName,
      signupPrefix: normalizeString(payload.signupPrefix) ?? current?.signupPrefix,
      updatedAt: new Date().toISOString(),
    };
    await saveCompanyConfig(ctx, companyId, next);
    return next;
  });

  ctx.actions.register("ensureCompanyPod", async (params) => {
    const payload = params as Record<string, unknown>;
    const companyId = requireCompanyId(payload);
    return await ensureCompanyPod(ctx, companyId, {
      apiKeySecretRef: normalizeString(payload.apiKeySecretRef),
      podClientId: normalizeString(payload.podClientId),
      podName: normalizeString(payload.podName),
      defaultDomain: normalizeString(payload.defaultDomain),
      defaultDisplayName: normalizeString(payload.defaultDisplayName),
      signupPrefix: normalizeString(payload.signupPrefix),
    });
  });

  ctx.actions.register("createCompanyInbox", async (params) => {
    const payload = params as Record<string, unknown>;
    const companyId = requireCompanyId(payload);
    return await createInboxForCompany(ctx, companyId, {
      username: normalizeString(payload.username),
      displayName: normalizeString(payload.displayName),
      domain: normalizeString(payload.domain),
      purpose: (normalizeString(payload.purpose) as "signup" | "ops" | "support" | "marketing" | "custom") ?? "custom",
      label: normalizeString(payload.label),
      serviceName: normalizeString(payload.serviceName),
      clientId: normalizeString(payload.clientId),
      tags: Array.isArray(payload.tags) ? payload.tags.filter((value): value is string => typeof value === "string") : [],
    });
  });

  ctx.actions.register("reserveSignupInbox", async (params) => {
    const payload = params as Record<string, unknown>;
    const companyId = requireCompanyId(payload);
    const serviceName = normalizeString(payload.serviceName);
    if (!serviceName) throw new Error("serviceName is required");
    return await reserveSignupInbox(ctx, companyId, serviceName, {
      label: normalizeString(payload.label),
      displayName: normalizeString(payload.displayName),
      username: normalizeString(payload.username),
      tags: Array.isArray(payload.tags) ? payload.tags.filter((value): value is string => typeof value === "string") : [],
    });
  });

  ctx.actions.register("sendCompanyMessage", async (params) => {
    const payload = params as Record<string, unknown>;
    const companyId = requireCompanyId(payload);
    const inboxId = normalizeString(payload.inboxId);
    const subject = normalizeString(payload.subject);
    if (!inboxId || !subject) throw new Error("inboxId and subject are required");
    return await sendMessageFromInbox(ctx, companyId, {
      inboxId,
      to: Array.isArray(payload.to) ? payload.to.filter((value): value is string => typeof value === "string") : [],
      cc: Array.isArray(payload.cc) ? payload.cc.filter((value): value is string => typeof value === "string") : undefined,
      bcc: Array.isArray(payload.bcc) ? payload.bcc.filter((value): value is string => typeof value === "string") : undefined,
      subject,
      text: normalizeString(payload.text),
      html: normalizeString(payload.html),
    });
  });

  ctx.actions.register("replyCompanyMessage", async (params) => {
    const payload = params as Record<string, unknown>;
    const companyId = requireCompanyId(payload);
    const inboxId = normalizeString(payload.inboxId);
    const messageId = normalizeString(payload.messageId);
    if (!inboxId || !messageId) throw new Error("inboxId and messageId are required");
    return await replyToMessage(ctx, companyId, {
      inboxId,
      messageId,
      text: normalizeString(payload.text),
      html: normalizeString(payload.html),
      replyAll: payload.replyAll === true,
    });
  });

  ctx.actions.register("detectVerificationCode", async (params) => {
    const payload = params as Record<string, unknown>;
    const companyId = requireCompanyId(payload);
    const inboxId = normalizeString(payload.inboxId);
    if (!inboxId) throw new Error("inboxId is required");
    return await findVerificationCode(ctx, companyId, inboxId);
  });
}

async function registerTools(ctx: PluginContext) {
  ctx.tools.register(
    "agentmail.reserve_signup_inbox",
    {
      displayName: "Reserve signup inbox",
      description: "Create or reuse a company-scoped AgentMail inbox for registering an external service.",
      parametersSchema: {
        type: "object",
        properties: {
          serviceName: { type: "string" },
          label: { type: "string" }
        },
        required: ["serviceName"]
      }
    },
    async (params, runCtx): Promise<ToolResult> => {
      try {
        const payload = params as { serviceName?: string; label?: string };
        if (!payload.serviceName) return { error: "serviceName is required" };
        const inbox = await reserveSignupInbox(ctx, runCtx.companyId, payload.serviceName, { label: payload.label });
        return {
          content: `Use ${inbox.email} for ${payload.serviceName} signups inside company ${runCtx.companyId}.`,
          data: inbox,
        };
      } catch (error) {
        return { error: error instanceof Error ? error.message : "AgentMail signup inbox reservation failed." };
      }
    },
  );

  ctx.tools.register(
    "agentmail.list_inboxes",
    {
      displayName: "List company inboxes",
      description: "List AgentMail inboxes available to the current company.",
      parametersSchema: { type: "object", properties: {} }
    },
    async (_params, runCtx): Promise<ToolResult> => {
      try {
        const overview = await listCompanyInboxes(ctx, runCtx.companyId);
        return {
          content: overview.inboxes.length
            ? overview.inboxes.map((row) => `- ${row.inbox.email}${row.metadata?.serviceName ? ` (${row.metadata.serviceName})` : ""}`).join("\n")
            : "No inboxes configured for this company yet.",
          data: overview,
        };
      } catch (error) {
        return { error: error instanceof Error ? error.message : "Failed to list inboxes." };
      }
    },
  );

  ctx.tools.register(
    "agentmail.list_messages",
    {
      displayName: "List inbox messages",
      description: "List recent messages in a company inbox.",
      parametersSchema: {
        type: "object",
        properties: {
          inboxId: { type: "string" },
          limit: { type: "number" }
        },
        required: ["inboxId"]
      }
    },
    async (params, runCtx): Promise<ToolResult> => {
      try {
        const payload = params as { inboxId?: string; limit?: number };
        if (!payload.inboxId) return { error: "inboxId is required" };
        const messages = await listMessagesForInbox(ctx, runCtx.companyId, payload.inboxId, payload.limit ?? 10);
        return {
          content: messages.messages.length
            ? messages.messages.map((message) => `- ${message.subject ?? "(no subject)"} from ${formatAddressField(message.from)}`).join("\n")
            : "No messages found.",
          data: messages,
        };
      } catch (error) {
        return { error: error instanceof Error ? error.message : "Failed to list messages." };
      }
    },
  );

  ctx.tools.register(
    "agentmail.find_verification_code",
    {
      displayName: "Find verification code",
      description: "Inspect recent inbox mail and return the most likely verification code.",
      parametersSchema: {
        type: "object",
        properties: {
          inboxId: { type: "string" }
        },
        required: ["inboxId"]
      }
    },
    async (params, runCtx): Promise<ToolResult> => {
      try {
        const payload = params as { inboxId?: string };
        if (!payload.inboxId) return { error: "inboxId is required" };
        const result = await findVerificationCode(ctx, runCtx.companyId, payload.inboxId);
        if (!result) {
          return { content: "No verification code found in the latest messages.", data: null };
        }
        return {
          content: `Verification code: ${result.code}`,
          data: result,
        };
      } catch (error) {
        return { error: error instanceof Error ? error.message : "Failed to scan for verification code." };
      }
    },
  );

  ctx.tools.register(
    "agentmail.send_message",
    {
      displayName: "Send email",
      description: "Send an email from a company inbox.",
      parametersSchema: {
        type: "object",
        properties: {
          inboxId: { type: "string" },
          to: { type: "array", items: { type: "string" } },
          subject: { type: "string" },
          text: { type: "string" }
        },
        required: ["inboxId", "to", "subject", "text"]
      }
    },
    async (params, runCtx): Promise<ToolResult> => {
      try {
        const payload = params as { inboxId?: string; to?: string[]; subject?: string; text?: string };
        if (!payload.inboxId || !payload.subject || !payload.text || !Array.isArray(payload.to) || payload.to.length === 0) {
          return { error: "inboxId, to, subject, and text are required" };
        }
        const response = await sendMessageFromInbox(ctx, runCtx.companyId, {
          inboxId: payload.inboxId,
          to: payload.to,
          subject: payload.subject,
          text: payload.text,
        });
        return {
          content: `Sent email from inbox ${payload.inboxId} to ${payload.to.join(", ")}.`,
          data: response,
        };
      } catch (error) {
        return { error: error instanceof Error ? error.message : "Failed to send email." };
      }
    },
  );
}

const plugin = definePlugin({
  async setup(ctx) {
    await registerData(ctx);
    await registerActions(ctx);
    await registerTools(ctx);
  },

  async onHealth() {
    return { status: "ok", message: "AgentMail plugin worker is ready." };
  }
});

export default plugin;
runWorker(plugin, import.meta.url);
