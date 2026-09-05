"use server";

import { db } from "@/db";
import { groups, groupMembers, transactions, transactionSplits, profiles, contacts, notifications, user as userTable } from "@/db/schema";
import { eq, and, isNull, count, inArray } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth-session";
import { z } from "zod";
import { rpcAction, rpcActionWithAuth } from "@/lib/action-helpers";
import { createGroupSchema } from "@/lib/validations/group";
import { scanGhostMatchesForUser } from "@/lib/services/ghost-auto-matcher";

const GetGroupByInviteSchema = z.string();
export const getGroupByInviteAction = rpcAction(GetGroupByInviteSchema, async (inviteCode) => {
  const targetGroup = await db.select().from(groups).where(eq(groups.inviteCode, inviteCode)).limit(1);
  if (targetGroup.length === 0) return [];
  
  const group = targetGroup[0];
  
  const ghosts = await db.select({
    id: groupMembers.id,
    ghostName: groupMembers.ghostName,
    avatarUrl: groupMembers.avatarUrl
  }).from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, group.id),
        isNull(groupMembers.userId)
      )
    );
    
  return [{
    group_id: group.id,
    group_name: group.name,
    group_avatar_url: group.avatarUrl,
    ghost_members: ghosts.length > 0 ? ghosts.map(g => ({
      id: g.id,
      name: g.ghostName || "",
      avatar_url: g.avatarUrl ?? null
    })) : null
  }];
});

const JoinGroupSchema = z.object({ inviteCode: z.string(), claimGhostMemberId: z.string().nullable().optional() });
export const joinGroupAction = rpcActionWithAuth(JoinGroupSchema, async ({ inviteCode, claimGhostMemberId }, currentUser) => {
  const user = { id: currentUser.id };
  const userId = currentUser.id;
  
  return await db.transaction(async (tx) => {
    // 1. Validate Invite Code
    const targetGroup = await tx.select().from(groups).where(eq(groups.inviteCode, inviteCode)).limit(1);
    if (targetGroup.length === 0) {
      throw new Error("Invalid invite code");
    }
    const targetGroupId = targetGroup[0].id;
    
    // 2. Check if already a member
    const existingMember = await tx.select().from(groupMembers).where(
      and(
        eq(groupMembers.groupId, targetGroupId),
        eq(groupMembers.userId, userId)
      )
    ).limit(1);
    
    if (existingMember.length > 0) {
      return { success: true, message: "Already a member", group_id: targetGroupId };
    }
    
    // 3. Logic Branch: Claim Ghost vs Join New
    if (claimGhostMemberId) {
      const ghostMatch = await tx.select().from(groupMembers).where(
        and(
          eq(groupMembers.id, claimGhostMemberId),
          eq(groupMembers.groupId, targetGroupId),
          isNull(groupMembers.userId)
        )
      ).limit(1);
      
      if (ghostMatch.length === 0) {
        throw new Error("Ghost member not found or already claimed");
      }
      
      await tx.update(groupMembers)
        .set({ userId, ghostName: null, joinedAt: new Date() })
        .where(eq(groupMembers.id, claimGhostMemberId));
    } else {
      await tx.insert(groupMembers).values({
        groupId: targetGroupId,
        userId: userId,
      });
    }
    
    return { success: true, group_id: targetGroupId };
  });
});

const LinkGhostSchema = z.object({ groupId: z.string(), ghostMemberId: z.string(), friendUserId: z.string() });
export const linkGhostToFriendAction = rpcActionWithAuth(LinkGhostSchema, async ({ groupId, ghostMemberId, friendUserId }, currentUser) => {
  const user = { id: currentUser.id };
  
  const currentUserId = user.id;
  
  return await db.transaction(async (tx) => {
    // 1. Check Permissions (Must be Group Creator)
    const targetGroup = await tx.select().from(groups).where(eq(groups.id, groupId)).limit(1);
    if (targetGroup.length === 0) throw new Error("Group not found");
    if (targetGroup[0].createdBy !== currentUserId) {
      throw new Error("Only group admin can link members");
    }
    
    // 2. Check if Friend is ALREADY in the group
    const existingMember = await tx.select().from(groupMembers).where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, friendUserId)
      )
    ).limit(1);
    
    if (existingMember.length > 0) {
      throw new Error("This friend is already a member of the group. Cannot merge.");
    }
    
    // 3. Perform the Link
    const ghostMatch = await tx.select().from(groupMembers).where(
      and(
        eq(groupMembers.id, ghostMemberId),
        eq(groupMembers.groupId, groupId),
        isNull(groupMembers.userId)
      )
    ).limit(1);
    
    if (ghostMatch.length === 0) {
      throw new Error("Ghost member not found");
    }
    
    await tx.update(groupMembers)
      .set({ userId: friendUserId, ghostName: null, avatarUrl: null })
      .where(eq(groupMembers.id, ghostMemberId));
      
    return { success: true };
  });
});

