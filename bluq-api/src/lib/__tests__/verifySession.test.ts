import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FastifyRequest, FastifyReply } from "fastify";

// Path is resolved relative to THIS test file (src/lib/__tests__/).
// "../../db/client.js" reaches src/db/client.ts — the same file verifySession.ts imports
// as "../db/client.js" from src/lib/. Both NodeNext .js extensions required.
vi.mock("../../db/client.js", () => ({
  db: {
    execute: vi.fn(),
  },
}));

// Import AFTER vi.mock so we get the mocked version
import { db } from "../../db/client.js";
import { verifySession } from "../verifySession.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(authHeader?: string): FastifyRequest {
  return {
    headers: { authorization: authHeader },
    userId: undefined,
  } as unknown as FastifyRequest;
}

function makeReply(): FastifyReply {
  const send = vi.fn().mockReturnThis();
  const status = vi.fn().mockReturnValue({ send });
  return { status, send } as unknown as FastifyReply;
}

type SessionRow = { user_id: string; expires_at: string };

function mockDbReturns(rows: SessionRow[]) {
  (db.execute as ReturnType<typeof vi.fn>).mockResolvedValueOnce(rows);
}

function mockDbThrows(err: Error) {
  (db.execute as ReturnType<typeof vi.fn>).mockRejectedValueOnce(err);
}

function futureDate(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

function pastDate(offsetMs: number): string {
  return new Date(Date.now() - offsetMs).toISOString();
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const SEVEN_DAYS = 7 * DAY;

const VALID_USER_ID = "a1b2c3d4-0000-0000-0000-000000000001";
const VALID_TOKEN = "Bearer valid-opaque-token";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe("verifySession — Authorization header validation", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const req = makeRequest(undefined);
    const rep = makeReply();
    await verifySession(req, rep);
    expect(rep.status).toHaveBeenCalledWith(401);
  });

  it("returns 401 when Authorization header lacks Bearer prefix", async () => {
    const req = makeRequest("Token abc123");
    const rep = makeReply();
    await verifySession(req, rep);
    expect(rep.status).toHaveBeenCalledWith(401);
  });

  it("returns 401 when Authorization is 'Bearer ' with empty token", async () => {
    const req = makeRequest("Bearer ");
    const rep = makeReply();
    // An empty token still passes the startsWith check but slice(7) yields ""
    // verifySession passes "" to the DB query — DB returns no rows → 401
    mockDbReturns([]);
    await verifySession(req, rep);
    expect(rep.status).toHaveBeenCalledWith(401);
  });

  it("returns 401 when Authorization uses a non-Bearer scheme", async () => {
    const req = makeRequest("Basic dXNlcjpwYXNz");
    const rep = makeReply();
    await verifySession(req, rep);
    expect(rep.status).toHaveBeenCalledWith(401);
  });

  it("does NOT call db.execute when Authorization header is missing", async () => {
    const req = makeRequest(undefined);
    const rep = makeReply();
    await verifySession(req, rep);
    expect(db.execute).not.toHaveBeenCalled();
  });
});

describe("verifySession — Token DB lookup", () => {
  it("returns 401 when token is not found in DB (empty rows)", async () => {
    mockDbReturns([]);
    const req = makeRequest(VALID_TOKEN);
    const rep = makeReply();
    await verifySession(req, rep);
    expect(rep.status).toHaveBeenCalledWith(401);
    expect((rep.status as ReturnType<typeof vi.fn>)(401).send).toHaveBeenCalledWith({
      error: "Invalid session",
    });
  });

  it("returns 500 when DB throws an error", async () => {
    mockDbThrows(new Error("connection refused"));
    const req = makeRequest(VALID_TOKEN);
    const rep = makeReply();
    await verifySession(req, rep);
    expect(rep.status).toHaveBeenCalledWith(500);
    expect((rep.status as ReturnType<typeof vi.fn>)(500).send).toHaveBeenCalledWith({
      error: "Auth check failed",
    });
  });

  it("calls db.execute exactly once per request", async () => {
    mockDbReturns([{ user_id: VALID_USER_ID, expires_at: futureDate(DAY) }]);
    const req = makeRequest(VALID_TOKEN);
    const rep = makeReply();
    await verifySession(req, rep);
    expect(db.execute).toHaveBeenCalledTimes(1);
  });
});

