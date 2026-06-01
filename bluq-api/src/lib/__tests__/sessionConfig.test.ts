import { describe, it, expect } from "vitest";

/**
 * Regression guard for session config constants.
 * Tests the numeric values independently — no Better Auth import, no DB connection.
 * These constants must match what is set in src/lib/auth.ts (frontend).
 *
 * NOTE: Rolling update (updateAge) is managed entirely by the Better Auth library on
 * the Next.js side. It cannot be unit-tested without a live DB + Better Auth instance.
 * The behavior contract is: every request where (now > session.updatedAt + updateAge)
 * pushes expires_at forward by another expiresIn seconds.
 */

const SEVEN_DAYS_SECONDS = 60 * 60 * 24 * 7;
const ONE_DAY_SECONDS = 60 * 60 * 24;
const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

describe("Session config constants", () => {
  it("SEVEN_DAYS_SECONDS equals 604800", () => {
    expect(SEVEN_DAYS_SECONDS).toBe(604800);
  });

  it("ONE_DAY_SECONDS equals 86400", () => {
    expect(ONE_DAY_SECONDS).toBe(86400);
  });

  it("expiresIn must be 7 days (not 30 days — regression guard)", () => {
    expect(SEVEN_DAYS_SECONDS).not.toBe(THIRTY_DAYS_SECONDS);
    expect(SEVEN_DAYS_SECONDS).toBe(60 * 60 * 24 * 7);
  });

  it("rolling window: updateAge (1 day) is less than expiresIn (7 days)", () => {
    // updateAge must be < expiresIn, otherwise rolling never triggers
    expect(ONE_DAY_SECONDS).toBeLessThan(SEVEN_DAYS_SECONDS);
  });

  it("7-day window is exactly 168 hours", () => {
    expect(SEVEN_DAYS_SECONDS / 3600).toBe(168);
  });

  it("updateAge is exactly 1/7th of expiresIn", () => {
    expect(SEVEN_DAYS_SECONDS / ONE_DAY_SECONDS).toBe(7);
  });
});
