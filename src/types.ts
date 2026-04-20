import type { AgentMail } from "agentmail";

export const STATE_NAMESPACE = "agentmail";
export const COMPANY_CONFIG_KEY = "company-config";
export const COMPANY_INBOX_METADATA_KEY = "company-inbox-metadata";

export type InboxPurpose = "signup" | "ops" | "support" | "marketing" | "custom";

export type CompanyAgentMailConfig = {
  apiKeySecretRef?: string;
  podId?: string;
  podClientId?: string;
  podName?: string;
  defaultDomain?: string;
  defaultDisplayName?: string;
  signupPrefix?: string;
  updatedAt: string;
};

export type CompanyInboxMetadata = {
  inboxId: string;
  purpose: InboxPurpose;
  serviceName?: string;
  label?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type CompanyInboxRecord = {
  inbox: AgentMail.inboxes.Inbox;
  metadata?: CompanyInboxMetadata;
};

export type CompanyMailOverview = {
  companyId: string;
  configured: boolean;
  config: CompanyAgentMailConfig | null;
  pod: AgentMail.pods.Pod | null;
  inboxes: CompanyInboxRecord[];
  warnings: string[];
};

export type CompanyInboxMessages = {
  companyId: string;
  inboxId: string;
  count: number;
  nextPageToken?: string;
  messages: AgentMail.MessageItem[];
};

export type MessageDetailResponse = {
  companyId: string;
  inboxId: string;
  message: AgentMail.Message;
};

export type VerificationCodeResult = {
  inboxId: string;
  messageId: string;
  code: string;
  subject?: string;
  from?: string[];
  matchedField: "subject" | "preview" | "text" | "extractedText";
};