describe("verifySession — Session expiry", () => {
  it("returns 401 when session expired 7 days + 1 second ago (inactivity window exceeded)", async () => {
    mockDbReturns([{ user_id: VALID_USER_ID, expires_at: pastDate(SEVEN_DAYS + SECOND) }]);
    const req = makeRequest(VALID_TOKEN);
    const rep = makeReply();
    await verifySession(req, rep);
    expect(rep.status).toHaveBeenCalledWith(401);
    expect((rep.status as ReturnType<typeof vi.fn>)(401).send).toHaveBeenCalledWith({
      error: "Session expired",
    });
  });

  it("returns 401 when expires_at is 1 second in the past", async () => {
    mockDbReturns([{ user_id: VALID_USER_ID, expires_at: pastDate(SECOND) }]);
    const req = makeRequest(VALID_TOKEN);
    const rep = makeReply();
    await verifySession(req, rep);
    expect(rep.status).toHaveBeenCalledWith(401);
  });

  it("returns 401 at the exact expiry boundary (expires_at === Date.now())", async () => {
    // new Date(expires_at) < new Date() — at exact equality this is false, so session is still valid.
    // We test 1ms in the past to represent "just expired".
    mockDbReturns([{ user_id: VALID_USER_ID, expires_at: pastDate(1) }]);
    const req = makeRequest(VALID_TOKEN);
    const rep = makeReply();
    await verifySession(req, rep);
    expect(rep.status).toHaveBeenCalledWith(401);
  });

  it("passes when expires_at is 1 second from now", async () => {
    mockDbReturns([{ user_id: VALID_USER_ID, expires_at: futureDate(SECOND) }]);
    const req = makeRequest(VALID_TOKEN);
    const rep = makeReply();
    await verifySession(req, rep);
    expect(rep.status).not.toHaveBeenCalled();
  });

  it("passes when expires_at is 6 days 23 hours 59 minutes from now (well within window)", async () => {
    mockDbReturns([{ user_id: VALID_USER_ID, expires_at: futureDate(SEVEN_DAYS - MINUTE) }]);
    const req = makeRequest(VALID_TOKEN);
    const rep = makeReply();
    await verifySession(req, rep);
    expect(rep.status).not.toHaveBeenCalled();
  });

  it("passes when expires_at is exactly 7 days from now (rolling just renewed)", async () => {
    mockDbReturns([{ user_id: VALID_USER_ID, expires_at: futureDate(SEVEN_DAYS) }]);
    const req = makeRequest(VALID_TOKEN);
    const rep = makeReply();
    await verifySession(req, rep);
    expect(rep.status).not.toHaveBeenCalled();
  });
});

describe("verifySession — Successful session", () => {
  it("sets request.userId to the user_id from the session row", async () => {
    mockDbReturns([{ user_id: VALID_USER_ID, expires_at: futureDate(DAY) }]);
    const req = makeRequest(VALID_TOKEN);
    const rep = makeReply();
    await verifySession(req, rep);
    expect(req.userId).toBe(VALID_USER_ID);
  });

  it("does NOT call reply.status() when session is valid", async () => {
    mockDbReturns([{ user_id: VALID_USER_ID, expires_at: futureDate(DAY) }]);
    const req = makeRequest(VALID_TOKEN);
    const rep = makeReply();
    await verifySession(req, rep);
    expect(rep.status).not.toHaveBeenCalled();
  });

  it("does NOT call reply.send() when session is valid", async () => {
    mockDbReturns([{ user_id: VALID_USER_ID, expires_at: futureDate(DAY) }]);
    const req = makeRequest(VALID_TOKEN);
    const rep = makeReply();
    await verifySession(req, rep);
    expect(rep.send).not.toHaveBeenCalled();
  });
});

