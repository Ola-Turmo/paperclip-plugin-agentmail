import * as React from "react";
import { useMemo, useState, type CSSProperties } from "react";
import {
  useHostContext,
  usePluginAction,
  usePluginData,
  usePluginToast,
  type PluginPageProps,
  type PluginWidgetProps,
} from "@paperclipai/plugin-sdk/ui";
import type { CompanyInboxMessages, CompanyMailOverview, MessageDetailResponse } from "../types.js";

const CARD: CSSProperties = {
  border: "1px solid rgba(15, 23, 42, 0.08)",
  borderRadius: 16,
  padding: 16,
  background: "rgba(255,255,255,0.92)",
};

function CompanyScopeRequired(props: { companyId?: string | null }) {
  if (props.companyId) return null;
  return (
    <div style={{ ...CARD, background: "#fff7ed", borderColor: "#fdba74" }}>
      <strong>Open AgentMail inside a company</strong>
      <div style={{ marginTop: 6, color: "#9a3412" }}>
        AgentMail is intentionally company-scoped. Open this page from a company route to manage its pod, inboxes,
        and signup mail.
      </div>
    </div>
  );
}

function formatAddressField(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) return value.join(", ");
  return value ?? "";
}

export function DashboardWidget(props: PluginWidgetProps) {
  const context = useHostContext();
  const companyId = context.companyId;
  const overview = usePluginData<CompanyMailOverview>("companyMailOverview", companyId ? { companyId } : {});
  if (!companyId) return <div>Open inside a company to use AgentMail.</div>;
  if (overview.loading) return <div>Loading AgentMail…</div>;
  if (overview.error) return <div>AgentMail error: {overview.error.message}</div>;
  const data = overview.data;
  if (!data) return <div>No AgentMail data yet.</div>;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <strong>AgentMail</strong>
      <div>{data.configured ? "Configured" : "Needs setup"}</div>
      <div>{data.pod ? `Pod: ${data.pod.name}` : "No pod yet"}</div>
      <div>{data.inboxes.length} inbox{data.inboxes.length === 1 ? "" : "es"}</div>
      {data.inboxes.slice(0, 3).map((row) => (
        <div key={row.inbox.inboxId} style={{ fontSize: 12, color: "#475569" }}>
          - {row.inbox.email}
        </div>
      ))}
    </div>
  );
}

