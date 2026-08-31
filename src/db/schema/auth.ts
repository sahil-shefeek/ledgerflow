import { pgTable, text, timestamp, boolean, uuid, integer, bigint, jsonb, pgEnum } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true, mode: "date" }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true, mode: "date" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }),
});

export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key"),
  count: integer("count"),
  lastRequest: bigint("last_request", { mode: "number" }),
});

export const onboardingStatusEnum = pgEnum("global_onboarding_status", ["PENDING", "COMPLETED"]);

export const profiles = pgTable("profiles", {
  id: text("id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  fullName: text("full_name"),
  businessName: text("business_name"),
  currencySymbol: text("currency_symbol").default("₹"),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  username: text("username").notNull().unique(),
  email: text("email"),
  discoverableByPhone: boolean("discoverable_by_phone").default(true),
  discoverableByUsername: boolean("discoverable_by_username").default(true),
  friendInviteToken: uuid("friend_invite_token").defaultRandom().unique(),
  globalOnboardingStatus: onboardingStatusEnum("global_onboarding_status").default("PENDING"),
  personalSetupStatus: onboardingStatusEnum("personal_setup_status").default("PENDING"),
  businessSetupStatus: onboardingStatusEnum("business_setup_status").default("PENDING"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
});

export const users = user;
export const sessions = session;
export const accountsAuth = account;
export const verifications = verification;
export const rateLimits = rateLimit;

