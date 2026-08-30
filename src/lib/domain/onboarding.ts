import { db } from "@/db";
import * as schema from "@/db/schema";

export async function initializeNewUser(user: { id: string; name?: string | null; email?: string | null; image?: string | null }) {
  await db.transaction(async (tx) => {
    // 1. Profile
    await tx
      .insert(schema.profiles)
      .values({
        id: user.id,
        username: user.id,
        fullName: user.name || null,
        email: user.email || null,
        avatarUrl: user.image || null,
      })
      .onConflictDoNothing();

    // 2. Default Settings
    await tx
      .insert(schema.userSettings)
      .values({
        userId: user.id,
      })
      .onConflictDoNothing();

    // Default Business and Account seeding removed in favor of JIT Onboarding.

    // 5. Default Categories
    const defaultCategories = [
      { name: "Salary", type: "INCOME", icon: "wallet" },
      { name: "Food", type: "EXPENSE", icon: "utensils" },
      { name: "Transport", type: "EXPENSE", icon: "car" },
      { name: "Shopping", type: "EXPENSE", icon: "shopping-bag" },
      { name: "Utilities", type: "EXPENSE", icon: "zap" },
    ];
    
    await tx.insert(schema.categories).values(
      defaultCategories.map((c) => ({
        ...c,
        userId: user.id,
      }))
    );
  });
  console.log(`[AUDIT] Created profile and settings for new user (JIT Onboarding pending): ${user.id}`);
}