export const createGroupAction = rpcActionWithAuth(createGroupSchema, async (data, currentUser) => {
  const userId = currentUser.id;

  return await db.transaction(async (tx) => {
    const [insertedGroup] = await tx
      .insert(groups)
      .values({
        name: data.name,
        type: data.type || "GENERAL",
        createdBy: userId,
      })
      .returning();

    const membersToAdd = [
      { groupId: insertedGroup.id, userId: userId },
      ...(data.members || []).map((m) => ({
        groupId: insertedGroup.id,
        userId: m.type === "REAL" ? m.id : null,
        ghostName: m.type === "GHOST" ? m.name : null,
      })),
    ];

    await tx.insert(groupMembers).values(membersToAdd);

    return {
      id: insertedGroup.id,
      name: insertedGroup.name,
      type: insertedGroup.type,
      createdBy: insertedGroup.createdBy,
      avatarUrl: insertedGroup.avatarUrl,
      inviteCode: insertedGroup.inviteCode,
      createdAt: insertedGroup.createdAt ? insertedGroup.createdAt.toISOString() : new Date().toISOString(),
    };
  });
});

async function assertGroupMember(groupId: string, userId: string) {
  const member = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);
  if (member.length === 0) {
    throw new Error("You are not a member of this group");
  }
}

const UpdateGroupSchema = z.object({ id: z.string(), name: z.string() });
export const updateGroupAction = rpcActionWithAuth(UpdateGroupSchema, async (data, currentUser) => {
  const user = { id: currentUser.id };
  
  await assertGroupMember(data.id, user.id);

  await db
    .update(groups)
    .set({ name: data.name })
    .where(eq(groups.id, data.id));

  return { success: true };
});

const DeleteGroupSchema = z.object({ id: z.string() });
export const deleteGroupAction = rpcActionWithAuth(DeleteGroupSchema, async (data, currentUser) => {
  const user = { id: currentUser.id };
  
  await assertGroupMember(data.id, user.id);

  await db.delete(groups).where(eq(groups.id, data.id));

  return { success: true };
});

const RemoveGroupMemberSchema = z.object({ groupId: z.string(), memberId: z.string() });
export const removeGroupMemberAction = rpcActionWithAuth(RemoveGroupMemberSchema, async (data, currentUser) => {
  const user = { id: currentUser.id };
  
  await assertGroupMember(data.groupId, user.id);

  await db.delete(groupMembers).where(
    and(
      eq(groupMembers.id, data.memberId),
      eq(groupMembers.groupId, data.groupId)
    )
  );

  return { success: true };
});

const GetGroupsSchema = z.any();
export const getGroupsAction = rpcActionWithAuth(GetGroupsSchema, async (_, currentUser) => {
  const user = { id: currentUser.id };
  

  const rows = await db
    .select({
      groups: groups,
    })
    .from(groupMembers)
    .innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .where(eq(groupMembers.userId, user.id));

  return rows.map((row) => ({
    id: row.groups.id,
    name: row.groups.name,
    type: row.groups.type,
    created_by: row.groups.createdBy,
    avatar_url: row.groups.avatarUrl,
    invite_code: row.groups.inviteCode,
    created_at: row.groups.createdAt ? row.groups.createdAt.toISOString() : new Date().toISOString(),
  }));
});

