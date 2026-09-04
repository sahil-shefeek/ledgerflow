import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockAuthSession } from "@/lib/__tests__/test-utils";

const { mockInsertValues, mockReturning, mockUpdateSet, mockDeleteWhere, mockTx, mockDb } =
  vi.hoisted(() => {
    const mockInsertValues = vi.fn();
    const mockReturning = vi.fn();
    const mockUpdateSet = vi.fn();
    const mockDeleteWhere = vi.fn();

    const mockQuery = {
      transactions: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      accounts: {
        findFirst: vi.fn(),
      },
      profiles: {
        findFirst: vi.fn().mockResolvedValue({ personalSetupStatus: 'COMPLETED', businessSetupStatus: 'COMPLETED' }),
      },
    };

    const mockTx = {
      insert: vi.fn(() => ({
        values: mockInsertValues,
      })),
      update: vi.fn(() => ({
        set: mockUpdateSet,
      })),
      delete: vi.fn(() => ({
        where: mockDeleteWhere,
      })),
      query: mockQuery,
    };

    const mockDb = {
      transaction: vi.fn(async (cb: any) => cb(mockTx)),
      query: mockQuery,
      update: vi.fn(() => ({
        set: mockUpdateSet,
      })),
      delete: vi.fn(() => ({
        where: mockDeleteWhere,
      })),
    };

    return {
      mockInsertValues,
      mockReturning,
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
  createTransactionAction,
  getTransactionsAction,
  getPersonalTransactionsAction,
  getUnifiedTransactionsAction,
  updateTransactionAction,
  deleteTransactionAction,
} from "../transactions";

describe("Transactions Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthSession({ id: "user-1" });
  });

  describe("createTransactionAction", () => {
    it("throws Unauthorized if no session user is found", async () => {
      mockAuthSession(null);
      await expect(
        createTransactionAction({
          amount: 5000,
          flow: "OUT",
          mode: "PERSONAL",
          name: "Lunch",
          date: new Date(),
        })
      ).resolves.toEqual({ error: "Unauthorized" });
    });

    it("creates transaction and splits atomically using Drizzle transaction", async () => {
      const mockCreatedTx = { id: "123e4567-e89b-12d3-a456-426614174000", name: "Lunch", amount: "5000" };
      mockInsertValues
        .mockReturnValueOnce({
          returning: vi.fn().mockResolvedValue([mockCreatedTx]),
        })
        .mockReturnValueOnce(Promise.resolve());

      const result = await createTransactionAction({
        amount: 5000,
        flow: "OUT",
        mode: "PERSONAL",
        name: "Lunch",
        date: new Date("2026-07-31"),
        splits: [
          {
            userId: "user-2",
            amount: 2500,
            memberNameSnapshot: "Bob",
          },
        ],
      });

      expect(mockDb.transaction).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        data: { id: "123e4567-e89b-12d3-a456-426614174000", transaction: mockCreatedTx }
      });
      expect(mockTx.insert).toHaveBeenCalledTimes(2);
    });

    it("deducts expense amount from account balance when accountId is specified", async () => {
      const mockCreatedTx = { id: "123e4567-e89b-12d3-a456-426614174000", name: "Groceries", amount: "3000", accountId: "acc-1" };
      mockInsertValues.mockReturnValueOnce({
        returning: vi.fn().mockResolvedValue([mockCreatedTx]),
      });

      mockUpdateSet.mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce([]),
      });

      await createTransactionAction({
        amount: 3000,
        flow: "OUT",
        mode: "PERSONAL",
        name: "Groceries",
        date: new Date(),
        accountId: "acc-1",
      });

      expect(mockUpdateSet).toHaveBeenCalledWith({ balance: expect.anything() });
    });
  });

  describe("getTransactionsAction", () => {
    it("throws Unauthorized if no user provided", async () => {
      mockAuthSession(null);
      await expect(getTransactionsAction({})).resolves.toEqual({ error: "Unauthorized" });
    });

    it("returns formatted transactions with joined relations", async () => {
      const mockTxData = [
        {
          id: "11111111-1111-4111-8111-111111111111",
          userId: "user-1",
          amount: "15000",
          flow: "OUT",
          mode: "PERSONAL",
          name: "Groceries",
          date: new Date("2026-07-31"),
          category: { name: "Food", icon: "🛒" },
          account: { name: "Cash", type: "CASH" },
          contact: null,
          group: null,
          payer: null,
          splits: [],
        },
      ];

      mockDb.query.transactions.findMany.mockResolvedValueOnce(mockTxData);

      const result = await getTransactionsAction({ mode: "PERSONAL" });

      expect(result.data).toHaveLength(1);
      expect(result.data![0].id).toBe("11111111-1111-4111-8111-111111111111");
      expect(result.data![0].amount).toBe(15000);
      expect(result.data![0].category?.name).toBe("Food");
    });
  });

  describe("getPersonalTransactionsAction", () => {
    it("queries personal transactions for the logged-in user", async () => {
      mockDb.query.transactions.findMany.mockResolvedValueOnce([
        {
          id: "tx-p1",
          userId: "user-1",
          amount: "2000",
          flow: "OUT",
          mode: "PERSONAL",
          name: "Coffee",
          date: new Date("2026-07-31"),
          category: { name: "Food", icon: "☕" },
          account: { name: "Wallet", type: "CASH" },
          contact: null,
          group: null,
        },
      ]);

      const result = await getPersonalTransactionsAction({});
      expect(result.data).toHaveLength(1);
      expect(result.data![0].name).toBe("Coffee");
      expect(result.data![0].amount).toBe(2000);
    });
  });

  describe("getUnifiedTransactionsAction", () => {
    it("fetches unified feed for user", async () => {
      mockDb.query.transactions.findMany.mockResolvedValueOnce([
        {
          id: "tx-u1",
          userId: "user-1",
          amount: "50000",
          flow: "IN",
          mode: "PERSONAL",
          name: "Salary",
          date: new Date("2026-07-31"),
          category: null,
          account: null,
          contact: null,
          group: null,
          payer: null,
          splits: [],
        },
      ]);

      const result = await getUnifiedTransactionsAction({});
      expect(result.data).toHaveLength(1);
      expect(result.data![0].amount).toBe(50000);
    });
  });

  describe("updateTransactionAction", () => {
    it("throws error if transaction does not exist or user is unauthorized", async () => {
      mockDb.query.transactions.findFirst.mockResolvedValueOnce(null);

      await expect(
        updateTransactionAction({
          id: "99999999-9999-4999-8999-999999999999",
          amount: 1000,
          flow: "OUT",
          mode: "PERSONAL",
          name: "Updated",
          date: new Date(),
        })
      ).resolves.toEqual({ error: "Transaction not found" });
    });

    it("updates transaction without account balance adjustment if no account linked", async () => {
      mockDb.query.transactions.findFirst.mockResolvedValueOnce({
        id: "11111111-1111-4111-8111-111111111111",
        userId: "user-1",
        amount: "1000",
        flow: "OUT",
        accountId: null,
      });

      const updatedRow = { id: "11111111-1111-4111-8111-111111111111", name: "Updated Name" };
      mockUpdateSet.mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([updatedRow]),
        }),
      });

      const result = await updateTransactionAction({
        id: "11111111-1111-4111-8111-111111111111",
        amount: 2000,
        flow: "OUT",
        mode: "PERSONAL",
        name: "Updated Name",
        date: new Date(),
      });

      expect(result).toEqual({ success: true, data: updatedRow });
    });

    it("calculates balance delta and updates account for expense amount increase", async () => {
      mockDb.query.transactions.findFirst.mockResolvedValueOnce({
        id: "11111111-1111-4111-8111-111111111111",
        userId: "user-1",
        amount: "2000",
        flow: "OUT",
        accountId: "acc-1",
      });

      const updatedRow = { id: "11111111-1111-4111-8111-111111111111", amount: "3000" };
      mockUpdateSet
        .mockReturnValueOnce({ where: vi.fn().mockResolvedValueOnce([]) }) // account update
        .mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            returning: vi.fn().mockResolvedValueOnce([updatedRow]),
          }),
        }); // transaction update

      const result = await updateTransactionAction({
        id: "11111111-1111-4111-8111-111111111111",
        amount: 3000,
        flow: "OUT",
        mode: "PERSONAL",
        name: "Dinner",
        date: new Date(),
        accountId: "acc-1",
      });

      expect(mockUpdateSet).toHaveBeenNthCalledWith(1, { balance: expect.anything() });
      expect(result).toEqual({ success: true, data: updatedRow });
    });

    it("calculates balance delta and updates account when switching flow from OUT to IN", async () => {
      mockDb.query.transactions.findFirst.mockResolvedValueOnce({
        id: "11111111-1111-4111-8111-111111111111",
        userId: "user-1",
        amount: "2000",
        flow: "OUT",
        accountId: "acc-1",
      });

      const updatedRow = { id: "11111111-1111-4111-8111-111111111111", flow: "IN", amount: "2000" };
      mockUpdateSet
        .mockReturnValueOnce({ where: vi.fn().mockResolvedValueOnce([]) })
        .mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            returning: vi.fn().mockResolvedValueOnce([updatedRow]),
          }),
        });

      await updateTransactionAction({
        id: "11111111-1111-4111-8111-111111111111",
        amount: 2000,
        flow: "IN",
        mode: "PERSONAL",
        name: "Refund",
        date: new Date(),
        accountId: "acc-1",
      });

      expect(mockUpdateSet).toHaveBeenNthCalledWith(1, { balance: expect.anything() });
    });

    it("reverts old account balance and updates new account balance when account is changed", async () => {
      mockDb.query.transactions.findFirst.mockResolvedValueOnce({
        id: "11111111-1111-4111-8111-111111111111",
        userId: "user-1",
        amount: "2000",
        flow: "OUT",
        accountId: "acc-old",
      });

      const updatedRow = { id: "11111111-1111-4111-8111-111111111111", accountId: "acc-new", amount: "2000" };
      mockUpdateSet
        .mockReturnValueOnce({ where: vi.fn().mockResolvedValueOnce([]) }) // old account update
        .mockReturnValueOnce({ where: vi.fn().mockResolvedValueOnce([]) }) // new account update
        .mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            returning: vi.fn().mockResolvedValueOnce([updatedRow]),
          }),
        }); // transaction update

      await updateTransactionAction({
        id: "11111111-1111-4111-8111-111111111111",
        amount: 2000,
        flow: "OUT",
        mode: "PERSONAL",
        name: "Moved expense",
        date: new Date(),
        accountId: "acc-new",
      });

      expect(mockUpdateSet).toHaveBeenNthCalledWith(1, { balance: expect.anything() });
      expect(mockUpdateSet).toHaveBeenNthCalledWith(2, { balance: expect.anything() });
    });
  });

  describe("deleteTransactionAction", () => {
    it("throws error if transaction does not exist or owned by another user", async () => {
      mockDb.query.transactions.findFirst.mockResolvedValueOnce(null);

      await expect(deleteTransactionAction("33333333-3333-4333-8333-333333333333")).resolves.toEqual({ error: "Transaction not found" });
    });

    it("soft-deletes transaction record using deleted_at and restores expense amount to account balance", async () => {
      mockDb.query.transactions.findFirst.mockResolvedValueOnce({
        id: "11111111-1111-4111-8111-111111111111",
        userId: "user-1",
        amount: "2000",
        flow: "OUT",
        accountId: "acc-1",
      });

      mockUpdateSet
        .mockReturnValueOnce({ where: vi.fn().mockResolvedValueOnce([]) }) // account balance update
        .mockReturnValueOnce({ where: vi.fn().mockResolvedValueOnce([]) }); // soft-delete transaction update

      const result = await deleteTransactionAction("11111111-1111-4111-8111-111111111111");

      expect(result).toEqual({ success: true, data: { success: true } });
      expect(mockUpdateSet).toHaveBeenNthCalledWith(1, { balance: expect.anything() });
      expect(mockUpdateSet).toHaveBeenNthCalledWith(2, expect.objectContaining({
        deletedAt: expect.any(Date),
      }));
    });

    it("soft-deletes transaction record using deleted_at and deducts income amount from account balance", async () => {
      mockDb.query.transactions.findFirst.mockResolvedValueOnce({
        id: "22222222-2222-4222-8222-222222222222",
        userId: "user-1",
        amount: "5000",
        flow: "IN",
        accountId: "acc-1",
      });

      mockUpdateSet
        .mockReturnValueOnce({ where: vi.fn().mockResolvedValueOnce([]) })
        .mockReturnValueOnce({ where: vi.fn().mockResolvedValueOnce([]) });

      const result = await deleteTransactionAction("22222222-2222-4222-8222-222222222222");

      expect(result).toEqual({ success: true, data: { success: true } });
      expect(mockUpdateSet).toHaveBeenNthCalledWith(1, { balance: expect.anything() });
      expect(mockUpdateSet).toHaveBeenNthCalledWith(2, expect.objectContaining({
        deletedAt: expect.any(Date),
      }));
    });
  });
});
