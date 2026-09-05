import { z } from "zod";

export const groupMemberSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Member name cannot be empty").max(50, "Member name is too long"),
  type: z.enum(["REAL", "GHOST"]),
  avatar_url: z.string().nullable().optional(),
});

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, "Group name cannot be empty").max(100, "Group name is too long"),
  type: z.enum(["GENERAL", "TRIP", "HOME", "COUPLE", "OTHER"]),
  members: z.array(groupMemberSchema).optional(),
});