const GetGroupDetailsSchema = z.string();
export const getGroupDetailsAction = rpcActionWithAuth(GetGroupDetailsSchema, async (groupId, currentUser) => {
  const user = { id: currentUser.id };
  
  await assertGroupMember(groupId, user.id);

  const groupRows = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (groupRows.length === 0) throw new Error("Group not found");

  const group = groupRows[0];

  const memberRows = await db
    .select({
      member: groupMembers,
      profile: profiles,
    })
    .from(groupMembers)
    .leftJoin(profiles, eq(groupMembers.userId, profiles.id))
    .where(eq(groupMembers.groupId, groupId));

  const membersList = memberRows.map((r) => ({
    id: r.member.id,
    group_id: r.member.groupId,
    user_id: r.member.userId,
    ghost_name: r.member.ghostName,
    avatar_url: r.member.avatarUrl,
    joined_at: r.member.joinedAt ? r.member.joinedAt.toISOString() : new Date().toISOString(),
    profiles: r.profile
      ? {
          full_name: r.profile.fullName,
          avatar_url: r.profile.avatarUrl,
        }
      : undefined,
  }));

  return {
    group: {
      id: group.id,
      name: group.name,
      type: group.type,
      created_by: group.createdBy,
      avatar_url: group.avatarUrl,
      invite_code: group.inviteCode,
      created_at: group.createdAt ? group.createdAt.toISOString() : new Date().toISOString(),
    },
    members: membersList,
  };
});

const GetGroupBalancesSchema = z.string();
export const getGroupBalancesAction = rpcActionWithAuth(GetGroupBalancesSchema, async (groupId, currentUser) => {
  const user = { id: currentUser.id };
  
  await assertGroupMember(groupId, user.id);

  const membersList = await db
    .select({ id: groupMembers.id, userId: groupMembers.userId })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));

  const txns = await db
    .select({
      id: transactions.id,
      amount: transactions.amount,
      payerId: transactions.payerId,
      payerGroupMemberId: transactions.payerGroupMemberId,
    })
    .from(transactions)
    .where(eq(transactions.groupId, groupId));

  const balanceMap: Record<string, number> = {};
  for (const member of membersList) {
    balanceMap[member.id] = 0;
  }

  if (txns.length === 0) return balanceMap;

  const txnIds = txns.map((t) => t.id);
  const splits = await db
    .select({
      transactionId: transactionSplits.transactionId,
      groupMemberId: transactionSplits.groupMemberId,
      amount: transactionSplits.amount,
    })
    .from(transactionSplits)
    .where(inArray(transactionSplits.transactionId, txnIds));

  const splitsByTxn: Record<string, typeof splits> = {};
  for (const split of splits) {
    if (!split.transactionId) continue;
    if (!splitsByTxn[split.transactionId]) {
      splitsByTxn[split.transactionId] = [];
    }
    splitsByTxn[split.transactionId].push(split);
  }

  for (const txn of txns) {
    let payerMemberId: string | null = null;
    if (txn.payerGroupMemberId) {
      payerMemberId = txn.payerGroupMemberId;
    } else if (txn.payerId) {
      const match = membersList.find((m) => m.userId === txn.payerId);
      payerMemberId = match?.id || null;
    }

    const numAmount = Number(txn.amount);
    if (payerMemberId && balanceMap[payerMemberId] !== undefined) {
      balanceMap[payerMemberId] += numAmount;
    }

    const txnSplits = splitsByTxn[txn.id] || [];
    for (const split of txnSplits) {
      if (split.groupMemberId && balanceMap[split.groupMemberId] !== undefined) {
        balanceMap[split.groupMemberId] -= Number(split.amount);
      }
    }
  }

  for (const key of Object.keys(balanceMap)) {
    balanceMap[key] = Math.round(balanceMap[key] * 100) / 100;
  }

  return balanceMap;
});

const GetGroupTransactionCountSchema = z.string();
export const getGroupTransactionCountAction = rpcActionWithAuth(GetGroupTransactionCountSchema, async (groupId, currentUser) => {
  const user = { id: currentUser.id };
  
  await assertGroupMember(groupId, user.id);

  const [result] = await db
    .select({ count: count() })
    .from(transactions)
    .where(eq(transactions.groupId, groupId));

  return { count: result ? result.count : 0 };
});

