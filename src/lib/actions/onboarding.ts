"use server";

import { db } from "@/db";
import { profiles, userSettings } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

async function getAuthenticatedUser(reqHeaders?: Headers) {
  const h = reqHeaders ?? (await headers());
  const session = await auth.api.getSession({ headers: h });
  if (!session || !session.user) {
    throw new Error("Unauthorized");
  }
  return session.user;
}

export async function completeGlobalOnboarding(data: {
  username: string;
  fullName: string;
  mode: "personal" | "business";
  currency: string;
  accent: string;
}) {
  const user = await getAuthenticatedUser();
  
  await db
    .update(profiles)
    .set({
      username: data.username,
      fullName: data.fullName,
      currencySymbol: data.currency,
      globalOnboardingStatus: "COMPLETED",
    })
    .where(eq(profiles.id, user.id));

  await db
    .insert(userSettings)
    .values({
      userId: user.id,
      defaultWorkspaceMode: data.mode,
      personalAccent: data.accent,
      businessAccent: data.accent,
    })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: {
        defaultWorkspaceMode: data.mode,
        personalAccent: data.accent,
        businessAccent: data.accent,
      }
    });

  return { success: true };
}

export async function completeModeSetup(mode: "personal" | "business", step: string, isCompleted: boolean) {
  const user = await getAuthenticatedUser();
  const status = isCompleted ? "COMPLETED" : "PENDING";
  
  if (mode === "personal") {
    await db.update(profiles).set({ personalSetupStatus: status }).where(eq(profiles.id, user.id));
  } else {
    await db.update(profiles).set({ businessSetupStatus: status }).where(eq(profiles.id, user.id));
  }

  return { success: true };
}

export async function checkUsernameAvailability(username: string) {
  const user = await getAuthenticatedUser();
  const existing = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.username, username))
    .limit(1);
    
  if (existing.length === 0) return true;
  if (existing[0].id === user.id) return true;
  return false;
}
