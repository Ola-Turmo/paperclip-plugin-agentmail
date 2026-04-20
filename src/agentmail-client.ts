import { AgentMailClient, type AgentMail } from "agentmail";
import type { PluginContext } from "@paperclipai/plugin-sdk";
import { buildPodClientId, buildSignupInboxClientId, buildSignupUsername, mergeInboxMetadata, nowIso, slugifySegment } from "./helpers.js";
import { loadCompanyConfig, loadInboxMetadata, saveCompanyConfig, saveInboxMetadata } from "./state.js";
import type { CompanyAgentMailConfig, CompanyInboxMetadata, CompanyInboxRecord, CompanyMailOverview, CompanyInboxMessages, MessageDetailResponse, VerificationCodeResult } from "./types.js";
import { extractBestVerificationCode } from "./helpers.js";

function companyScopedError(message: string) {
  return new Error(message);
}

export async function getClientForCompany(ctx: PluginContext, companyId: string) {
  const config = await loadCompanyConfig(ctx, companyId);
  if (!config?.apiKeySecretRef) {
    throw companyScopedError("AgentMail is not configured for this company. Save an AgentMail API key secret ref first.");
  }
  const apiKey = await ctx.secrets.resolve(config.apiKeySecretRef);
  return {
    client: new AgentMailClient({ apiKey }),
    config,
  };
}

async function getCompanyName(ctx: PluginContext, companyId: string) {
  const companies = await ctx.companies.list({ limit: 200, offset: 0 });
  return companies.find((company) => company.id === companyId)?.name ?? companyId;
}

async function findPodByClientId(client: AgentMailClient, clientId: string): Promise<AgentMail.pods.Pod | null> {
  let nextPageToken: string | undefined;
  do {
    const page = await client.pods.list({ limit: 100, pageToken: nextPageToken });
    const match = page.pods.find((pod) => pod.clientId === clientId);
    if (match) return match;
    nextPageToken = page.nextPageToken;
  } while (nextPageToken);
  return null;
}

export async function ensureCompanyPod(
  ctx: PluginContext,
  companyId: string,
  overrides?: Partial<CompanyAgentMailConfig>,
) {
  const companyName = await getCompanyName(ctx, companyId);
  const existingConfig = await loadCompanyConfig(ctx, companyId);
  const baseConfig: CompanyAgentMailConfig = {
    apiKeySecretRef: overrides?.apiKeySecretRef ?? existingConfig?.apiKeySecretRef,
    podId: existingConfig?.podId,
    podClientId: overrides?.podClientId ?? existingConfig?.podClientId ?? buildPodClientId(companyId),
    podName: overrides?.podName ?? existingConfig?.podName ?? `${companyName} Mail`,
    defaultDomain: overrides?.defaultDomain ?? existingConfig?.defaultDomain ?? "agentmail.to",
    defaultDisplayName: overrides?.defaultDisplayName ?? existingConfig?.defaultDisplayName ?? companyName,
    signupPrefix: overrides?.signupPrefix ?? existingConfig?.signupPrefix ?? slugifySegment(companyName, "paperclip"),
    updatedAt: nowIso(),
  };

  if (!baseConfig.apiKeySecretRef) {
    await saveCompanyConfig(ctx, companyId, baseConfig);
    return { config: baseConfig, pod: null };
  }

  const apiKey = await ctx.secrets.resolve(baseConfig.apiKeySecretRef);
  const client = new AgentMailClient({ apiKey });

  let pod: AgentMail.pods.Pod | null = null;
  if (baseConfig.podId) {
    try {
      pod = await client.pods.get(baseConfig.podId);
    } catch {
      pod = null;
    }
  }
  if (!pod) {
    pod = await findPodByClientId(client, baseConfig.podClientId!);
  }
  if (!pod) {
    pod = await client.pods.create({
      clientId: baseConfig.podClientId,
      name: baseConfig.podName,
    });
  }

  const nextConfig: CompanyAgentMailConfig = {
    ...baseConfig,
    podId: pod.podId,
    podClientId: pod.clientId ?? baseConfig.podClientId,
    podName: pod.name,
    updatedAt: nowIso(),
  };
  await saveCompanyConfig(ctx, companyId, nextConfig);
  return { config: nextConfig, pod };
}

export async function listCompanyInboxes(
  ctx: PluginContext,
  companyId: string,
): Promise<CompanyMailOverview> {
  const config = await loadCompanyConfig(ctx, companyId);
  if (!config?.apiKeySecretRef) {
    return {
      companyId,
      configured: false,
      config,
      pod: null,
      inboxes: [],
      warnings: ["Configure an AgentMail API key secret ref for this company to enable inbox provisioning."],
    };
  }

  const { client } = await getClientForCompany(ctx, companyId);
  const { config: ensuredConfig, pod } = await ensureCompanyPod(ctx, companyId);
  if (!pod) {
    return {
      companyId,
      configured: false,
      config: ensuredConfig,
      pod: null,
      inboxes: [],
      warnings: ["AgentMail pod could not be provisioned for this company."],
    };
  }

  const inboxPage = await client.pods.inboxes.list(pod.podId, { limit: 100 });
  const metadataRows = await loadInboxMetadata(ctx, companyId);
  const metadataById = new Map(metadataRows.map((row) => [row.inboxId, row]));

  return {
    companyId,
    configured: true,
    config: ensuredConfig,
    pod,
    inboxes: inboxPage.inboxes.map((inbox) => ({
      inbox,
      metadata: metadataById.get(inbox.inboxId),
    })),
    warnings: [],
  };
}

