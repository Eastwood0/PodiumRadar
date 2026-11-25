import { describe, expect, it } from "vitest";
import { findSecrets } from "../scripts/check-secrets.mjs";

// Fixtures are split with "+" so this file itself passes the secret check.
describe("findSecrets", () => {
  it("flags an API key assignment", () => {
    expect(findSecrets("TICKETMASTER_API_KEY" + '="AbCdEf0123456789XyZ"')).toHaveLength(1);
    expect(findSecrets("apikey" + ": abcdefghijklmnop1234")).toHaveLength(1);
  });

  it("ignores empty or short placeholders", () => {
    expect(findSecrets("TICKETMASTER_API_KEY=")).toEqual([]);
    expect(findSecrets("token: ${{ secrets.X }}")).toEqual([]);
  });

  it("flags personal e-mail addresses but not allowed domains", () => {
    expect(findSecrets("contact: someone" + "@gmail.com")).toHaveLength(1);
    expect(findSecrets("allowlist noreply@notify.cloudflare.com and test@example.com")).toEqual([]);
  });
});
