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
      personalSetupStatus: profiles.personalSetupStatus,
      businessSetupStatus: profiles.businessSetupStatus,
      personalSetupStep: profiles.personalSetupStep,
      businessSetupStep: profiles.businessSetupStep,
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
  
  const updateData: any = {};
  if (mode === "personal") {
    updateData.personalSetupStep = step;
    if (isCompleted) updateData.personalSetupStatus = "COMPLETED";
  } else {
    updateData.businessSetupStep = step;
    if (isCompleted) updateData.businessSetupStatus = "COMPLETED";
  }

  await db
    .update(profiles)
    .set(updateData)
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
