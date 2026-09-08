import { describe, expect, it } from "vitest";
import {
  isGoogleAdminEmail,
  isVerifiedGoogleProfile,
  parseGoogleAdminEmails,
} from "./google";

describe("Google account policy", () => {
  it("normalizes the administrator allowlist", () => {
    expect([
      ...parseGoogleAdminEmails("Owner@Example.com, admin@example.com "),
    ]).toEqual(["owner@example.com", "admin@example.com"]);
    expect(isGoogleAdminEmail("OWNER@example.com", "owner@example.com")).toBe(
      true,
    );
  });

  it("requires Google's verified-email claim", () => {
    expect(
      isVerifiedGoogleProfile({
        email: "customer@example.com",
        email_verified: true,
      }),
    ).toBe(true);
    expect(
      isVerifiedGoogleProfile({
        email: "customer@example.com",
        email_verified: false,
      }),
    ).toBe(false);
  });
});