const ClaimGroupGhostMemberSchema = z.object({ inviteToken: z.string(), targetUserId: z.string() });
export const claimGroupGhostMemberByToken = rpcActionWithAuth(ClaimGroupGhostMemberSchema, async ({ inviteToken, targetUserId }, currentUser) => {
  const sessionUser = { id: currentUser.id };
  
  if (sessionUser.id !== targetUserId) {
    throw new Error("Forbidden: Cannot claim ghost member for another user");
  }

  return await db.transaction(async (tx) => {
    // 1. Locate ghost member record associated with inviteToken
    let ghostMember: typeof groupMembers.$inferSelect | undefined;

    // Direct ghost member ID lookup
    const directGhostMatch = await tx
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.id, inviteToken), isNull(groupMembers.userId)))
      .limit(1);

    if (directGhostMatch.length > 0) {
      ghostMember = directGhostMatch[0];
    } else {
      // Look up contact by inviteToken
      const contactMatch = await tx
        .select()
        .from(contacts)
        .where(eq(contacts.inviteToken, inviteToken))
        .limit(1);

      if (contactMatch.length > 0) {
        const contact = contactMatch[0];
        const ghostByContact = await tx
          .select()
          .from(groupMembers)
          .where(and(eq(groupMembers.ghostName, contact.name), isNull(groupMembers.userId)))
          .limit(1);

        if (ghostByContact.length > 0) {
          ghostMember = ghostByContact[0];
        }
      } else {
        // Look up group by inviteCode
        const groupMatch = await tx
          .select()
          .from(groups)
          .where(eq(groups.inviteCode, inviteToken))
          .limit(1);

        if (groupMatch.length > 0) {
          const ghostByGroup = await tx
            .select()
            .from(groupMembers)
            .where(and(eq(groupMembers.groupId, groupMatch[0].id), isNull(groupMembers.userId)))
            .limit(1);

          if (ghostByGroup.length > 0) {
            ghostMember = ghostByGroup[0];
          }
        }
      }
    }

    if (!ghostMember) {
      throw new Error("Ghost member not found or invalid invite token");
    }

    // 2. Validate target user profile existence
    const targetUserRecords = await tx
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.id, targetUserId))
      .limit(1);

    if (targetUserRecords.length === 0) {
      throw new Error("Target user profile not found");
    }

    // 3. Retrieve group record
    if (!ghostMember.groupId) {
      throw new Error("Group not found");
    }

    const groupRecords = await tx
      .select()
      .from(groups)
      .where(eq(groups.id, ghostMember.groupId))
      .limit(1);

    if (groupRecords.length === 0) {
      throw new Error("Group not found");
    }
    const group = groupRecords[0];

    // Check if target user is already a full member in this group
    const existingMember = await tx
      .select()
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, group.id),
          eq(groupMembers.userId, targetUserId)
        )
      )
      .limit(1);

    if (existingMember.length > 0) {
      throw new Error("User is already a member of this group");
    }

    // 4. Upgrade ghost member to full member
    await tx
      .update(groupMembers)
      .set({
        userId: targetUserId,
        ghostName: null,
        joinedAt: new Date(),
      })
      .where(eq(groupMembers.id, ghostMember.id));

    // 5. Bulk re-assign transaction_splits.userId = targetUserId
    await tx
      .update(transactionSplits)
      .set({ userId: targetUserId })
      .where(eq(transactionSplits.groupMemberId, ghostMember.id));

    // Also re-assign transactions payerId if payerGroupMemberId matches
    await tx
      .update(transactions)
      .set({ payerId: targetUserId })
      .where(eq(transactions.payerGroupMemberId, ghostMember.id));

    // 6. In-app notifications
    await tx.insert(notifications).values({
      userId: targetUserId,
      type: "GHOST_CLAIMED",
      title: "Group Member Claimed",
      message: `You have claimed your member slot in group '${group.name}'.`,
      data: {
        groupId: group.id,
        ghostMemberId: ghostMember.id,
        inviteToken,
      },
    });

    if (group.createdBy && group.createdBy !== targetUserId) {
      await tx.insert(notifications).values({
        userId: group.createdBy,
        type: "GHOST_CLAIMED",
        title: "Ghost Member Claimed",
        message: `A ghost member in '${group.name}' was claimed by a user.`,
        data: {
          groupId: group.id,
          ghostMemberId: ghostMember.id,
          targetUserId,
          inviteToken,
        },
      });
    }

    return {
      success: true,
      groupId: group.id,
      claimedMemberId: ghostMember.id,
      targetUserId,
    };
  });
});