export function CompanyAgentMailPage(props: PluginPageProps) {
  const context = useHostContext();
  const companyId = context.companyId;
  const toast = usePluginToast();
  const saveConfig = usePluginAction("saveCompanyConfig");
  const ensurePod = usePluginAction("ensureCompanyPod");
  const createInbox = usePluginAction("createCompanyInbox");
  const reserveSignupInbox = usePluginAction("reserveSignupInbox");
  const sendMessage = usePluginAction("sendCompanyMessage");
  const replyMessage = usePluginAction("replyCompanyMessage");
  const detectVerificationCode = usePluginAction("detectVerificationCode");

  const overview = usePluginData<CompanyMailOverview>("companyMailOverview", companyId ? { companyId } : {});
  const [selectedInboxId, setSelectedInboxId] = useState<string>("");
  const messages = usePluginData<CompanyInboxMessages>(
    "companyInboxMessages",
    companyId && selectedInboxId ? { companyId, inboxId: selectedInboxId, limit: 25 } : {},
  );
  const [selectedMessageId, setSelectedMessageId] = useState<string>("");
  const messageDetail = usePluginData<MessageDetailResponse>(
    "companyMessageDetail",
    companyId && selectedInboxId && selectedMessageId
      ? { companyId, inboxId: selectedInboxId, messageId: selectedMessageId }
      : {},
  );

  const [configDraft, setConfigDraft] = useState({
    apiKeySecretRef: "",
    podClientId: "",
    podName: "",
    defaultDomain: "agentmail.to",
    defaultDisplayName: "",
    signupPrefix: "",
  });
  const [newInbox, setNewInbox] = useState({
    username: "",
    displayName: "",
    purpose: "custom",
    label: "",
    serviceName: "",
    clientId: "",
  });
  const [signupService, setSignupService] = useState("");
  const [composer, setComposer] = useState({
    to: "",
    subject: "",
    text: "",
  });
  const [replyText, setReplyText] = useState("");

  React.useEffect(() => {
    if (!overview.data?.config) return;
    setConfigDraft({
      apiKeySecretRef: overview.data.config.apiKeySecretRef ?? "",
      podClientId: overview.data.config.podClientId ?? "",
      podName: overview.data.config.podName ?? "",
      defaultDomain: overview.data.config.defaultDomain ?? "agentmail.to",
      defaultDisplayName: overview.data.config.defaultDisplayName ?? "",
      signupPrefix: overview.data.config.signupPrefix ?? "",
    });
    if (!selectedInboxId && overview.data.inboxes[0]) {
      setSelectedInboxId(overview.data.inboxes[0].inbox.inboxId);
    }
  }, [overview.data, selectedInboxId]);

  const inboxOptions = useMemo(() => overview.data?.inboxes ?? [], [overview.data]);

  async function runWithToast(label: string, callback: () => Promise<void>) {
    try {
      await callback();
      toast({ title: label, tone: "success" });
      overview.refresh();
      messages.refresh();
      messageDetail.refresh();
    } catch (error) {
      toast({
        title: `${label} failed`,
        body: error instanceof Error ? error.message : "Unknown error",
        tone: "error",
      });
    }
  }

  if (!companyId) return <CompanyScopeRequired companyId={companyId} />;

  return (
    <div style={{ display: "grid", gap: 16, padding: 12 }}>
      <CompanyScopeRequired companyId={companyId} />

      <div style={CARD}>
        <strong>AgentMail Setup</strong>
        <div style={{ marginTop: 8, color: "#475569" }}>
          Store the AgentMail API key in company secrets, then paste its secret UUID here. The plugin will create one
          AgentMail pod per company and keep signup inboxes isolated inside that pod.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10, marginTop: 12 }}>
          <input placeholder="AgentMail API key secret UUID" value={configDraft.apiKeySecretRef} onChange={(e) => setConfigDraft((current) => ({ ...current, apiKeySecretRef: e.target.value }))} />
          <input placeholder="Pod client id" value={configDraft.podClientId} onChange={(e) => setConfigDraft((current) => ({ ...current, podClientId: e.target.value }))} />
          <input placeholder="Pod name" value={configDraft.podName} onChange={(e) => setConfigDraft((current) => ({ ...current, podName: e.target.value }))} />
          <input placeholder="Default domain" value={configDraft.defaultDomain} onChange={(e) => setConfigDraft((current) => ({ ...current, defaultDomain: e.target.value }))} />
          <input placeholder="Default display name" value={configDraft.defaultDisplayName} onChange={(e) => setConfigDraft((current) => ({ ...current, defaultDisplayName: e.target.value }))} />
          <input placeholder="Signup username prefix" value={configDraft.signupPrefix} onChange={(e) => setConfigDraft((current) => ({ ...current, signupPrefix: e.target.value }))} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={() => void runWithToast("Saved AgentMail config", async () => {
            await saveConfig({ companyId, ...configDraft });
          })}>Save company config</button>
          <button onClick={() => void runWithToast("Ensured company pod", async () => {
            await ensurePod({ companyId, ...configDraft });
          })}>Ensure company pod</button>
        </div>
        {overview.data?.pod ? (
          <div style={{ marginTop: 10, color: "#0f766e" }}>
            Active pod: <strong>{overview.data.pod.name}</strong> ({overview.data.pod.podId})
          </div>
        ) : null}
        {(overview.data?.warnings ?? []).map((warning) => (
          <div key={warning} style={{ marginTop: 8, color: "#b45309" }}>{warning}</div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.2fr", gap: 16 }}>
        <div style={{ ...CARD, display: "grid", gap: 12 }}>
          <strong>Company Inboxes</strong>
          <div style={{ display: "grid", gap: 8 }}>
            <input placeholder="Reserve signup inbox for service" value={signupService} onChange={(e) => setSignupService(e.target.value)} />
            <button onClick={() => void runWithToast("Reserved signup inbox", async () => {
              await reserveSignupInbox({ companyId, serviceName: signupService });
              setSignupService("");
            })}>Reserve signup inbox</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8 }}>
            <input placeholder="username" value={newInbox.username} onChange={(e) => setNewInbox((current) => ({ ...current, username: e.target.value }))} />
            <input placeholder="display name" value={newInbox.displayName} onChange={(e) => setNewInbox((current) => ({ ...current, displayName: e.target.value }))} />
            <input placeholder="purpose" value={newInbox.purpose} onChange={(e) => setNewInbox((current) => ({ ...current, purpose: e.target.value }))} />
            <input placeholder="label" value={newInbox.label} onChange={(e) => setNewInbox((current) => ({ ...current, label: e.target.value }))} />
            <input placeholder="service name" value={newInbox.serviceName} onChange={(e) => setNewInbox((current) => ({ ...current, serviceName: e.target.value }))} />
            <input placeholder="client id" value={newInbox.clientId} onChange={(e) => setNewInbox((current) => ({ ...current, clientId: e.target.value }))} />
          </div>
          <button onClick={() => void runWithToast("Created inbox", async () => {
              await createInbox({ companyId, ...newInbox });
            })}>Create custom inbox</button>

          <div style={{ display: "grid", gap: 8 }}>
            {inboxOptions.map((row) => (
              <button
                key={row.inbox.inboxId}
                onClick={() => {
                  setSelectedInboxId(row.inbox.inboxId);
                  setSelectedMessageId("");
                }}
                style={{
                  textAlign: "left",
                  border: row.inbox.inboxId === selectedInboxId ? "2px solid #0f766e" : "1px solid rgba(15,23,42,0.12)",
                  borderRadius: 12,
                  padding: 12,
                  background: row.inbox.inboxId === selectedInboxId ? "#ecfdf5" : "#fff",
                }}
              >
                <div><strong>{row.inbox.email}</strong></div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  {row.metadata?.label ?? row.metadata?.serviceName ?? row.metadata?.purpose ?? "general"} {row.inbox.clientId ? `· ${row.inbox.clientId}` : ""}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div style={CARD}>
            <strong>Inbox Messages</strong>
            {!selectedInboxId ? (
              <div style={{ marginTop: 8, color: "#64748b" }}>Select an inbox to load its messages.</div>
            ) : messages.loading ? (
              <div style={{ marginTop: 8 }}>Loading messages…</div>
            ) : messages.error ? (
              <div style={{ marginTop: 8, color: "#b91c1c" }}>{messages.error.message}</div>
            ) : (
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                <button onClick={() => void runWithToast("Scanned verification mail", async () => {
                  const result = await detectVerificationCode({ companyId, inboxId: selectedInboxId }) as { code?: string; subject?: string } | null;
                  if (result?.code) {
                    toast({ title: `Verification code: ${result.code}`, body: result.subject, tone: "success" });
                  } else {
                    toast({ title: "No verification code found", tone: "warn" });
                  }
                })}>Find latest verification code</button>
                {(messages.data?.messages ?? []).map((message) => (
                  <button
                    key={message.messageId}
                    onClick={() => setSelectedMessageId(message.messageId)}
                    style={{
                      textAlign: "left",
                      border: message.messageId === selectedMessageId ? "2px solid #2563eb" : "1px solid rgba(15,23,42,0.12)",
                      borderRadius: 12,
                      padding: 12,
                      background: message.messageId === selectedMessageId ? "#eff6ff" : "#fff",
                    }}
                  >
                    <div><strong>{message.subject ?? "(no subject)"}</strong></div>
                    <div style={{ fontSize: 12, color: "#475569" }}>{formatAddressField(message.from)}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{message.preview ?? "No preview"}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={CARD}>
            <strong>Message Detail</strong>
            {!selectedMessageId ? (
              <div style={{ marginTop: 8, color: "#64748b" }}>Select a message to preview it.</div>
            ) : messageDetail.loading ? (
              <div style={{ marginTop: 8 }}>Loading message…</div>
            ) : messageDetail.error ? (
              <div style={{ marginTop: 8, color: "#b91c1c" }}>{messageDetail.error.message}</div>
            ) : (
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                <div><strong>{messageDetail.data?.message.subject ?? "(no subject)"}</strong></div>
                <div style={{ fontSize: 12, color: "#475569" }}>{formatAddressField(messageDetail.data?.message.from)}</div>
                <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", margin: 0, color: "#1e293b" }}>
                  {messageDetail.data?.message.extractedText ?? messageDetail.data?.message.text ?? "No extracted text"}
                </pre>
                <textarea rows={4} placeholder="Reply text" value={replyText} onChange={(e) => setReplyText(e.target.value)} />
                <button onClick={() => void runWithToast("Reply sent", async () => {
                  await replyMessage({ companyId, inboxId: selectedInboxId, messageId: selectedMessageId, text: replyText });
                  setReplyText("");
                })}>Reply</button>
              </div>
            )}
          </div>

          <div style={CARD}>
            <strong>Compose</strong>
            <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
              <input placeholder="to@example.com, second@example.com" value={composer.to} onChange={(e) => setComposer((current) => ({ ...current, to: e.target.value }))} />
              <input placeholder="Subject" value={composer.subject} onChange={(e) => setComposer((current) => ({ ...current, subject: e.target.value }))} />
              <textarea rows={5} placeholder="Message text" value={composer.text} onChange={(e) => setComposer((current) => ({ ...current, text: e.target.value }))} />
              <button onClick={() => void runWithToast("Email sent", async () => {
                await sendMessage({
                  companyId,
                  inboxId: selectedInboxId,
                  to: composer.to.split(",").map((value) => value.trim()).filter(Boolean),
                  subject: composer.subject,
                  text: composer.text,
                });
                setComposer({ to: "", subject: "", text: "" });
              })}>Send email</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
