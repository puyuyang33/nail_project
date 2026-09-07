export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

export function normalizeContact(value: string) {
  return value.includes("@") ? normalizeEmail(value) : normalizePhone(value);
}
