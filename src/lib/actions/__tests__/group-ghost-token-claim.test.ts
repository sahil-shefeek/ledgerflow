import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockInsertValues,
  mockUpdateSet,
  mockTx,
  mockDb,
} = vi.hoisted(() => {
  const mockInsertValues = vi.fn();
  const mockUpdateSet = vi.fn();

  const mockTx = {
    select: vi.fn(),
    insert: vi.fn(() => ({
      values: mockInsertValues,
    })),
    update: vi.fn(() => ({
      set: mockUpdateSet,
    })),
  };

  const mockDb = {
    transaction: vi.fn(async (cb: any) => cb(mockTx)),
    select: vi.fn(),
  };

  return {
    mockInsertValues,
    mockUpdateSet,
    mockTx,
    mockDb,
  };
});

vi.mock("@/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/auth-session", () => ({
  getSessionUser: vi.fn(),
}));

import { claimGroupGhostMemberByToken } from "../groups";
import { getSessionUser } from "@/lib/auth-session";

function makeSessionUser(id: string) {
  return {
    id,
    email: `${id}@example.com`,
    name: `User ${id}`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("claimGroupGhostMemberByToken Server Action", () => {
  const mockGetSessionUser = vi.mocked(getSessionUser);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws Unauthorized if no session user is present", async () => {
    mockGetSessionUser.mockResolvedValueOnce(null);

    const res = await claimGroupGhostMemberByToken({ inviteToken: "token-123", targetUserId: "user-claimer" });
      expect(res.error).toBe("Unauthorized");
  });

  it("throws error if ghost member is not found for given inviteToken", async () => {
    mockGetSessionUser.mockResolvedValueOnce(makeSessionUser("user-claimer"));

    // 1. direct ghost query empty, 2. contact query empty, 3. group query empty
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          limit: vi.fn().mockResolvedValueOnce([]),
        }),
      }),
    });
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          limit: vi.fn().mockResolvedValueOnce([]),
        }),
      }),
    });
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          limit: vi.fn().mockResolvedValueOnce([]),
        }),
      }),
    });

    const res = await claimGroupGhostMemberByToken({ inviteToken: "invalid-token", targetUserId: "user-claimer" });
      expect(res.error).toBe("Ghost member not found or invalid invite token");
  });

  it("throws Forbidden error if session user does not match targetUserId", async () => {
    mockGetSessionUser.mockResolvedValueOnce(makeSessionUser("user-claimer"));

    const res = await claimGroupGhostMemberByToken({ inviteToken: "ghost-1", targetUserId: "user-victim" });
      expect(res.error).toBe("Forbidden: Cannot claim ghost member for another user");
  });

  it("throws error if target user profile is not found", async () => {
    mockGetSessionUser.mockResolvedValueOnce(makeSessionUser("non-existent-user"));

    const ghostMember = {
      id: "ghost-1",
      groupId: "g-1",
      userId: null,
      ghostName: "Ghost Bob",
    };

    // 1. ghost query found, 2. target user query empty
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          limit: vi.fn().mockResolvedValueOnce([ghostMember]),
        }),
      }),
    });
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          limit: vi.fn().mockResolvedValueOnce([]),
        }),
      }),
    });

    const res = await claimGroupGhostMemberByToken({ inviteToken: "ghost-1", targetUserId: "non-existent-user" });
      expect(res.error).toBe("Target user profile not found");
  });

  it("throws error if target user is already a member of the group", async () => {
    mockGetSessionUser.mockResolvedValueOnce(makeSessionUser("user-claimer"));

    const ghostMember = {
      id: "ghost-1",
      groupId: "g-1",
      userId: null,
      ghostName: "Ghost Bob",
    };

    // 1. ghost query found, 2. target user query found, 3. group query found, 4. existing member check found
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          limit: vi.fn().mockResolvedValueOnce([ghostMember]),
        }),
      }),
    });
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          limit: vi.fn().mockResolvedValueOnce([{ id: "user-claimer" }]),
        }),
      }),
    });
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          limit: vi.fn().mockResolvedValueOnce([{ id: "g-1", name: "Trip Group", createdBy: "user-admin" }]),
        }),
      }),
    });
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          limit: vi.fn().mockResolvedValueOnce([{ id: "gm-existing", userId: "user-claimer" }]),
        }),
      }),
    });

    const res = await claimGroupGhostMemberByToken({ inviteToken: "ghost-1", targetUserId: "user-claimer" });
      expect(res.error).toBe("User is already a member of this group");
  });

  it("successfully claims ghost member, updates splits and emits notifications to claimer and admin", async () => {
    mockGetSessionUser.mockResolvedValueOnce(makeSessionUser("user-claimer"));

    const ghostMember = {
      id: "ghost-1",
      groupId: "g-1",
      userId: null,
      ghostName: "Ghost Bob",
    };

    const group = {
      id: "g-1",
      name: "Ski Trip",
      createdBy: "user-admin",
    };

    // 1. ghost query found
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          limit: vi.fn().mockResolvedValueOnce([ghostMember]),
        }),
      }),
    });
    // 2. target user query found
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          limit: vi.fn().mockResolvedValueOnce([{ id: "user-claimer" }]),
        }),
      }),
    });
    // 3. group query found
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          limit: vi.fn().mockResolvedValueOnce([group]),
        }),
      }),
    });
    // 4. existing member check (empty)
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          limit: vi.fn().mockResolvedValueOnce([]),
        }),
      }),
    });

    mockUpdateSet.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    mockInsertValues.mockResolvedValue(undefined);

    const res = await claimGroupGhostMemberByToken({ inviteToken: "ghost-1", targetUserId: "user-claimer" });

    expect(mockDb.transaction).toHaveBeenCalled();
    expect(res).toEqual({
      success: true,
      groupId: "g-1",
      claimedMemberId: "ghost-1",
      targetUserId: "user-claimer",
    });

    // Check group_members update: set userId = "user-claimer", ghostName = null
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-claimer",
        ghostName: null,
      })
    );

    // Check transaction_splits update: set userId = "user-claimer"
    expect(mockUpdateSet).toHaveBeenCalledWith({
      userId: "user-claimer",
    });

    // Check transactions payer update: set payerId = "user-claimer"
    expect(mockUpdateSet).toHaveBeenCalledWith({
      payerId: "user-claimer",
    });

    // Check notifications inserted for claimer and group admin
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-claimer",
        type: "GHOST_CLAIMED",
      })
    );

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-admin",
        type: "GHOST_CLAIMED",
      })
    );
  });

  it("claims ghost member via contact invite token and only emits one notification if admin is claimer", async () => {
    mockGetSessionUser.mockResolvedValueOnce(makeSessionUser("user-admin"));

    const contact = {
      id: "c-1",
      name: "Ghost Charlie",
      inviteToken: "contact-token-abc",
    };

    const ghostMember = {
      id: "ghost-2",
      groupId: "g-1",
      userId: null,
      ghostName: "Ghost Charlie",
    };

    const group = {
      id: "g-1",
      name: "Office Lunch",
      createdBy: "user-admin",
    };

    // 1. direct ghost query empty
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          limit: vi.fn().mockResolvedValueOnce([]),
        }),
      }),
    });
    // 2. contact query found
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          limit: vi.fn().mockResolvedValueOnce([contact]),
        }),
      }),
    });
    // 3. ghost by contact name found
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          limit: vi.fn().mockResolvedValueOnce([ghostMember]),
        }),
      }),
    });
    // 4. target user found
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          limit: vi.fn().mockResolvedValueOnce([{ id: "user-admin" }]),
        }),
      }),
    });
    // 5. group query found
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          limit: vi.fn().mockResolvedValueOnce([group]),
        }),
      }),
    });
    // 6. existing member check (empty)
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          limit: vi.fn().mockResolvedValueOnce([]),
        }),
      }),
    });

    mockUpdateSet.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    mockInsertValues.mockResolvedValue(undefined);

    const res = await claimGroupGhostMemberByToken({ inviteToken: "contact-token-abc", targetUserId: "user-admin" });

    expect(res.success).toBe(true);
    // Notification inserted only once for claimer since admin === claimer
    expect(mockInsertValues).toHaveBeenCalledTimes(1);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-admin",
        type: "GHOST_CLAIMED",
      })
    );
  });
});
