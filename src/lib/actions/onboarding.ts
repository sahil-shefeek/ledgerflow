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

export async function getOnboardingStatus() {
  const user = await getAuthenticatedUser();
  const result = await db
    .select({
      globalOnboardingStatus: profiles.globalOnboardingStatus,
      modeSetupState: profiles.modeSetupState,
      username: profiles.username,
      fullName: profiles.fullName,
    })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  return result[0];
}

export async function completeGlobalOnboarding(data: {
  username: string;
  fullName: string;
  mode: "personal" | "business";
}) {
  const user = await getAuthenticatedUser();
  
  await db
    .update(profiles)
    .set({
      username: data.username,
      fullName: data.fullName,
      globalOnboardingStatus: "COMPLETED",
    })
    .where(eq(profiles.id, user.id));

  await db
    .insert(userSettings)
    .values({
      userId: user.id,
      defaultWorkspaceMode: data.mode,
    })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: {
        defaultWorkspaceMode: data.mode,
      }
    });

  return { success: true };
}

export async function completeModeSetup(mode: "personal" | "business", step: string, isCompleted: boolean) {
  const user = await getAuthenticatedUser();
  
  const profileRecord = await db.select({ modeSetupState: profiles.modeSetupState }).from(profiles).where(eq(profiles.id, user.id)).limit(1);
  const currentState = profileRecord[0]?.modeSetupState || {
    personal: { status: "PENDING", step: "bank-account" },
    business: { status: "PENDING", step: "business-name" }
  };

  const newState = {
    ...currentState,
    [mode]: {
      ...(currentState as any)[mode],
      step,
      status: isCompleted ? "COMPLETED" : (currentState as any)[mode]?.status || "PENDING"
    }
  };

  await db
    .update(profiles)
    .set({ modeSetupState: newState })
    .where(eq(profiles.id, user.id));

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