export async function createInboxForCompany(
  ctx: PluginContext,
  companyId: string,
  input: {
    username?: string;
    displayName?: string;
    domain?: string;
    purpose: CompanyInboxMetadata["purpose"];
    label?: string;
    serviceName?: string;
    clientId?: string;
    tags?: string[];
  },
) {
  const { client } = await getClientForCompany(ctx, companyId);
  const { config, pod } = await ensureCompanyPod(ctx, companyId);
  if (!pod) {
    throw companyScopedError("Company pod is not available.");
  }

  const inboxes = await client.pods.inboxes.list(pod.podId, { limit: 100 });
  const desiredClientId = input.clientId?.trim() || undefined;
  if (desiredClientId) {
    const existing = inboxes.inboxes.find((row) => row.clientId === desiredClientId);
    if (existing) {
      return existing;
    }
  }

  const created = await client.pods.inboxes.create(pod.podId, {
    username: input.username,
    displayName: input.displayName ?? config.defaultDisplayName,
    domain: input.domain ?? config.defaultDomain,
    clientId: desiredClientId,
  });

  const currentRows = await loadInboxMetadata(ctx, companyId);
  const nextRows = [
    ...currentRows.filter((row) => row.inboxId !== created.inboxId),
    mergeInboxMetadata(undefined, {
      inboxId: created.inboxId,
      purpose: input.purpose,
      serviceName: input.serviceName,
      label: input.label,
      tags: input.tags ?? [],
    }),
  ];
  await saveInboxMetadata(ctx, companyId, nextRows);
  return created;
}

export async function reserveSignupInbox(
  ctx: PluginContext,
  companyId: string,
  serviceName: string,
  options?: { label?: string; tags?: string[]; displayName?: string; username?: string },
) {
  const { config } = await ensureCompanyPod(ctx, companyId);
  const clientId = buildSignupInboxClientId(serviceName);
  const username = options?.username ?? buildSignupUsername(config.signupPrefix, serviceName);
  return await createInboxForCompany(ctx, companyId, {
    purpose: "signup",
    serviceName,
    label: options?.label ?? `${serviceName} signup`,
    tags: ["signup", slugifySegment(serviceName, "service"), ...(options?.tags ?? [])],
    displayName: options?.displayName ?? `${config.defaultDisplayName} Signup`,
    username,
    clientId,
  });
}

export async function listMessagesForInbox(
  ctx: PluginContext,
  companyId: string,
  inboxId: string,
  limit = 25,
): Promise<CompanyInboxMessages> {
  const { client } = await getClientForCompany(ctx, companyId);
  const page = await client.inboxes.messages.list(inboxId, { limit });
  return {
    companyId,
    inboxId,
    count: page.count,
    nextPageToken: page.nextPageToken,
    messages: page.messages,
  };
}

export async function getMessageDetail(
  ctx: PluginContext,
  companyId: string,
  inboxId: string,
  messageId: string,
): Promise<MessageDetailResponse> {
  const { client } = await getClientForCompany(ctx, companyId);
  const message = await client.inboxes.messages.get(inboxId, messageId);
  return { companyId, inboxId, message };
}

export async function sendMessageFromInbox(
  ctx: PluginContext,
  companyId: string,
  input: {
    inboxId: string;
    to: string[];
    subject: string;
    text?: string;
    html?: string;
    cc?: string[];
    bcc?: string[];
  },
) {
  const { client } = await getClientForCompany(ctx, companyId);
  return await client.inboxes.messages.send(input.inboxId, {
    to: input.to,
    cc: input.cc,
    bcc: input.bcc,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}

export async function replyToMessage(
  ctx: PluginContext,
  companyId: string,
  input: {
    inboxId: string;
    messageId: string;
    text?: string;
    html?: string;
    replyAll?: boolean;
  },
) {
  const { client } = await getClientForCompany(ctx, companyId);
  return await client.inboxes.messages.reply(input.inboxId, input.messageId, {
    text: input.text,
    html: input.html,
    replyAll: input.replyAll,
  });
}

export async function findVerificationCode(
  ctx: PluginContext,
  companyId: string,
  inboxId: string,
): Promise<VerificationCodeResult | null> {
  const { client } = await getClientForCompany(ctx, companyId);
  const page = await client.inboxes.messages.list(inboxId, { limit: 10 });

  for (const item of page.messages) {
    const message = await client.inboxes.messages.get(inboxId, item.messageId);
    const best = extractBestVerificationCode({
      subject: message.subject,
      preview: message.preview,
      text: message.text,
      extractedText: message.extractedText,
    });
    if (best) {
      return {
        inboxId,
        messageId: item.messageId,
        code: best.code,
        subject: message.subject,
        from: Array.isArray(message.from) ? message.from : undefined,
        matchedField: best.matchedField,
      };
    }
  }

  return null;
}

export function mergeOverviewInboxes(
  inboxes: AgentMail.inboxes.Inbox[],
  metadataRows: CompanyInboxMetadata[],
): CompanyInboxRecord[] {
  const metadataById = new Map(metadataRows.map((row) => [row.inboxId, row]));
  return inboxes.map((inbox) => ({
    inbox,
    metadata: metadataById.get(inbox.inboxId),
  }));
}
