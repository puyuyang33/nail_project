import { describe, expect, it } from "vitest";
import {
  assertBookable,
  buildCandidateRange,
  hasConflict,
  isWithinBusinessHours,
} from "./availability";

describe("appointment availability", () => {
  it("detects overlapping appointments but allows adjacent slots", () => {
    const existing = [
      {
        start: new Date("2026-09-08T15:00:00.000Z"),
        end: new Date("2026-09-08T16:00:00.000Z"),
      },
    ];
    expect(
      hasConflict(
        {
          start: new Date("2026-09-08T15:30:00.000Z"),
          end: new Date("2026-09-08T16:30:00.000Z"),
        },
        existing,
      ),
    ).toBe(true);
    expect(
      hasConflict(
        {
          start: new Date("2026-09-08T16:00:00.000Z"),
          end: new Date("2026-09-08T17:00:00.000Z"),
        },
        existing,
      ),
    ).toBe(false);
  });

  it("converts studio time to UTC and includes preparation time", () => {
    const range = buildCandidateRange(
      "2026-09-08",
      "10:00",
      60,
      15,
      "America/Chicago",
    );
    expect(range.start.toISOString()).toBe("2026-09-08T15:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-09-08T16:15:00.000Z");
    expect(
      isWithinBusinessHours(range, "09:00", "19:00", "America/Chicago"),
    ).toBe(true);
  });

  it("rejects slots inside the booking lead time", () => {
    expect(() =>
      assertBookable(
        {
          start: new Date("2026-09-08T11:00:00.000Z"),
          end: new Date("2026-09-08T12:00:00.000Z"),
        },
        new Date("2026-09-08T10:00:00.000Z"),
        12,
      ),
    ).toThrow(/lead time/);
  });
});
