export function parseGoogleAdminEmails(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isGoogleAdminEmail(
  email: string | null | undefined,
  configuredEmails: string | undefined,
) {
  return email
    ? parseGoogleAdminEmails(configuredEmails).has(email.trim().toLowerCase())
    : false;
}

export function isVerifiedGoogleProfile(profile: unknown) {
  if (!profile || typeof profile !== "object") return false;
  return (
    "email_verified" in profile &&
    profile.email_verified === true &&
    "email" in profile &&
    typeof profile.email === "string"
  );
}