const RequestGroupGhostMergeSchema = z.object({ groupId: z.string(), ghostMemberId: z.string(), targetUserId: z.string() });
export const requestGroupGhostMerge = rpcActionWithAuth(RequestGroupGhostMergeSchema, async ({ groupId, ghostMemberId, targetUserId }, currentUser) => {
  const sessionUser = { id: currentUser.id };


  

  // 1. Target user profile check
  const targetUserRecords = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.id, targetUserId))
    .limit(1);

  if (targetUserRecords.length === 0) {
    throw new Error("Target user profile not found");
  }

  // 2. Group check
  const groupRecords = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  if (groupRecords.length === 0) {
    throw new Error("Group not found");
  }
  const group = groupRecords[0];
  if (!group.createdBy) {
    throw new Error("Group has no admin");
  }

  // 3. Ghost member check
  const ghostMemberRecords = await db
    .select()
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.id, ghostMemberId),
        eq(groupMembers.groupId, groupId),
        isNull(groupMembers.userId)
      )
    )
    .limit(1);

  if (ghostMemberRecords.length === 0) {
    throw new Error("Ghost member not found");
  }
  const ghostMember = ghostMemberRecords[0];

  // 4. Target user already member check
  const existingMember = await db
    .select()
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, targetUserId)
      )
    )
    .limit(1);

  if (existingMember.length > 0) {
    throw new Error("User is already a member of this group");
  }

  // 5. Create merge request notification to group admin (group.createdBy)
  const insertedNotificationResults = await db
    .insert(notifications)
    .values({
      userId: group.createdBy,
      type: "GROUP_GHOST_MERGE_REQUEST",
      title: "Group Ghost Member Merge Request",
      message: `Request to merge ghost member '${ghostMember.ghostName || "Ghost"}' with user profile in '${group.name}'.`,
      data: {
        groupId: group.id,
        ghostMemberId: ghostMember.id,
        targetUserId,
        requestingUserId: sessionUser.id,
        status: "PENDING",
      },
    })
    .returning();

  const insertedNotification = insertedNotificationResults[0];

  // Audit notification to requesting user if different from admin
  if (sessionUser.id !== group.createdBy) {
    await db.insert(notifications).values({
      userId: sessionUser.id,
      type: "GROUP_GHOST_MERGE_REQUEST_SENT",
      title: "Merge Request Sent",
      message: `Your request to join group '${group.name}' as ghost member '${ghostMember.ghostName || "Ghost"}' has been sent to the group admin.`,
      data: {
        groupId: group.id,
        ghostMemberId: ghostMember.id,
        targetUserId,
        requestId: insertedNotification ? insertedNotification.id : undefined,
      },
    });
  }

  return {
    success: true,
    requestId: insertedNotification ? insertedNotification.id : undefined,
    groupId: group.id,
  };
});

const ApproveGroupGhostMergeSchema = z.string();
export const approveGroupGhostMerge = rpcActionWithAuth(ApproveGroupGhostMergeSchema, async (requestId, currentUser) => {
  const sessionUser = { id: currentUser.id };
  

  // 1. Fetch merge request notification
  const requestRecords = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, requestId))
    .limit(1);

  if (requestRecords.length === 0) {
    throw new Error("Merge request not found");
  }
  const requestNotif = requestRecords[0];

  if (requestNotif.type !== "GROUP_GHOST_MERGE_REQUEST") {
    throw new Error("Invalid merge request");
  }

  const reqData = (requestNotif.data || {}) as Record<string, any>;
  if (reqData.status !== "PENDING") {
    throw new Error("Merge request has already been processed");
  }

  const { groupId, ghostMemberId, targetUserId } = reqData;

  // 2. Fetch group to verify admin caller
  const groupRecords = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  if (groupRecords.length === 0) {
    throw new Error("Group not found");
  }
  const group = groupRecords[0];

  if (group.createdBy !== sessionUser.id) {
    throw new Error("Forbidden: Only group admin can approve merge requests");
  }

  return await db.transaction(async (tx) => {
    // 3. Verify ghost member exists and unclaimed
    const ghostMatch = await tx
      .select()
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.id, ghostMemberId),
          eq(groupMembers.groupId, groupId),
          isNull(groupMembers.userId)
        )
      )
      .limit(1);

    if (ghostMatch.length === 0) {
      throw new Error("Ghost member not found or already claimed");
    }

    // 4. Verify target user is not already full member
    const existingMember = await tx
      .select()
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, targetUserId)
        )
      )
      .limit(1);

    if (existingMember.length > 0) {
      throw new Error("Target user is already a member of this group");
    }

    // 5. Upgrade group member slot
    await tx
      .update(groupMembers)
      .set({
        userId: targetUserId,
        ghostName: null,
        joinedAt: new Date(),
      })
      .where(eq(groupMembers.id, ghostMemberId));

    // 6. Re-assign transaction splits and transactions payer
    await tx
      .update(transactionSplits)
      .set({ userId: targetUserId })
      .where(eq(transactionSplits.groupMemberId, ghostMemberId));

    await tx
      .update(transactions)
      .set({ payerId: targetUserId })
      .where(eq(transactions.payerGroupMemberId, ghostMemberId));

    // 7. Update request notification status
    await tx
      .update(notifications)
      .set({
        data: {
          ...reqData,
          status: "APPROVED",
          approvedAt: new Date().toISOString(),
        },
        isRead: true,
      })
      .where(eq(notifications.id, requestId));

    // 8. Audit notifications
    await tx.insert(notifications).values({
      userId: targetUserId,
      type: "GROUP_GHOST_MERGE_APPROVED",
      title: "Merge Request Approved",
      message: `Your request to merge ghost member in '${group.name}' has been approved by the admin.`,
      data: {
        groupId: group.id,
        ghostMemberId,
        targetUserId,
        requestId,
      },
    });

    if (group.createdBy !== targetUserId) {
      await tx.insert(notifications).values({
        userId: group.createdBy,
        type: "GROUP_GHOST_MERGE_APPROVED",
        title: "Merge Request Approved",
        message: `You approved the ghost merge request in '${group.name}'.`,
        data: {
          groupId: group.id,
          ghostMemberId,
          targetUserId,
          requestId,
        },
      });
    }

    return {
      success: true,
      requestId,
      groupId: group.id,
      claimedMemberId: ghostMemberId,
      targetUserId,
    };
  });
});

