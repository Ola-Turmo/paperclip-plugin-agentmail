import { describe, expect, it } from "vitest";
import { buildPodClientId, buildSignupInboxClientId, buildSignupUsername, extractBestVerificationCode } from "../src/helpers.js";

describe("AgentMail helper utilities", () => {
  it("builds stable company pod ids", () => {
    expect(buildPodClientId("12345678-aaaa-bbbb-cccc-ddddeeeeffff")).toBe("paperclip-company-12345678");
  });

  it("builds stable signup client ids and usernames", () => {
    expect(buildSignupInboxClientId("Google Search Console")).toBe("signup-google-search-console");
    expect(buildSignupUsername("kursing", "Google Search Console")).toBe("kursinggooglesearchconsole");
  });

  it("extracts a likely verification code from common message fields", () => {
    const result = extractBestVerificationCode({
      subject: "Your verification code is 482913",
      preview: undefined,
      text: undefined,
      extractedText: undefined,
    });
    expect(result?.code).toBe("482913");
    expect(result?.matchedField).toBe("subject");
  });
});
