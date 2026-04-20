import type { CompanyInboxMetadata, InboxPurpose } from "./types.js";

export function slugifySegment(value: string, fallback = "mail") {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);
  return normalized || fallback;
}

export function buildPodClientId(companyId: string) {
  return `paperclip-company-${companyId.slice(0, 8)}`;
}

export function buildSignupInboxClientId(serviceName: string) {
  return `signup-${slugifySegment(serviceName, "service")}`;
}

export function buildSignupUsername(prefix: string | undefined, serviceName: string) {
  const service = slugifySegment(serviceName, "service").replace(/-/g, "");
  const head = slugifySegment(prefix || "paperclip", "paperclip").replace(/-/g, "");
  return `${head}${service}`.slice(0, 32);
}

export function nowIso() {
  return new Date().toISOString();
}

export function mergeInboxMetadata(
  current: CompanyInboxMetadata | undefined,
  update: Partial<CompanyInboxMetadata> & Pick<CompanyInboxMetadata, "inboxId" | "purpose">,
): CompanyInboxMetadata {
  const createdAt = current?.createdAt ?? nowIso();
  return {
    inboxId: update.inboxId,
    purpose: update.purpose,
    serviceName: update.serviceName ?? current?.serviceName,
    label: update.label ?? current?.label,
    tags: Array.from(new Set(update.tags ?? current?.tags ?? [])).sort(),
    createdAt,
    updatedAt: nowIso(),
  };
}

const VERIFICATION_REGEXES: Array<{ regex: RegExp; score: number }> = [
  { regex: /\b(\d{6})\b/g, score: 30 },
  { regex: /\b(\d{4,8})\b/g, score: 20 },
  { regex: /\b([A-Z0-9]{6,8})\b/g, score: 10 },
];

const KEYWORD_BONUS = [
  "verify",
  "verification",
  "code",
  "otp",
  "one-time",
  "confirm",
  "security",
  "sign in",
];

export function extractBestVerificationCode(fields: Record<string, string | undefined>) {
  let best:
    | {
        code: string;
        matchedField: "subject" | "preview" | "text" | "extractedText";
        score: number;
      }
    | null = null;

  for (const [field, rawValue] of Object.entries(fields)) {
    if (!rawValue) continue;
    const value = rawValue.trim();
    const lower = value.toLowerCase();
    const keywordScore = KEYWORD_BONUS.some((keyword) => lower.includes(keyword)) ? 15 : 0;

    for (const candidate of VERIFICATION_REGEXES) {
      for (const match of value.matchAll(candidate.regex)) {
        const code = match[1];
        const score = candidate.score + keywordScore;
        if (!best || score > best.score) {
          best = {
            code,
            matchedField: field as "subject" | "preview" | "text" | "extractedText",
            score,
          };
        }
      }
    }
  }

  return best;
}

export function purposeLabel(purpose: InboxPurpose) {
  switch (purpose) {
    case "signup":
      return "Signup";
    case "ops":
      return "Ops";
    case "support":
      return "Support";
    case "marketing":
      return "Marketing";
    default:
      return "Custom";
  }
}
