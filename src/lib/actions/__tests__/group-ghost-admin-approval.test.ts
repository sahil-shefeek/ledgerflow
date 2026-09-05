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
    insert: vi.fn(() => ({
      values: mockInsertValues,
    })),
    update: vi.fn(() => ({
      set: mockUpdateSet,
    })),
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

import {
  requestGroupGhostMerge,
  approveGroupGhostMerge,
  rejectGroupGhostMerge,
} from "../groups";
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

function mockTxQuerySequence(...results: any[][]) {
  results.forEach((data) => {
    mockTx.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          limit: vi.fn().mockResolvedValueOnce(data),
        }),
      }),
    });
  });
}

function mockDbQuerySequence(...results: any[][]) {
  results.forEach((data) => {
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          limit: vi.fn().mockResolvedValueOnce(data),
        }),
      }),
    });
  });
}

describe("Group Ghost Admin Approval Workflow Server Actions", () => {
  const mockGetSessionUser = vi.mocked(getSessionUser);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("requestGroupGhostMerge", () => {
    it("throws Unauthorized if no session user is present", async () => {
      mockGetSessionUser.mockResolvedValueOnce(null);

      const res = await requestGroupGhostMerge({ groupId: "g-1", ghostMemberId: "ghost-1", targetUserId: "user-target" });
      expect(res.error).toBe("Unauthorized");
    });

    it("throws error if target user profile is not found", async () => {
      mockGetSessionUser.mockResolvedValueOnce(makeSessionUser("user-target"));
      mockDbQuerySequence([]); // target user not found

      const res = await requestGroupGhostMerge({ groupId: "g-1", ghostMemberId: "ghost-1", targetUserId: "user-target" });
      expect(res.error).toBe("Target user profile not found");
    });

    it("throws error if group is not found", async () => {
      mockGetSessionUser.mockResolvedValueOnce(makeSessionUser("user-target"));
      mockDbQuerySequence(
        [{ id: "user-target" }], // target user found
        [] // group empty
      );

      const res = await requestGroupGhostMerge({ groupId: "g-1", ghostMemberId: "ghost-1", targetUserId: "user-target" });
      expect(res.error).toBe("Group not found");
    });

    it("throws error if ghost member is not found in group", async () => {
      mockGetSessionUser.mockResolvedValueOnce(makeSessionUser("user-target"));
      mockDbQuerySequence(
        [{ id: "user-target" }],
        [{ id: "g-1", name: "Trip Group", createdBy: "user-admin" }],
        [] // ghost member empty
      );

      const res = await requestGroupGhostMerge({ groupId: "g-1", ghostMemberId: "ghost-1", targetUserId: "user-target" });
      expect(res.error).toBe("Ghost member not found");
    });

    it("throws error if target user is already a member of the group", async () => {
      mockGetSessionUser.mockResolvedValueOnce(makeSessionUser("user-target"));
      mockDbQuerySequence(
        [{ id: "user-target" }],
        [{ id: "g-1", name: "Trip Group", createdBy: "user-admin" }],
        [{ id: "ghost-1", groupId: "g-1", userId: null, ghostName: "Ghost Bob" }],
        [{ id: "gm-existing", userId: "user-target" }] // target user already member
      );

      const res = await requestGroupGhostMerge({ groupId: "g-1", ghostMemberId: "ghost-1", targetUserId: "user-target" });
      expect(res.error).toBe("User is already a member of this group");
    });

    it("successfully dispatches merge request notification to group admin", async () => {
      mockGetSessionUser.mockResolvedValueOnce(makeSessionUser("user-target"));

      mockDbQuerySequence(
        [{ id: "user-target" }],
        [{ id: "g-1", name: "Ski Trip", createdBy: "user-admin" }],
        [{ id: "ghost-1", groupId: "g-1", userId: null, ghostName: "Ghost Bob" }],
        [] // existing member empty
      );

      const insertedReqId = "req-123";
      mockInsertValues.mockReturnValueOnce({
        returning: vi.fn().mockResolvedValueOnce([{ id: insertedReqId }]),
      });
      mockInsertValues.mockResolvedValueOnce(undefined);

      const res = await requestGroupGhostMerge({ groupId: "g-1", ghostMemberId: "ghost-1", targetUserId: "user-target" });

      expect(res).toEqual({
        success: true,
        requestId: insertedReqId,
        groupId: "g-1",
      });

      // Notification sent to group admin
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-admin",
          type: "GROUP_GHOST_MERGE_REQUEST",
          data: expect.objectContaining({
            groupId: "g-1",
            ghostMemberId: "ghost-1",
            targetUserId: "user-target",
            status: "PENDING",
          }),
        })
      );
    });
  });

  describe("approveGroupGhostMerge", () => {
    it("throws Unauthorized if no session user is present", async () => {
      mockGetSessionUser.mockResolvedValueOnce(null);

      await expect(approveGroupGhostMerge("req-123")).rejects.toThrow(
        "Unauthorized"
      );
    });

    it("throws error if merge request notification is not found", async () => {
      mockGetSessionUser.mockResolvedValueOnce(makeSessionUser("user-admin"));
      mockDbQuerySequence([]); // request notification not found

      await expect(approveGroupGhostMerge("invalid-req")).rejects.toThrow(
        "Merge request not found"
      );
    });

    it("throws error if caller is not the group admin", async () => {
      mockGetSessionUser.mockResolvedValueOnce(makeSessionUser("user-non-admin"));

      const requestNotif = {
        id: "req-123",
        userId: "user-admin",
        type: "GROUP_GHOST_MERGE_REQUEST",
        data: {
          groupId: "g-1",
          ghostMemberId: "ghost-1",
          targetUserId: "user-target",
          status: "PENDING",
        },
      };

      mockDbQuerySequence(
        [requestNotif], // notification found
        [{ id: "g-1", createdBy: "user-admin", name: "Ski Trip" }] // group query
      );

      await expect(approveGroupGhostMerge("req-123")).rejects.toThrow(
        "Forbidden: Only group admin can approve merge requests"
      );
    });

    it("throws error if request is already processed", async () => {
      mockGetSessionUser.mockResolvedValueOnce(makeSessionUser("user-admin"));

      const requestNotif = {
        id: "req-123",
        userId: "user-admin",
        type: "GROUP_GHOST_MERGE_REQUEST",
        data: {
          groupId: "g-1",
          ghostMemberId: "ghost-1",
          targetUserId: "user-target",
          status: "APPROVED",
        },
      };

      mockDbQuerySequence([requestNotif]);

      await expect(approveGroupGhostMerge("req-123")).rejects.toThrow(
        "Merge request has already been processed"
      );
    });

    it("approves merge request, updates member and splits inside transaction, and emits audit notifications", async () => {
      mockGetSessionUser.mockResolvedValueOnce(makeSessionUser("user-admin"));

      const requestNotif = {
        id: "req-123",
        userId: "user-admin",
        type: "GROUP_GHOST_MERGE_REQUEST",
        data: {
          groupId: "g-1",
          ghostMemberId: "ghost-1",
          targetUserId: "user-target",
          status: "PENDING",
        },
      };

      const group = {
        id: "g-1",
        name: "Ski Trip",
        createdBy: "user-admin",
      };

      const ghostMember = {
        id: "ghost-1",
        groupId: "g-1",
        userId: null,
        ghostName: "Ghost Bob",
      };

      mockDbQuerySequence([requestNotif], [group]);

      // Transaction queries: 1. ghost member check, 2. existing member check (empty)
      mockTxQuerySequence([ghostMember], []);

      mockUpdateSet.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      mockInsertValues.mockResolvedValue(undefined);

      const res = await approveGroupGhostMerge("req-123");

      expect(mockDb.transaction).toHaveBeenCalled();
      expect(res).toEqual({
        success: true,
        requestId: "req-123",
        groupId: "g-1",
        claimedMemberId: "ghost-1",
        targetUserId: "user-target",
      });

      // Verify group_members updated
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-target",
          ghostName: null,
        })
      );

      // Verify transaction_splits updated
      expect(mockUpdateSet).toHaveBeenCalledWith({
        userId: "user-target",
      });

      // Verify request notification data updated
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "APPROVED",
          }),
          isRead: true,
        })
      );

      // Audit notifications inserted for requesting user and admin
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-target",
          type: "GROUP_GHOST_MERGE_APPROVED",
        })
      );
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-admin",
          type: "GROUP_GHOST_MERGE_APPROVED",
        })
      );
    });

    it("throws error if ghost member is not found or already claimed inside transaction", async () => {
      mockGetSessionUser.mockResolvedValueOnce(makeSessionUser("user-admin"));

      const requestNotif = {
        id: "req-123",
        userId: "user-admin",
        type: "GROUP_GHOST_MERGE_REQUEST",
        data: {
          groupId: "g-1",
          ghostMemberId: "ghost-1",
          targetUserId: "user-target",
          status: "PENDING",
        },
      };

      mockDbQuerySequence(
        [requestNotif],
        [{ id: "g-1", name: "Ski Trip", createdBy: "user-admin" }]
      );

      // Inside transaction: ghost member query returns empty (already claimed / not found)
      mockTxQuerySequence([]);

      await expect(approveGroupGhostMerge("req-123")).rejects.toThrow(
        "Ghost member not found or already claimed"
      );
    });

    it("throws error if target user is already a member of the group inside transaction", async () => {
      mockGetSessionUser.mockResolvedValueOnce(makeSessionUser("user-admin"));

      const requestNotif = {
        id: "req-123",
        userId: "user-admin",
        type: "GROUP_GHOST_MERGE_REQUEST",
        data: {
          groupId: "g-1",
          ghostMemberId: "ghost-1",
          targetUserId: "user-target",
          status: "PENDING",
        },
      };

      const ghostMember = {
        id: "ghost-1",
        groupId: "g-1",
        userId: null,
        ghostName: "Ghost Bob",
      };

      mockDbQuerySequence(
        [requestNotif],
        [{ id: "g-1", name: "Ski Trip", createdBy: "user-admin" }]
      );

      // Inside transaction: ghost member found, but target user already member
      mockTxQuerySequence([ghostMember], [{ id: "gm-existing", userId: "user-target" }]);

      await expect(approveGroupGhostMerge("req-123")).rejects.toThrow(
        "Target user is already a member of this group"
      );
    });
  });

  describe("rejectGroupGhostMerge", () => {
    it("throws Unauthorized if no session user is present", async () => {
      mockGetSessionUser.mockResolvedValueOnce(null);

      await expect(rejectGroupGhostMerge("req-123")).rejects.toThrow(
        "Unauthorized"
      );
    });

    it("throws error if caller is not group admin", async () => {
      mockGetSessionUser.mockResolvedValueOnce(makeSessionUser("user-impostor"));

      const requestNotif = {
        id: "req-123",
        userId: "user-admin",
        type: "GROUP_GHOST_MERGE_REQUEST",
        data: {
          groupId: "g-1",
          ghostMemberId: "ghost-1",
          targetUserId: "user-target",
          status: "PENDING",
        },
      };

      mockDbQuerySequence(
        [requestNotif],
        [{ id: "g-1", createdBy: "user-admin", name: "Beach Trip" }]
      );

      await expect(rejectGroupGhostMerge("req-123")).rejects.toThrow(
        "Forbidden: Only group admin can reject merge requests"
      );
    });

    it("rejects request, updates request status, and emits audit notification without altering group member state", async () => {
      mockGetSessionUser.mockResolvedValueOnce(makeSessionUser("user-admin"));

      const requestNotif = {
        id: "req-123",
        userId: "user-admin",
        type: "GROUP_GHOST_MERGE_REQUEST",
        data: {
          groupId: "g-1",
          ghostMemberId: "ghost-1",
          targetUserId: "user-target",
          status: "PENDING",
        },
      };

      const group = {
        id: "g-1",
        name: "Beach Trip",
        createdBy: "user-admin",
      };

      mockDbQuerySequence([requestNotif], [group]);

      mockUpdateSet.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      mockInsertValues.mockResolvedValue(undefined);

      const res = await rejectGroupGhostMerge("req-123");

      expect(res).toEqual({
        success: true,
        requestId: "req-123",
        status: "REJECTED",
      });

      // Group member table NOT updated with userId
      expect(mockUpdateSet).not.toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-target",
          ghostName: null,
        })
      );

      // Notification data updated to REJECTED
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "REJECTED",
          }),
          isRead: true,
        })
      );

      // Audit notification sent to requesting target user and admin
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-target",
          type: "GROUP_GHOST_MERGE_REJECTED",
        })
      );
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-admin",
          type: "GROUP_GHOST_MERGE_REJECTED",
        })
      );
    });

    it("handles already REJECTED merge requests idempotently", async () => {
      mockGetSessionUser.mockResolvedValueOnce(makeSessionUser("user-admin"));

      const requestNotif = {
        id: "req-123",
        userId: "user-admin",
        type: "GROUP_GHOST_MERGE_REQUEST",
        data: {
          groupId: "g-1",
          ghostMemberId: "ghost-1",
          targetUserId: "user-target",
          status: "REJECTED",
        },
      };

      const group = {
        id: "g-1",
        name: "Beach Trip",
        createdBy: "user-admin",
      };

      mockDbQuerySequence([requestNotif], [group]);

      const res = await rejectGroupGhostMerge("req-123");

      expect(res).toEqual({
        success: true,
        requestId: "req-123",
        status: "REJECTED",
      });

      // DB mutation methods not invoked on idempotent re-call
      expect(mockUpdateSet).not.toHaveBeenCalled();
      expect(mockInsertValues).not.toHaveBeenCalled();
    });

    it("throws error if merge request is not found", async () => {
      mockGetSessionUser.mockResolvedValueOnce(makeSessionUser("user-admin"));
      mockDbQuerySequence([]);

      await expect(rejectGroupGhostMerge("invalid-req")).rejects.toThrow(
        "Merge request not found"
      );
    });

    it("throws error if merge request type is invalid", async () => {
      mockGetSessionUser.mockResolvedValueOnce(makeSessionUser("user-admin"));
      mockDbQuerySequence([{ id: "req-123", type: "OTHER_NOTIFICATION" }]);

      await expect(rejectGroupGhostMerge("req-123")).rejects.toThrow(
        "Invalid merge request"
      );
    });

    it("throws error if merge request has already been approved", async () => {
      mockGetSessionUser.mockResolvedValueOnce(makeSessionUser("user-admin"));

      const requestNotif = {
        id: "req-123",
        userId: "user-admin",
        type: "GROUP_GHOST_MERGE_REQUEST",
        data: {
          groupId: "g-1",
          ghostMemberId: "ghost-1",
          targetUserId: "user-target",
          status: "APPROVED",
        },
      };

      const group = {
        id: "g-1",
        name: "Beach Trip",
        createdBy: "user-admin",
      };

      mockDbQuerySequence([requestNotif], [group]);

      await expect(rejectGroupGhostMerge("req-123")).rejects.toThrow(
        "Merge request has already been processed"
      );
    });
  });
});
