import type { PluginContext } from "@paperclipai/plugin-sdk";
import {
  COMPANY_CONFIG_KEY,
  COMPANY_INBOX_METADATA_KEY,
  STATE_NAMESPACE,
  type CompanyAgentMailConfig,
  type CompanyInboxMetadata,
} from "./types.js";

export async function loadCompanyConfig(ctx: PluginContext, companyId: string): Promise<CompanyAgentMailConfig | null> {
  const state = await ctx.state.get({
    scopeKind: "company",
    scopeId: companyId,
    namespace: STATE_NAMESPACE,
    stateKey: COMPANY_CONFIG_KEY,
  });
  return state && typeof state === "object" ? state as CompanyAgentMailConfig : null;
}

export async function saveCompanyConfig(ctx: PluginContext, companyId: string, config: CompanyAgentMailConfig) {
  await ctx.state.set(
    {
      scopeKind: "company",
      scopeId: companyId,
      namespace: STATE_NAMESPACE,
      stateKey: COMPANY_CONFIG_KEY,
    },
    config,
  );
}

export async function loadInboxMetadata(ctx: PluginContext, companyId: string): Promise<CompanyInboxMetadata[]> {
  const state = await ctx.state.get({
    scopeKind: "company",
    scopeId: companyId,
    namespace: STATE_NAMESPACE,
    stateKey: COMPANY_INBOX_METADATA_KEY,
  });
  return Array.isArray(state) ? state as CompanyInboxMetadata[] : [];
}

export async function saveInboxMetadata(ctx: PluginContext, companyId: string, rows: CompanyInboxMetadata[]) {
  await ctx.state.set(
    {
      scopeKind: "company",
      scopeId: companyId,
      namespace: STATE_NAMESPACE,
      stateKey: COMPANY_INBOX_METADATA_KEY,
    },
    rows,
  );
}