describe("verifySession — Security scenarios", () => {
  it("returns 401 for a revoked/deleted session (no rows — simulates post-logout token reuse)", async () => {
    // After logout, the session row is deleted. Any subsequent request with the old token
    // finds no rows and receives 401 — the token cannot be reused.
    mockDbReturns([]);
    const req = makeRequest(VALID_TOKEN);
    const rep = makeReply();
    await verifySession(req, rep);
    expect(rep.status).toHaveBeenCalledWith(401);
    expect((rep.status as ReturnType<typeof vi.fn>)(401).send).toHaveBeenCalledWith({
      error: "Invalid session",
    });
  });

  it("returns 401 for a tampered/malformed token that matches no DB row", async () => {
    mockDbReturns([]);
    const req = makeRequest("Bearer tampered-or-random-garbage-token");
    const rep = makeReply();
    await verifySession(req, rep);
    expect(rep.status).toHaveBeenCalledWith(401);
  });

  it("returns 401 for a session belonging to a deleted user (cascade removes session row)", async () => {
    // ON DELETE CASCADE on session.user_id means deleting the user removes all their sessions.
    // The token lookup returns no rows → 401.
    mockDbReturns([]);
    const req = makeRequest(VALID_TOKEN);
    const rep = makeReply();
    await verifySession(req, rep);
    expect(rep.status).toHaveBeenCalledWith(401);
  });

  it("handles concurrent calls: all inject userId when token is valid", async () => {
    // Simulate 5 concurrent requests sharing the same valid session token.
    // Each call gets its own DB mock response.
    for (let i = 0; i < 5; i++) {
      mockDbReturns([{ user_id: VALID_USER_ID, expires_at: futureDate(DAY) }]);
    }

    const requests = Array.from({ length: 5 }, () => makeRequest(VALID_TOKEN));
    const replies = requests.map(() => makeReply());

    await Promise.all(requests.map((req, i) => verifySession(req, replies[i])));

    for (const req of requests) {
      expect(req.userId).toBe(VALID_USER_ID);
    }
    for (const rep of replies) {
      expect(rep.status).not.toHaveBeenCalled();
    }
  });

  it("expired session token returns 401, not 200", async () => {
    mockDbReturns([{ user_id: VALID_USER_ID, expires_at: pastDate(SECOND) }]);
    const req = makeRequest(VALID_TOKEN);
    const rep = makeReply();
    await verifySession(req, rep);
    expect(rep.status).toHaveBeenCalledWith(401);
    expect(rep.status).not.toHaveBeenCalledWith(200);
  });
});

describe("verifySession — Session isolation", () => {
  const USER_A = "aaaaaaaa-0000-0000-0000-000000000001";
  const USER_B = "bbbbbbbb-0000-0000-0000-000000000002";
  const TOKEN_A = "Bearer token-for-user-a";
  const TOKEN_B = "Bearer token-for-user-b";

  it("two tokens for the same user_id resolve independently to the same userId", async () => {
    const TOKEN_A2 = "Bearer second-token-same-user";
    mockDbReturns([{ user_id: USER_A, expires_at: futureDate(DAY) }]);
    mockDbReturns([{ user_id: USER_A, expires_at: futureDate(2 * DAY) }]);

    const req1 = makeRequest(TOKEN_A);
    const req2 = makeRequest(TOKEN_A2);
    const rep1 = makeReply();
    const rep2 = makeReply();

    await verifySession(req1, rep1);
    await verifySession(req2, rep2);

    expect(req1.userId).toBe(USER_A);
    expect(req2.userId).toBe(USER_A);
    expect(rep1.status).not.toHaveBeenCalled();
    expect(rep2.status).not.toHaveBeenCalled();
  });

  it("an expired session for user A does not affect a valid session for user B", async () => {
    mockDbReturns([{ user_id: USER_A, expires_at: pastDate(SECOND) }]);
    mockDbReturns([{ user_id: USER_B, expires_at: futureDate(DAY) }]);

    const reqA = makeRequest(TOKEN_A);
    const reqB = makeRequest(TOKEN_B);
    const repA = makeReply();
    const repB = makeReply();

    await verifySession(reqA, repA);
    await verifySession(reqB, repB);

    expect(repA.status).toHaveBeenCalledWith(401);
    expect(reqB.userId).toBe(USER_B);
    expect(repB.status).not.toHaveBeenCalled();
  });

  it("revoking one session (no rows) does not affect a different session for the same user", async () => {
    mockDbReturns([]);                                                             // token A revoked
    mockDbReturns([{ user_id: USER_A, expires_at: futureDate(DAY) }]);             // token A2 still valid

    const TOKEN_A2 = "Bearer second-active-token-same-user";
    const reqRevoked = makeRequest(TOKEN_A);
    const reqActive  = makeRequest(TOKEN_A2);
    const repRevoked = makeReply();
    const repActive  = makeReply();

    await verifySession(reqRevoked, repRevoked);
    await verifySession(reqActive, repActive);

    expect(repRevoked.status).toHaveBeenCalledWith(401);
    expect(reqActive.userId).toBe(USER_A);
    expect(repActive.status).not.toHaveBeenCalled();
  });
});
