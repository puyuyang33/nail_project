import { AppointmentStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { blocksPublicAvailability, canAdminAccept } from "./status";

describe("appointment approval status", () => {
  it("keeps unaccepted requests visible as open time", () => {
    expect(blocksPublicAvailability(AppointmentStatus.PENDING)).toBe(false);
    expect(canAdminAccept(AppointmentStatus.PENDING)).toBe(true);
  });

  it("blocks public availability only after acceptance or payment hold", () => {
    expect(blocksPublicAvailability(AppointmentStatus.PENDING_PAYMENT)).toBe(
      true,
    );
    expect(blocksPublicAvailability(AppointmentStatus.CONFIRMED)).toBe(true);
    expect(blocksPublicAvailability(AppointmentStatus.IN_PROGRESS)).toBe(true);
    expect(blocksPublicAvailability(AppointmentStatus.CANCELED)).toBe(false);
  });
});