const RejectGroupGhostMergeSchema = z.string();
export const rejectGroupGhostMerge = rpcActionWithAuth(RejectGroupGhostMergeSchema, async (requestId, currentUser) => {
  const sessionUser = { id: currentUser.id };
  

  // 1. Fetch merge request notification
  const requestRecords = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, requestId))
    .limit(1);

  if (requestRecords.length === 0) {
    throw new Error("Merge request not found");
  }
  const requestNotif = requestRecords[0];

  if (requestNotif.type !== "GROUP_GHOST_MERGE_REQUEST") {
    throw new Error("Invalid merge request");
  }

  const reqData = (requestNotif.data || {}) as Record<string, any>;
  const { groupId, ghostMemberId, targetUserId } = reqData;

  // 2. Fetch group to verify admin caller authorization
  const groupRecords = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  if (groupRecords.length === 0) {
    throw new Error("Group not found");
  }
  const group = groupRecords[0];

  if (group.createdBy !== sessionUser.id) {
    throw new Error("Forbidden: Only group admin can reject merge requests");
  }

  // 3. Idempotent check for status
  if (reqData.status === "REJECTED") {
    return {
      success: true,
      requestId,
      status: "REJECTED",
    };
  }

  if (reqData.status !== "PENDING") {
    throw new Error("Merge request has already been processed");
  }

  return await db.transaction(async (tx) => {
    // Update request notification status to REJECTED (group member data is untouched)
    await tx
      .update(notifications)
      .set({
        data: {
          ...reqData,
          status: "REJECTED",
          rejectedAt: new Date().toISOString(),
        },
        isRead: true,
      })
      .where(eq(notifications.id, requestId));

    // Audit notification to requesting target user
    await tx.insert(notifications).values({
      userId: targetUserId,
      type: "GROUP_GHOST_MERGE_REJECTED",
      title: "Merge Request Rejected",
      message: `Your request to merge ghost member in '${group.name}' was rejected by the admin.`,
      data: {
        groupId: group.id,
        ghostMemberId,
        targetUserId,
        requestId,
      },
    });

    if (group.createdBy !== targetUserId) {
      await tx.insert(notifications).values({
        userId: group.createdBy,
        type: "GROUP_GHOST_MERGE_REJECTED",
        title: "Merge Request Rejected",
        message: `You rejected the ghost merge request in '${group.name}'.`,
        data: {
          groupId: group.id,
          ghostMemberId,
          targetUserId,
          requestId,
        },
      });
    }

    return {
      success: true,
      requestId,
      status: "REJECTED",
    };
  });
});

const TriggerGhostAutoMatchingSchema = z.any();
export const triggerGhostAutoMatchingAction = rpcActionWithAuth(TriggerGhostAutoMatchingSchema, async (_, currentUser) => {
  const sessionUser = { id: currentUser.id };
  
  return await scanGhostMatchesForUser(sessionUser.id);
});



