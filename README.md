# Paperclip AgentMail Plugin

`paperclip-plugin-agentmail` gives each Paperclip company its own AgentMail pod and inbox layer so agents can:

- reserve signup inboxes for external services
- receive and inspect email per company
- send and reply from company-specific inboxes
- extract verification codes from recent mail
- keep all inbox usage inside the right company boundary

## Why this exists

Paperclip companies need operational email, but they should not share one global inbox surface. AgentMail already supports inboxes, pods, messages, and threaded email. This plugin turns that API into a company-scoped Paperclip service with an operator inbox page and agent tools.

## Main design

- One AgentMail pod per Paperclip company
- Many inboxes inside each company pod
- AgentMail API key stored as a Paperclip company secret
- Plugin stores only secret references and inbox metadata in company-scoped plugin state
- Agents use tools like `agentmail.reserve_signup_inbox`, `agentmail.list_messages`, and `agentmail.find_verification_code`

## Setup

1. Create an AgentMail API key.
2. Store it in Paperclip company secrets.
3. Open the `AgentMail Inboxes` page inside the target company.
4. Paste the company secret UUID into `AgentMail API key secret UUID`.
5. Click `Save company config`.
6. Click `Ensure company pod`.

After that you can create inboxes manually or use `Reserve signup inbox` for service-account creation flows.

## Agent workflows

- `agentmail.reserve_signup_inbox`
  Creates or reuses a signup inbox for a service inside the current company.
- `agentmail.list_inboxes`
  Lists available company inboxes.
- `agentmail.list_messages`
  Lists recent inbox mail.
- `agentmail.find_verification_code`
  Scans recent mail and returns the most likely code.
- `agentmail.send_message`
  Sends email from a company inbox.

## Operator UI

The plugin ships a company page with:

- company AgentMail setup and pod provisioning
- inbox creation and signup inbox reservation
- inbox message list
- message preview and reply
- compose/send surface

## Verification

```bash
npm install
npm run verify
```

## References

- [AgentMail quickstart](https://docs.agentmail.to/quickstart)
- [AgentMail TypeScript reference](https://github.com/agentmail-to/agentmail-node/blob/HEAD/reference.md)
