import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockInsertValues,
  mockUpdateSet,
  mockDeleteWhere,
  mockTx,
  mockDb,
} = vi.hoisted(() => {
  const mockInsertValues = vi.fn();
  const mockUpdateSet = vi.fn();
  const mockDeleteWhere = vi.fn();

  const mockTx = {
    select: vi.fn(),
    insert: vi.fn(() => ({
      values: mockInsertValues,
    })),
    update: vi.fn(() => ({
      set: mockUpdateSet,
    })),
    delete: vi.fn(() => ({
      where: mockDeleteWhere,
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
    delete: vi.fn(() => ({
      where: mockDeleteWhere,
    })),
    query: {
      groups: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      groupMembers: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      transactions: {
        findMany: vi.fn(),
      },
    },
  };

  return {
    mockInsertValues,
    mockUpdateSet,
    mockDeleteWhere,
    mockTx,
    mockDb,
  };
});

vi.mock("@/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

import {
  getGroupByInviteAction,
  joinGroupAction,
  linkGhostToFriendAction,
  createGroupAction,
  updateGroupAction,
  deleteGroupAction,
  removeGroupMemberAction,
  getGroupsAction,
  getGroupDetailsAction,
  getGroupBalancesAction,
  getGroupTransactionCountAction,
} from "../groups";
import { auth } from "@/lib/auth";
import { mockAuthSession } from "@/lib/__tests__/test-utils";

describe("Groups Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthSession({ id: "user-1" });
  });

  describe("getGroupByInviteAction", () => {
    it("returns empty array if no group matches invite code", async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([]),
          }),
        }),
      });

      const res = await getGroupByInviteAction("invalid-code");
      expect(res.data).toEqual([]);
    });

    it("returns group and ghost members for valid invite code", async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([
              { id: "g1", name: "Trip Group", avatarUrl: null },
            ]),
          }),
        }),
      });

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            { id: "gm1", ghostName: "Ghost User", avatarUrl: null },
          ]),
        }),
      });

      const res = await getGroupByInviteAction("valid-code");
      expect(res.data).toHaveLength(1);
      expect(res.data![0]).toEqual({
        group_id: "g1",
        group_name: "Trip Group",
        group_avatar_url: null,
        ghost_members: [{ id: "gm1", name: "Ghost User", avatar_url: null }],
      });
    });
  });

  describe("joinGroupAction", () => {
    it("throws Unauthorized if not logged in", async () => {
      (auth.api.getSession as any).mockResolvedValueOnce(null);
      const res = await joinGroupAction({ inviteCode: "code123" });
      expect(res.error).toBe("Unauthorized");
    });

    it("joins group as new member if not already member", async () => {
      (auth.api.getSession as any).mockResolvedValueOnce({
        user: { id: "user-1" },
      });

      // 1. target group lookup
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([{ id: "g1" }]),
          }),
        }),
      });

      // 2. existing member check
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([]),
          }),
        }),
      });

      // 3. insert new member
      mockInsertValues.mockResolvedValueOnce(undefined);

      const res = await joinGroupAction({ inviteCode: "code123", claimGhostMemberId: undefined });
      expect(res.data).toEqual({ success: true, group_id: "g1" });
    });

    it("returns existing status if already a member", async () => {
      (auth.api.getSession as any).mockResolvedValueOnce({
        user: { id: "user-1" },
      });

      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([{ id: "g1" }]),
          }),
        }),
      });

      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([{ id: "gm-existing" }]),
          }),
        }),
      });

      const res = await joinGroupAction({ inviteCode: "code123" });
      expect(res).toEqual({ success: true, message: "Already a member", group_id: "g1" });
    });

    it("claims ghost member if claimGhostMemberId is provided", async () => {
      (auth.api.getSession as any).mockResolvedValueOnce({
        user: { id: "user-1" },
      });

      // 1. group lookup
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([{ id: "g1" }]),
          }),
        }),
      });

      // 2. existing member check (empty)
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([]),
          }),
        }),
      });

      // 3. ghost member lookup (found)
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([{ id: "ghost-1", groupId: "g1", userId: null }]),
          }),
        }),
      });

      mockUpdateSet.mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce(undefined),
      });

      const res = await joinGroupAction({ inviteCode: "code123", claimGhostMemberId: "ghost-1" });
      expect(res.data).toEqual({ success: true, group_id: "g1" });
      expect(mockTx.update).toHaveBeenCalled();
    });
  });

  describe("linkGhostToFriendAction", () => {
    it("throws if group is not found", async () => {
      (auth.api.getSession as any).mockResolvedValueOnce({ user: { id: "user-1" } });
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([]),
          }),
        }),
      });

      const res = await linkGhostToFriendAction({ groupId: "g1", ghostMemberId: "ghost-1", friendUserId: "friend-1" });
      expect(res.error).toBe("Group not found");;
    });

    it("throws if user is not group admin", async () => {
      (auth.api.getSession as any).mockResolvedValueOnce({ user: { id: "user-2" } });
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([{ id: "g1", createdBy: "user-1" }]),
          }),
        }),
      });

      const res = await linkGhostToFriendAction({ groupId: "g1", ghostMemberId: "ghost-1", friendUserId: "friend-1" });
      expect(res.error).toBe("Only group admin can link members");;
    });

    it("throws if target friend is already a member", async () => {
      (auth.api.getSession as any).mockResolvedValueOnce({ user: { id: "user-1" } });
      // group lookup
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([{ id: "g1", createdBy: "user-1" }]),
          }),
        }),
      });
      // friend member lookup (found)
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([{ id: "gm-friend", userId: "friend-1" }]),
          }),
        }),
      });

      const res = await linkGhostToFriendAction({ groupId: "g1", ghostMemberId: "ghost-1", friendUserId: "friend-1" });
      expect(res.error).toBe("This friend is already a member of the group. Cannot merge.");;
    });

    it("links ghost member to friend successfully", async () => {
      (auth.api.getSession as any).mockResolvedValueOnce({ user: { id: "user-1" } });
      // group lookup
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([{ id: "g1", createdBy: "user-1" }]),
          }),
        }),
      });
      // friend member lookup (not found)
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([]),
          }),
        }),
      });
      // ghost match lookup (found)
      mockTx.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([{ id: "ghost-1", groupId: "g1", userId: null }]),
          }),
        }),
      });
      mockUpdateSet.mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce(undefined),
      });

      const res = await linkGhostToFriendAction({ groupId: "g1", ghostMemberId: "ghost-1", friendUserId: "friend-1" });
      expect(res.data).toEqual({ success: true });
      expect(mockTx.update).toHaveBeenCalled();
    });
  });

  describe("createGroupAction", () => {
    it("creates a group and inserts member records in a transaction", async () => {
      (auth.api.getSession as any).mockResolvedValueOnce({
        user: { id: "user-1" },
      });

      const newGroup = {
        id: "g-new",
        name: "Goa Vacation",
        type: "TRIP",
        createdBy: "user-1",
        avatarUrl: null,
        inviteCode: "inv-1",
        createdAt: new Date("2026-01-01"),
      };

      mockTx.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([newGroup]),
        }),
      });

      mockTx.insert.mockReturnValueOnce({
        values: mockInsertValues.mockResolvedValueOnce(undefined),
      });

      const res = await createGroupAction({
        name: "Goa Vacation",
        type: "TRIP",
        members: [{ name: "Alice", type: "GHOST" }],
      });

      expect(mockDb.transaction).toHaveBeenCalled();
      expect(res.data!.id).toBe("g-new");
      expect(res.data!.name).toBe("Goa Vacation");
    });
  });

  describe("updateGroupAction, deleteGroupAction, removeGroupMemberAction", () => {
    it("updates group name", async () => {
      // assertGroupMember check
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([{ id: "gm1" }]),
          }),
        }),
      });
      mockUpdateSet.mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce(undefined),
      });

      const res = await updateGroupAction({ id: "g1", name: "Updated Name" });
      expect(res.data).toEqual({ success: true });
    });

    it("deletes group", async () => {
      // assertGroupMember check
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([{ id: "gm1" }]),
          }),
        }),
      });
      mockDeleteWhere.mockResolvedValueOnce(undefined);

      const res = await deleteGroupAction({ id: "g1" });
      expect(res.data).toEqual({ success: true });
    });

    it("removes group member", async () => {
      // assertGroupMember check
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([{ id: "gm1" }]),
          }),
        }),
      });
      mockDeleteWhere.mockResolvedValueOnce(undefined);

      const res = await removeGroupMemberAction({ groupId: "g1", memberId: "gm1" });
      expect(res.data).toEqual({ success: true });
    });
  });

  describe("getGroupsAction", () => {
    it("returns user groups list", async () => {
      (auth.api.getSession as any).mockResolvedValueOnce({
        user: { id: "user-1" },
      });

      const mockGroupRows = [
        {
          groups: {
            id: "g1",
            name: "Flatmates",
            type: "HOME",
            avatarUrl: null,
            inviteCode: "inv-flat",
            createdAt: new Date("2026-01-01"),
          },
        },
      ];

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          innerJoin: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockResolvedValueOnce(mockGroupRows),
          }),
        }),
      });

      const groups = await getGroupsAction({});
      expect(groups.data).toHaveLength(1);
      expect(groups.data![0].name).toBe("Flatmates");
    });
  });

  describe("getGroupDetailsAction", () => {
    it("returns group details and member list with profiles", async () => {
      // assertGroupMember check
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([{ id: "gm1" }]),
          }),
        }),
      });

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([
              {
                id: "g1",
                name: "Trip",
                type: "TRIP",
                createdBy: "user-1",
                avatarUrl: null,
                inviteCode: "code",
                createdAt: new Date("2026-01-01"),
              },
            ]),
          }),
        }),
      });

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          leftJoin: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockResolvedValueOnce([
              {
                member: {
                  id: "gm1",
                  groupId: "g1",
                  userId: "user-1",
                  ghostName: null,
                  avatarUrl: null,
                  joinedAt: new Date("2026-01-01"),
                },
                profile: {
                  fullName: "User One",
                  avatarUrl: null,
                },
              },
            ]),
          }),
        }),
      });

      const details = await getGroupDetailsAction("g1");
      expect(details.data!.group.name).toBe("Trip");
      expect(details.data!.members).toHaveLength(1);
      expect(details.data!.members[0].profiles?.full_name).toBe("User One");
    });
  });

  describe("getGroupBalancesAction", () => {
    it("calculates member balances accurately from transactions and splits", async () => {
      // assertGroupMember check
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([{ id: "gm1" }]),
          }),
        }),
      });

      // member list
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            { id: "gm1", userId: "user-1" },
            { id: "gm2", userId: "user-2" },
          ]),
        }),
      });

      // transactions
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            {
              id: "t1",
              amount: "100",
              payerId: "user-1",
              payerGroupMemberId: "gm1",
            },
          ]),
        }),
      });

      // transaction splits
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([
            { transactionId: "t1", groupMemberId: "gm1", amount: "50" },
            { transactionId: "t1", groupMemberId: "gm2", amount: "50" },
          ]),
        }),
      });

      const balances = await getGroupBalancesAction("g1");
      expect(balances.data).toEqual({
        gm1: 50, // paid 100, split -50 = +50
        gm2: -50, // paid 0, split -50 = -50
      });
    });
  });

  describe("getGroupTransactionCountAction", () => {
    it("returns transaction count for group", async () => {
      // assertGroupMember check
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([{ id: "gm1" }]),
          }),
        }),
      });

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([{ count: 5 }]),
        }),
      });

      const res = await getGroupTransactionCountAction("g1");
      expect(res.data).toEqual({ count: 5 });
    });
  });
});

